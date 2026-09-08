// const mongoose = require("mongoose");
// const bcrypt = require("bcryptjs");
// const { Schema } = mongoose;

// /**
//  * A shopper.
//  *
//  * Deliberately a separate collection from AdminUser. Staff and customers have
//  * nothing in common operationally — different fields, different lifecycles,
//  * different risk — and keeping them apart means a bug in the shop's sign-up
//  * flow can never mint something that satisfies an admin route.
//  */

// const addressSchema = new Schema(
//   {
//     label: { type: String, trim: true, default: "Home" },
//     fullName: { type: String, trim: true },
//     phone: { type: String, trim: true },
//     line1: { type: String, trim: true },
//     line2: { type: String, trim: true },
//     landmark: { type: String, trim: true },
//     city: { type: String, trim: true },
//     state: { type: String, trim: true },
//     pincode: { type: String, trim: true },
//     country: { type: String, trim: true, default: "India" },
//     isDefaultShipping: { type: Boolean, default: false },
//     isDefaultBilling: { type: Boolean, default: false },
//   },
//   { _id: true, timestamps: true }
// );

// const customerSchema = new Schema(
//   {
//     name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 120 },

//     email: {
//       type: String,
//       required: [true, "Email is required"],
//       trim: true,
//       lowercase: true,
//       unique: true,
//       match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
//     },

//     phone: {
//       type: String,
//       trim: true,
//       match: [/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number"],
//     },

//     // Absent for Google-only accounts (next release), so not required here.
//     passwordHash: { type: String, select: false },

//     googleId: { type: String, trim: true, index: true, sparse: true },
//     avatarUrl: { type: String, trim: true },

//     /** Store the shopper last chose — orders are raised against a branch. */
//     preferredBranch: { type: Schema.Types.ObjectId, ref: "Branch", default: null },

//     addresses: { type: [addressSchema], default: [] },

//     status: { type: String, enum: ["active", "blocked"], default: "active", index: true },
//     emailVerified: { type: Boolean, default: false },
//     lastLoginAt: { type: Date, default: null },

//     isDeleted: { type: Boolean, default: false, index: true },
//     deletedAt: { type: Date, default: null },
//   },
//   { timestamps: true }
// );

// customerSchema.index({ name: "text", email: "text", phone: "text" });

// /** Hash on save so no call site can accidentally store a plaintext password. */
// customerSchema.pre("save", async function hashPassword(next) {
//   if (!this.isModified("passwordHash") || !this.passwordHash) return next();
//   // Skip if it already looks like a bcrypt digest (re-saving an existing doc).
//   if (/^\$2[aby]\$\d{2}\$/.test(this.passwordHash)) return next();
//   this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
//   next();
// });

// customerSchema.methods.matchPassword = async function matchPassword(plain) {
//   if (!this.passwordHash) return false;
//   return bcrypt.compare(plain, this.passwordHash);
// };

// /** Shape sent to the browser — never includes the hash. */
// customerSchema.methods.toPublic = function toPublic() {
//   return {
//     id: this._id,
//     name: this.name,
//     email: this.email,
//     phone: this.phone || "",
//     avatarUrl: this.avatarUrl || "",
//     preferredBranch: this.preferredBranch || null,
//     addresses: this.addresses || [],
//     emailVerified: this.emailVerified,
//     createdAt: this.createdAt,
//   };
// };

// module.exports = mongoose.model("Customer", customerSchema);








// const mongoose = require("mongoose");
// const bcrypt = require("bcryptjs");
// const { Schema } = mongoose;

// /**
//  * A shopper.
//  *
//  * Deliberately a separate collection from AdminUser. Staff and customers have
//  * nothing in common operationally — different fields, different lifecycles,
//  * different risk — and keeping them apart means a bug in the shop's sign-up
//  * flow can never mint something that satisfies an admin route.
//  */

// const addressSchema = new Schema(
//   {
//     label: { type: String, trim: true, default: "Home" },
//     fullName: { type: String, trim: true },
//     phone: { type: String, trim: true },
//     line1: { type: String, trim: true },
//     line2: { type: String, trim: true },
//     landmark: { type: String, trim: true },
//     city: { type: String, trim: true },
//     state: { type: String, trim: true },
//     pincode: { type: String, trim: true },
//     country: { type: String, trim: true, default: "India" },
//     isDefaultShipping: { type: Boolean, default: false },
//     isDefaultBilling: { type: Boolean, default: false },
//   },
//   { _id: true, timestamps: true }
// );

// const customerSchema = new Schema(
//   {
//     name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 120 },

//     email: {
//       type: String,
//       required: [true, "Email is required"],
//       trim: true,
//       lowercase: true,
//       unique: true,
//       match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
//     },

//     phone: {
//       type: String,
//       trim: true,
//       match: [/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number"],
//     },

//     // Absent for Google-only accounts (next release), so not required here.
//     passwordHash: { type: String, select: false },

//     googleId: { type: String, trim: true, index: true, sparse: true },

