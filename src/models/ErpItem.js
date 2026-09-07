const mongoose = require("mongoose");

// The ERP's Item master, so Woven Essence's Items screen shows the same rows
// as GROO RETAIL ERP's Inventory → Item screen. Mirrors
// retailerpv2/models/Item.js; the collection name is pinned lowercase because
// Mongoose would otherwise pluralise it and MongoDB names are case-sensitive.
//
// `subGroupId` points at a productgroup row — in the ERP a group and a
// subgroup are the same collection, so this is the item's group.
const erpItemSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    name: { type: String, default: "" },
    subGroupId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    uomId: { type: mongoose.Schema.Types.ObjectId, default: null },
    hsnId: { type: mongoose.Schema.Types.ObjectId, default: null },
    filterId: { type: mongoose.Schema.Types.ObjectId, default: null },
    uniqueBarcode: { type: String, default: "No" },
    offerPriceNetPrice: { type: String, default: "No" },
    prefix: { type: String, default: "" },
    itemCode: { type: String, default: "" },
    rsp: { type: Number, default: null },
    wsp: { type: Number, default: null },
    rspOfferPercent: { type: Number, default: null },
    image: { type: String, default: "" },
    description: { type: String, default: "" },
    attributeAddonIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    itemType: { type: String, default: "Simple" },
  },
  {
    collection: "item",
    // config/db.js sets strictQuery globally, which drops any query path not
    // declared above. The ERP owns this shape and can add fields at any time —
    // see models/BarcodeLabel.js for what that setting did to the Products
    // search when a filter path was missing from the schema.
    strictQuery: false,
    timestamps: true,
  },
);

module.exports =
  mongoose.models.ErpItem || mongoose.model("ErpItem", erpItemSchema);
