// const asyncHandler = require("express-async-handler");
// const buildCrudController = require("../utils/crudFactory");
// const Item = require("../models/Item");
// const Branch = require("../models/Branch");
// const Group = require("../models/Group");
// const Subgroup = require("../models/Subgroup");

// /**
//  * Every object-valued field group on the Item document. Update merges these
//  * shallowly so a form that submits only one tab never wipes the others.
//  */
// const OBJECT_SECTIONS = [
//   "identity", "saree", "color", "size", "pricing", "tax", "inventory",
//   "barcodeManagement", "supplier", "aiImageAnalysis", "aiContent", "seo",
//   "care", "styling", "shipping", "returns", "marketplace", "visibility",
//   "relationships", "variantSettings", "aiRecommendation", "reviews",
// ];

// /** Array-valued field groups — replaced wholesale, since the UI sends the full list. */
// const ARRAY_SECTIONS = ["images", "videos", "gifs", "documents", "warehouseAllocations", "variants", "faqs"];

// /**
//  * Section 32 is maintained by the system (orders, views, reviews) — never by the
//  * admin form, so it is deliberately absent from both lists above.
//  */
// const SYSTEM_SECTIONS = ["salesIntelligence"];

// const EXPORT_COLUMNS = [
//   { header: "Item Code", key: "itemCode", width: 26 },
//   { header: "Barcode", key: "barcode", width: 16 },
//   { header: "Product Name", key: "productName", width: 30 },
//   { header: "Saree Type", key: "sareeType", width: 18 },
//   { header: "Fabric Type", key: "fabricType", width: 18 },
//   { header: "Primary Color", key: "primaryColor", width: 16 },
//   { header: "MRP", key: "mrp", width: 10 },
//   { header: "Selling Price", key: "sellingPrice", width: 14 },
//   { header: "GST %", key: "gstRate", width: 8 },
//   { header: "Current Stock", key: "currentStock", width: 14 },
//   { header: "Supplier", key: "supplierName", width: 22 },
//   { header: "Status", key: "status", width: 12 },
//   { header: "Lifecycle Stage", key: "lifecycleStage", width: 16 },
// ];

// const flattenForExport = (i) => ({
//   itemCode: i.identity?.itemCode || "",
//   barcode: i.identity?.barcode || "",
//   productName: i.identity?.productName || "",
//   sareeType: i.saree?.sareeType || "",
//   fabricType: i.saree?.fabricType || "",
//   primaryColor: i.color?.primaryColor || "",
//   mrp: i.pricing?.mrp ?? "",
//   sellingPrice: i.pricing?.sellingPrice ?? "",
//   gstRate: i.tax?.gstRate ?? "",
//   currentStock: i.inventory?.currentStock ?? "",
//   supplierName: i.supplier?.supplierName || "",
//   status: i.status,
//   lifecycleStage: i.lifecycleStage,
// });

// const baseController = buildCrudController(Item, {
//   entityName: "Item",
//   searchFields: ["identity.productName", "identity.itemCode", "identity.sku", "identity.barcode"],
//   filterFields: ["status", "lifecycleStage", "group", "subgroup"],
//   branchScoped: true,
//   editableFields: [...OBJECT_SECTIONS, ...ARRAY_SECTIONS, "status"],
//   populate: [
//     { path: "group", select: "groupName groupCode" },
//     { path: "subgroup", select: "subgroupName subgroupCode" },
//   ],
//   exportColumns: EXPORT_COLUMNS,
//   flattenForExport,
//   // Excel import goes through the same code-generation path as the UI, so an
//   // imported item is never left without an itemCode/barcode.
//   beforeCreate: async (body, req) => {
//     const { itemCode, barcode } = await resolveAndGenerateCodes(body);
//     return {
//       identity: { ...(body.identity || {}), itemCode, barcode },
//       barcodeManagement: {
//         ...(body.barcodeManagement || {}),
//         internalBarcode: barcode,
//         generatedDate: new Date(),
//         generatedBy: req?.adminUser?._id,
//       },
//     };
//   },
//   importRow: async (row) => ({
//     branch: row["Branch ID"] || row["branch"],
//     group: row["Group ID"] || row["group"],
//     subgroup: row["Subgroup ID"] || row["subgroup"],
//     identity: {
//       productName: row["Product Name"] || row["productName"],
//       sku: row["SKU"] || "",
//     },
//     saree: { sareeType: row["Saree Type"] || "", fabricType: row["Fabric Type"] || "" },
//     pricing: {
//       mrp: row["MRP"] ? Number(row["MRP"]) : undefined,
//       sellingPrice: row["Selling Price"] ? Number(row["Selling Price"]) : undefined,
//     },
//     inventory: { currentStock: row["Current Stock"] ? Number(row["Current Stock"]) : undefined },
//     supplier: { supplierName: row["Supplier"] || "" },
//   }),
// });