//     /**
//      * Password reset.
//      *
//      * Only the SHA-256 hash of the token is stored, never the token itself —
//      * a leaked database dump then can't be used to reset anyone's password.
//      * `usedAt` makes the link single-use even before it expires.
//      */
//     passwordReset: {
//       tokenHash: { type: String, default: null, select: false },
//       expiresAt: { type: Date, default: null, select: false },
//       requestedAt: { type: Date, default: null, select: false },
//       usedAt: { type: Date, default: null, select: false },
//     },
//     avatarUrl: { type: String, trim: true },

//     /** Store the shopper last chose — orders are raised against a branch. */
//     preferredBranch: { type: Schema.Types.ObjectId, ref: "Branch", default: null },

//     addresses: { type: [addressSchema], default: [] },

//     status: { type: String, enum: ["active", "blocked"], default: "active", index: true },
//     emailVerified: { type: Boolean, default: false },
//     lastLoginAt: { type: Date, default: null },

//     isDeleted: { type: Boolean, default: false, index: true },
//     deletedAt: { type: Date, default: null },
//   },
//   { timestamps: true }
// );

// customerSchema.index({ name: "text", email: "text", phone: "text" });

// /** Hash on save so no call site can accidentally store a plaintext password. */
// customerSchema.pre("save", async function hashPassword(next) {
//   if (!this.isModified("passwordHash") || !this.passwordHash) return next();
//   // Skip if it already looks like a bcrypt digest (re-saving an existing doc).
//   if (/^\$2[aby]\$\d{2}\$/.test(this.passwordHash)) return next();
//   this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
//   next();
// });

// customerSchema.methods.matchPassword = async function matchPassword(plain) {
//   if (!this.passwordHash) return false;
//   return bcrypt.compare(plain, this.passwordHash);
// };

// /** Shape sent to the browser — never includes the hash. */
// customerSchema.methods.toPublic = function toPublic() {
//   return {
//     id: this._id,
//     name: this.name,
//     email: this.email,
//     phone: this.phone || "",
//     avatarUrl: this.avatarUrl || "",
//     preferredBranch: this.preferredBranch || null,
//     addresses: this.addresses || [],
//     emailVerified: this.emailVerified,
//     createdAt: this.createdAt,
//   };
// };

// module.exports = mongoose.model("Customer", customerSchema);








const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { Schema } = mongoose;

/**
 * A shopper.
 *
 * Deliberately a separate collection from AdminUser. Staff and customers have
 * nothing in common operationally — different fields, different lifecycles,
 * different risk — and keeping them apart means a bug in the shop's sign-up
 * flow can never mint something that satisfies an admin route.
 */

const addressSchema = new Schema(
  {
    label: { type: String, trim: true, default: "Home" },
    fullName: { type: String, trim: true },
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9]{10}$/, "Enter a valid 10-digit phone number"],
    },
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    country: { type: String, trim: true, default: "India" },
    isDefaultShipping: { type: Boolean, default: false },
    isDefaultBilling: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

const customerSchema = new Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 120 },

    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
    },

    phone: {
      type: String,
      trim: true,
      match: [/^[0-9]{10}$/, "Enter a valid 10-digit phone number"],
    },

    // Absent for Google-only accounts (next release), so not required here.
    passwordHash: { type: String, select: false },

    googleId: { type: String, trim: true, index: true, sparse: true },

    /**
     * Recently viewed sarees, newest first.
     *
     * Kept on the customer rather than in its own collection: it's a short
     * bounded list read only for this one shopper, so a separate collection
     * would add a join for no benefit. Capped in the controller — an unbounded
     * array would grow the document forever.
     */
    recentlyViewed: {
      type: [
        new Schema(
          {
            item: { type: Schema.Types.ObjectId, ref: "Item", required: true },
            viewedAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
      select: false,
    },

    /**
     * Password reset.
     *
     * Only the SHA-256 hash of the token is stored, never the token itself —
     * a leaked database dump then can't be used to reset anyone's password.
     * `usedAt` makes the link single-use even before it expires.
     */
    passwordReset: {
      tokenHash: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null, select: false },
      requestedAt: { type: Date, default: null, select: false },
      usedAt: { type: Date, default: null, select: false },
    },
    avatarUrl: { type: String, trim: true },

    /** Store the shopper last chose — orders are raised against a branch. */
    preferredBranch: { type: Schema.Types.ObjectId, ref: "Branch", default: null },

    addresses: { type: [addressSchema], default: [] },

    status: { type: String, enum: ["active", "blocked"], default: "active", index: true },
    emailVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

customerSchema.index({ name: "text", email: "text", phone: "text" });

/** Hash on save so no call site can accidentally store a plaintext password. */
customerSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("passwordHash") || !this.passwordHash) return next();
  // Skip if it already looks like a bcrypt digest (re-saving an existing doc).
  if (/^\$2[aby]\$\d{2}\$/.test(this.passwordHash)) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
  next();
});

customerSchema.methods.matchPassword = async function matchPassword(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

/** Shape sent to the browser — never includes the hash. */
customerSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone || "",
    avatarUrl: this.avatarUrl || "",
    preferredBranch: this.preferredBranch || null,
    addresses: this.addresses || [],
    emailVerified: this.emailVerified,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("Customer", customerSchema);