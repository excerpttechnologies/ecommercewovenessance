const mongoose = require("mongoose");

// The ERP's HSN master — read only so items can show an HSN code instead of an
// ObjectId. retailerpv2/models/Hsn.js labels these rows by `code`.
const erpHsnSchema = new mongoose.Schema(
  { code: { type: String, default: "" }, description: { type: String, default: "" } },
  { collection: "hsn", strictQuery: false, timestamps: true },
);

module.exports = mongoose.models.ErpHsn || mongoose.model("ErpHsn", erpHsnSchema);
