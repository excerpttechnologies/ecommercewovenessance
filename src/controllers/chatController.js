const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Item = require("../models/Item");
const Order = require("../models/Order");
const Branch = require("../models/Branch");
const { CARD_FIELDS, toCard, LIVE_ITEM } = require("./storeController");

/**
 * Shop assistant.
 *
 * Deliberately NOT a language model. It matches the shopper's message against a
 * fixed set of intents and answers every one of them from this database — the
 * live catalogue, their own orders, the branch records. Nothing is generated or
 * guessed.
 *
 * That constraint is the point: an assistant that invents a delivery date or a
 * return window is worse than no assistant on a shop that takes money. Where the
 * data can't answer, it says so and offers the WhatsApp video call, which is a
 * real person.
 *
 * Everything it says about a saree — price, stock, fabric, return window — is
 * read at request time from the same fields the product page uses, so the two can
 * never disagree.
 */

/** Vocabulary is derived from the catalogue, not hard-coded, so it follows your data. */
const FACET_PATHS = {
  sareeType: "saree.sareeType",
  fabric: "saree.fabricType",
  colour: "color.primaryColor",
  occasion: "saree.occasion",
};

const MAX_CARDS = 4;


/**
 * Branch scope for the assistant.
 *
 * Ids MUST be cast to ObjectId, not left as the strings off the request:
 * priceBands() uses aggregate(), and Mongoose casts against the schema for
 * find() but hands an aggregation pipeline to MongoDB verbatim. Uncast, the
 * $match silently matched nothing and every price band vanished.
 */
