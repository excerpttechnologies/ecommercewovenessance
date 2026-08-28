// const asyncHandler = require("express-async-handler");
// const Branch = require("../models/Branch");
// const ApiFeatures = require("../utils/apiFeatures");
// const { exportToExcel, parseExcelBuffer } = require("../utils/excelUtil");
// const { exportToPdf } = require("../utils/pdfUtil");

// // GET /api/woven-essence/branches
// // Supports: q (search), status, lifecycleStage, dateFrom, dateTo, page, limit, sortBy
// const listBranches = asyncHandler(async (req, res) => {
//   const base = new ApiFeatures(Branch.find(), req.query)
//     .excludeDeleted()
//     .search(["branchName", "branchCode", "gstNumber"])
//     .filter(["status", "lifecycleStage"])
//     .dateRange("createdAt")
//     .sort();

//   const pagination = await base.paginate();
//   const branches = await base.query.lean();

//   res.json({ success: true, data: branches, pagination });
// });

// // GET /api/woven-essence/branches/dashboard
// // Mini dashboard metrics required on every listing page per spec 5.1
// const branchDashboard = asyncHandler(async (req, res) => {
//   const [total, active, inactive, draft, published, hold, deleted] = await Promise.all([
//     Branch.countDocuments({ isDeleted: { $ne: true } }),
//     Branch.countDocuments({ isDeleted: { $ne: true }, status: "active" }),
//     Branch.countDocuments({ isDeleted: { $ne: true }, status: "inactive" }),
//     Branch.countDocuments({ isDeleted: { $ne: true }, lifecycleStage: "draft" }),
//     Branch.countDocuments({ isDeleted: { $ne: true }, lifecycleStage: "published" }),
//     Branch.countDocuments({ isDeleted: { $ne: true }, lifecycleStage: "hold" }),
//     Branch.countDocuments({ isDeleted: true }),
//   ]);

//   res.json({
//     success: true,
//     data: { total, active, inactive, draft, published, hold, deleted },
//   });
// });

// // GET /api/woven-essence/branches/:id
// const getBranch = asyncHandler(async (req, res) => {
//   const branch = await Branch.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
//   if (!branch) {
//     res.status(404);
//     throw new Error("Branch not found");
//   }
//   res.json({ success: true, data: branch });
// });

// // POST /api/woven-essence/branches
// const createBranch = asyncHandler(async (req, res) => {
//   const { branchName, address, location, gstNumber, contact, status, lifecycleStage } = req.body;

//   if (!branchName || !branchName.trim()) {
//     res.status(400);
//     throw new Error("Branch name is required");
//   }

//   const branchCode = await Branch.generateBranchCode();

//   const branch = await Branch.create({
//     branchName: branchName.trim(),
//     branchCode,
//     address,
//     location,
//     gstNumber,
//     contact,
//     status: status || "active",
//     lifecycleStage: lifecycleStage || "draft",
//     createdBy: req.adminUser?._id,
//     updatedBy: req.adminUser?._id,
//   });

//   res.status(201).json({ success: true, data: branch });
// });

// // PUT /api/woven-essence/branches/:id
// const updateBranch = asyncHandler(async (req, res) => {
//   const branch = await Branch.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
//   if (!branch) {
//     res.status(404);
//     throw new Error("Branch not found");
//   }

//   const editable = ["branchName", "address", "location", "gstNumber", "contact", "status"];
//   editable.forEach((field) => {
//     if (req.body[field] !== undefined) branch[field] = req.body[field];
//   });
//   branch.updatedBy = req.adminUser?._id;

//   await branch.save();
//   res.json({ success: true, data: branch });
// });

// // PATCH /api/woven-essence/branches/:id/lifecycle  { stage: 'draft'|'published'|'unpublished'|'hold' }
// const setLifecycleStage = asyncHandler(async (req, res) => {
//   const { stage } = req.body;
//   const allowed = ["draft", "published", "unpublished", "hold"];
//   if (!allowed.includes(stage)) {
//     res.status(400);
//     throw new Error(`stage must be one of: ${allowed.join(", ")}`);
//   }