// /**
//  * Validates the branch -> group -> subgroup chain and returns the auto-generated
//  * identity codes (Section 5.3). Lookups use { $ne: true } rather than false so
//  * documents written by the existing ERP without an isDeleted field still resolve.
//  */
// async function resolveAndGenerateCodes(body) {
//   if (!body.branch) throw new Error("branch is required");
//   if (!body.group) throw new Error("group is required");
//   if (!body.subgroup) throw new Error("subgroup is required");
//   if (!body.identity?.productName) throw new Error("identity.productName is required");

//   const [branch, group, subgroup] = await Promise.all([
//     Branch.findOne({ _id: body.branch, isDeleted: { $ne: true } }),
//     Group.findOne({ _id: body.group, isDeleted: { $ne: true } }),
//     Subgroup.findOne({ _id: body.subgroup, isDeleted: { $ne: true } }),
//   ]);
//   if (!branch) throw new Error("Branch not found — reselect the working branch in the sidebar");
//   if (!group) throw new Error("Group not found");
//   if (!subgroup) throw new Error("Subgroup not found");
//   if (String(group.branch) !== String(branch._id)) throw new Error("Group does not belong to this branch");
//   if (String(subgroup.group) !== String(group._id)) throw new Error("Subgroup does not belong to this group");

//   const itemCode = await Item.generateItemCode(branch.branchCode, group.groupCode, subgroup.subgroupCode);
//   const barcode = await Item.generateBarcode();
//   return { itemCode, barcode };
// }

// const create = asyncHandler(async (req, res) => {
//   const { itemCode, barcode } = await resolveAndGenerateCodes(req.body);

//   const payload = {
//     branch: req.body.branch,
//     group: req.body.group,
//     subgroup: req.body.subgroup,
//     status: req.body.status || "active",
//     lifecycleStage: req.body.lifecycleStage || "draft",
//     createdBy: req.adminUser?._id,
//     updatedBy: req.adminUser?._id,
//   };

//   // Copy every submitted field group through; anything omitted falls back to
//   // the schema default, so a half-filled form is still a valid item.
//   OBJECT_SECTIONS.forEach((section) => {
//     if (req.body[section] !== undefined) payload[section] = req.body[section];
//   });
//   ARRAY_SECTIONS.forEach((section) => {
//     if (req.body[section] !== undefined) payload[section] = req.body[section];
//   });
//   SYSTEM_SECTIONS.forEach((section) => delete payload[section]);

//   payload.identity = { ...(req.body.identity || {}), itemCode, barcode };
//   payload.barcodeManagement = {
//     ...(req.body.barcodeManagement || {}),
//     internalBarcode: barcode,
//     generatedDate: new Date(),
//     generatedBy: req.adminUser?._id,
//   };

//   const item = await Item.create(payload);
//   res.status(201).json({ success: true, data: item });
// });

// const update = asyncHandler(async (req, res) => {
//   const item = await Item.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
//   if (!item) {
//     res.status(404);
//     throw new Error("Item not found");
//   }

