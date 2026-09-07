const mongoose = require("mongoose");

// The ERP owns this collection, so keep its document shape flexible and use
// an explicit collection name to avoid Mongoose pluralising it.
const barcodeLabelSchema = new mongoose.Schema(
  {},
  {
    collection: "barcodeLabel",
    strict: false,
    // config/db.js sets strictQuery globally, which makes Mongoose DROP any
    // query path that isn't declared in the schema. This schema is empty on
    // purpose — the ERP owns the shape — so with strictQuery inherited, every
    // filter (search, status, date) was silently stripped and each request
    // returned the whole collection unfiltered. That is why searching did
    // nothing. Only this model opts out; the rest keep the strict default.
    strictQuery: false,
    timestamps: false,
  },
);

module.exports =
  mongoose.models.BarcodeLabel ||
  mongoose.model("BarcodeLabel", barcodeLabelSchema);