//   const branch = await Branch.findOneAndUpdate(
//     { _id: req.params.id, isDeleted: { $ne: true } },
//     { lifecycleStage: stage, updatedBy: req.adminUser?._id },
//     { new: true }
//   );
//   if (!branch) {
//     res.status(404);
//     throw new Error("Branch not found");
//   }
//   res.json({ success: true, data: branch });
// });

// // DELETE /api/woven-essence/branches/:id  (soft delete, default)
// const softDeleteBranch = asyncHandler(async (req, res) => {
//   const branch = await Branch.findOneAndUpdate(
//     { _id: req.params.id, isDeleted: { $ne: true } },
//     { isDeleted: true, deletedAt: new Date(), deletedBy: req.adminUser?._id },
//     { new: true }
//   );
//   if (!branch) {
//     res.status(404);
//     throw new Error("Branch not found");
//   }
//   res.json({ success: true, message: "Branch soft-deleted", data: branch });
// });

// // DELETE /api/woven-essence/branches/:id/hard  (permanent)
// const hardDeleteBranch = asyncHandler(async (req, res) => {
//   const branch = await Branch.findByIdAndDelete(req.params.id);
//   if (!branch) {
//     res.status(404);
//     throw new Error("Branch not found");
//   }
//   res.json({ success: true, message: "Branch permanently deleted" });
// });

// // POST /api/woven-essence/branches/:id/restore
// const restoreBranch = asyncHandler(async (req, res) => {
//   const branch = await Branch.findOneAndUpdate(
//     { _id: req.params.id, isDeleted: true },
//     { isDeleted: { $ne: true }, deletedAt: null, deletedBy: null },
//     { new: true }
//   );
//   if (!branch) {
//     res.status(404);
//     throw new Error("Deleted branch not found");
//   }
//   res.json({ success: true, data: branch });
// });

// const EXCEL_COLUMNS = [
//   { header: "Branch Code", key: "branchCode", width: 15 },
//   { header: "Branch Name", key: "branchName", width: 30 },
//   { header: "City", key: "city", width: 18 },
//   { header: "State", key: "state", width: 18 },
//   { header: "Pincode", key: "pincode", width: 12 },
//   { header: "GST Number", key: "gstNumber", width: 20 },
//   { header: "Contact Name", key: "contactName", width: 20 },
//   { header: "Contact Phone", key: "contactPhone", width: 16 },
//   { header: "Status", key: "status", width: 12 },
//   { header: "Lifecycle Stage", key: "lifecycleStage", width: 16 },
//   { header: "Created At", key: "createdAt", width: 22 },
// ];

// const flattenForExport = (b) => ({
//   branchCode: b.branchCode,
//   branchName: b.branchName,
//   city: b.address?.city || "",
//   state: b.address?.state || "",
//   pincode: b.address?.pincode || "",
//   gstNumber: b.gstNumber || "",
//   contactName: b.contact?.name || "",
//   contactPhone: b.contact?.phone || "",
//   status: b.status,
//   lifecycleStage: b.lifecycleStage,
//   createdAt: b.createdAt ? new Date(b.createdAt).toLocaleString() : "",
// });

// // GET /api/woven-essence/branches/export/excel
// const exportBranchesExcel = asyncHandler(async (req, res) => {
//   const branches = await Branch.find({ isDeleted: { $ne: true } }).sort("-createdAt").lean();
//   await exportToExcel(res, {
//     sheetName: "Branches",
//     columns: EXCEL_COLUMNS,
//     rows: branches.map(flattenForExport),
//     filename: `branches_${Date.now()}.xlsx`,
//   });
// });

// // GET /api/woven-essence/branches/export/pdf
// const exportBranchesPdf = asyncHandler(async (req, res) => {
//   const branches = await Branch.find({ isDeleted: { $ne: true } }).sort("-createdAt").lean();
//   exportToPdf(res, {
//     title: "Woven Essence - Branch List",
//     columns: EXCEL_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 70 })),
//     rows: branches.map(flattenForExport),
//     filename: `branches_${Date.now()}.pdf`,
//   });
// });

// // POST /api/woven-essence/branches/import/excel  (multipart file field "file")
// const importBranchesExcel = asyncHandler(async (req, res) => {
//   if (!req.file) {
//     res.status(400);
//     throw new Error("No file uploaded (field name must be 'file')");
//   }

