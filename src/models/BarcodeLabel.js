const mongoose = require("mongoose");

// The ERP owns this collection, so keep its document shape flexible and use
// an explicit collection name to avoid Mongoose pluralising it.
const barcodeLabelSchema = new mongoose.Schema(
  {},
  {
    collection: "barcodeLabel",
    strict: false,
    timestamps: false,
  },
);

module.exports =
  mongoose.models.BarcodeLabel ||
  mongoose.model("BarcodeLabel", barcodeLabelSchema);
