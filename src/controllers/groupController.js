const buildCrudController = require("../utils/crudFactory");
const Group = require("../models/Group");

const controller = buildCrudController(Group, {
  entityName: "Group",
  searchFields: ["groupName", "groupCode", "description"],
  filterFields: ["status", "lifecycleStage"],
  branchScoped: true,
  editableFields: ["groupName", "groupCode", "description", "status"],
  exportColumns: [
    { header: "Group Code", key: "groupCode", width: 15 },
    { header: "Group Name", key: "groupName", width: 30 },
    { header: "Description", key: "description", width: 40 },
    { header: "Status", key: "status", width: 12 },
    { header: "Lifecycle Stage", key: "lifecycleStage", width: 16 },
    { header: "Created At", key: "createdAt", width: 22 },
  ],
  flattenForExport: (g) => ({
    groupCode: g.groupCode,
    groupName: g.groupName,
    description: g.description || "",
    status: g.status,
    lifecycleStage: g.lifecycleStage,
    createdAt: g.createdAt ? new Date(g.createdAt).toLocaleString() : "",
  }),
  beforeCreate: async (body) => {
    if (!body.branch) throw new Error("branch is required");
    if (!body.groupCode || !body.groupCode.trim()) throw new Error("groupCode is required");
    return { groupCode: body.groupCode.trim().toUpperCase() };
  },
  importRow: async (row) => ({
    branch: row["Branch ID"] || row["branch"],
    groupName: row["Group Name"] || row["groupName"],
    groupCode: (row["Group Code"] || row["groupCode"] || "").toString().toUpperCase(),
    description: row["Description"] || "",
  }),
});

module.exports = controller;