//   // itemCode and barcode are part of the permanent identity chain (Section 5.5)
//   // and are never editable once generated.
//   OBJECT_SECTIONS.forEach((section) => {
//     if (req.body[section] === undefined) return;
//     const incoming = { ...req.body[section] };

//     if (section === "identity") {
//       delete incoming.itemCode;
//       delete incoming.barcode;
//     }
//     if (section === "barcodeManagement") {
//       delete incoming.internalBarcode; // mirrors identity.barcode
//       delete incoming.generatedBy;
//       delete incoming.generatedDate;
//     }

//     const current = item[section] ? item[section].toObject() : {};
//     item[section] = { ...current, ...incoming };
//   });

//   ARRAY_SECTIONS.forEach((section) => {
//     if (req.body[section] !== undefined) item[section] = req.body[section];
//   });

//   if (req.body.status !== undefined) item.status = req.body.status;
//   item.updatedBy = req.adminUser?._id;

//   await item.save();
//   res.json({ success: true, data: item });
// });

// module.exports = { ...baseController, create, update };
// module.exports.OBJECT_SECTIONS = OBJECT_SECTIONS;
// module.exports.ARRAY_SECTIONS = ARRAY_SECTIONS;

const asyncHandler = require("express-async-handler");
const buildCrudController = require("../utils/crudFactory");
const ApiFeatures = require("../utils/apiFeatures");
const Item = require("../models/Item");
const Branch = require("../models/Branch");
const Group = require("../models/Group");
const Subgroup = require("../models/Subgroup");
const { mirrorErpSelection, ensureDefaultGroup } = require("../utils/erpMirror");
const BarcodeLabel = require("../models/BarcodeLabel");
const { assertBranchAccess } = require("../middleware/branchScope");
const { listAugustProducts, buildAugustFilter } = require("./barcodeLabelController");

/**
 * Every object-valued field group on the Item document. Update merges these
 * shallowly so a form that submits only one tab never wipes the others.
 */
const OBJECT_SECTIONS = [
  "identity",
  "saree",
  "color",
  "size",
  "pricing",
  "tax",
  "inventory",
  "barcodeManagement",
  "supplier",
  "aiImageAnalysis",
  "aiContent",
  "seo",
  "care",
  "styling",
  "shipping",
  "returns",
  "marketplace",
  "visibility",
  "relationships",
  "variantSettings",
  "aiRecommendation",
  "reviews",
];

/** Array-valued field groups — replaced wholesale, since the UI sends the full list. */
const ARRAY_SECTIONS = [
  "images",
  "videos",
  "gifs",
  "documents",
  "warehouseAllocations",
  "variants",
  "faqs",
];

/**
 * Section 32 is maintained by the system (orders, views, reviews) — never by the
 * admin form, so it is deliberately absent from both lists above.
 */
const SYSTEM_SECTIONS = ["salesIntelligence"];

const EXPORT_COLUMNS = [
  { header: "Item Code", key: "itemCode", width: 26 },
  { header: "Barcode", key: "barcode", width: 16 },
  { header: "Product Name", key: "productName", width: 30 },
  { header: "Saree Type", key: "sareeType", width: 18 },
  { header: "Fabric Type", key: "fabricType", width: 18 },
  { header: "Primary Color", key: "primaryColor", width: 16 },
  { header: "MRP", key: "mrp", width: 10 },
  { header: "Selling Price", key: "sellingPrice", width: 14 },
  { header: "GST %", key: "gstRate", width: 8 },
  { header: "Current Stock", key: "currentStock", width: 14 },
  { header: "Supplier", key: "supplierName", width: 22 },
  { header: "Status", key: "status", width: 12 },
  { header: "Lifecycle Stage", key: "lifecycleStage", width: 16 },
];

const flattenForExport = (i) => ({
  itemCode: i.identity?.itemCode || "",
  barcode: i.identity?.barcode || "",
  productName: i.identity?.productName || "",
  sareeType: i.saree?.sareeType || "",
  fabricType: i.saree?.fabricType || "",
  primaryColor: i.color?.primaryColor || "",
  mrp: i.pricing?.mrp ?? "",
  sellingPrice: i.pricing?.sellingPrice ?? "",
  gstRate: i.tax?.gstRate ?? "",
  currentStock: i.inventory?.currentStock ?? "",
  supplierName: i.supplier?.supplierName || "",
  status: i.status,
  lifecycleStage: i.lifecycleStage,
});

