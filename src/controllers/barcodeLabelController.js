// const asyncHandler = require("express-async-handler");
// const BarcodeLabel = require("../models/BarcodeLabel");

// const LABEL_FIELDS = [
//   "grcId",
//   "supplierId",
//   "groupId",
//   "oldBarcode",
//   "itemCode",
//   "barcodeNo",
//   "batchUnique",
//   "billsNo",
//   "seq",
//   "dummy",
//   "supplierDescription",
//   "qty",
//   "uom",
//   "hsn",
//   "mrp",
//   "saleRate",
//   "discount",
//   "tax",
//   "cgst",
//   "sgst",
//   "igst",
//   "cess",
//   "saleNet",
//   "totalNet",
//   "printDescription",
//   "imageUrl",
//   "imageURL",
//   "image_url",
//   "filePath",
//   "image",
//   "createdAt",
// ];

// const projection = LABEL_FIELDS.join(" ");

// /** Returns barcode-label products created on or after August 1, 2026. */
// const listAugustProducts = asyncHandler(async (req, res) => {
//   const search = String(req.query.q || "").trim();
//   const filter = {
//     itemCode: /^8A/i,
//     imageUrl: { $exists: true, $nin: ["", null] },
//     createdAt: { $gte: new Date("2026-08-01T00:00:00.000Z") },
//   };

//   if (search) {
//     filter.$and = [
//       {
//         $or: LABEL_FIELDS.filter((field) => field !== "createdAt").map(
//           (field) => ({ [field]: { $regex: search, $options: "i" } }),
//         ),
//       },
//     ];
//   }

//   const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
//   const page = Math.max(Number(req.query.page) || 1, 1);
//   const [documents, total] = await Promise.all([
//     BarcodeLabel.find(filter)
//       .select(projection)
//       .sort({ createdAt: -1, _id: -1 })
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .lean(),
//     BarcodeLabel.countDocuments(filter),
//   ]);
//   console.log("barcodeLabel filtered query", {
//     filter,
//     totalFilteredRecords: total,
//     recordsReturned: documents.length,
//     page,
//     limit,
//   });

//   res.json({
//     success: true,
//     startDate: "2026-08-01T00:00:00.000Z",
//     data: documents,
//     pagination: {
//       page,
//       limit,
//       total,
//       totalPages: Math.max(Math.ceil(total / limit), 1),
//     },
//   });
// });

// module.exports = { listAugustProducts };

const asyncHandler = require("express-async-handler");
const BarcodeLabel = require("../models/BarcodeLabel");

// Full field list — used ONLY for projection (which columns to return).
const LABEL_FIELDS = [
  "grcId",
  "supplierId",
  "groupId",
  "oldBarcode",
  "itemCode",
  "barcodeNo",
  "barcodeGenerated",
  "batchUnique",
  "batchType",
  "billSlNo",
  "billsNo",
  "billingNo",
  "seq",
  "serialNo",
  "dummy",
  "supplierDescription",
  "printDescription",
  "qty",
  "qtyNum",
  "uom",
  "uomType",
  "hsn",
  "retailPrice",
  "mrp",
  "purRate",
  "offerPrice",
  "saleRate",
  "disc",
  "disc2",
  "discount",
  "gst",
  "tax",
  "cgst",
  "sgst",
  "igst",
  "cess",
  "finalNet",
  "saleNet",
  "totalNet",
  "wspPrice",
  "dpPrice",
  "fma",
  "silkMark",
  "status",
  "imageUrl",
  "imageURL",
  "image_url",
  "filePath",
  "image",
  "createdAt",
];

// Narrow field list — used ONLY for the search $or. Only identifier/text
// fields belong here. Price, tax, qty, discount fields are intentionally
// excluded: matching a search term against those was making almost every
// document match (21417 out of ~21417 total), i.e. the search wasn't
// restricting anything.
const SEARCH_FIELDS = [
  "grcId",
  "supplierId",
  "groupId",
  "oldBarcode",
  "itemCode",
  "barcodeNo",
  "barcodeGenerated",
  "batchUnique",
  "billSlNo",
  "billsNo",
  "billingNo",
  "supplierDescription",
  "printDescription",
  "hsn",
];

const projection = LABEL_FIELDS.join(" ");

/** Escapes user input so it's safe to embed inside a MongoDB $regex string. */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Returns barcode-label products created on or after August 1, 2026. */
const listAugustProducts = asyncHandler(async (req, res) => {
  const search = String(req.query.q || "").trim();
  const statusFilter = String(req.query.status || "").trim();
  const seriesFilter = String(req.query.series || "").trim();

  // NOTE: there used to be an `imageUrl: { $exists: true, $nin: ["", null] }`
  // gate here. It never actually ran (see models/BarcodeLabel.js — strictQuery
  // was stripping the whole filter), and switching it on would have hidden 563
  // of the ~21.4k rows staff already work with, including every record matching
  // a description search. The table renders a "No image" placeholder by design,
  // so rows without artwork belong in the list.
  const filter = {
    createdAt: { $gte: new Date("2026-08-01T00:00:00.000Z") },
  };

  if (statusFilter) {
    filter.status = new RegExp(`^${escapeRegExp(statusFilter)}$`, "i");
  }

  // If a series parameter is provided (e.g. series=8A) restrict rows to those
  // whose identifier starts with the series string. This checks the ERP's
  // identifier fields so the frontend can ask the server for only the 8A series.
  if (seriesFilter) {
    const escaped = escapeRegExp(seriesFilter);
    const anchored = new RegExp(`^${escaped}`, "i");
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { itemCode: anchored },
        { barcodeNo: anchored },
        { barcodeGenerated: anchored },
        { oldBarcode: anchored },
      ],
    });
  }

  if (search) {
    const safeSearch = escapeRegExp(search);
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: SEARCH_FIELDS.map((field) => ({
        [field]: { $regex: safeSearch, $options: "i" },
      })),
    });
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [documents, total] = await Promise.all([
    BarcodeLabel.find(filter)
      .select(projection)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BarcodeLabel.countDocuments(filter),
  ]);

  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");

  res.json({
    success: true,
    startDate: "2026-08-01T00:00:00.000Z",
    data: documents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
});

module.exports = { listAugustProducts };
