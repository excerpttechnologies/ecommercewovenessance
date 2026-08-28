const asyncHandler = require("express-async-handler");
const Wishlist = require("../models/Wishlist");
const Item = require("../models/Item");
const { productSlug } = require("../utils/storeSeo");
const { LIVE_ITEM } = require("./cartController");

/**
 * Saved sarees.
 *
 * Unlike the cart, a sold-out or unpublished saree stays on the wishlist and is
 * simply marked unavailable — that is the whole point of saving something.
 */

const MAX_ENTRIES = 100;

async function getOrCreate(customerId) {
  let list = await Wishlist.findOne({ customer: customerId });
  if (!list) list = await Wishlist.create({ customer: customerId, entries: [] });
  return list;
}

async function buildView(list) {
  const ids = list.entries.map((e) => e.item);

  const items = await Item.find({ _id: { $in: ids } })
    .select({
      "identity.productName": 1, "identity.displayName": 1, "identity.itemCode": 1,
      "identity.featured": 1, "identity.newArrival": 1, "identity.bestSeller": 1, "identity.trending": 1,
      "saree.sareeType": 1, "saree.fabricType": 1, "saree.handloomStatus": 1, "saree.occasion": 1,
      "color.primaryColor": 1,
      "pricing.mrp": 1, "pricing.sellingPrice": 1, "pricing.currency": 1,
      "inventory.currentStock": 1, "reviews.averageRating": 1, "reviews.totalReviews": 1,
      "seo.slug": 1, images: 1, branch: 1, status: 1, lifecycleStage: 1,
      "visibility.onlineSaleEnabled": 1, isDeleted: 1,
    })
    .lean();

  const byId = new Map(items.map((i) => [String(i._id), i]));

  // Newest saved first — that is the order a shopper expects to find them in.
  const entries = [...list.entries]
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .map((entry) => {
      const item = byId.get(String(entry.item));
      if (!item) {
        return { entryId: entry._id, itemId: entry.item, available: false, issue: "No longer listed" };
      }

      const live =
        item.isDeleted !== true &&
        item.status === "active" &&
        item.lifecycleStage === "published" &&
        item.visibility?.onlineSaleEnabled !== false;
      const stock = item.inventory?.currentStock || 0;
      const selling = item.pricing?.sellingPrice ?? null;
      const mrp = item.pricing?.mrp ?? null;
      const hero =
        (item.images || []).find((i) => i.category === "Main Product Image") || (item.images || [])[0] || null;

      return {
        entryId: entry._id,
        // Shaped like a catalogue card so the same SareeCard renders it.
        id: item._id,
        itemId: item._id,
        slug: item.seo?.slug || productSlug(item),
        itemCode: item.identity?.itemCode || "",
        name: item.identity?.displayName || item.identity?.productName || "Saree",
        brand: "Woven Essence",
        sareeType: item.saree?.sareeType || "",
        fabric: item.saree?.fabricType || "",
        handloom: item.saree?.handloomStatus === "handloom",
        occasion: item.saree?.occasion || "",
        colour: item.color?.primaryColor || "",
        mrp,
        sellingPrice: selling,
        discountPercent: mrp && selling && mrp > selling ? Math.round(((mrp - selling) / mrp) * 100) : null,
        currency: item.pricing?.currency || "INR",
        inStock: stock > 0,
        rating: item.reviews?.averageRating || 0,
        reviewCount: item.reviews?.totalReviews || 0,
        image: hero ? { url: hero.url, altText: hero.altText } : null,
        imageCount: (item.images || []).length,
        badges: [
          item.identity?.bestSeller && "Best seller",
          item.identity?.newArrival && "New arrival",
          item.identity?.trending && "Trending",
          item.identity?.featured && "Featured",
        ].filter(Boolean),
        available: live && stock > 0 && selling != null,
        issue: !live ? "No longer available" : stock <= 0 ? "Sold out" : selling == null ? "Price on request" : null,
        addedAt: entry.addedAt,
      };
    });

  return { id: list._id, count: entries.length, entries };
}

// GET /api/woven-essence/wishlist
const getWishlist = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await buildView(await getOrCreate(req.customer._id)) });
});

// POST /api/woven-essence/wishlist/items   { itemId }
const addToWishlist = asyncHandler(async (req, res) => {
  const { itemId } = req.body;
  if (!/^[a-f\d]{24}$/i.test(String(itemId || ""))) {
    res.status(400);
    throw new Error("Invalid product");
  }

  const item = await Item.findOne({ _id: itemId, ...LIVE_ITEM }).select("_id");
  if (!item) {
    res.status(404);
    throw new Error("This saree isn't available");
  }

  const list = await getOrCreate(req.customer._id);
  if (list.entries.length >= MAX_ENTRIES && !list.entries.some((e) => String(e.item) === String(itemId))) {
    res.status(409);
    throw new Error(`Your wishlist is full (${MAX_ENTRIES} sarees). Remove one first.`);
  }

  // Idempotent: saving twice is not an error, it just stays saved once.
  if (!list.entries.some((e) => String(e.item) === String(itemId))) {
    list.entries.push({ item: itemId });
    await list.save();
  }

  res.status(201).json({ success: true, data: await buildView(list) });
});

// DELETE /api/woven-essence/wishlist/items/:itemId
const removeFromWishlist = asyncHandler(async (req, res) => {
  const list = await getOrCreate(req.customer._id);
  const id = req.params.itemId;
  const before = list.entries.length;
  list.entries = list.entries.filter(
    (e) => String(e.item) !== String(id) && String(e._id) !== String(id)
  );
  if (list.entries.length === before) {
    res.status(404);
    throw new Error("That saree isn't on your wishlist");
  }
  await list.save();
  res.json({ success: true, data: await buildView(list) });
});

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