const baseController = buildCrudController(Item, {
  entityName: "Item",
  searchFields: [
    "identity.productName",
    "identity.itemCode",
    "identity.sku",
    "identity.barcode",
  ],
  filterFields: ["status", "lifecycleStage", "group", "subgroup"],
  branchScoped: true,
  editableFields: [...OBJECT_SECTIONS, ...ARRAY_SECTIONS, "status"],
  populate: [
    { path: "group", select: "groupName groupCode" },
    { path: "subgroup", select: "subgroupName subgroupCode" },
  ],
  exportColumns: EXPORT_COLUMNS,
  flattenForExport,
  // Excel import goes through the same code-generation path as the UI, so an
  // imported item is never left without an itemCode/barcode.
  beforeCreate: async (body, req) => {
    const { itemCode, barcode } = await resolveAndGenerateCodes(body);
    return {
      identity: { ...(body.identity || {}), itemCode, barcode },
      barcodeManagement: {
        ...(body.barcodeManagement || {}),
        internalBarcode: barcode,
        generatedDate: new Date(),
        generatedBy: req?.adminUser?._id,
      },
    };
  },
  importRow: async (row) => ({
    branch: row["Branch ID"] || row["branch"],
    group: row["Group ID"] || row["group"],
    subgroup: row["Subgroup ID"] || row["subgroup"],
    identity: {
      productName: row["Product Name"] || row["productName"],
      sku: row["SKU"] || "",
    },
    saree: {
      sareeType: row["Saree Type"] || "",
      fabricType: row["Fabric Type"] || "",
    },
    pricing: {
      mrp: row["MRP"] ? Number(row["MRP"]) : undefined,
      sellingPrice: row["Selling Price"]
        ? Number(row["Selling Price"])
        : undefined,
    },
    inventory: {
      currentStock: row["Current Stock"]
        ? Number(row["Current Stock"])
        : undefined,
    },
    supplier: { supplierName: row["Supplier"] || "" },
  }),
});

/**
 * Validates the branch -> group -> subgroup chain and returns the auto-generated
 * identity codes (Section 5.3). Lookups use { $ne: true } rather than false so
 * documents written by the existing ERP without an isDeleted field still resolve.
 */
async function resolveAndGenerateCodes(body) {
  if (!body.branch) throw new Error("branch is required");
  if (!body.group) throw new Error("group is required");
  if (!body.subgroup) throw new Error("subgroup is required");
  if (!body.identity?.productName)
    throw new Error("identity.productName is required");

  const [branch, group, subgroup] = await Promise.all([
    Branch.findOne({ _id: body.branch, isDeleted: { $ne: true } }),
    Group.findOne({ _id: body.group, isDeleted: { $ne: true } }),
    Subgroup.findOne({ _id: body.subgroup, isDeleted: { $ne: true } }),
  ]);
  if (!branch)
    throw new Error(
      "Branch not found — reselect the working branch in the sidebar",
    );
  if (!group) throw new Error("Group not found");
  if (!subgroup) throw new Error("Subgroup not found");
  if (String(group.branch) !== String(branch._id))
    throw new Error("Group does not belong to this branch");
  if (String(subgroup.group) !== String(group._id))
    throw new Error("Subgroup does not belong to this group");

  const itemCode = await Item.generateItemCode(
    branch.branchCode,
    group.groupCode,
    subgroup.subgroupCode,
  );
  const barcode = await Item.generateBarcode();
  return { itemCode, barcode };
}

