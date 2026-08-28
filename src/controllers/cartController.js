// const asyncHandler = require("express-async-handler");
// const Cart = require("../models/Cart");
// const Wishlist = require("../models/Wishlist");
// const Item = require("../models/Item");
// const Branch = require("../models/Branch");
// const { productSlug } = require("../utils/storeSeo");

// /**
//  * Cart.
//  *
//  * Everything monetary is computed here from the live Item document. The client
//  * sends item ids and quantities and nothing else — no prices, no totals.
//  */

// /** The same visibility gate the storefront uses. An unbuyable saree can't be carted. */
// const LIVE_ITEM = {
//   isDeleted: { $ne: true },
//   status: "active",
//   lifecycleStage: "published",
//   "visibility.onlineSaleEnabled": { $ne: false },
// };

// const MAX_QTY_PER_LINE = 20;

// async function getOrCreateCart(customerId) {
//   let cart = await Cart.findOne({ customer: customerId });
//   if (!cart) cart = await Cart.create({ customer: customerId, lines: [] });
//   return cart;
// }

// /**
//  * Builds the cart the browser sees: each line priced from its Item, plus totals.
//  *
//  * Lines whose saree has since been unpublished, deleted or gone out of stock are
//  * kept and flagged rather than silently dropped — a cart that quietly loses an
//  * item is worse than one that explains why it can't be bought.
//  */
// async function buildCartView(cart) {
//   const ids = cart.lines.map((l) => l.item);

//   const items = await Item.find({ _id: { $in: ids } })
//     .select({
//       "identity.productName": 1, "identity.displayName": 1, "identity.itemCode": 1,
//       "saree.sareeType": 1, "saree.fabricType": 1, "color.primaryColor": 1,
//       "pricing.mrp": 1, "pricing.sellingPrice": 1, "pricing.currency": 1, "pricing.taxInclusive": 1,
//       "tax.gstRate": 1, "inventory.currentStock": 1, "inventory.unitOfMeasure": 1,
//       "seo.slug": 1, images: 1, branch: 1, status: 1, lifecycleStage: 1,
//       "visibility.onlineSaleEnabled": 1, isDeleted: 1,
//     })
//     .lean();

//   const byId = new Map(items.map((i) => [String(i._id), i]));

//   let subtotal = 0;
//   let mrpTotal = 0;
//   let taxTotal = 0;
//   let buyableCount = 0;

//   const lines = cart.lines.map((line) => {
//     const item = byId.get(String(line.item));

//     if (!item) {
//       return {
//         lineId: line._id,
//         itemId: line.item,
//         quantity: line.quantity,
//         available: false,
//         issue: "This saree is no longer listed",
//       };
//     }

//     const live =
//       item.isDeleted !== true &&
//       item.status === "active" &&
//       item.lifecycleStage === "published" &&
//       item.visibility?.onlineSaleEnabled !== false;

//     const stock = item.inventory?.currentStock || 0;
//     const sellingPrice = item.pricing?.sellingPrice ?? null;

//     let issue = null;
//     if (!live) issue = "This saree is no longer available";
//     else if (sellingPrice == null) issue = "Price on request — contact us to buy";
//     else if (stock <= 0) issue = "Sold out";
//     else if (line.quantity > stock) issue = `Only ${stock} left in stock`;

//     const quantity = Math.min(line.quantity, Math.max(stock, 1));
//     const available = !issue;

//     if (available) {
//       const gross = sellingPrice * quantity;
//       subtotal += gross;
//       mrpTotal += (item.pricing?.mrp ?? sellingPrice) * quantity;
//       buyableCount += quantity;

//       // Prices are stored tax-inclusive by default, so tax is extracted rather
//       // than added — otherwise the shopper would be charged GST twice.
//       const rate = item.tax?.gstRate || 0;
//       if (rate > 0) {
//         taxTotal += item.pricing?.taxInclusive === false
//           ? (gross * rate) / 100
//           : gross - gross / (1 + rate / 100);
//       }
//     }

//     const hero =
//       (item.images || []).find((i) => i.category === "Main Product Image") || (item.images || [])[0] || null;

