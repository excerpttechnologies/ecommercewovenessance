const mongoose = require("mongoose");

/**
 * Which ERP Product Groups appear as categories in the shop header.
 *
 * The publish flag lives HERE rather than on the ERP's `productgroup` rows:
 * that collection belongs to GROO RETAIL ERP, and "is this on the Woven
 * Essence storefront" is not a fact about the ERP's master data. Writing our
 * flag into their documents would put a field they don't know about into a
 * collection they validate and export.
 *
 * So this is a thin side table — one row per ERP group we've been asked about,
 * keyed by that group's _id. A group with no row here has never been touched
 * and is unpublished, which is why the read side treats "missing" and "false"
 * the same way.
 */
const storefrontGroupSchema = new mongoose.Schema(
  {
    // The ERP productgroup._id this row describes. Not a ref: the target lives
    // in a collection this app deliberately does not own.
    productGroup: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    isPublished: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  { collection: "storefrontGroups", timestamps: true },
);

module.exports =
  mongoose.models.StorefrontGroup ||
  mongoose.model("StorefrontGroup", storefrontGroupSchema);