const create = asyncHandler(async (req, res) => {
  // The Create form picks an ERP group and item. Neither can be stored on
  // the Item directly - group/subgroup are required refs to this app's own
  // collections and the item code is built from their codes - so the pair is
  // mirrored into a local Group/Subgroup first, creating them if this branch
  // has not used that pair before. See utils/erpMirror.js.
  if (req.body.erpGroup || req.body.erpItem) {
    const mirrored = await mirrorErpSelection({
      branchId: req.body.branch,
      erpGroupId: req.body.erpGroup,
      erpItemId: req.body.erpItem,
    });
    req.body.group = mirrored.group;
    req.body.subgroup = mirrored.subgroup;
  }

  const { itemCode, barcode } = await resolveAndGenerateCodes(req.body);

  const payload = {
    branch: req.body.branch,
    group: req.body.group,
    subgroup: req.body.subgroup,
    status: req.body.status || "active",
    lifecycleStage: req.body.lifecycleStage || "draft",
    createdBy: req.adminUser?._id,
    updatedBy: req.adminUser?._id,
  };

  // Copy every submitted field group through; anything omitted falls back to
  // the schema default, so a half-filled form is still a valid item.
  OBJECT_SECTIONS.forEach((section) => {
    if (req.body[section] !== undefined) payload[section] = req.body[section];
  });
  ARRAY_SECTIONS.forEach((section) => {
    if (req.body[section] !== undefined) payload[section] = req.body[section];
  });
  SYSTEM_SECTIONS.forEach((section) => delete payload[section]);

  payload.identity = { ...(req.body.identity || {}), itemCode, barcode };
  payload.barcodeManagement = {
    ...(req.body.barcodeManagement || {}),
    internalBarcode: barcode,
    generatedDate: new Date(),
    generatedBy: req.adminUser?._id,
  };

  const item = await Item.create(payload);
  res.status(201).json({ success: true, data: item });
});

const update = asyncHandler(async (req, res) => {
  const item = await Item.findOne({
    _id: req.params.id,
    isDeleted: { $ne: true },
  });
  if (!item) {
    res.status(404);
    throw new Error("Item not found");
  }
  // This handler replaces crudFactory's update, so it needs its own branch
  // check — the id alone locates the item, with no branch parameter to scope.
  assertBranchAccess(req, item, "Item");

  // itemCode and barcode are part of the permanent identity chain (Section 5.5)
  // and are never editable once generated.
  OBJECT_SECTIONS.forEach((section) => {
    if (req.body[section] === undefined) return;
    const incoming = { ...req.body[section] };

    if (section === "identity") {
      delete incoming.itemCode;
      delete incoming.barcode;
    }
    if (section === "barcodeManagement") {
      delete incoming.internalBarcode; // mirrors identity.barcode
      delete incoming.generatedBy;
      delete incoming.generatedDate;
    }

    const current = item[section] ? item[section].toObject() : {};
    item[section] = { ...current, ...incoming };
  });

  ARRAY_SECTIONS.forEach((section) => {
    if (req.body[section] !== undefined) item[section] = req.body[section];
  });

  if (req.body.status !== undefined) item.status = req.body.status;
  item.updatedBy = req.adminUser?._id;

  await item.save();
  res.json({ success: true, data: item });
});

/**
 * Batch lookup of the Items (if any) published from a given set of
 * barcodeLabel rows — keyed by `barcodeManagement.sourceBarcodeLabel`, which
 * ItemFormModal writes on create when a product is picked from the ERP list.
 * The ERP products table uses this to decide, per row, whether to show
 * "Publish" or the shop's Status/In the shop/View/Edit/Delete controls.
 */
const listBySource = asyncHandler(async (req, res) => {
  const ids = String(req.query.ids || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) return res.json({ success: true, data: [] });

  let query = Item.find({
    isDeleted: { $ne: true },
    "barcodeManagement.sourceBarcodeLabel": { $in: ids },
  });
  if (req.query.branch) query = query.find({ branch: req.query.branch });
  query = query
    .populate({ path: "group", select: "groupName groupCode" })
    .populate({ path: "subgroup", select: "subgroupName subgroupCode" });

  const docs = await query.lean();
  res.json({ success: true, data: docs });
});