//     return {
//       lineId: line._id,
//       itemId: item._id,
//       slug: item.seo?.slug || productSlug(item),
//       name: item.identity?.displayName || item.identity?.productName || "Saree",
//       itemCode: item.identity?.itemCode || "",
//       sareeType: item.saree?.sareeType || "",
//       fabric: item.saree?.fabricType || "",
//       colour: item.color?.primaryColor || "",
//       image: hero ? { url: hero.url, altText: hero.altText } : null,
//       unitPrice: sellingPrice,
//       mrp: item.pricing?.mrp ?? null,
//       currency: item.pricing?.currency || "INR",
//       gstRate: item.tax?.gstRate ?? null,
//       quantity,
//       lineTotal: available && sellingPrice != null ? sellingPrice * quantity : null,
//       stock,
//       unit: item.inventory?.unitOfMeasure || "pcs",
//       available,
//       issue,
//     };
//   });

//   const round = (n) => Math.round(n * 100) / 100;

//   return {
//     id: cart._id,
//     branch: cart.branch,
//     groupKey: cart.groupKey || null,
//     lines,
//     summary: {
//       lineCount: lines.length,
//       itemCount: buyableCount,
//       mrpTotal: round(mrpTotal),
//       subtotal: round(subtotal),
//       savings: round(Math.max(mrpTotal - subtotal, 0)),
//       taxIncluded: round(taxTotal),
//       // Shipping is quoted at checkout by Shiprocket, so it is deliberately
//       // absent here rather than guessed.
//       total: round(subtotal),
//       currency: lines.find((l) => l.currency)?.currency || "INR",
//     },
//     hasIssues: lines.some((l) => !l.available),
//   };
// }

// // GET /api/woven-essence/cart
// const getCart = asyncHandler(async (req, res) => {
//   const cart = await getOrCreateCart(req.customer._id);
//   res.json({ success: true, data: await buildCartView(cart) });
// });

// // POST /api/woven-essence/cart/items   { itemId, quantity? }
// const addToCart = asyncHandler(async (req, res) => {
//   const { itemId } = req.body;
//   const quantity = Math.min(Math.max(parseInt(req.body.quantity, 10) || 1, 1), MAX_QTY_PER_LINE);

//   if (!/^[a-f\d]{24}$/i.test(String(itemId || ""))) {
//     res.status(400);
//     throw new Error("Invalid product");
//   }

//   const item = await Item.findOne({ _id: itemId, ...LIVE_ITEM }).select(
//     "branch inventory.currentStock pricing.sellingPrice identity.productName"
//   );
//   if (!item) {
//     res.status(404);
//     throw new Error("This saree isn't available to buy");
//   }
//   if (item.pricing?.sellingPrice == null) {
//     res.status(409);
//     throw new Error("This saree is priced on request — please contact the store");
//   }

//   const stock = item.inventory?.currentStock || 0;
//   if (stock <= 0) {
//     res.status(409);
//     throw new Error("This saree is sold out");
//   }

//   const cart = await getOrCreateCart(req.customer._id);

//   // A cart belongs to one store, because an order is raised against one branch.
//   if (cart.branch && String(cart.branch) !== String(item.branch) && cart.lines.length > 0) {
//     const current = await Branch.findById(cart.branch).select("branchName address.city");
//     res.status(409);
//     throw new Error(
//       `Your cart holds sarees from ${current?.address?.city || current?.branchName || "another store"}. ` +
//         `Empty it first to shop from a different store.`
//     );
//   }

//   const existing = cart.lines.find((l) => String(l.item) === String(item._id));
//   const requested = (existing?.quantity || 0) + quantity;

//   if (requested > stock) {
//     res.status(409);
//     throw new Error(
//       existing
//         ? `You already have ${existing.quantity} of these, and only ${stock} are in stock`
//         : `Only ${stock} of these are in stock`
//     );
//   }

//   if (existing) existing.quantity = Math.min(requested, MAX_QTY_PER_LINE);
//   else cart.lines.push({ item: item._id, quantity });

//   cart.branch = item.branch;
//   await cart.save();

//   // Carting something implies it is no longer just "saved for later".
//   await Wishlist.updateOne({ customer: req.customer._id }, { $pull: { entries: { item: item._id } } });

//   res.status(201).json({ success: true, data: await buildCartView(cart) });
// });

// // PATCH /api/woven-essence/cart/items/:lineId   { quantity }
// const updateLine = asyncHandler(async (req, res) => {
//   const quantity = parseInt(req.body.quantity, 10);
//   if (!Number.isFinite(quantity) || quantity < 0 || quantity > MAX_QTY_PER_LINE) {
//     res.status(400);
//     throw new Error(`Quantity must be between 0 and ${MAX_QTY_PER_LINE}`);
//   }

