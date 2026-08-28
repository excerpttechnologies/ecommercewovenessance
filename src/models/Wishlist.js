const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Saved sarees.
 *
 * Separate from the cart because it outlives it: a wishlist entry should
 * survive a sold-out saree (so the shopper can be told when it returns),
 * whereas a cart line for an unbuyable item is just noise.
 */

const wishlistEntrySchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const wishlistSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, unique: true, index: true },
    entries: { type: [wishlistEntrySchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Wishlist", wishlistSchema);