/**
 * Same listing behavior as the generic CRUD list (crudFactory), plus an
 * optional `series` param that restricts results to items whose item code
 * starts with that prefix — lets the storefront tab mirror the ERP tab's
 * 8A-series filter. Overrides baseController.list rather than changing
 * crudFactory itself, since that factory is shared by every other module
 * (Branch, Group, Subgroup, ...) that has no notion of a "series".
 */
const list = asyncHandler(async (req, res) => {
  let query = Item.find();
  if (req.query.branch) query = query.find({ branch: req.query.branch });
  query = query
    .populate({ path: "group", select: "groupName groupCode" })
    .populate({ path: "subgroup", select: "subgroupName subgroupCode" });

  const seriesFilter = String(req.query.series || "").trim();
  if (seriesFilter) {
    const escaped = seriesFilter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query = query.find({ "identity.itemCode": new RegExp(`^${escaped}`, "i") });
  }

  const features = new ApiFeatures(query, req.query)
    .excludeDeleted()
    .search(["identity.productName", "identity.itemCode", "identity.sku", "identity.barcode"])
    .filter(["status", "lifecycleStage", "group", "subgroup"])
    .dateRange("createdAt")
    .sort();

  const pagination = await features.paginate();
  const docs = await features.query.lean();
  res.json({ success: true, data: docs, pagination });
});


/**
 * Mirrors the frontend's image-URL handling: ERP rows store either an
 * absolute URL or a path relative to the deployed host.
 */