//   const rows = await parseExcelBuffer(req.file.buffer);
//   const created = [];
//   const errors = [];

//   for (const [i, row] of rows.entries()) {
//     try {
//       const branchName = row["Branch Name"] || row["branchName"];
//       if (!branchName) throw new Error("Missing Branch Name");

//       const branchCode = await Branch.generateBranchCode();
//       const branch = await Branch.create({
//         branchName: String(branchName).trim(),
//         branchCode,
//         address: {
//           city: row["City"] || "",
//           state: row["State"] || "",
//           pincode: row["Pincode"] ? String(row["Pincode"]) : "",
//         },
//         gstNumber: row["GST Number"] || undefined,
//         contact: {
//           name: row["Contact Name"] || "",
//           phone: row["Contact Phone"] ? String(row["Contact Phone"]) : "",
//         },
//         createdBy: req.adminUser?._id,
//         updatedBy: req.adminUser?._id,
//       });
//       created.push(branch.branchCode);
//     } catch (err) {
//       errors.push({ row: i + 2, message: err.message });
//     }
//   }

//   res.json({ success: true, createdCount: created.length, created, errors });
// });

// module.exports = {
//   listBranches,
//   branchDashboard,
//   getBranch,
//   createBranch,
//   updateBranch,
//   setLifecycleStage,
//   softDeleteBranch,
//   hardDeleteBranch,
//   restoreBranch,
//   exportBranchesExcel,
//   exportBranchesPdf,
//   importBranchesExcel,
// };




const asyncHandler = require("express-async-handler");

/**
 * Restriction pinning a scoped admin to their own branch document.
 *
 * A Branch has no `branch` field — it IS the branch — so the guard filters on
 * _id. Merged into the query rather than checked afterwards so an update or
 * delete can't land before the check runs.
 */
function ownBranchOnly(req) {
  if (isUnrestricted(req.adminUser) || !req.adminUser?.assignedBranch) return {};
  return { _id: req.adminUser.assignedBranch };
}

/**
 * Refuses a by-id request for someone else's branch.
 *
 * Needed because spreading ownBranchOnly() into a query alongside
 * `_id: req.params.id` silently OVERWRITES the requested id — the caller then
 * gets their own branch back with a 200, which looks like success and hides the
 * fact they asked for something they can't have. An explicit comparison 404s
 * instead, and 404 rather than 403 so the id isn't confirmed as real.
 */
function assertOwnBranchParam(req) {
  if (isUnrestricted(req.adminUser)) return;
  const assigned = req.adminUser?.assignedBranch;
  if (!assigned) {
    const err = new Error("Your account isn't assigned to a branch");
    err.statusCode = 403;
    throw err;
  }
  if (String(req.params.id) !== String(assigned)) {
    const err = new Error("Branch not found");
    err.statusCode = 404;
    throw err;
  }
}

const Branch = require("../models/Branch");
const ApiFeatures = require("../utils/apiFeatures");
const { exportToExcel, parseExcelBuffer } = require("../utils/excelUtil");
const { exportToPdf } = require("../utils/pdfUtil");
const { isUnrestricted } = require("../middleware/branchScope");

// GET /api/woven-essence/branches
// Supports: q (search), status, lifecycleStage, dateFrom, dateTo, page, limit, sortBy
const listBranches = asyncHandler(async (req, res) => {
  // A scoped admin lists only their own branch, so the sidebar selector and
  // every downstream screen can only ever point at it.
  const base = new ApiFeatures(Branch.find(ownBranchOnly(req)), req.query)
    .excludeDeleted()
    .search(["branchName", "branchCode", "gstNumber"])
    .filter(["status", "lifecycleStage"])
    .dateRange("createdAt")
    .sort();

  const pagination = await base.paginate();
  const branches = await base.query.lean();

  res.json({ success: true, data: branches, pagination });
});

