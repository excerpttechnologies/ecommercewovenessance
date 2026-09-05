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
const Item = require("../models/Item");
const Branch = require("../models/Branch");
const Group = require("../models/Group");
const Subgroup = require("../models/Subgroup");
const { assertBranchAccess } = require("../middleware/branchScope");
const { listAugustProducts } = require("./barcodeLabelController");

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

module.exports = { ...baseController, create, update, listAugustProducts };
module.exports.OBJECT_SECTIONS = OBJECT_SECTIONS;
module.exports.ARRAY_SECTIONS = ARRAY_SECTIONS;
