const asyncHandler = require("express-async-handler");
const ErpItem = require("../models/ErpItem");
const ErpHsn = require("../models/ErpHsn");
const ErpUom = require("../models/ErpUom");
const ProductGroup = require("../models/ProductGroup");

// Read-only views over the ERP's Item master.
//
// This collection belongs to GROO RETAIL ERP (retailerpv2), which validates it
// its own way, so Woven Essence only reads. Adding and editing items stays in
// the ERP — the same arrangement as Groups.
//
// Scoping: items carry an ERP business, not a Woven Essence branch, so the
// list follows the `business` param the sidebar's WORKING BRANCH selector
// sends. That is the ERP's own branch list.

/** Escapes user input so it's safe to embed inside a MongoDB $regex string. */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every group id an item may sit under when the caller asks for one group.
 *
 * Items hang off the CHILD groups, not the parent — no published group in this
 * database has a single item directly under it, they are all one level down.
 * So filtering on the chosen group alone returns an empty list every time, and
 * the group plus its children is what the caller actually means.
 */
async function groupWithChildren(groupId) {
  const children = await ProductGroup.find({ parentId: groupId }).select("_id").lean();
  return [groupId, ...children.map((c) => String(c._id))];
}

/** Builds the query shared by the list and the dashboard, so counts match rows. */
async function buildFilter(query) {
  const filter = {};

  const search = String(query.q || "").trim();
  if (search) {
    const rx = { $regex: escapeRegExp(search), $options: "i" };
    filter.$or = [
      { name: rx },
      { itemCode: rx },
      { prefix: rx },
      { description: rx },
    ];
  }

  const business = String(query.business || "").trim();
  if (business) filter.businessId = business;

  const group = String(query.group || "").trim();
  if (group) filter.subGroupId = { $in: await groupWithChildren(group) };

  const itemType = String(query.itemType || "").trim();
  if (itemType) filter.itemType = itemType;

  return filter;
}

/**
 * Resolves the three id columns to names in one pass each, the way the ERP's
 * lib/refLabels.js does. HSN rows are labelled by `code` and UOM rows by
 * `name`, matching retailerpv2's LABEL_FIELD exports.
 */
async function resolveLabels(rows) {
  const ids = (key) => [...new Set(rows.map((r) => r[key]).filter(Boolean).map(String))];
  const groupIds = ids("subGroupId");
  const hsnIds = ids("hsnId");
  const uomIds = ids("uomId");

  const [groups, hsns, uoms] = await Promise.all([
    groupIds.length ? ProductGroup.find({ _id: { $in: groupIds } }).select("name").lean() : [],
    hsnIds.length ? ErpHsn.find({ _id: { $in: hsnIds } }).select("code").lean() : [],
    uomIds.length ? ErpUom.find({ _id: { $in: uomIds } }).select("name").lean() : [],
  ]);

  const labels = {};
  groups.forEach((g) => { labels[String(g._id)] = g.name || ""; });
  hsns.forEach((h) => { labels[String(h._id)] = h.code || ""; });
  uoms.forEach((u) => { labels[String(u._id)] = u.name || ""; });
  return labels;
}

/** GET /product-items — paginated list, newest first, same as the ERP's. */
const list = asyncHandler(async (req, res) => {
  const filter = await buildFilter(req.query);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 500);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const [docs, total] = await Promise.all([
    ErpItem.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ErpItem.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: docs,
    labels: await resolveLabels(docs),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
});

/**
 * GET /product-items/dashboard — the stat cards.
 *
 * These rows carry no status, lifecycle stage or soft-delete flag, so the
 * counts Woven Essence shows for its own records have nothing to read here.
 * These are the numbers this collection can actually answer.
 */
const dashboard = asyncHandler(async (req, res) => {
  const filter = await buildFilter(req.query);

  const [total, simple, variant, groups] = await Promise.all([
    ErpItem.countDocuments(filter),
    ErpItem.countDocuments({ ...filter, itemType: "Simple" }),
    ErpItem.countDocuments({ ...filter, itemType: "Variant" }),
    ErpItem.distinct("subGroupId", filter),
  ]);

  res.json({
    success: true,
    data: { total, simple, variant, groups: groups.filter(Boolean).length },
  });
});

/**
 * GET /product-items/groups — options for the Group filter.
 *
 * Only groups that actually hold an item in scope, so the dropdown never
 * offers a value that returns an empty list.
 */
const groups = asyncHandler(async (req, res) => {
  const business = String(req.query.business || "").trim();
  const used = await ErpItem.distinct(
    "subGroupId",
    business ? { businessId: business } : {},
  );
  const ids = used.filter(Boolean);
  if (!ids.length) return res.json({ success: true, data: [] });

  const docs = await ProductGroup.find({ _id: { $in: ids } })
    .select("name")
    .sort("name")
    .lean();

  res.json({ success: true, data: docs });
});

module.exports = { list, dashboard, groups };
