// const asyncHandler = require("express-async-handler");
// const ApiFeatures = require("./apiFeatures");
// const { exportToExcel, parseExcelBuffer } = require("./excelUtil");
// const { exportToPdf } = require("./pdfUtil");

// /**
//  * Builds a full set of Express handlers (list/dashboard/get/create/update/
//  * lifecycle/soft-delete/hard-delete/restore/export/import) for a Mongoose
//  * model that follows the standard Woven Essence admin conventions:
//  * status (active/inactive), lifecycleStage (draft/published/unpublished/hold),
//  * isDeleted soft-delete, createdBy/updatedBy audit fields.
//  *
//  * This is the pattern every listing-page module in Section 5.1 shares, so it's
//  * built once here instead of re-implemented per module (Branch was written
//  * before this factory existed and is kept as its own explicit controller for
//  * clarity as the reference implementation; everything after Branch uses this).
//  */
// function buildCrudController(Model, config) {
//   const {
//     entityName, // "Group"
//     searchFields, // ["groupName", "groupCode"]
//     filterFields = ["status", "lifecycleStage"],
//     branchScoped = true, // if true, requires/filters by req.query.branch or req.body.branch
//     editableFields, // fields updateable via PUT
//     exportColumns, // [{ header, key, width }]
//     flattenForExport, // (doc) => plain row object
//     beforeCreate, // async (body, req) => extra fields to merge into the create payload
//     populate = [], // paths to populate on list/get
//   } = config;

//   const list = asyncHandler(async (req, res) => {
//     let query = Model.find();
//     if (branchScoped && req.query.branch) query = query.find({ branch: req.query.branch });
//     populate.forEach((p) => (query = query.populate(p)));

//     const features = new ApiFeatures(query, req.query)
//       .excludeDeleted()
//       .search(searchFields)
//       .filter(filterFields)
//       .dateRange("createdAt")
//       .sort();

//     const pagination = await features.paginate();
//     const docs = await features.query.lean();
//     res.json({ success: true, data: docs, pagination });
//   });

//   const dashboard = asyncHandler(async (req, res) => {
//     const scope = { isDeleted: { $ne: true } };
//     if (branchScoped && req.query.branch) scope.branch = req.query.branch;

//     const [total, active, inactive, draft, published, hold, deleted] = await Promise.all([
//       Model.countDocuments(scope),
//       Model.countDocuments({ ...scope, status: "active" }),
//       Model.countDocuments({ ...scope, status: "inactive" }),
//       Model.countDocuments({ ...scope, lifecycleStage: "draft" }),
//       Model.countDocuments({ ...scope, lifecycleStage: "published" }),
//       Model.countDocuments({ ...scope, lifecycleStage: "hold" }),
//       Model.countDocuments({ ...(branchScoped && req.query.branch ? { branch: req.query.branch } : {}), isDeleted: true }),
//     ]);

//     res.json({ success: true, data: { total, active, inactive, draft, published, hold, deleted } });
//   });

//   const getOne = asyncHandler(async (req, res) => {
//     let query = Model.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
//     populate.forEach((p) => (query = query.populate(p)));
//     const doc = await query;
//     if (!doc) {
//       res.status(404);
//       throw new Error(`${entityName} not found`);
//     }
//     res.json({ success: true, data: doc });
//   });

//   const create = asyncHandler(async (req, res) => {
//     const extra = beforeCreate ? await beforeCreate(req.body, req) : {};
//     const doc = await Model.create({
//       ...req.body,
//       ...extra,
//       createdBy: req.adminUser?._id,
//       updatedBy: req.adminUser?._id,
//     });
//     res.status(201).json({ success: true, data: doc });
//   });

//   const update = asyncHandler(async (req, res) => {
//     const doc = await Model.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
//     if (!doc) {
//       res.status(404);
//       throw new Error(`${entityName} not found`);
//     }
//     editableFields.forEach((field) => {
//       if (req.body[field] !== undefined) doc[field] = req.body[field];
//     });
//     doc.updatedBy = req.adminUser?._id;
//     await doc.save();
//     res.json({ success: true, data: doc });
//   });

