const mongoose = require("mongoose");

/**
 * Group is the first level of the product structure (Section 5.3):
 * Group → Subgroup → Item. Branch-aware per Section 4.
 */
const groupSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    groupName: { type: String, required: [true, "Group name is required"], trim: true, maxlength: 120 },
    // Short code used inside auto-generated item codes, e.g. "SLK" for Silk Sarees
    groupCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    description: { type: String, trim: true, maxlength: 500 },

    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    lifecycleStage: {
      type: String,
      enum: ["draft", "published", "unpublished", "hold"],
      default: "draft",
      index: true,
    },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

// A group code must be unique within a branch, not globally - different
// branches may reasonably run the same short code.
groupSchema.index({ branch: 1, groupCode: 1 }, { unique: true });
groupSchema.index({ groupName: "text", groupCode: "text" });

module.exports = mongoose.model("Group", groupSchema);
