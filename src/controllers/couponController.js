const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Coupon = require("../models/Coupon");
const { CouponRedemption } = require("../models/Coupon");
const Cart = require("../models/Cart");
const { isUnrestricted } = require("../middleware/branchScope");

/**
 * Coupons: admin management, shopper preview, and the evaluation the checkout
 * calls to price an order.
 *
 * evaluateForCustomer() is the single source of truth. The "apply" button and
 * the actual checkout both go through it, so what the shopper is quoted and
 * what they are charged cannot drift apart.
 */

const round = (n) => Math.round(n * 100) / 100;

/**
 * Resolves a code for a specific customer and cart.
 *
 * Returns { coupon, discount } or throws with a shopper-safe message.
 *
 * IMPORTANT: an unknown code and a deactivated code produce the SAME message.
 * Distinguishing them would let anyone probe which codes exist by trying
 * strings until the wording changed.
 */
async function evaluateForCustomer({ code, customerId, subtotal, branchIds = [] }) {
  const clean = String(code || "").trim().toUpperCase();
  if (!clean) {
    const err = new Error("Enter a coupon code");
    err.statusCode = 400;
    throw err;
  }

  const coupon = await Coupon.findOne({ code: clean, isDeleted: { $ne: true } });
  if (!coupon) {
    const err = new Error("That code isn't available");
    err.statusCode = 404;
    throw err;
  }

  const reason = coupon.reasonUnusable({ subtotal, branchIds });
  if (reason) {
    const err = new Error(reason);
    err.statusCode = 409;
    throw err;
  }

  // Per-customer limit is counted from real redemptions, not a field on the
  // customer — a counter would drift the first time an order was deleted.
  if (coupon.perCustomerLimit != null) {
    const mine = await CouponRedemption.countDocuments({ coupon: coupon._id, customer: customerId });
    if (mine >= coupon.perCustomerLimit) {
      const err = new Error(
        coupon.perCustomerLimit === 1
          ? "You've already used this offer"
          : `You've used this offer the maximum ${coupon.perCustomerLimit} times`
      );
      err.statusCode = 409;
      throw err;
    }
  }

  const discount = coupon.discountFor(subtotal);
  if (discount <= 0) {
    const err = new Error("This offer doesn't reduce your total");
    err.statusCode = 409;
    throw err;
  }

  return { coupon, discount };
}

/**
 * Writes the redemption and increments the counter, guarded so the usage limit
 * cannot be exceeded under concurrent checkouts. Called once per order — on COD
 * placement, or on verified payment for Razorpay, so an abandoned payment sheet
 * doesn't burn a use.
 *
 * Never throws into the caller: the order is already placed and paid by this
 * point, and failing it over a coupon counter would be far worse than a
 * miscounted redemption.
 */
async function recordRedemption({ coupon, customer, order }) {
  if (!coupon || !order?.coupon?.code) return;

  try {
    const existing = await CouponRedemption.findOne({ coupon: coupon._id, order: order._id });
    if (existing) return; // replayed callback

    await CouponRedemption.create({
      coupon: coupon._id,
      code: coupon.code,
      customer: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      order: order._id,
      orderNumber: order.orderNumber,
      discountAmount: order.amounts.couponDiscount,
      orderTotal: order.amounts.grandTotal,
    });

    await Coupon.updateOne(
      {
        _id: coupon._id,
        $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
      },
      { $inc: { usedCount: 1 } }
    );
  } catch (err) {
    if (err?.code === 11000) return; // unique (coupon, order) — already recorded
    console.error(`[coupons] failed to record redemption for ${order.orderNumber}:`, err.message);
  }
}

/* ── shopper endpoints ───────────────────────────────────────────────────── */

// POST /api/woven-essence/coupons/apply   { code }
// Preview only — nothing is reserved or consumed until the order is placed.
const applyCoupon = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ customer: req.customer._id });
  if (!cart || cart.lines.length === 0) {
    res.status(400);
    throw new Error("Your cart is empty");
  }

  // Price the cart the same way checkout will, so the quoted saving is real.
  const { priceCartForCheckout } = require("./checkoutController");
  const { amounts, sourceBranches } = await priceCartForCheckout(req.customer._id, {
    method: "razorpay",
  });

  const { coupon, discount } = await evaluateForCustomer({
    code: req.body.code,
    customerId: req.customer._id,
    subtotal: amounts.subtotal,
    branchIds: sourceBranches.map((s) => s.branch),
  });

  res.json({
    success: true,
    data: {
      code: coupon.code,
      summary: coupon.summaryText(),
      description: coupon.description || "",
      discount,
      newTotal: round(amounts.grandTotal - discount),
    },
    message: `${coupon.code} applied — you save ₹${discount.toLocaleString("en-IN")}`,
  });
});

