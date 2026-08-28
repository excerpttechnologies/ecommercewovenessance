const asyncHandler = require("express-async-handler");
const Customer = require("../models/Customer");
const Item = require("../models/Item");
const { CARD_FIELDS, toCard, LIVE_ITEM } = require("./storeController");

/**
 * Recently viewed sarees.
 *
 * Saree shopping is high-consideration — people open a dozen pieces over several
 * days before deciding — so this list follows the shopper across devices rather
 * than living only in one browser's storage. Anonymous visitors get a
 * localStorage version on the client instead; nothing here tracks them.
 *
 * The list is a set of item REFERENCES. Prices, stock and photos are read from
 * the live Item at display time, so a saree that has since sold out or changed
 * price shows its current state.
 */

const MAX_ENTRIES = 20;
/** Cards to hand back — one row of the rail on desktop, a swipe on mobile. */
const DEFAULT_LIMIT = 12;

// POST /api/woven-essence/account/recently-viewed   { itemId }
const recordRecentlyViewed = asyncHandler(async (req, res) => {
  const { itemId } = req.body || {};
  if (!/^[a-f\d]{24}$/i.test(String(itemId || ""))) {
    res.status(400);
    throw new Error("Invalid product");
  }

  // Only record something the shopper could actually have viewed on the shop.
  const exists = await Item.exists({ _id: itemId, ...LIVE_ITEM });
  if (!exists) return res.status(202).json({ success: true });

  const customer = await Customer.findById(req.customer._id).select("+recentlyViewed");
  if (!customer) {
    res.status(404);
    throw new Error("Account not found");
  }

  // Move an existing entry to the front rather than duplicating it: viewing the
  // same saree three times should leave one entry, not three.
  const others = (customer.recentlyViewed || []).filter((e) => String(e.item) !== String(itemId));
  customer.recentlyViewed = [{ item: itemId, viewedAt: new Date() }, ...others].slice(0, MAX_ENTRIES);

  await customer.save({ validateModifiedOnly: true });
  res.status(202).json({ success: true });
});

// GET /api/woven-essence/account/recently-viewed?limit=&exclude=
const listRecentlyViewed = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), MAX_ENTRIES);

  const customer = await Customer.findById(req.customer._id).select("+recentlyViewed").lean();
  const entries = customer?.recentlyViewed || [];
  if (entries.length === 0) return res.json({ success: true, data: [] });

  // The product page passes its own id so a saree doesn't appear in its own
  // "recently viewed" rail.
  const exclude = /^[a-f\d]{24}$/i.test(String(req.query.exclude || "")) ? String(req.query.exclude) : null;

  const ids = entries.map((e) => e.item).filter((id) => String(id) !== exclude);

  const items = await Item.find({ _id: { $in: ids }, ...LIVE_ITEM })
    .select(CARD_FIELDS)
    .populate("branch", "branchName address.city")
    .lean();

  // Preserve view order — a $in query returns documents in storage order, not
  // the order asked for.
  const byId = new Map(items.map((i) => [String(i._id), i]));
  const cards = ids
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .slice(0, limit)
    .map(toCard);

  res.json({ success: true, data: cards });
});

// DELETE /api/woven-essence/account/recently-viewed
const clearRecentlyViewed = asyncHandler(async (req, res) => {
  await Customer.updateOne({ _id: req.customer._id }, { $set: { recentlyViewed: [] } });
  res.json({ success: true, message: "Recently viewed cleared" });
});

module.exports = { recordRecentlyViewed, listRecentlyViewed, clearRecentlyViewed };
