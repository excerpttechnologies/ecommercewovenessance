const mongoose = require("mongoose");

/**
 * Branch is the ROOT entity of the entire Woven Essence system.
 * Every product, order, and report downstream is branch-aware and
 * refs this collection's _id.
 */
const branchSchema = new mongoose.Schema(
  {
    branchName: {
      type: String,
      required: [true, "Branch name is required"],
      trim: true,
      maxlength: 120,
    },
    // Auto-generated, collision-proof: TF-<STATE?>-<seq>, e.g. TF-0001
    branchCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    address: {
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
      country: { type: String, trim: true, default: "India" },
    },
    location: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[0-9A-Z]{15}$/, "GST number must be 15 alphanumeric characters"],
      sparse: true,
    },
    contact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    // Operational toggle (Section 4: Status active/inactive)
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    // Lifecycle toggle (Section 5.1: Draft / Publish / Unpublish / Hold applies to ALL modules)
    lifecycleStage: {
      type: String,
      enum: ["draft", "published", "unpublished", "hold"],
      default: "draft",
      index: true,
    },
    // Soft delete (Section 5.1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

branchSchema.index({ branchName: "text", branchCode: "text" });

// Auto-generate a collision-proof branch code: TF-0001, TF-0002, ...
branchSchema.statics.generateBranchCode = async function () {
  const last = await this.findOne({}, { branchCode: 1 })
    .sort({ createdAt: -1 })
    .lean();

  let nextSeq = 1;
  if (last && last.branchCode) {
    const match = last.branchCode.match(/(\d+)$/);
    if (match) nextSeq = parseInt(match[1], 10) + 1;
  }

  let code;
  let exists = true;
  // Guard against rare race conditions on the running sequence.
  while (exists) {
    code = `TF-${String(nextSeq).padStart(4, "0")}`;
    exists = await this.exists({ branchCode: code });
    if (exists) nextSeq += 1;
  }
  return code;
};

module.exports = mongoose.model("Branch", branchSchema);
