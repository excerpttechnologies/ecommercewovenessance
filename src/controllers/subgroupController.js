const buildCrudController = require("../utils/crudFactory");
const Subgroup = require("../models/Subgroup");
const Group = require("../models/Group");

const controller = buildCrudController(Subgroup, {
  entityName: "Subgroup",
  searchFields: ["subgroupName", "subgroupCode", "description"],
  filterFields: ["status", "lifecycleStage", "group"],
  branchScoped: true,
  editableFields: ["subgroupName", "subgroupCode", "description", "status"],
  populate: [{ path: "group", select: "groupName groupCode" }],
  exportColumns: [
    { header: "Subgroup Code", key: "subgroupCode", width: 16 },
    { header: "Subgroup Name", key: "subgroupName", width: 30 },
    { header: "Group", key: "groupName", width: 24 },
    { header: "Description", key: "description", width: 36 },
    { header: "Status", key: "status", width: 12 },
    { header: "Lifecycle Stage", key: "lifecycleStage", width: 16 },
    { header: "Created At", key: "createdAt", width: 22 },
  ],
  flattenForExport: (s) => ({
    subgroupCode: s.subgroupCode,
    subgroupName: s.subgroupName,
    groupName: s.group?.groupName || "",
    description: s.description || "",
    status: s.status,
    lifecycleStage: s.lifecycleStage,
    createdAt: s.createdAt ? new Date(s.createdAt).toLocaleString() : "",
  }),
  beforeCreate: async (body) => {
    // The branch is DERIVED from the parent group below, never sent by the
    // client — demanding it here contradicted that and made subgroup creation
    // fail every time with "branch is required".
    if (!body.group) throw new Error("group is required");
    if (!body.subgroupCode || !body.subgroupCode.trim()) throw new Error("subgroupCode is required");

    // { $ne: true } rather than false, so documents written by the existing ERP
    // without an isDeleted field still resolve.
    const parentGroup = await Group.findOne({ _id: body.group, isDeleted: { $ne: true } });
    if (!parentGroup) throw new Error("Parent group not found");

    // Deriving the branch guarantees a subgroup can never end up under a group
    // from a different branch, whatever the client sends.
    return { subgroupCode: body.subgroupCode.trim().toUpperCase(), branch: parentGroup.branch };
  },
  importRow: async (row) => ({
    group: row["Group ID"] || row["group"],
    subgroupName: row["Subgroup Name"] || row["subgroupName"],
    subgroupCode: (row["Subgroup Code"] || row["subgroupCode"] || "").toString().toUpperCase(),
    description: row["Description"] || "",
  }),
});

module.exports = controller;
