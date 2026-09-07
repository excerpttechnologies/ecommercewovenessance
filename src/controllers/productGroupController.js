const asyncHandler = require("express-async-handler");
const ProductGroup = require("../models/ProductGroup");
const ErpBusiness = require("../models/ErpBusiness");
const StorefrontGroup = require("../models/StorefrontGroup");

// The ERP's Product Group master, plus the one thing Woven Essence owns
// about it: whether a group shows in the shop header.
//
// This collection belongs to GROO RETAIL ERP (retailerpv2). Woven Essence
// reads it so both admins show one list, and deliberately does NOT write to
// it — creating or editing master data here would put two apps with different
// validation rules on the same rows. Group maintenance stays in the ERP.
//
// Publishing is the one thing this screen does write, and it writes to Woven
// Essence's own storefrontGroups side table, never to the ERP's rows. See
// models/StorefrontGroup.js.
//
// Scoping note: these rows carry an ERP business, not a Woven Essence branch,
// and no field links the two. The list is scoped by the `business` param the
// sidebar's WORKING BRANCH selector sends, which is the ERP's own branch list.

/** Escapes user input so it's safe to embed inside a MongoDB $regex string. */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds the query shared by the list and the dashboard, so counts match rows. */
function buildFilter(query) {
  const filter = {};

  const search = String(query.q || "").trim();
  if (search) {
    const rx = { $regex: escapeRegExp(search), $options: "i" };
    filter.$or = [{ name: rx }, { prefix: rx }];
  }

  const business = String(query.business || "").trim();
  if (business) filter.businessId = business;

  // "top" = the categories; "sub" = rows nested under another group.
  const level = String(query.level || "").trim();
  if (level === "top") filter.parentId = null;
  if (level === "sub") filter.parentId = { $ne: null };

  return filter;
}

/**
 * Looks up the publish flag for a page of groups in one query.
 *
 * A group with no side-table row has never been published, so a missing
 * entry reads as false rather than as an error.
 */
async function resolvePublished(rows) {
  const ids = rows.map((r) => r._id);
  if (!ids.length) return {};

  const flags = await StorefrontGroup.find({ productGroup: { $in: ids } })
    .select("productGroup isPublished")
    .lean();

  const published = {};
  flags.forEach((f) => { published[String(f.productGroup)] = !!f.isPublished; });
  return published;
}

/** The ids of every currently published group, for counting and filtering. */
async function publishedIds() {
  const rows = await StorefrontGroup.find({ isPublished: true }).select("productGroup").lean();
  return rows.map((r) => r.productGroup);
}

/**
 * Resolves businessId and parentId to names in one pass, the way the ERP's
 * lib/refLabels.js does — the list shows names, the documents store ids.
 */
async function resolveLabels(rows) {
  const businessIds = [...new Set(rows.map((r) => r.businessId).filter(Boolean).map(String))];
  const parentIds = [...new Set(rows.map((r) => r.parentId).filter(Boolean).map(String))];

  const [businesses, parents] = await Promise.all([
    businessIds.length ? ErpBusiness.find({ _id: { $in: businessIds } }).select("name").lean() : [],
    parentIds.length ? ProductGroup.find({ _id: { $in: parentIds } }).select("name").lean() : [],
  ]);

  const labels = {};
  businesses.forEach((b) => { labels[String(b._id)] = b.name || ""; });
  parents.forEach((p) => { labels[String(p._id)] = p.name || ""; });
  return labels;
}

/** GET /product-groups — paginated list, newest first, same as the ERP's. */
const list = asyncHandler(async (req, res) => {
  const filter = buildFilter(req.query);

  // The publish flag lives in another collection, so filtering by it means
  // resolving the id set first rather than adding a path to the query.
  const wantPublished = String(req.query.published || "").trim();
  if (wantPublished === "yes") filter._id = { $in: await publishedIds() };
  if (wantPublished === "no") filter._id = { $nin: await publishedIds() };
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 500);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const [docs, total] = await Promise.all([
    ProductGroup.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ProductGroup.countDocuments(filter),
  ]);

  const published = await resolvePublished(docs);

  res.json({
    success: true,
    data: docs.map((d) => ({ ...d, isPublished: !!published[String(d._id)] })),
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
 * GET /product-groups/dashboard — the stat cards.
 *
 * The ERP's productgroup rows carry no status, lifecycle stage or soft-delete
 * flag, so the counts Woven Essence shows for its own Groups (active/draft/
 * published/hold) have nothing to read here. These are the numbers this
 * collection can actually answer.
 */
const dashboard = asyncHandler(async (req, res) => {
  const filter = buildFilter(req.query);

  const [total, topLevel, referencedIds, live] = await Promise.all([
    ProductGroup.countDocuments(filter),
    ProductGroup.countDocuments({ ...filter, parentId: null }),
    ProductGroup.distinct("businessId", filter),
    publishedIds(),
  ]);

  // Counted through the same filter as the rows, so the card matches the
  // list rather than reporting every published group in the database.
  const published = await ProductGroup.countDocuments({ ...filter, _id: { $in: live } });

  // Some rows point at businesses that no longer exist, so counting distinct
  // ids would report more businesses than the filter dropdown offers. Count
  // only the ones that still resolve, and let those rows show "—" for
  // Business in the table.
  const businessIds = referencedIds.filter(Boolean);
  const businesses = businessIds.length
    ? await ErpBusiness.countDocuments({ _id: { $in: businessIds } })
    : 0;

  res.json({
    success: true,
    data: {
      total,
      topLevel,
      subGroups: total - topLevel,
      published,
      businesses,
    },
  });
});

/**
 * PATCH /product-groups/:id/publish — put a group in the shop header, or
 * take it out.
 *
 * Upsert, because most groups have no side-table row until the first time
 * someone publishes them. The ERP row itself is only read, to reject an id
 * that does not name a real group.
 */
const setPublished = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isPublished = req.body.isPublished === true || req.body.isPublished === "true";

  const group = await ProductGroup.findById(id).select("_id name").lean();
  if (!group) {
    res.status(404);
    throw new Error("Product group not found");
  }

  const doc = await StorefrontGroup.findOneAndUpdate(
    { productGroup: group._id },
    {
      $set: {
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        publishedBy: isPublished ? req.user?._id || null : null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  res.json({
    success: true,
    data: { _id: String(group._id), name: group.name, isPublished: doc.isPublished },
  });
});

/**
 * GET /product-groups/published — the groups a product can be filed under.
 *
 * Only published ones, because publishing is what puts a category in the shop:
 * filing a product under an unpublished group would leave it with nowhere to
 * be found. Not paginated — this feeds a dropdown, and the published set is
 * small by design.
 */
const publishedGroups = asyncHandler(async (req, res) => {
  const live = await publishedIds();
  if (!live.length) return res.json({ success: true, data: [] });

  const filter = { _id: { $in: live } };
  const business = String(req.query.business || "").trim();
  if (business) filter.businessId = business;

  const docs = await ProductGroup.find(filter).select("name prefix").sort("name").lean();
  res.json({ success: true, data: docs });
});

module.exports = { list, dashboard, setPublished, publishedGroups };