const IMAGE_BASE = "https://wovenessence.etpl.ai";
function labelImageUrl(row) {
  const raw =
    row.imageUrl ||
    row.imageURL ||
    row.image_url ||
    (typeof row.image === "string" ? row.image : undefined) ||
    row.filePath;
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  // Inline images (base64 data URIs) are complete as they are; prefixing them
  // with the host produces an unloadable URL.
  if (/^(data|blob):/i.test(s)) return s;
  if (/^\/\//.test(s)) return `https:${s}`;
  return `${IMAGE_BASE}${s.startsWith("/") ? "" : "/"}${s}`;
}

/**
 * Reads a price off an ERP row.
 *
 * The ERP stores prices as strings and uses "" for "not set". An empty string is
 * not null, so `??` treated it as a real value and products published with no
 * price at all — which is what put "Price on request" on the storefront. Anything
 * blank, non-numeric or zero is rejected here so the caller's fallback can run.
 */
function toPrice(value) {
  const n = parseFloat(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Reads a text field off an ERP row.
 *
 * The ERP writes "" rather than leaving a field unset, so a plain `||` chain
 * would still skip a blank but a `??` chain would not. Whitespace-only values
 * are treated as absent too, so the caller's fallback runs for them as well.
 */
function pick(value) {
  const s = String(value ?? "").trim();
  return s || undefined;
}

/**
 * Publishes every ERP product row matching the current q/status/series
 * filters that isn't already in the shop — across all pages, not just the
 * one on screen.
 *
 * Runs server-side so a few thousand rows don't turn into a few thousand
 * round-trips from the browser. Each row becomes an Item filed under the
 * branch's "ERP Products / General" pair (see utils/erpMirror.js) and goes
 * straight to lifecycleStage "published". Rows already linked by
 * barcodeManagement.sourceBarcodeLabel are skipped, so the button is safe to
 * press twice.
 */
const bulkPublishFromLabels = asyncHandler(async (req, res) => {
  const branchId = req.body.branch;
  if (!branchId) {
    res.status(400);
    throw new Error("branch is required");
  }
  const branch = await Branch.findOne({ _id: branchId, isDeleted: { $ne: true } });
  if (!branch) {
    res.status(404);
    throw new Error("Branch not found — reselect the working branch in the sidebar");
  }
  assertBranchAccess(req, branch, "Branch");

  const filter = buildAugustFilter(req.body);
  const rows = await BarcodeLabel.find(filter)
    .select(
      "itemName itemCode barcodeNo barcodeGenerated oldBarcode printDescription supplierDescription hsn mrp retailPrice offerPrice saleRate finalNet status qtyNum imageUrl imageURL image_url filePath image",
    )
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  const ids = rows.map((r) => r._id);
  const already = await Item.find({
    isDeleted: { $ne: true },
    branch: branchId,
    "barcodeManagement.sourceBarcodeLabel": { $in: ids },
  })
    .select("barcodeManagement.sourceBarcodeLabel")
    .lean();
  const linked = new Set(
    already.map((i) => String(i.barcodeManagement?.sourceBarcodeLabel)),
  );
  const targets = rows.filter((r) => !linked.has(String(r._id)));

  const result = {
    total: rows.length,
    published: 0,
    skipped: rows.length - targets.length,
    failed: [],
  };
  if (!targets.length) return res.json({ success: true, data: result });

  const { group, subgroup } = await ensureDefaultGroup(branchId);
  const [groupDoc, subgroupDoc] = await Promise.all([
    Group.findById(group).select("groupCode").lean(),
    Subgroup.findById(subgroup).select("subgroupCode").lean(),
  ]);

  for (const row of targets) {
    // itemName is the product's name in the ERP and is what the shop shows and
    // what the header's category menu groups by. It is blank on some rows, and
    // only then does itemCode stand in for it. The description fields are a last
    // resort so a row can never publish nameless.
    const productName =
      pick(row.itemName) ||
      pick(row.itemCode) ||
      pick(row.printDescription) ||
      pick(row.supplierDescription) ||
      "Untitled product";
    const imageUrl = labelImageUrl(row);
    try {
      const [itemCode, barcode] = await Promise.all([
        Item.generateItemCode(branch.branchCode, groupDoc.groupCode, subgroupDoc.subgroupCode),
        Item.generateBarcode(),
      ]);
      await Item.create({
        branch: branchId,
        group,
        subgroup,
        status: "active",
        lifecycleStage: "published",
        createdBy: req.adminUser?._id,
        updatedBy: req.adminUser?._id,
        identity: { productName, itemCode, barcode },
        tax: { hsnCode: row.hsn ? String(row.hsn) : "" },
        // retailPrice is the shop price. offerPrice, saleRate, finalNet and
        // purRate are cost or wholesale figures and must never reach a shopper,
        // so they are deliberately not used as a fallback: a row with no retail
        // price publishes as "Price on request" instead of leaking margin.
        pricing: {
          mrp: toPrice(row.mrp) ?? toPrice(row.retailPrice),
          sellingPrice: toPrice(row.retailPrice),
        },
        // Stock comes from the ERP row's own status, not from a quantity field
        // that is frequently absent. IN_STOCK means sellable, so it carries the
        // row's quantity (at least 1); SOLD and VOID mean it is gone. Publishing
        // without this left every product at 0 and therefore "Sold out".
        inventory: {
          currentStock:
            row.status === "IN_STOCK"
              ? Number.isFinite(parseFloat(row.qtyNum)) && parseFloat(row.qtyNum) > 0
                ? parseFloat(row.qtyNum)
                : 1
              : 0,
        },
        barcodeManagement: {
          sourceBarcodeLabel: row._id,
          supplierBarcode: row.barcodeGenerated || row.barcodeNo || row.oldBarcode || "",
          internalBarcode: barcode,
          generatedDate: new Date(),
          generatedBy: req.adminUser?._id,
        },
        images: imageUrl
          ? [{ url: imageUrl, filename: "", altText: productName, category: "", sortOrder: 0 }]
          : [],
      });
      result.published += 1;
    } catch (err) {
      result.failed.push(row.itemCode || row.barcodeNo || String(row._id));
    }
  }

  res.json({ success: true, data: result });
});

module.exports = { ...baseController, list, listBySource, create, update, listAugustProducts, bulkPublishFromLabels };
module.exports.OBJECT_SECTIONS = OBJECT_SECTIONS;
module.exports.ARRAY_SECTIONS = ARRAY_SECTIONS;