function branchFilterFrom(raw) {
  const ids = String(raw || "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^[a-f\d]{24}$/i.test(v))
    .map((v) => new mongoose.Types.ObjectId(v));
  return ids.length > 0 ? { branch: { $in: ids } } : {};
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const rupees = (n) =>
  n == null ? "—" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

/**
 * The distinct values that actually exist for each facet, within the stores being
 * browsed. Used to recognise "kanjivaram" or "ruby red" in a message without a
 * hard-coded word list — add a new fabric in the admin and the assistant knows it.
 */
async function catalogueVocabulary(branchFilter) {
  const base = { ...LIVE_ITEM, ...branchFilter };
  const [types, fabrics, colours, occasions] = await Promise.all(
    Object.values(FACET_PATHS).map((path) => Item.distinct(path, base))
  );
  return {
    sareeType: types.filter(Boolean),
    fabric: fabrics.filter(Boolean),
    colour: colours.filter(Boolean),
    occasion: occasions.filter(Boolean),
  };
}

/**
 * Finds a catalogue value mentioned in the message.
 *
 * Tries the whole phrase first, then individual significant words — shoppers type
 * "cotton" when the catalogue says "Pure Cotton", and "kanjivaram" when it says
 * "Kanjivaram Silk". Without the second pass those messages matched nothing and
 * silently fell through to an unfiltered search.
 *
 * Words of three letters or fewer are ignored so "for" or "and" can't match.
 */
function matchVocabulary(message, values) {
  const lower = ` ${message.toLowerCase()} `;
  const sorted = [...values].sort((a, b) => String(b).length - String(a).length);

  const exact = sorted.find((value) => lower.includes(String(value).toLowerCase()));
  if (exact) return exact;

  for (const value of sorted) {
    const words = String(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3);
    if (words.some((w) => new RegExp(`\\b${escapeRegex(w)}\\b`).test(lower))) return value;
  }
  return null;
}

/** "under 5000", "below ₹10,000", "less than 3k" → a number. */
function extractMaxPrice(message) {
  const match = message
    .toLowerCase()
    .replace(/[,₹]/g, "")
    .match(/(?:under|below|less than|upto|up to|max|within)\s*(\d+(?:\.\d+)?)\s*(k|thousand)?/);
  if (!match) return null;
  const value = Number(match[1]);
  return match[2] ? value * 1000 : value;
}

function extractMinPrice(message) {
  const match = message
    .toLowerCase()
    .replace(/[,₹]/g, "")
    .match(/(?:above|over|more than|starting)\s*(\d+(?:\.\d+)?)\s*(k|thousand)?/);
  if (!match) return null;
  const value = Number(match[1]);
  return match[2] ? value * 1000 : value;
}

function extractOrderNumber(message) {
  const match = message.toUpperCase().match(/WE-[A-Z0-9]+-\d+/);
  return match ? match[0] : null;
}

/* ── intent detection ──────────────────────────────────────────────────────── */

const INTENT_RULES = [
  ["greeting", /^\s*(hi|hey|hello|hola|namaste|good (morning|afternoon|evening))\b/i],
  ["thanks", /\b(thanks|thank you|thankyou|dhanyavad)\b/i],
  ["order_status", /\b(order|track|tracking|shipped|dispatch|delivery status|where is my)\b/i],
  ["returns", /\b(return|refund|exchange|replace|cancel)\b/i],
  // Payment is checked BEFORE delivery: "cash on delivery" contains the word
  // delivery, and answering it with a shipping estimate misses the question.
  ["payment", /\b(pay|paying|payment|cod|cash on delivery|upi|card|netbanking|razorpay|emi)\b/i],
  ["delivery", /\b(deliver|delivery|shipping|ship|courier|how long|when will|arrive|days)\b/i],
  ["care", /\b(wash|care|iron|dry clean|maintain|storage)\b/i],
  ["store_info", /\b(store|shop|address|location|branch|visit|timing|open|phone|contact)\b/i],
  ["video_call", /\b(video call|whatsapp|live|show me live|call)\b/i],
  ["group_shopping", /\b(group|together|family|share.*cart|pin)\b/i],
  ["human", /\b(human|agent|person|someone|speak to|talk to)\b/i],
];

function detectIntent(message) {
  for (const [intent, pattern] of INTENT_RULES) {
    if (pattern.test(message)) return intent;
  }
  return "search"; // anything else is treated as a product hunt
}

/* ── answers, each built from real records ─────────────────────────────────── */

async function answerSearch(message, { branchFilter, vocabulary }) {
  const filter = { ...LIVE_ITEM, ...branchFilter };
  const described = [];

  for (const [key, path] of Object.entries(FACET_PATHS)) {
    const found = matchVocabulary(message, vocabulary[key]);
    if (found) {
      filter[path] = new RegExp(`^${escapeRegex(found)}$`, "i");
      described.push(found);
    }
  }

  const maxPrice = extractMaxPrice(message);
  const minPrice = extractMinPrice(message);
  if (maxPrice != null || minPrice != null) {
    filter["pricing.sellingPrice"] = {};
    if (maxPrice != null) filter["pricing.sellingPrice"].$lte = maxPrice;
    if (minPrice != null) filter["pricing.sellingPrice"].$gte = minPrice;
  }

  if (/\bhandloom\b/i.test(message)) {
    filter["saree.handloomStatus"] = "handloom";
    described.push("handloom");
  }
  if (/\b(in stock|available)\b/i.test(message)) filter["inventory.currentStock"] = { $gt: 0 };

  // Nothing recognised: fall back to a text search across name and description
  // rather than returning the whole catalogue.
  const recognisedSomething = described.length > 0 || maxPrice != null || minPrice != null;
  if (!recognisedSomething) {
    const words = message
      .split(/\s+/)
      .map((w) => w.replace(/[^\w]/g, ""))
      .filter((w) => w.length > 2)
      .slice(0, 4);
    if (words.length === 0) {
      return {
        text: "Tell me what you're after — a fabric, a colour, an occasion, or a budget. For example: \"red silk under 10000\".",
        quickReplies: await suggestionChips(vocabulary),
      };
    }
    filter.$or = words.flatMap((w) => {
      const rx = new RegExp(escapeRegex(w), "i");
      return [{ "identity.productName": rx }, { "saree.sareeType": rx }, { "color.primaryColor": rx }];
    });
  }

  const items = await Item.find(filter)
    .select(CARD_FIELDS)
    .populate("branch", "branchName address.city")
    .sort({ "salesIntelligence.totalViews": -1 })
    .limit(MAX_CARDS)
    .lean();

  const total = await Item.countDocuments(filter);

  if (items.length === 0) {
    return {
      text:
        `I couldn't find anything matching that${described.length ? ` (${described.join(", ")})` : ""}` +
        " in the stores you're browsing. Our stock moves quickly — ask on a video call and we'll show you what's on the shelf today.",
      quickReplies: await suggestionChips(vocabulary),
      showVideoCall: true,
    };
  }

  const label = described.length ? described.join(", ") : "your search";
  const priceNote =
    maxPrice != null ? ` under ${rupees(maxPrice)}` : minPrice != null ? ` above ${rupees(minPrice)}` : "";

  return {
    text:
      `Found ${total} saree${total === 1 ? "" : "s"} for ${label}${priceNote}. ` +
      (total > items.length ? `Here are ${items.length} to start with:` : "Here you go:"),
    products: items.map(toCard),
    quickReplies: [
      { label: "Only handloom", message: `handloom ${label}` },
      { label: "In stock now", message: `${label} in stock` },
      { label: "See all", action: "catalog" },
    ],
  };
}

/** Chips built from whatever the catalogue actually contains. */
async function suggestionChips(vocabulary) {
  const chips = [];
  if (vocabulary.sareeType[0]) chips.push({ label: vocabulary.sareeType[0], message: vocabulary.sareeType[0] });
  if (vocabulary.occasion[0]) chips.push({ label: `For ${vocabulary.occasion[0]}`, message: vocabulary.occasion[0] });
  if (vocabulary.colour[0]) chips.push({ label: vocabulary.colour[0], message: vocabulary.colour[0] });
  chips.push({ label: "Under ₹5,000", message: "sarees under 5000" });
  return chips.slice(0, 4);
}

async function answerOrderStatus(message, { customer }) {
  if (!customer) {
    return {
      text: "Sign in and I can look your order up — or give me the order number if you have it to hand.",
      quickReplies: [{ label: "Sign in", action: "signin" }],
    };
  }

  const orderNumber = extractOrderNumber(message);
  const query = orderNumber
    ? { orderNumber, customer: customer._id }
    : { customer: customer._id };

  const order = await Order.findOne(query).sort("-createdAt").lean();

  if (!order) {
    return {
      text: orderNumber
        ? `I can't find order ${orderNumber} on your account. Double-check the number, or ask us on WhatsApp.`
        : "You don't have any orders yet. Once you do, I can track them here.",
      showVideoCall: !!orderNumber,
    };
  }

  const s = order.shipment || {};
  const parts = [
    `Order ${order.orderNumber} is **${order.status.replace(/_/g, " ")}**.`,
    `Total ${rupees(order.amounts?.grandTotal)} — ${
      order.payment?.method === "cod" ? "cash on delivery" : "paid online"
    }.`,
  ];

  if (s.courierName && s.awbCode) parts.push(`${s.courierName}, tracking ${s.awbCode}.`);
  if (s.expectedDeliveryAt) parts.push(`Expected ${new Date(s.expectedDeliveryAt).toDateString()}.`);
  if (order.status === "delivered" && order.invoiceNumber) {
    parts.push(`Delivered — your invoice ${order.invoiceNumber} is on the order page.`);
  }

  return {
    text: parts.join(" "),
    quickReplies: [{ label: "Open order", action: "order", value: order.orderNumber }],
  };
}

/**
 * Returns and delivery are answered from the actual item records, not a policy
 * page — different sarees can carry different windows, and the product page is
 * already the source of truth for that.
 */
async function answerReturns(message, { branchFilter }) {
  const rows = await Item.find({ ...LIVE_ITEM, ...branchFilter })
    .select("returns.returnApplicable returns.returnWindow returns.exchangeWindow returns.exchangeApplicable")
    .limit(200)
    .lean();

  const windows = rows.map((r) => r.returns?.returnWindow).filter((n) => typeof n === "number" && n > 0);
  const anyNoReturn = rows.some((r) => r.returns?.returnApplicable === false);
  const exchanges = rows.map((r) => r.returns?.exchangeWindow).filter((n) => typeof n === "number" && n > 0);

  if (windows.length === 0 && exchanges.length === 0) {
    return {
      text: "Return terms are shown on each saree's page under Shipping & Returns. If it isn't listed for the piece you're looking at, ask us and we'll confirm before you buy.",
      showVideoCall: true,
    };
  }

  const min = Math.min(...windows);
  const max = Math.max(...windows);
  const range = min === max ? `${min} days` : `${min}–${max} days depending on the saree`;

  return {
    text:
      `Returns run ${range} from delivery` +
      (exchanges.length ? `, and exchanges up to ${Math.max(...exchanges)} days` : "") +
      `. ${anyNoReturn ? "A few pieces are final sale — that's stated on the product page. " : ""}` +
      "The exact window for any saree is on its page under Shipping & Returns.",
  };
}

async function answerDelivery(message, { branchFilter }) {
  const rows = await Item.find({ ...LIVE_ITEM, ...branchFilter })
    .select("shipping.estimatedDeliveryTime shipping.freeShipping shipping.codAvailable")
    .limit(200)
    .lean();

  const estimates = [...new Set(rows.map((r) => r.shipping?.estimatedDeliveryTime).filter(Boolean))];
  const anyFree = rows.some((r) => r.shipping?.freeShipping === true);
  const anyCod = rows.some((r) => r.shipping?.codAvailable !== false);

  const lines = [];
  if (estimates.length === 1) lines.push(`Delivery usually takes ${estimates[0]}.`);
  else if (estimates.length > 1) lines.push(`Delivery takes ${estimates.slice(0, 3).join(" or ")} depending on the saree.`);
  else lines.push("Delivery time is shown on each saree's page, and the exact charge is calculated at checkout.");

  if (anyFree) lines.push("Some pieces ship free — it's marked on the product page.");
  if (anyCod) lines.push("Cash on delivery is available.");
  lines.push("Once we hand your parcel to the courier you'll get the tracking number by email.");

  return { text: lines.join(" ") };
}

async function answerPayment() {
  return {
    text:
      "You can pay by UPI, card or netbanking through Razorpay at checkout, or choose cash on delivery. " +
      "Prices on the site include GST, and your invoice is available once the order is delivered.",
    quickReplies: [{ label: "See sarees", action: "catalog" }],
  };
}

async function answerCare(message, { branchFilter }) {
  const rows = await Item.find({ ...LIVE_ITEM, ...branchFilter, "care.washCare": { $nin: [null, ""] } })
    .select("care.washCare care.ironInstructions care.storageInstructions")
    .limit(50)
    .lean();

  if (rows.length === 0) {
    return {
      text: "Care instructions are listed on each saree's page under Product Details. Ask us about a specific piece and we'll tell you exactly how to look after it.",
      showVideoCall: true,
    };
  }

  const washes = [...new Set(rows.map((r) => r.care?.washCare).filter(Boolean))].slice(0, 3);
  const irons = [...new Set(rows.map((r) => r.care?.ironInstructions).filter(Boolean))].slice(0, 2);

  return {
    text:
      `Most of our sarees are ${washes.join(" or ").toLowerCase()}.` +
      (irons.length ? ` Ironing: ${irons.join("; ").toLowerCase()}.` : "") +
      " Each saree's page lists its own care instructions — worth checking for silk especially.",
  };
}

async function answerStoreInfo(message, { branches }) {
  if (branches.length === 0) {
    return {
      text: "Our store details aren't listed online just yet. Message us on WhatsApp and we'll share the address.",
      showVideoCall: true,
    };
  }

  const lines = branches.slice(0, 5).map((b) => {
    const address = [b.address?.line1, b.address?.city, b.address?.state, b.address?.pincode]
      .filter(Boolean)
      .join(", ");
    const phone = b.contact?.phone ? ` · ${b.contact.phone}` : "";
    return `**${b.branchName}** — ${address || "address on request"}${phone}`;
  });

  return {
    text: `We have ${branches.length} store${branches.length === 1 ? "" : "s"}:\n\n${lines.join("\n")}`,
    quickReplies: [{ label: "Shop online", action: "catalog" }],
  };
}

function answerGroupShopping() {
  return {
    text:
      "Group shopping lets you and your family fill one cart together. One of you starts a group, shares the pin, " +
      "and everyone adds the sarees they want — then you settle up either as a single payment or one each, to one delivery address.",
    quickReplies: [{ label: "Start a group", action: "group" }],
  };
}

function answerVideoCall() {
  return {
    text:
      "We'll show you any saree live on WhatsApp — the drape, the zari, the true colour. It's the closest thing to being in the shop.",
    showVideoCall: true,
  };
}

function answerHuman() {
  return {
    text: "Of course — our team answers on WhatsApp, and they can show you sarees on a video call while you talk.",
    showVideoCall: true,
  };
}

/* ── entry point ───────────────────────────────────────────────────────────── */

// POST /api/woven-essence/store/chat   { message, branch? }
const chat = asyncHandler(async (req, res) => {
  const message = String(req.body?.message || "").trim().slice(0, 500);

  if (!message) {
    res.status(400);
    throw new Error("Say something and I'll help");
  }

  // Scope to the stores the shopper is browsing, so nothing is offered that they
  // can't actually buy from where they are.
  const branchFilter = branchFilterFrom(req.body?.branch);

  const branches = await Branch.find({ isDeleted: { $ne: true }, status: "active" })
    .select("branchName address contact")
    .sort("branchName")
    .lean();

  const intent = detectIntent(message);
  const vocabulary = await catalogueVocabulary(branchFilter);
  const context = { branchFilter, vocabulary, customer: req.customer, branches };

  let reply;
  switch (intent) {
    case "greeting":
      reply = {
        text: "Hello! I can help you find a saree, check an order, or explain delivery and returns. What are you looking for?",
        quickReplies: await suggestionChips(vocabulary),
      };
      break;
    case "thanks":
      reply = { text: "Happy to help. Anything else you'd like to know?" };
      break;
    case "order_status":
      reply = await answerOrderStatus(message, context);
      break;
    case "returns":
      reply = await answerReturns(message, context);
      break;
    case "delivery":
      reply = await answerDelivery(message, context);
      break;
    case "payment":
      reply = await answerPayment();
      break;
    case "care":
      reply = await answerCare(message, context);
      break;
    case "store_info":
      reply = await answerStoreInfo(message, context);
      break;
    case "video_call":
      reply = answerVideoCall();
      break;
    case "group_shopping":
      reply = answerGroupShopping();
      break;
    case "human":
      reply = answerHuman();
      break;
    default:
      reply = await answerSearch(message, context);
  }

  res.json({
    success: true,
    data: {
      intent,
      text: reply.text,
      products: reply.products || [],
      quickReplies: reply.quickReplies || [],
      showVideoCall: !!reply.showVideoCall,
    },
  });
});

/** GET /api/woven-essence/store/chat/greeting — the opening message. */
const chatGreeting = asyncHandler(async (req, res) => {
  const vocabulary = await catalogueVocabulary(branchFilterFrom(req.query.branch));

  res.json({
    success: true,
    data: {
      text:
        (req.customer ? `Hello ${req.customer.name.split(" ")[0]}! ` : "Hello! ") +
        "Ask me about a saree, your order, delivery or returns.",
      quickReplies: [
        ...(await suggestionChips(vocabulary)),
        { label: "Track my order", message: "where is my order" },
      ].slice(0, 5),
    },
  });
});


/* ── guided menu ───────────────────────────────────────────────────────────────
   The assistant is menu-driven: the shopper taps options rather than typing.
   That suits a phone, and it means every question asked is one this database can
   actually answer — there is no free text to misunderstand.

   Every list of options is built from live data. The fabrics offered are the
   fabrics in stock; the price bands are derived from the real price range. A node
   with nothing behind it is never shown.
   ──────────────────────────────────────────────────────────────────────────── */

/** Price bands derived from what the catalogue actually costs. */
async function priceBands(branchFilter) {
  const [stats] = await Item.aggregate([
    { $match: { ...LIVE_ITEM, ...branchFilter, "pricing.sellingPrice": { $gt: 0 } } },
    { $group: { _id: null, min: { $min: "$pricing.sellingPrice" }, max: { $max: "$pricing.sellingPrice" } } },
  ]);
  if (!stats) return [];

  const { min, max } = stats;
  if (max <= min) return [{ label: `Around ${rupees(min)}`, min: 0, max: null }];

  // Three bands split on the real range, rounded to something a shopper reads
  // naturally rather than exact thirds.
  const round = (n) => {
    const step = n > 20000 ? 5000 : n > 5000 ? 1000 : 500;
    return Math.max(Math.round(n / step) * step, step);
  };
  const lower = round(min + (max - min) / 3);
  const upper = round(min + ((max - min) * 2) / 3);

  const bands = [{ label: `Under ${rupees(lower)}`, min: 0, max: lower }];
  if (upper > lower) bands.push({ label: `${rupees(lower)} – ${rupees(upper)}`, min: lower, max: upper });
  bands.push({ label: `Above ${rupees(upper > lower ? upper : lower)}`, min: upper > lower ? upper : lower, max: null });
  return bands;
}

/** Counts sarees behind a filter so an option that leads nowhere can be hidden. */
async function countFor(branchFilter, extra) {
  return Item.countDocuments({ ...LIVE_ITEM, ...branchFilter, ...extra });
}

/** Cards for a filter, newest and most-viewed first. */
async function cardsFor(branchFilter, extra, limit = MAX_CARDS) {
  const items = await Item.find({ ...LIVE_ITEM, ...branchFilter, ...extra })
    .select(CARD_FIELDS)
    .populate("branch", "branchName address.city")
    .sort({ "salesIntelligence.totalViews": -1, createdAt: -1 })
    .limit(limit)
    .lean();
  return items.map(toCard);
}

const HOME_OPTIONS = [
  { label: "Browse sarees", node: "browse" },
  { label: "Track my order", node: "orders" },
  { label: "Delivery & returns", node: "help" },
  { label: "Visit or call us", node: "contact" },
];

/**
 * Resolves a menu node into what to show.
 *
 * `node` is a plain string so the client stays dumb — it echoes back whatever the
 * server gave it and never constructs a query itself.
 */
async function resolveNode(node, { branchFilter, vocabulary, customer, branches }) {
  const [key, rawValue] = String(node || "home").split(":");
  const value = rawValue ? decodeURIComponent(rawValue) : null;

  switch (key) {
    case "home":
      return {
        text:
          (customer ? `Hello ${customer.name.split(" ")[0]}. ` : "Hello. ") +
          "What can I help you with?",
        options: HOME_OPTIONS,
      };

    /* ── browsing ── */
    case "browse": {
      const options = [];
      if (vocabulary.sareeType.length) options.push({ label: "By type of saree", node: "by_type" });
      if (vocabulary.fabric.length) options.push({ label: "By fabric", node: "by_fabric" });
      if (vocabulary.colour.length) options.push({ label: "By colour", node: "by_colour" });
      if (vocabulary.occasion.length) options.push({ label: "By occasion", node: "by_occasion" });
      options.push({ label: "By budget", node: "by_price" });

      if (await countFor(branchFilter, { "saree.handloomStatus": "handloom" })) {
        options.push({ label: "Handloom only", node: "list:handloom" });
      }
      options.push({ label: "Most popular", node: "list:popular" });

      return { text: "How would you like to look?", options, back: "home" };
    }

    case "by_type":
      return {
        text: "Which type?",
        options: vocabulary.sareeType.slice(0, 8).map((v) => ({
          label: v,
          node: `list:type:${encodeURIComponent(v)}`,
        })),
        back: "browse",
      };

    case "by_fabric":
      return {
        text: "Which fabric?",
        options: vocabulary.fabric.slice(0, 8).map((v) => ({
          label: v,
          node: `list:fabric:${encodeURIComponent(v)}`,
        })),
        back: "browse",
      };

    case "by_colour":
      return {
        text: "Which colour?",
        options: vocabulary.colour.slice(0, 10).map((v) => ({
          label: v,
          node: `list:colour:${encodeURIComponent(v)}`,
        })),
        back: "browse",
      };

    case "by_occasion":
      return {
        text: "What's the occasion?",
        options: vocabulary.occasion.slice(0, 8).map((v) => ({
          label: v,
          node: `list:occasion:${encodeURIComponent(v)}`,
        })),
        back: "browse",
      };

    case "by_price": {
      const bands = await priceBands(branchFilter);
      if (bands.length === 0) {
        return { text: "Nothing is priced online in these stores yet.", options: [], back: "browse", showVideoCall: true };
      }
      return {
        text: "What's your budget?",
        options: bands.map((b, i) => ({ label: b.label, node: `list:price:${i}` })),
        back: "browse",
      };
    }

    /* ── the actual listings ── */
    case "list": {
      const [kind, arg] = [rawValue, String(node).split(":").slice(2).join(":")];
      let extra = {};
      let described = "";

      if (kind === "handloom") {
        extra = { "saree.handloomStatus": "handloom" };
        described = "handloom sarees";
      } else if (kind === "popular") {
        described = "our most viewed sarees";
      } else if (kind === "price") {
        const bands = await priceBands(branchFilter);
        const band = bands[Number(arg)] || null;
        if (!band) return { text: "That budget isn't available.", options: [], back: "by_price" };
        extra = { "pricing.sellingPrice": { $gte: band.min, ...(band.max ? { $lte: band.max } : {}) } };
        described = `sarees ${band.label.toLowerCase()}`;
      } else {
        const pathByKind = {
          type: FACET_PATHS.sareeType,
          fabric: FACET_PATHS.fabric,
          colour: FACET_PATHS.colour,
          occasion: FACET_PATHS.occasion,
        };
        const path = pathByKind[kind];
        const decoded = decodeURIComponent(arg || "");
        if (!path || !decoded) return { text: "I didn't follow that.", options: HOME_OPTIONS, back: "home" };
        extra = { [path]: new RegExp(`^${escapeRegex(decoded)}$`, "i") };
        described = decoded;
      }

      const [cards, total] = await Promise.all([
        cardsFor(branchFilter, extra),
        countFor(branchFilter, extra),
      ]);

      if (total === 0) {
        return {
          text: `Nothing in ${described} right now. Our stock moves quickly — ask us on a video call and we'll show you what's on the shelf today.`,
          options: [{ label: "Look at something else", node: "browse" }],
          back: "browse",
          showVideoCall: true,
        };
      }

      return {
        text:
          `${total} saree${total === 1 ? "" : "s"} in ${described}` +
          (total > cards.length ? `. Here are ${cards.length}:` : ":"),
        products: cards,
        options: [
          { label: "See all on the site", action: "catalog" },
          { label: "Look at something else", node: "browse" },
        ],
        back: "browse",
      };
    }

    /* ── orders ── */
    case "orders": {
      if (!customer) {
        return {
          text: "Sign in and I'll show you your orders and where they are.",
          options: [{ label: "Sign in", action: "signin" }],
          back: "home",
        };
      }

      const orders = await Order.find({ customer: customer._id })
        .select("orderNumber status amounts.grandTotal payment.method shipment createdAt")
        .sort("-createdAt")
        .limit(5)
        .lean();

      if (orders.length === 0) {
        return {
          text: "You haven't placed an order yet.",
          options: [{ label: "Browse sarees", node: "browse" }],
          back: "home",
        };
      }

      return {
        text: "Which order?",
        options: orders.map((o) => ({
          label: `${o.orderNumber} — ${o.status.replace(/_/g, " ")}`,
          node: `order:${encodeURIComponent(o.orderNumber)}`,
        })),
        back: "home",
      };
    }

    case "order": {
      if (!customer) return { text: "Please sign in first.", options: [{ label: "Sign in", action: "signin" }], back: "home" };

      const order = await Order.findOne({ orderNumber: value, customer: customer._id }).lean();
      if (!order) return { text: "I can't find that order on your account.", options: [], back: "orders", showVideoCall: true };

      const s = order.shipment || {};
      const lines = [
        `Order ${order.orderNumber} is **${order.status.replace(/_/g, " ")}**.`,
        `Total ${rupees(order.amounts?.grandTotal)} — ${order.payment?.method === "cod" ? "cash on delivery" : "paid online"}.`,
      ];
      if (s.courierName && s.awbCode) lines.push(`${s.courierName}, tracking ${s.awbCode}.`);
      if (s.expectedDeliveryAt) lines.push(`Expected ${new Date(s.expectedDeliveryAt).toDateString()}.`);
      if (order.status === "delivered" && order.invoiceNumber) lines.push(`Invoice ${order.invoiceNumber} is on the order page.`);

      return {
        text: lines.join(" "),
        options: [
          { label: "Open this order", action: "order", value: order.orderNumber },
          { label: "Another order", node: "orders" },
        ],
        back: "orders",
      };
    }

    /* ── help ── */
    case "help":
      return {
        text: "What would you like to know?",
        options: [
          { label: "Delivery time", node: "delivery" },
          { label: "Returns & exchange", node: "returns" },
          { label: "Payment options", node: "payment" },
          { label: "Caring for a saree", node: "care" },
        ],
        back: "home",
      };

    case "delivery": {
      const answer = await answerDelivery("", { branchFilter });
      return { ...answer, options: [{ label: "Something else", node: "help" }], back: "help" };
    }
    case "returns": {
      const answer = await answerReturns("", { branchFilter });
      return { ...answer, options: [{ label: "Something else", node: "help" }], back: "help" };
    }
    case "payment": {
      const answer = await answerPayment();
      return { ...answer, options: [{ label: "Something else", node: "help" }], back: "help" };
    }
    case "care": {
      const answer = await answerCare("", { branchFilter });
      return { ...answer, options: [{ label: "Something else", node: "help" }], back: "help" };
    }

    /* ── contact ── */
    case "contact":
      return {
        text: "How would you like to reach us?",
        options: [
          { label: "Our stores", node: "stores" },
          { label: "Shop by video call", node: "video" },
          { label: "Shop with family", node: "group" },
        ],
        back: "home",
      };

    case "stores": {
      const answer = await answerStoreInfo("", { branches });
      return { ...answer, options: [{ label: "Back", node: "contact" }], back: "contact" };
    }
    case "video":
      return { ...answerVideoCall(), options: [{ label: "Back", node: "contact" }], back: "contact" };
    case "group":
      return {
        ...answerGroupShopping(),
        options: [{ label: "Start a group", action: "group" }, { label: "Back", node: "contact" }],
        back: "contact",
      };

    default:
      return { text: "Let's start again — what can I help with?", options: HOME_OPTIONS, back: null };
  }
}

// POST /api/woven-essence/store/chat/menu   { node, branch }
const chatMenu = asyncHandler(async (req, res) => {
  const branchFilter = branchFilterFrom(req.body?.branch);

  const [vocabulary, branches] = await Promise.all([
    catalogueVocabulary(branchFilter),
    Branch.find({ isDeleted: { $ne: true }, status: "active" })
      .select("branchName address contact")
      .sort("branchName")
      .lean(),
  ]);

  const reply = await resolveNode(req.body?.node, {
    branchFilter,
    vocabulary,
    customer: req.customer,
    branches,
  });

  res.json({
    success: true,
    data: {
      node: String(req.body?.node || "home"),
      text: reply.text,
      options: reply.options || [],
      products: reply.products || [],
      showVideoCall: !!reply.showVideoCall,
      back: reply.back ?? null,
    },
  });
});

module.exports = { chat, chatGreeting, chatMenu };
