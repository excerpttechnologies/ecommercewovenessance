const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Discount codes, festival offers and campaign promotions.
 *
 * The discount MATHS lives on the model rather than in the controller, because
 * three call sites need the same answer — the shopper previewing a code at
 * checkout, the order being priced, and the admin list showing what a coupon is
 * worth. Any drift between them shows up as a customer being charged something
 * other than what they were quoted.
 *
 * Two documents:
 *   Coupon           — the rule
 *   CouponRedemption — one row per actual use, which is what enforces the
 *                      per-customer limit and gives the admin an audit trail.
 *                      A counter alone couldn't answer "who used it".
 */

const couponSchema = new Schema(
  {
    /** Always stored upper-case; shoppers type it however they like. */
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, "Code must be at least 3 characters"],
      maxlength: [24, "Code must be 24 characters or fewer"],
      match: [/^[A-Z0-9_-]+$/, "Code can only contain letters, numbers, hyphens and underscores"],
      index: true,
    },

    /** What staff see in the list; never shown to shoppers. */
    title: { type: String, required: [true, "Give the coupon a name"], trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 400 },

    discountType: { type: String, enum: ["percentage", "flat"], required: true },

    /** Percent (1-100) or rupees, depending on discountType. */
    value: { type: Number, required: true, min: [0.01, "Discount must be more than zero"] },

    /** Ceiling for a percentage coupon: "20% off, up to ₹2,000". */
    maxDiscount: { type: Number, default: null, min: 0 },

    /** Cart subtotal the shopper must reach before this applies. */
    minOrderValue: { type: Number, default: 0, min: 0 },

    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date, default: null },

    /** Total uses across all customers. null = unlimited. */
    usageLimit: { type: Number, default: null, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },

    /** Uses per customer. Defaults to one, which is what most offers mean. */
    perCustomerLimit: { type: Number, default: 1, min: 1 },

    /**
     * Restrict to certain stores. Empty = every store.
     * A multi-store order qualifies if ANY of its source stores is listed —
     * checked in the controller, where the order's stores are known.
     */
    branches: [{ type: Schema.Types.ObjectId, ref: "Branch" }],

    /** e.g. "Diwali", "Ugadi" — groups offers in the admin and on the storefront. */
    festivalLabel: { type: String, trim: true, maxlength: 60, default: "" },

    /** Advertise on the storefront, or keep it private for direct sharing. */
    showPublicly: { type: Boolean, default: false },

    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

couponSchema.index({ status: 1, validTo: 1 });

/** Percentage coupons are meaningless above 100%, and flat ones need no cap. */
couponSchema.pre("validate", function validateShape(next) {
  if (this.discountType === "percentage" && this.value > 100) {
    return next(new Error("A percentage discount can't exceed 100%"));
  }
  if (this.discountType === "flat" && this.maxDiscount) {
    return next(new Error("A flat discount doesn't need a maximum — that's the value itself"));
  }
  if (this.validTo && this.validFrom && this.validTo <= this.validFrom) {
    return next(new Error("The end date must be after the start date"));
  }
  next();
});

/**
 * Why this coupon can't be used right now, as a sentence, or null if it can.
 *
 * Returns a REASON rather than a boolean so the shopper is told what to do
 * ("Add ₹400 more") instead of a flat refusal. Deliberately gives the same
 * wording for "no such code" and "inactive code" — see the controller.
 */
couponSchema.methods.reasonUnusable = function reasonUnusable({ subtotal, branchIds = [] } = {}) {
  const now = new Date();

  if (this.isDeleted || this.status !== "active") return "That code isn't available";
  if (this.validFrom && now < this.validFrom) {
    return `This offer starts on ${this.validFrom.toLocaleDateString("en-IN", { day: "numeric", month: "long" })}`;
  }
  if (this.validTo && now > this.validTo) return "This offer has expired";
  if (this.usageLimit != null && this.usedCount >= this.usageLimit) {
    return "This offer has been fully claimed";
  }
  if (subtotal != null && this.minOrderValue > 0 && subtotal < this.minOrderValue) {
    const short = Math.ceil(this.minOrderValue - subtotal);
    return `Add ₹${short.toLocaleString("en-IN")} more to use this offer`;
  }
  if (this.branches?.length > 0 && branchIds.length > 0) {
    const allowed = this.branches.map(String);
    if (!branchIds.some((b) => allowed.includes(String(b)))) {
      return "This offer isn't available for the store you're buying from";
    }
  }
  return null;
};

/**
 * Rupees off, given a subtotal.
 *
 * Capped twice on purpose: at maxDiscount for percentage coupons, and at the
 * subtotal itself, so a ₹500 flat coupon on a ₹300 cart discounts ₹300 and not
 * ₹500. Without the second cap a grand total could go negative and Razorpay
 * would be asked to collect a negative amount.
 */
couponSchema.methods.discountFor = function discountFor(subtotal) {
  if (!subtotal || subtotal <= 0) return 0;

  let off =
    this.discountType === "percentage" ? (subtotal * this.value) / 100 : this.value;

  if (this.discountType === "percentage" && this.maxDiscount != null) {
    off = Math.min(off, this.maxDiscount);
  }

  return Math.round(Math.min(off, subtotal) * 100) / 100;
};

/** One-line summary, e.g. "20% off up to ₹2,000". Used by admin and storefront. */
couponSchema.methods.summaryText = function summaryText() {
  const money = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
  const base =
    this.discountType === "percentage"
      ? `${this.value}% off${this.maxDiscount != null ? ` up to ${money(this.maxDiscount)}` : ""}`
      : `${money(this.value)} off`;
  return this.minOrderValue > 0 ? `${base} on orders over ${money(this.minOrderValue)}` : base;
};

/** Shopper-facing shape. Never exposes usage counts — that's business data. */
couponSchema.methods.toPublic = function toPublic() {
  return {
    code: this.code,
    description: this.description || "",
    summary: this.summaryText(),
    festivalLabel: this.festivalLabel || "",
    minOrderValue: this.minOrderValue,
    validTo: this.validTo,
  };
};

/**
 * One row per use. Unique on (coupon, order) so a retried payment callback
 * can't consume a second use of the same coupon.
 */
const redemptionSchema = new Schema(
  {
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon", required: true, index: true },
    code: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    customerName: String,
    customerEmail: String,
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: String,
    discountAmount: { type: Number, required: true },
    orderTotal: { type: Number, required: true },
  },
  { timestamps: true }
);

redemptionSchema.index({ coupon: 1, order: 1 }, { unique: true });
redemptionSchema.index({ coupon: 1, customer: 1 });

module.exports = mongoose.model("Coupon", couponSchema);
module.exports.CouponRedemption = mongoose.model("CouponRedemption", redemptionSchema);