//   const setLifecycleStage = asyncHandler(async (req, res) => {
//     const allowed = ["draft", "published", "unpublished", "hold"];
//     if (!allowed.includes(req.body.stage)) {
//       res.status(400);
//       throw new Error(`stage must be one of: ${allowed.join(", ")}`);
//     }
//     const doc = await Model.findOneAndUpdate(
//       { _id: req.params.id, isDeleted: { $ne: true } },
//       { lifecycleStage: req.body.stage, updatedBy: req.adminUser?._id },
//       { new: true }
//     );
//     if (!doc) {
//       res.status(404);
//       throw new Error(`${entityName} not found`);
//     }
//     res.json({ success: true, data: doc });
//   });

//   const softDelete = asyncHandler(async (req, res) => {
//     const doc = await Model.findOneAndUpdate(
//       { _id: req.params.id, isDeleted: { $ne: true } },
//       { isDeleted: true, deletedAt: new Date(), deletedBy: req.adminUser?._id },
//       { new: true }
//     );
//     if (!doc) {
//       res.status(404);
//       throw new Error(`${entityName} not found`);
//     }
//     res.json({ success: true, message: `${entityName} soft-deleted`, data: doc });
//   });

//   const hardDelete = asyncHandler(async (req, res) => {
//     const doc = await Model.findByIdAndDelete(req.params.id);
//     if (!doc) {
//       res.status(404);
//       throw new Error(`${entityName} not found`);
//     }
//     res.json({ success: true, message: `${entityName} permanently deleted` });
//   });

//   const restore = asyncHandler(async (req, res) => {
//     const doc = await Model.findOneAndUpdate(
//       { _id: req.params.id, isDeleted: true },
//       { isDeleted: { $ne: true }, deletedAt: null, deletedBy: null },
//       { new: true }
//     );
//     if (!doc) {
//       res.status(404);
//       throw new Error(`Deleted ${entityName.toLowerCase()} not found`);
//     }
//     res.json({ success: true, data: doc });
//   });

//   const exportExcel = asyncHandler(async (req, res) => {
//     const scope = { isDeleted: { $ne: true } };
//     if (branchScoped && req.query.branch) scope.branch = req.query.branch;
//     let q = Model.find(scope).sort("-createdAt");
//     populate.forEach((p) => (q = q.populate(p)));
//     const docs = await q.lean();
//     await exportToExcel(res, {
//       sheetName: entityName,
//       columns: exportColumns,
//       rows: docs.map(flattenForExport),
//       filename: `${entityName.toLowerCase()}s_${Date.now()}.xlsx`,
//     });
//   });

//   const exportPdf = asyncHandler(async (req, res) => {
//     const scope = { isDeleted: { $ne: true } };
//     if (branchScoped && req.query.branch) scope.branch = req.query.branch;
//     let q = Model.find(scope).sort("-createdAt");
//     populate.forEach((p) => (q = q.populate(p)));
//     const docs = await q.lean();
//     exportToPdf(res, {
//       title: `Woven Essence - ${entityName} List`,
//       columns: exportColumns.map((c) => ({ header: c.header, key: c.key, width: 70 })),
//       rows: docs.map(flattenForExport),
//       filename: `${entityName.toLowerCase()}s_${Date.now()}.pdf`,
//     });
//   });

//   const importExcel = asyncHandler(async (req, res) => {
//     if (!req.file) {
//       res.status(400);
//       throw new Error("No file uploaded (field name must be 'file')");
//     }
//     const rows = await parseExcelBuffer(req.file.buffer);
//     const created = [];
//     const errors = [];

//     for (const [i, row] of rows.entries()) {
//       try {
//         if (!config.importRow) throw new Error("Import not configured for this module");
//         const payload = await config.importRow(row, req);
//         const extra = beforeCreate ? await beforeCreate(payload, req) : {};
//         const doc = await Model.create({
//           ...payload,
//           ...extra,
//           createdBy: req.adminUser?._id,
//           updatedBy: req.adminUser?._id,
//         });
//         created.push(doc._id);
//       } catch (err) {
//         errors.push({ row: i + 2, message: err.message });
//       }
//     }
//     res.json({ success: true, createdCount: created.length, errors });
//   });

//   return {
//     list,
//     dashboard,
//     getOne,
//     create,
//     update,
//     setLifecycleStage,
//     softDelete,
//     hardDelete,
//     restore,
//     exportExcel,
//     exportPdf,
//     importExcel,
//   };
// }

// module.exports = buildCrudController;










const asyncHandler = require("express-async-handler");
const ApiFeatures = require("./apiFeatures");
const { exportToExcel, parseExcelBuffer } = require("./excelUtil");
const { exportToPdf } = require("./pdfUtil");
const { assertBranchAccess, isUnrestricted } = require("../middleware/branchScope");

