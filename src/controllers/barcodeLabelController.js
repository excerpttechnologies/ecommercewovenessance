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

// Fields as they actually exist on real barcodeLabel documents, plus the
// original/legacy names kept for backward compatibility with any records
// that may still use them. barcodeNo / barcodeGenerated are included so
// barcode search actually matches.
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

const projection = LABEL_FIELDS.join(" ");

/** Escapes user input so it's safe to embed inside a MongoDB $regex string. */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Returns barcode-label products created on or after August 1, 2026. */
const listAugustProducts = asyncHandler(async (req, res) => {
  const search = String(req.query.q || "").trim();
  const statusFilter = String(req.query.status || "").trim();

  const filter = {
    imageUrl: { $exists: true, $nin: ["", null] },
    createdAt: { $gte: new Date("2026-08-01T00:00:00.000Z") },
    // NOTE: the old hardcoded `itemCode: /^8A/i` filter was removed here —
    // it required every itemCode to start with "8A", which real documents
    // (e.g. "sk-10") never match, and was silently filtering out everything.
  };

  if (statusFilter) {
    filter.status = new RegExp(`^${escapeRegExp(statusFilter)}$`, "i");
  }

  if (search) {
    const safeSearch = escapeRegExp(search);
    filter.$and = [
      {
        $or: LABEL_FIELDS.filter((field) => field !== "createdAt").map(
          (field) => ({ [field]: { $regex: safeSearch, $options: "i" } }),
        ),
      },
    ];
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
  console.log("barcodeLabel filtered query", {
    filter,
    totalFilteredRecords: total,
    recordsReturned: documents.length,
    page,
    limit,
  });

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
