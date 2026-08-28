const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * A group shopping session.
 *
 * Several shoppers share one pin and build a single cart together. The group
 * cart is deliberately a separate document from each member's personal Cart —
 * joining a group must not disturb what someone already had saved for
 * themselves, and leaving must not take the group's items with them.
 *
 * As with Cart, lines hold item references and quantities only. Every rupee is
 * computed at read time from the live product, through the same pricer the solo
 * checkout uses.
 */

const memberSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    /** Snapshotted so a member who leaves is still attributable on the lines. */
    name: { type: String, required: true },
    isHost: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
  },
  { _id: false }
);

const groupLineSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    quantity: { type: Number, required: true, min: 1, max: 20, default: 1 },
    /** Who put it in — drives the per-person split when paying separately. */
    addedBy: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    addedByName: { type: String, default: "" },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const groupSessionSchema = new Schema(
  {
    /** Shared pin, e.g. WOVENESSENCE-482913. Uppercase, unique. */
    key: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },

    /** Everyone shops one store — stock, price and fulfilment are per branch. */
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    members: { type: [memberSchema], default: [] },
    lines: { type: [groupLineSchema], default: [] },

    /**
     * open      — still adding
     * confirmed — host locked the list and set the delivery address
     * ordered   — every payer has an order
     * cancelled — abandoned by the host
     */
    status: {
      type: String,
      enum: ["open", "confirmed", "ordered", "cancelled"],
      default: "open",
      index: true,
    },

    /** How the group settles up. Chosen at confirm time. */
    paymentMode: { type: String, enum: ["together", "separate", null], default: null },

    /**
     * One delivery address for the whole group — the brief's rule: whoever pays
     * gives the address, and everyone sees the same one.
     */
    shippingAddress: {
      fullName: String,
      phone: String,
      line1: String,
      line2: String,
      landmark: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: "India" },
    },

    /** Orders raised out of this session — one when paying together, one each otherwise. */
    orders: {
      type: [
        new Schema(
          {
            customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
            order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
            orderNumber: String,
            amount: Number,
            paidAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    confirmedAt: Date,
    orderedAt: Date,
    expiresAt: { type: Date, index: true },
  },
  { timestamps: true }
);

/** Active members only — the ones still in the room. */
groupSessionSchema.methods.activeMembers = function activeMembers() {
  return this.members.filter((m) => !m.leftAt);
};

groupSessionSchema.methods.isMember = function isMember(customerId) {
  return this.activeMembers().some((m) => String(m.customer) === String(customerId));
};

groupSessionSchema.methods.isHost = function isHost(customerId) {
  return this.activeMembers().some((m) => String(m.customer) === String(customerId) && m.isHost);
};

/**
 * Generates an unused pin.
 *
 * Six digits gives a million combinations, which is ample for concurrent
 * sessions while staying short enough to read out over the phone. Uniqueness is
 * checked rather than assumed.
 */
groupSessionSchema.statics.generateKey = async function generateKey() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const digits = String(Math.floor(100000 + Math.random() * 900000));
    const key = `WOVENESSENCE-${digits}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await this.exists({ key }))) return key;
  }
  throw new Error("Couldn't generate a free group pin — please try again");
};

module.exports = mongoose.model("GroupSession", groupSessionSchema);