//   const cart = await getOrCreateCart(req.customer._id);
//   const line = cart.lines.id(req.params.lineId);
//   if (!line) {
//     res.status(404);
//     throw new Error("That item isn't in your cart");
//   }

//   if (quantity === 0) {
//     line.deleteOne();
//   } else {
//     const item = await Item.findOne({ _id: line.item, ...LIVE_ITEM }).select("inventory.currentStock");
//     const stock = item?.inventory?.currentStock || 0;
//     if (quantity > stock) {
//       res.status(409);
//       throw new Error(`Only ${stock} left in stock`);
//     }
//     line.quantity = quantity;
//   }

//   if (cart.lines.length === 0) cart.branch = null;
//   await cart.save();
//   res.json({ success: true, data: await buildCartView(cart) });
// });

// // DELETE /api/woven-essence/cart/items/:lineId
// const removeLine = asyncHandler(async (req, res) => {
//   const cart = await getOrCreateCart(req.customer._id);
//   const before = cart.lines.length;
//   cart.lines = cart.lines.filter((l) => String(l._id) !== String(req.params.lineId));
//   if (cart.lines.length === before) {
//     res.status(404);
//     throw new Error("That item isn't in your cart");
//   }
//   if (cart.lines.length === 0) cart.branch = null;
//   await cart.save();
//   res.json({ success: true, data: await buildCartView(cart) });
// });

// // DELETE /api/woven-essence/cart
// const clearCart = asyncHandler(async (req, res) => {
//   const cart = await getOrCreateCart(req.customer._id);
//   cart.lines = [];
//   cart.branch = null;
//   await cart.save();
//   res.json({ success: true, data: await buildCartView(cart) });
// });

// module.exports = { getCart, addToCart, updateLine, removeLine, clearCart, buildCartView, LIVE_ITEM };


















const asyncHandler = require("express-async-handler");
const Cart = require("../models/Cart");
const Wishlist = require("../models/Wishlist");
const Item = require("../models/Item");
const { productSlug } = require("../utils/storeSeo");

/**
 * Cart.
 *
 * Everything monetary is computed here from the live Item document. The client
 * sends item ids and quantities and nothing else — no prices, no totals.
 *
 * MULTI-STORE
 * -----------
 * A cart may hold sarees from several stores. The old rule — one cart, one
 * branch — matched a world where each store shipped its own parcel. It doesn't
 * match this business: the team collects from every store, packs one parcel at
 * the warehouse and ships once. So the cart no longer refuses a second store;
 * it just labels each line with the store it comes from, and reports a
 * per-store breakdown the checkout and the pick list are built from.
 *
 * `cart.branch` is kept as the PRIMARY store — the first one the shopper added
 * from. Nothing gates on it any more; group shopping still uses it to decide
 * which store a new session belongs to.
 */

/** The same visibility gate the storefront uses. An unbuyable saree can't be carted. */
const LIVE_ITEM = {
  isDeleted: { $ne: true },
  status: "active",
  lifecycleStage: "published",
  "visibility.onlineSaleEnabled": { $ne: false },
};

const MAX_QTY_PER_LINE = 20;

async function getOrCreateCart(customerId) {
  let cart = await Cart.findOne({ customer: customerId });
  if (!cart) cart = await Cart.create({ customer: customerId, lines: [] });
  return cart;
}

/**
 * Builds the cart the browser sees: each line priced from its Item, labelled
 * with its store, plus totals and a per-store breakdown.
 *
 * Lines whose saree has since been unpublished, deleted or gone out of stock are
 * kept and flagged rather than silently dropped — a cart that quietly loses an
 * item is worse than one that explains why it can't be bought.
 */
