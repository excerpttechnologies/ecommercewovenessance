const mongoose = require("mongoose");

/**
 * Subgroup is the second level of the product structure (Section 5.3):
 * Group → Subgroup → Item. Always nested under exactly one Group, and
 * inherits that Group's branch for consistency (denormalized here for
 * fast branch-filtered queries without a join).
 */
const subgroupSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },

    subgroupName: { type: String, required: [true, "Subgroup name is required"], trim: true, maxlength: 120 },
    subgroupCode: { type: String, required: true, uppercase: true, trim: true },
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

// A subgroup code must be unique within its parent group.
subgroupSchema.index({ group: 1, subgroupCode: 1 }, { unique: true });
subgroupSchema.index({ subgroupName: "text", subgroupCode: "text" });

module.exports = mongoose.model("Subgroup", subgroupSchema);