// GET /api/woven-essence/branches/dashboard
// Mini dashboard metrics required on every listing page per spec 5.1
const branchDashboard = asyncHandler(async (req, res) => {
  const own = ownBranchOnly(req);
  const [total, active, inactive, draft, published, hold, deleted] = await Promise.all([
    Branch.countDocuments({ ...own, isDeleted: { $ne: true } }),
    Branch.countDocuments({ ...own, isDeleted: { $ne: true }, status: "active" }),
    Branch.countDocuments({ ...own, isDeleted: { $ne: true }, status: "inactive" }),
    Branch.countDocuments({ ...own, isDeleted: { $ne: true }, lifecycleStage: "draft" }),
    Branch.countDocuments({ ...own, isDeleted: { $ne: true }, lifecycleStage: "published" }),
    Branch.countDocuments({ ...own, isDeleted: { $ne: true }, lifecycleStage: "hold" }),
    Branch.countDocuments({ ...own, isDeleted: true }),
  ]);

  res.json({
    success: true,
    data: { total, active, inactive, draft, published, hold, deleted },
  });
});

// GET /api/woven-essence/branches/:id
const getBranch = asyncHandler(async (req, res) => {
  assertOwnBranchParam(req);
  const branch = await Branch.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
  if (!branch) {
    res.status(404);
    throw new Error("Branch not found");
  }
  res.json({ success: true, data: branch });
});

// POST /api/woven-essence/branches
const createBranch = asyncHandler(async (req, res) => {
  const { branchName, address, location, gstNumber, contact, status, lifecycleStage } = req.body;

  if (!branchName || !branchName.trim()) {
    res.status(400);
    throw new Error("Branch name is required");
  }

  const branchCode = await Branch.generateBranchCode();

  const branch = await Branch.create({
    branchName: branchName.trim(),
    branchCode,
    address,
    location,
    gstNumber,
    contact,
    status: status || "active",
    lifecycleStage: lifecycleStage || "draft",
    createdBy: req.adminUser?._id,
    updatedBy: req.adminUser?._id,
  });

  res.status(201).json({ success: true, data: branch });
});

// PUT /api/woven-essence/branches/:id
const updateBranch = asyncHandler(async (req, res) => {
  assertOwnBranchParam(req);
  const branch = await Branch.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
  if (!branch) {
    res.status(404);
    throw new Error("Branch not found");
  }

  const editable = ["branchName", "address", "location", "gstNumber", "contact", "status"];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) branch[field] = req.body[field];
  });
  branch.updatedBy = req.adminUser?._id;

  await branch.save();
  res.json({ success: true, data: branch });
});

// PATCH /api/woven-essence/branches/:id/lifecycle  { stage: 'draft'|'published'|'unpublished'|'hold' }
const setLifecycleStage = asyncHandler(async (req, res) => {
  assertOwnBranchParam(req);
  const { stage } = req.body;
  const allowed = ["draft", "published", "unpublished", "hold"];
  if (!allowed.includes(stage)) {
    res.status(400);
    throw new Error(`stage must be one of: ${allowed.join(", ")}`);
  }

  const branch = await Branch.findOneAndUpdate(
    { _id: req.params.id, isDeleted: { $ne: true } },
    { lifecycleStage: stage, updatedBy: req.adminUser?._id },
    { new: true }
  );
  if (!branch) {
    res.status(404);
    throw new Error("Branch not found");
  }
  res.json({ success: true, data: branch });
});

// DELETE /api/woven-essence/branches/:id  (soft delete, default)
const softDeleteBranch = asyncHandler(async (req, res) => {
  assertOwnBranchParam(req);
  const branch = await Branch.findOneAndUpdate(
    { _id: req.params.id, isDeleted: { $ne: true } },
    { isDeleted: true, deletedAt: new Date(), deletedBy: req.adminUser?._id },
    { new: true }
  );
  if (!branch) {
    res.status(404);
    throw new Error("Branch not found");
  }
  res.json({ success: true, message: "Branch soft-deleted", data: branch });
});

// DELETE /api/woven-essence/branches/:id/hard  (permanent)
const hardDeleteBranch = asyncHandler(async (req, res) => {
  assertOwnBranchParam(req);
  const branch = await Branch.findOneAndDelete({ _id: req.params.id });
  if (!branch) {
    res.status(404);
    throw new Error("Branch not found");
  }
  res.json({ success: true, message: "Branch permanently deleted" });
});

