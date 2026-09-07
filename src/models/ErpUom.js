const mongoose = require("mongoose");

// The ERP's Unit of Measurement master — read only, for item labels.
// retailerpv2/models/Uom.js labels these rows by `name`.
const erpUomSchema = new mongoose.Schema(
  { name: { type: String, default: "" }, shortName: { type: String, default: "" } },
  { collection: "uom", strictQuery: false, timestamps: true },
);

module.exports = mongoose.models.ErpUom || mongoose.model("ErpUom", erpUomSchema);