// GET /api/woven-essence/coupons/public
// Offers worth advertising. Unauthenticated: it's marketing, not account data.
const publicCoupons = asyncHandler(async (req, res) => {
  const now = new Date();
  const coupons = await Coupon.find({
    isDeleted: { $ne: true },
    status: "active",
    showPublicly: true,
    validFrom: { $lte: now },
    $and: [
      { $or: [{ validTo: null }, { validTo: { $gte: now } }] },
      { $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
    ],
  })
    .sort({ festivalLabel: 1, minOrderValue: 1 })
    .limit(12);

  res.json({ success: true, data: coupons.map((c) => c.toPublic()) });
});

/* ── admin endpoints ─────────────────────────────────────────────────────── */

/** Adds the derived state the list needs but the schema shouldn't store. */
function adminShape(c) {
  const now = new Date();
  const doc = c.toObject ? c.toObject() : c;
  return {
    ...doc,
    summary: c.summaryText ? c.summaryText() : "",
    isScheduled: !!doc.validFrom && doc.validFrom > now,
    isExpired: !!doc.validTo && doc.validTo < now,
    isExhausted: doc.usageLimit != null && doc.usedCount >= doc.usageLimit,
    remaining: doc.usageLimit != null ? Math.max(doc.usageLimit - doc.usedCount, 0) : null,
  };
}

// GET /admin/coupons?status=&q=&festival=&page=&limit=
const listCoupons = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const filter = { isDeleted: { $ne: true } };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.festival) filter.festivalLabel = req.query.festival;

  // A branch admin sees store-wide coupons plus any scoped to their store.
  if (!isUnrestricted(req.adminUser) && req.adminUser?.assignedBranch) {
    filter.$or = [{ branches: { $size: 0 } }, { branches: req.adminUser.assignedBranch }];
  }

  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const search = [{ code: rx }, { title: rx }, { festivalLabel: rx }];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: search }];
      delete filter.$or;
    } else {
      filter.$or = search;
    }
  }

  const now = new Date();
  const [total, coupons, counts, festivals] = await Promise.all([
    Coupon.countDocuments(filter),
    Coupon.find(filter).sort("-createdAt").skip((page - 1) * limit).limit(limit),
    Promise.all([
      Coupon.countDocuments({ isDeleted: { $ne: true } }),
      Coupon.countDocuments({ isDeleted: { $ne: true }, status: "active" }),
      Coupon.countDocuments({ isDeleted: { $ne: true }, status: "active", validTo: { $lt: now } }),
      Coupon.countDocuments({ isDeleted: { $ne: true }, showPublicly: true, status: "active" }),
      CouponRedemption.countDocuments({}),
    ]),
    Coupon.distinct("festivalLabel", { isDeleted: { $ne: true }, festivalLabel: { $nin: ["", null] } }),
  ]);

  const [all, active, expired, publicly, redemptions] = counts;

  res.json({
    success: true,
    data: coupons.map(adminShape),
    stats: { all, active, expired, publicly, redemptions },
    festivals,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

const EDITABLE = [
  "title", "description", "discountType", "value", "maxDiscount", "minOrderValue",
  "validFrom", "validTo", "usageLimit", "perCustomerLimit", "branches",
  "festivalLabel", "showPublicly", "status",
];

function pickEditable(body) {
  const out = {};
  for (const key of EDITABLE) {
    if (body[key] === undefined) continue;
    // "" and null both mean "no limit" for the optional numeric fields.
    if (["maxDiscount", "usageLimit", "validTo"].includes(key) && (body[key] === "" || body[key] === null)) {
      out[key] = null;
    } else {
      out[key] = body[key];
    }
  }
  return out;
}

// POST /admin/coupons
const createCoupon = asyncHandler(async (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();

  const clash = await Coupon.findOne({ code });
  if (clash) {
    res.status(409);
    throw new Error(
      clash.isDeleted
        ? `Code ${code} was used by a deleted coupon — pick a different one so old orders stay readable`
        : `Code ${code} already exists`
    );
  }

  const coupon = await Coupon.create({
    ...pickEditable(req.body),
    code,
    createdBy: req.adminUser._id,
    updatedBy: req.adminUser._id,
  });

  res.status(201).json({ success: true, data: adminShape(coupon), message: `${coupon.code} created` });
});

// PATCH /admin/coupons/:id
// The CODE itself is immutable: orders store a snapshot of it, and letting a
// live code be renamed would make redemption history impossible to follow.
const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
  if (!coupon) {
    res.status(404);
    throw new Error("Coupon not found");
  }

  if (req.body.code && String(req.body.code).toUpperCase() !== coupon.code) {
    res.status(409);
    throw new Error("A coupon's code can't be changed — deactivate this one and create a new code");
  }

  Object.assign(coupon, pickEditable(req.body), { updatedBy: req.adminUser._id });
  await coupon.save();

  res.json({ success: true, data: adminShape(coupon), message: `${coupon.code} updated` });
});

// DELETE /admin/coupons/:id  — soft delete, so past orders keep their snapshot.
const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
  if (!coupon) {
    res.status(404);
    throw new Error("Coupon not found");
  }

  coupon.isDeleted = true;
  coupon.deletedAt = new Date();
  coupon.deletedBy = req.adminUser._id;
  coupon.status = "inactive";
  await coupon.save();

  res.json({ success: true, message: `${coupon.code} deleted` });
});

// GET /admin/coupons/:id/redemptions
const listRedemptions = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400);
    throw new Error("Invalid coupon");
  }

  const [rows, totalDiscount] = await Promise.all([
    CouponRedemption.find({ coupon: req.params.id }).sort("-createdAt").limit(200).lean(),
    CouponRedemption.aggregate([
      { $match: { coupon: new mongoose.Types.ObjectId(String(req.params.id)) } },
      { $group: { _id: null, discount: { $sum: "$discountAmount" }, revenue: { $sum: "$orderTotal" } } },
    ]),
  ]);

  res.json({
    success: true,
    data: rows,
    totals: {
      uses: rows.length,
      discountGiven: round(totalDiscount[0]?.discount || 0),
      revenueInfluenced: round(totalDiscount[0]?.revenue || 0),
    },
  });
});

module.exports = {
  applyCoupon,
  publicCoupons,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  listRedemptions,
  evaluateForCustomer,
  recordRedemption,
};
