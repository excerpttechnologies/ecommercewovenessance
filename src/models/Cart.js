const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * A shopper's cart.
 *
 * Deliberately stores ONLY item references and quantities — never prices.
 * Prices, discounts and tax are recomputed from the Item on every read, so a
 * cart can't be edited in devtools to pay less, and a price change in the admin
 * is reflected immediately instead of being frozen at add-to-cart time.
 *
 * A cart belongs to one branch. Stock, pricing and fulfilment are all per
 * branch, so a cart mixing two stores could not be fulfilled as one order.
 */

const cartLineSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    quantity: { type: Number, required: true, min: 1, max: 20, default: 1 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const cartSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, unique: true, index: true },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", default: null },
    lines: { type: [cartLineSchema], default: [] },

    /** Set when a group-shopping session is joined (next slice). */
    groupKey: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cart", cartSchema);
