const mongoose = require("mongoose");

// The ERP's Business master — what GROO RETAIL ERP calls a branch, and what
// the WORKING BRANCH selector and Branch management both read.
//
// Read-only here: the ERP owns these rows and validates them its own way.
// Woven Essence keeps its own Branch collection as the thing products, orders
// and staff actually reference; Branch.erpBusinessId records which of these a
// branch corresponds to, because nothing else in either database does.
const erpBusinessSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    businessPrintName: { type: String, default: "" },
    addressLine1: { type: String, default: "" },
    addressLine2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    zipCode: { type: String, default: "" },
    mobile: { type: String, default: "" },
    email: { type: String, default: "" },
    gstin: { type: String, default: "" },
    // The ERP stores this as the string "Active", not a boolean.
    isActive: { type: String, default: "" },
    isMainBranch: { type: Boolean, default: false },
    parentBusinessId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { collection: "business", strictQuery: false, timestamps: true },
);

module.exports =
  mongoose.models.ErpBusiness || mongoose.model("ErpBusiness", erpBusinessSchema);