/**
 * Builds a full set of Express handlers (list/dashboard/get/create/update/
 * lifecycle/soft-delete/hard-delete/restore/export/import) for a Mongoose
 * model that follows the standard Woven Essence admin conventions:
 * status (active/inactive), lifecycleStage (draft/published/unpublished/hold),
 * isDeleted soft-delete, createdBy/updatedBy audit fields.
 *
 * This is the pattern every listing-page module in Section 5.1 shares, so it's
 * built once here instead of re-implemented per module (Branch was written
 * before this factory existed and is kept as its own explicit controller for
 * clarity as the reference implementation; everything after Branch uses this).
 */
function buildCrudController(Model, config) {
  const {
    entityName, // "Group"
    searchFields, // ["groupName", "groupCode"]
    filterFields = ["status", "lifecycleStage"],
    branchScoped = true, // if true, requires/filters by req.query.branch or req.body.branch
    editableFields, // fields updateable via PUT
    exportColumns, // [{ header, key, width }]
    flattenForExport, // (doc) => plain row object
    beforeCreate, // async (body, req) => extra fields to merge into the create payload
    populate = [], // paths to populate on list/get
  } = config;

  /**
   * Extra filter pinning a scoped admin to their own branch.
   *
   * Merged into the by-id queries rather than checked afterwards, because
   * findOneAndUpdate and findByIdAndDelete would already have written to
   * another branch's document by the time a post-hoc check could refuse.
   */
  const branchGuard = (req) =>
    !branchScoped || isUnrestricted(req.adminUser) || !req.adminUser?.assignedBranch
      ? {}
      : { branch: req.adminUser.assignedBranch };

  const list = asyncHandler(async (req, res) => {
    let query = Model.find();
    if (branchScoped && req.query.branch) query = query.find({ branch: req.query.branch });
    populate.forEach((p) => (query = query.populate(p)));

    const features = new ApiFeatures(query, req.query)
      .excludeDeleted()
      .search(searchFields)
      .filter(filterFields)
      .dateRange("createdAt")
      .sort();

    const pagination = await features.paginate();
    const docs = await features.query.lean();
    res.json({ success: true, data: docs, pagination });
  });

  const dashboard = asyncHandler(async (req, res) => {
    const scope = { isDeleted: { $ne: true } };
    if (branchScoped && req.query.branch) scope.branch = req.query.branch;

    const [total, active, inactive, draft, published, hold, deleted] = await Promise.all([
      Model.countDocuments(scope),
      Model.countDocuments({ ...scope, status: "active" }),
      Model.countDocuments({ ...scope, status: "inactive" }),
      Model.countDocuments({ ...scope, lifecycleStage: "draft" }),
      Model.countDocuments({ ...scope, lifecycleStage: "published" }),
      Model.countDocuments({ ...scope, lifecycleStage: "hold" }),
      Model.countDocuments({ ...(branchScoped && req.query.branch ? { branch: req.query.branch } : {}), isDeleted: true }),
    ]);

    res.json({ success: true, data: { total, active, inactive, draft, published, hold, deleted } });
  });

  const getOne = asyncHandler(async (req, res) => {
    let query = Model.findOne({ _id: req.params.id, isDeleted: { $ne: true }, ...branchGuard(req) });
    populate.forEach((p) => (query = query.populate(p)));
    const doc = await query;
    if (!doc) {
      res.status(404);
      throw new Error(`${entityName} not found`);
    }
    // An id alone locates the record, so query scoping can't protect this.
    assertBranchAccess(req, doc, entityName);
    res.json({ success: true, data: doc });
  });

  const create = asyncHandler(async (req, res) => {
    const extra = beforeCreate ? await beforeCreate(req.body, req) : {};
    const doc = await Model.create({
      ...req.body,
      ...extra,
      createdBy: req.adminUser?._id,
      updatedBy: req.adminUser?._id,
    });
    res.status(201).json({ success: true, data: doc });
  });

  const update = asyncHandler(async (req, res) => {
    const doc = await Model.findOne({ _id: req.params.id, isDeleted: { $ne: true }, ...branchGuard(req) });
    if (!doc) {
      res.status(404);
      throw new Error(`${entityName} not found`);
    }
    assertBranchAccess(req, doc, entityName);
    editableFields.forEach((field) => {
      if (req.body[field] !== undefined) doc[field] = req.body[field];
    });
    doc.updatedBy = req.adminUser?._id;
    await doc.save();
    res.json({ success: true, data: doc });
  });

  const setLifecycleStage = asyncHandler(async (req, res) => {
    const allowed = ["draft", "published", "unpublished", "hold"];
    if (!allowed.includes(req.body.stage)) {
      res.status(400);
      throw new Error(`stage must be one of: ${allowed.join(", ")}`);
    }
    const doc = await Model.findOneAndUpdate(
      { _id: req.params.id, isDeleted: { $ne: true }, ...branchGuard(req) },
      { lifecycleStage: req.body.stage, updatedBy: req.adminUser?._id },
      { new: true }
    );
    if (!doc) {
      res.status(404);
      throw new Error(`${entityName} not found`);
    }
    res.json({ success: true, data: doc });
  });

  const softDelete = asyncHandler(async (req, res) => {
    const doc = await Model.findOneAndUpdate(
      { _id: req.params.id, isDeleted: { $ne: true }, ...branchGuard(req) },
      { isDeleted: true, deletedAt: new Date(), deletedBy: req.adminUser?._id },
      { new: true }
    );
    if (!doc) {
      res.status(404);
      throw new Error(`${entityName} not found`);
    }
    res.json({ success: true, message: `${entityName} soft-deleted`, data: doc });
  });

  const hardDelete = asyncHandler(async (req, res) => {
    const doc = await Model.findOneAndDelete({ _id: req.params.id, ...branchGuard(req) });
    if (!doc) {
      res.status(404);
      throw new Error(`${entityName} not found`);
    }
    res.json({ success: true, message: `${entityName} permanently deleted` });
  });

  const restore = asyncHandler(async (req, res) => {
    const doc = await Model.findOneAndUpdate(
      { _id: req.params.id, isDeleted: true, ...branchGuard(req) },
      { isDeleted: false, deletedAt: null, deletedBy: null },
      { new: true }
    );
    if (!doc) {
      res.status(404);
      throw new Error(`Deleted ${entityName.toLowerCase()} not found`);
    }
    res.json({ success: true, data: doc });
  });

  const exportExcel = asyncHandler(async (req, res) => {
    const scope = { isDeleted: { $ne: true } };
    if (branchScoped && req.query.branch) scope.branch = req.query.branch;
    let q = Model.find(scope).sort("-createdAt");
    populate.forEach((p) => (q = q.populate(p)));
    const docs = await q.lean();
    await exportToExcel(res, {
      sheetName: entityName,
      columns: exportColumns,
      rows: docs.map(flattenForExport),
      filename: `${entityName.toLowerCase()}s_${Date.now()}.xlsx`,
    });
  });

  const exportPdf = asyncHandler(async (req, res) => {
    const scope = { isDeleted: { $ne: true } };
    if (branchScoped && req.query.branch) scope.branch = req.query.branch;
    let q = Model.find(scope).sort("-createdAt");
    populate.forEach((p) => (q = q.populate(p)));
    const docs = await q.lean();
    exportToPdf(res, {
      title: `Woven Essence - ${entityName} List`,
      columns: exportColumns.map((c) => ({ header: c.header, key: c.key, width: 70 })),
      rows: docs.map(flattenForExport),
      filename: `${entityName.toLowerCase()}s_${Date.now()}.pdf`,
    });
  });

  const importExcel = asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400);
      throw new Error("No file uploaded (field name must be 'file')");
    }
    const rows = await parseExcelBuffer(req.file.buffer);
    const created = [];
    const errors = [];

    for (const [i, row] of rows.entries()) {
      try {
        if (!config.importRow) throw new Error("Import not configured for this module");
        const payload = await config.importRow(row, req);
        const extra = beforeCreate ? await beforeCreate(payload, req) : {};
        const doc = await Model.create({
          ...payload,
          ...extra,
          createdBy: req.adminUser?._id,
          updatedBy: req.adminUser?._id,
        });
        created.push(doc._id);
      } catch (err) {
        errors.push({ row: i + 2, message: err.message });
      }
    }
    res.json({ success: true, createdCount: created.length, errors });
  });

  return {
    list,
    dashboard,
    getOne,
    create,
    update,
    setLifecycleStage,
    softDelete,
    hardDelete,
    restore,
    exportExcel,
    exportPdf,
    importExcel,
  };
}

module.exports = buildCrudController;