async function buildCartView(cart) {
  const ids = cart.lines.map((l) => l.item);

  const items = await Item.find({ _id: { $in: ids } })
    .select({
      "identity.productName": 1, "identity.displayName": 1, "identity.itemCode": 1,
      "saree.sareeType": 1, "saree.fabricType": 1, "color.primaryColor": 1,
      "pricing.mrp": 1, "pricing.sellingPrice": 1, "pricing.currency": 1, "pricing.taxInclusive": 1,
      "tax.gstRate": 1, "inventory.currentStock": 1, "inventory.unitOfMeasure": 1,
      "seo.slug": 1, images: 1, branch: 1, status: 1, lifecycleStage: 1,
      "visibility.onlineSaleEnabled": 1, isDeleted: 1,
    })
    // Needed so every line can say which shop it comes from.
    .populate("branch", "branchName address.city")
    .lean();

  const byId = new Map(items.map((i) => [String(i._id), i]));

  let subtotal = 0;
  let mrpTotal = 0;
  let taxTotal = 0;
  let buyableCount = 0;

  /** Per-store rollup, keyed by branch id. Drives the checkout breakdown. */
  const storeTotals = new Map();

  const lines = cart.lines.map((line) => {
    const item = byId.get(String(line.item));

    if (!item) {
      return {
        lineId: line._id,
        itemId: line.item,
        quantity: line.quantity,
        available: false,
        issue: "This saree is no longer listed",
      };
    }

    const live =
      item.isDeleted !== true &&
      item.status === "active" &&
      item.lifecycleStage === "published" &&
      item.visibility?.onlineSaleEnabled !== false;

    const stock = item.inventory?.currentStock || 0;
    const sellingPrice = item.pricing?.sellingPrice ?? null;

    let issue = null;
    if (!live) issue = "This saree is no longer available";
    else if (sellingPrice == null) issue = "Price on request — contact us to buy";
    else if (stock <= 0) issue = "Sold out";
    else if (line.quantity > stock) issue = `Only ${stock} left in stock`;

    const quantity = Math.min(line.quantity, Math.max(stock, 1));
    const available = !issue;

    // branch is populated, so it arrives as a document rather than an id.
    const branchDoc = item.branch && typeof item.branch === "object" ? item.branch : null;
    const branchId = branchDoc ? String(branchDoc._id) : String(item.branch || "");
    const branchName = branchDoc?.branchName || "";
    const branchCity = branchDoc?.address?.city || "";

    if (available) {
      const gross = sellingPrice * quantity;
      subtotal += gross;
      mrpTotal += (item.pricing?.mrp ?? sellingPrice) * quantity;
      buyableCount += quantity;

      // Prices are stored tax-inclusive by default, so tax is extracted rather
      // than added — otherwise the shopper would be charged GST twice.
      const rate = item.tax?.gstRate || 0;
      if (rate > 0) {
        taxTotal += item.pricing?.taxInclusive === false
          ? (gross * rate) / 100
          : gross - gross / (1 + rate / 100);
      }

      const bucket = storeTotals.get(branchId) || {
        branchId,
        branchName,
        branchCity,
        itemCount: 0,
        subtotal: 0,
      };
      bucket.itemCount += quantity;
      bucket.subtotal += gross;
      storeTotals.set(branchId, bucket);
    }

    const hero =
      (item.images || []).find((i) => i.category === "Main Product Image") || (item.images || [])[0] || null;

    return {
      lineId: line._id,
      itemId: item._id,
      slug: item.seo?.slug || productSlug(item),
      name: item.identity?.displayName || item.identity?.productName || "Saree",
      itemCode: item.identity?.itemCode || "",
      sareeType: item.saree?.sareeType || "",
      fabric: item.saree?.fabricType || "",
      colour: item.color?.primaryColor || "",
      branchId,
      branchName,
      branchCity,
      image: hero ? { url: hero.url, altText: hero.altText } : null,
      unitPrice: sellingPrice,
      mrp: item.pricing?.mrp ?? null,
      currency: item.pricing?.currency || "INR",
      gstRate: item.tax?.gstRate ?? null,
      quantity,
      lineTotal: available && sellingPrice != null ? sellingPrice * quantity : null,
      stock,
      unit: item.inventory?.unitOfMeasure || "pcs",
      available,
      issue,
    };
  });

  const round = (n) => Math.round(n * 100) / 100;

  const stores = [...storeTotals.values()]
    .map((s) => ({ ...s, subtotal: round(s.subtotal) }))
    .sort((a, b) => b.subtotal - a.subtotal);

  return {
    id: cart._id,
    branch: cart.branch,
    groupKey: cart.groupKey || null,
    lines,
    /** One entry per store the cart draws from — the shape of the pick list. */
    stores,
    storeCount: stores.length,
    multiStore: stores.length > 1,
    summary: {
      lineCount: lines.length,
      itemCount: buyableCount,
      mrpTotal: round(mrpTotal),
      subtotal: round(subtotal),
      savings: round(Math.max(mrpTotal - subtotal, 0)),
      taxIncluded: round(taxTotal),
      // Shipping is quoted at checkout, once for the whole parcel — the order
      // ships as one consignment however many stores it was collected from.
      total: round(subtotal),
      currency: lines.find((l) => l.currency)?.currency || "INR",
    },
    hasIssues: lines.some((l) => !l.available),
  };
}

