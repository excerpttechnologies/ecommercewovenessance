const mongoose = require("mongoose");

// The ERP's Product Group master, read here so the Woven Essence admin shows
// the same rows as GROO RETAIL ERP's Inventory → Group screen instead of a
// second, divergent list. Mirrors retailerpv2/models/ProductGroup.js:
// the collection name is pinned lowercase because Mongoose would otherwise
// pluralise it to "productgroups" and MongoDB names are case-sensitive.
//
// A group and a subgroup are the SAME collection in the ERP — a row with a
// parentId is a subgroup of the row it points at.
const productGroupSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    name: { type: String, default: "" },
    prefix: { type: String, default: "" },
    parentId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  },
  {
    collection: "productgroup",
    // config/db.js sets strictQuery globally, which makes Mongoose silently
    // DROP any query path not declared above. Everything this controller
    // filters on is declared, but the ERP owns the shape and can add fields
    // at any time — see models/BarcodeLabel.js for what the global setting
    // did to the Products search when a filter path wasn't in the schema.
    strictQuery: false,
    timestamps: true,
  },
);

module.exports =
  mongoose.models.ProductGroup ||
  mongoose.model("ProductGroup", productGroupSchema);