// POST /api/woven-essence/branches/:id/restore
const restoreBranch = asyncHandler(async (req, res) => {
  assertOwnBranchParam(req);
  const branch = await Branch.findOneAndUpdate(
    { _id: req.params.id, isDeleted: true },
    { isDeleted: { $ne: true }, deletedAt: null, deletedBy: null },
    { new: true }
  );
  if (!branch) {
    res.status(404);
    throw new Error("Deleted branch not found");
  }
  res.json({ success: true, data: branch });
});

const EXCEL_COLUMNS = [
  { header: "Branch Code", key: "branchCode", width: 15 },
  { header: "Branch Name", key: "branchName", width: 30 },
  { header: "City", key: "city", width: 18 },
  { header: "State", key: "state", width: 18 },
  { header: "Pincode", key: "pincode", width: 12 },
  { header: "GST Number", key: "gstNumber", width: 20 },
  { header: "Contact Name", key: "contactName", width: 20 },
  { header: "Contact Phone", key: "contactPhone", width: 16 },
  { header: "Status", key: "status", width: 12 },
  { header: "Lifecycle Stage", key: "lifecycleStage", width: 16 },
  { header: "Created At", key: "createdAt", width: 22 },
];

const flattenForExport = (b) => ({
  branchCode: b.branchCode,
  branchName: b.branchName,
  city: b.address?.city || "",
  state: b.address?.state || "",
  pincode: b.address?.pincode || "",
  gstNumber: b.gstNumber || "",
  contactName: b.contact?.name || "",
  contactPhone: b.contact?.phone || "",
  status: b.status,
  lifecycleStage: b.lifecycleStage,
  createdAt: b.createdAt ? new Date(b.createdAt).toLocaleString() : "",
});

// GET /api/woven-essence/branches/export/excel
const exportBranchesExcel = asyncHandler(async (req, res) => {
  const branches = await Branch.find({ isDeleted: { $ne: true } }).sort("-createdAt").lean();
  await exportToExcel(res, {
    sheetName: "Branches",
    columns: EXCEL_COLUMNS,
    rows: branches.map(flattenForExport),
    filename: `branches_${Date.now()}.xlsx`,
  });
});

// GET /api/woven-essence/branches/export/pdf
const exportBranchesPdf = asyncHandler(async (req, res) => {
  const branches = await Branch.find({ isDeleted: { $ne: true } }).sort("-createdAt").lean();
  exportToPdf(res, {
    title: "Woven Essence - Branch List",
    columns: EXCEL_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 70 })),
    rows: branches.map(flattenForExport),
    filename: `branches_${Date.now()}.pdf`,
  });
});

// POST /api/woven-essence/branches/import/excel  (multipart file field "file")
const importBranchesExcel = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded (field name must be 'file')");
  }

  const rows = await parseExcelBuffer(req.file.buffer);
  const created = [];
  const errors = [];

  for (const [i, row] of rows.entries()) {
    try {
      const branchName = row["Branch Name"] || row["branchName"];
      if (!branchName) throw new Error("Missing Branch Name");

      const branchCode = await Branch.generateBranchCode();
      const branch = await Branch.create({
        branchName: String(branchName).trim(),
        branchCode,
        address: {
          city: row["City"] || "",
          state: row["State"] || "",
          pincode: row["Pincode"] ? String(row["Pincode"]) : "",
        },
        gstNumber: row["GST Number"] || undefined,
        contact: {
          name: row["Contact Name"] || "",
          phone: row["Contact Phone"] ? String(row["Contact Phone"]) : "",
        },
        createdBy: req.adminUser?._id,
        updatedBy: req.adminUser?._id,
      });
      created.push(branch.branchCode);
    } catch (err) {
      errors.push({ row: i + 2, message: err.message });
    }
  }

  res.json({ success: true, createdCount: created.length, created, errors });
});

module.exports = {
  listBranches,
  branchDashboard,
  getBranch,
  createBranch,
  updateBranch,
  setLifecycleStage,
  softDeleteBranch,
  hardDeleteBranch,
  restoreBranch,
  exportBranchesExcel,
  exportBranchesPdf,
  importBranchesExcel,
};