// GET /api/woven-essence/cart
const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.customer._id);
  res.json({ success: true, data: await buildCartView(cart) });
});

// POST /api/woven-essence/cart/items   { itemId, quantity? }
const addToCart = asyncHandler(async (req, res) => {
  const { itemId } = req.body;
  const quantity = Math.min(Math.max(parseInt(req.body.quantity, 10) || 1, 1), MAX_QTY_PER_LINE);

  if (!/^[a-f\d]{24}$/i.test(String(itemId || ""))) {
    res.status(400);
    throw new Error("Invalid product");
  }

  const item = await Item.findOne({ _id: itemId, ...LIVE_ITEM }).select(
    "branch inventory.currentStock pricing.sellingPrice identity.productName"
  );
  if (!item) {
    res.status(404);
    throw new Error("This saree isn't available to buy");
  }
  if (item.pricing?.sellingPrice == null) {
    res.status(409);
    throw new Error("This saree is priced on request — please contact the store");
  }

  const stock = item.inventory?.currentStock || 0;
  if (stock <= 0) {
    res.status(409);
    throw new Error("This saree is sold out");
  }

  const cart = await getOrCreateCart(req.customer._id);

  // NOTE: there is deliberately no cross-store check here any more. A cart may
  // span stores; the warehouse collects from each one and ships a single parcel.

  const existing = cart.lines.find((l) => String(l.item) === String(item._id));
  const requested = (existing?.quantity || 0) + quantity;

  if (requested > stock) {
    res.status(409);
    throw new Error(
      existing
        ? `You already have ${existing.quantity} of these, and only ${stock} are in stock`
        : `Only ${stock} of these are in stock`
    );
  }

  if (existing) existing.quantity = Math.min(requested, MAX_QTY_PER_LINE);
  else cart.lines.push({ item: item._id, quantity });

  // Primary store = the first one added. Only group shopping reads this now.
  if (!cart.branch) cart.branch = item.branch;
  await cart.save();

  // Carting something implies it is no longer just "saved for later".
  await Wishlist.updateOne({ customer: req.customer._id }, { $pull: { entries: { item: item._id } } });

  res.status(201).json({ success: true, data: await buildCartView(cart) });
});

// PATCH /api/woven-essence/cart/items/:lineId   { quantity }
const updateLine = asyncHandler(async (req, res) => {
  const quantity = parseInt(req.body.quantity, 10);
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > MAX_QTY_PER_LINE) {
    res.status(400);
    throw new Error(`Quantity must be between 0 and ${MAX_QTY_PER_LINE}`);
  }

  const cart = await getOrCreateCart(req.customer._id);
  const line = cart.lines.id(req.params.lineId);
  if (!line) {
    res.status(404);
    throw new Error("That item isn't in your cart");
  }

  if (quantity === 0) {
    line.deleteOne();
  } else {
    const item = await Item.findOne({ _id: line.item, ...LIVE_ITEM }).select("inventory.currentStock");
    const stock = item?.inventory?.currentStock || 0;
    if (quantity > stock) {
      res.status(409);
      throw new Error(`Only ${stock} left in stock`);
    }
    line.quantity = quantity;
  }

  if (cart.lines.length === 0) cart.branch = null;
  await cart.save();
  res.json({ success: true, data: await buildCartView(cart) });
});

// DELETE /api/woven-essence/cart/items/:lineId
const removeLine = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.customer._id);
  const before = cart.lines.length;
  cart.lines = cart.lines.filter((l) => String(l._id) !== String(req.params.lineId));
  if (cart.lines.length === before) {
    res.status(404);
    throw new Error("That item isn't in your cart");
  }
  if (cart.lines.length === 0) cart.branch = null;
  await cart.save();
  res.json({ success: true, data: await buildCartView(cart) });
});

// DELETE /api/woven-essence/cart
const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.customer._id);
  cart.lines = [];
  cart.branch = null;
  await cart.save();
  res.json({ success: true, data: await buildCartView(cart) });
});

module.exports = { getCart, addToCart, updateLine, removeLine, clearCart, buildCartView, LIVE_ITEM };