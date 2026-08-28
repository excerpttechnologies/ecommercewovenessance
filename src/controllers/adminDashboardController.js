const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Cart = require("../models/Cart");
const Wishlist = require("../models/Wishlist");
const Order = require("../models/Order");
const Item = require("../models/Item");
const Visit = require("../models/Visit");
const Branch = require("../models/Branch");

/**
 * Admin dashboard.
 *
 * Every figure here is aggregated from a real collection. Where the data to
 * answer a question does not exist yet, the response says so explicitly rather
 * than returning a zero that reads like a real measurement — a dashboard that
 * can't distinguish "nothing happened" from "not measured" is worse than no
 * dashboard.
 */

const REVENUE_STATUSES = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"];

/**
 * Branch scope for BOTH find() and aggregate().
 *
 * The id must be a real ObjectId, not the string off the query. Mongoose casts
 * strings against the schema for find(), but an aggregation pipeline is handed
 * to MongoDB verbatim — so `$match: { branch: "<hex string>" }` silently matches
 * zero documents and every figure on the dashboard reads 0.
 */
function branchFilter(req) {
  const id = req.query.branch;
  if (!/^[a-f\d]{24}$/i.test(String(id || ""))) return {};
  return { branch: new mongoose.Types.ObjectId(String(id)) };
}

/** Start of day, N days back, in UTC. */
function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

// GET /api/woven-essence/admin/dashboard?branch=&days=30
const dashboard = asyncHandler(async (req, res) => {
  const scope = branchFilter(req);
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const since = daysAgo(days);

  const [
    customerTotal,
    customerNew,
    customerBlocked,
    cartAgg,
    wishlistAgg,
    orderCounts,
    revenueAgg,
    revenueWindow,
    codPending,
    itemTotals,
    lowStock,
    visitAgg,
    viewAgg,
    recentOrders,
    topSelling,
    dailyRevenue,
  ] = await Promise.all([
    // ── customers ── (not branch-scoped: an account isn't owned by a store)
    Customer.countDocuments({ isDeleted: { $ne: true } }),
    Customer.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: since } }),
    Customer.countDocuments({ isDeleted: { $ne: true }, status: "blocked" }),

    // ── live carts ──
    Cart.aggregate([
      ...(scope.branch ? [{ $match: { branch: scope.branch } }] : []),
      { $project: { lineCount: { $size: "$lines" }, units: { $sum: "$lines.quantity" }, updatedAt: 1 } },
      { $match: { lineCount: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          activeCarts: { $sum: 1 },
          cartLines: { $sum: "$lineCount" },
          cartUnits: { $sum: "$units" },
          abandoned: { $sum: { $cond: [{ $lt: ["$updatedAt", daysAgo(7)] }, 1, 0] } },
        },
      },
    ]),

    Wishlist.aggregate([
      { $project: { count: { $size: "$entries" } } },
      { $match: { count: { $gt: 0 } } },
      { $group: { _id: null, lists: { $sum: 1 }, saved: { $sum: "$count" } } },
    ]),

    // ── orders by status ──
    Order.aggregate([
      ...(scope.branch ? [{ $match: scope }] : []),
      { $group: { _id: "$status", count: { $sum: 1 }, value: { $sum: "$amounts.grandTotal" } } },
    ]),

    Order.aggregate([
      { $match: { ...scope, status: { $in: REVENUE_STATUSES } } },
      { $group: { _id: null, revenue: { $sum: "$amounts.grandTotal" }, orders: { $sum: 1 } } },
    ]),

    Order.aggregate([
      { $match: { ...scope, status: { $in: REVENUE_STATUSES }, createdAt: { $gte: since } } },
      { $group: { _id: null, revenue: { $sum: "$amounts.grandTotal" }, orders: { $sum: 1 } } },
    ]),

    Order.countDocuments({ ...scope, "payment.method": "cod", "payment.status": "cod_pending" }),

    // ── catalogue ──
    Item.aggregate([
      { $match: { ...scope, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ["$lifecycleStage", "published"] }, 1, 0] } },
          draft: { $sum: { $cond: [{ $eq: ["$lifecycleStage", "draft"] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $lte: ["$inventory.currentStock", 0] }, 1, 0] } },
          stockValue: {
            $sum: { $multiply: [{ $ifNull: ["$inventory.currentStock", 0] }, { $ifNull: ["$pricing.costPrice", 0] }] },
          },
        },
      },
    ]),

    Item.find({ ...scope, isDeleted: { $ne: true }, lifecycleStage: "published" })
      .select("identity.productName identity.itemCode inventory.currentStock inventory.reorderLevel")
      .sort({ "inventory.currentStock": 1 })
      .limit(8)
      .lean(),

    // ── traffic ──
    Visit.aggregate([
      { $match: { day: { $gte: since }, ...(scope.branch ? { branch: scope.branch } : {}) } },
      { $group: { _id: null, views: { $sum: "$views" }, sessions: { $sum: "$sessions" } } },
    ]),

    Item.aggregate([
      { $match: { ...scope, isDeleted: { $ne: true } } },
      { $group: { _id: null, productViews: { $sum: "$salesIntelligence.totalViews" } } },
    ]),

    Order.find(scope)
      .select("orderNumber status amounts.grandTotal payment.method payment.status createdAt customerName lines")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),

    // ── best sellers, from actual order lines ──
    Order.aggregate([
      { $match: { ...scope, status: { $in: REVENUE_STATUSES } } },
      { $unwind: "$lines" },
      {
        $group: {
          _id: "$lines.item",
          name: { $first: "$lines.productName" },
          itemCode: { $first: "$lines.itemCode" },
          units: { $sum: "$lines.quantity" },
          revenue: { $sum: "$lines.lineSubtotal" },
        },
      },
      { $sort: { units: -1 } },
      { $limit: 8 },
    ]),

    // ── revenue per day, for the chart ──
    Order.aggregate([
      { $match: { ...scope, status: { $in: REVENUE_STATUSES }, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$amounts.grandTotal" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const statusMap = Object.fromEntries(orderCounts.map((s) => [s._id, s.count]));
  const orderTotal = orderCounts.reduce((sum, s) => sum + s.count, 0);
  const cart = cartAgg[0] || { activeCarts: 0, cartLines: 0, cartUnits: 0, abandoned: 0 };
  const wl = wishlistAgg[0] || { lists: 0, saved: 0 };
  const items = itemTotals[0] || { total: 0, published: 0, draft: 0, outOfStock: 0, stockValue: 0 };
  const rev = revenueAgg[0] || { revenue: 0, orders: 0 };
  const win = revenueWindow[0] || { revenue: 0, orders: 0 };
  const traffic = visitAgg[0] || { views: 0, sessions: 0 };

  res.json({
    success: true,
    data: {
      windowDays: days,
      customers: { total: customerTotal, newInWindow: customerNew, blocked: customerBlocked },
      carts: {
        active: cart.activeCarts,
        lines: cart.cartLines,
        units: cart.cartUnits,
        // Untouched for a week with items still in it.
        abandoned: cart.abandoned,
      },
      wishlists: { lists: wl.lists, savedItems: wl.saved },
      orders: {
        total: orderTotal,
        byStatus: statusMap,
        awaitingPayment: statusMap.pending_payment || 0,
        toFulfil: (statusMap.confirmed || 0) + (statusMap.packed || 0),
        inTransit: (statusMap.shipped || 0) + (statusMap.out_for_delivery || 0),
        delivered: statusMap.delivered || 0,
        cancelled: statusMap.cancelled || 0,
        codPending,
      },
      revenue: {
        allTime: Math.round(rev.revenue || 0),
        inWindow: Math.round(win.revenue || 0),
        ordersInWindow: win.orders,
        averageOrderValue: win.orders ? Math.round(win.revenue / win.orders) : 0,
        currency: "INR",
      },
      catalogue: {
        total: items.total,
        published: items.published,
        draft: items.draft,
        outOfStock: items.outOfStock,
        stockValueAtCost: Math.round(items.stockValue || 0),
      },
      traffic: {
        pageViews: traffic.views,
        visits: traffic.sessions,
        productViews: viewAgg[0]?.productViews || 0,
        // Says plainly what this number is and isn't.
        note: "Visits count anonymous browser sessions since visitor tracking was enabled. No personal data is stored.",
      },
      conversion: {
        // Only meaningful once there is traffic to divide by.
        ordersPerVisit: traffic.sessions ? Math.round((win.orders / traffic.sessions) * 10000) / 100 : null,
        cartToOrder: cart.activeCarts + win.orders ? Math.round((win.orders / (cart.activeCarts + win.orders)) * 10000) / 100 : null,
      },
      lowStock: lowStock.map((i) => ({
        id: i._id,
        name: i.identity?.productName || "",
        itemCode: i.identity?.itemCode || "",
        stock: i.inventory?.currentStock ?? 0,
        reorderLevel: i.inventory?.reorderLevel ?? null,
      })),
      topSelling: topSelling.map((t) => ({
        itemId: t._id,
        name: t.name,
        itemCode: t.itemCode,
        units: t.units,
        revenue: Math.round(t.revenue || 0),
      })),
      recentOrders: recentOrders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.amounts?.grandTotal ?? 0,
        paymentMethod: o.payment?.method,
        paymentStatus: o.payment?.status,
        itemCount: (o.lines || []).reduce((n, l) => n + (l.quantity || 0), 0),
        customerName: o.customerName || "",
        placedAt: o.createdAt,
      })),
      dailyRevenue: dailyRevenue.map((d) => ({ date: d._id, revenue: Math.round(d.revenue), orders: d.orders })),
    },
  });
});

// GET /api/woven-essence/admin/customers?q=&page=&limit=
// Customer list with their order history, for support lookups.
const listCustomers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const filter = { isDeleted: { $ne: true } };
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  if (req.query.status) filter.status = req.query.status;

  const [total, customers] = await Promise.all([
    Customer.countDocuments(filter),
    Customer.find(filter)
      .select("name email phone status createdAt lastLoginAt preferredBranch addresses")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  // Order counts per listed customer, in one query rather than N.
  const ids = customers.map((c) => c._id);
  const orderStats = await Order.aggregate([
    { $match: { customer: { $in: ids } } },
    {
      $group: {
        _id: "$customer",
        orders: { $sum: 1 },
        spent: { $sum: { $cond: [{ $in: ["$status", REVENUE_STATUSES] }, "$amounts.grandTotal", 0] } },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
  ]);
  const statsById = new Map(orderStats.map((s) => [String(s._id), s]));

  res.json({
    success: true,
    data: customers.map((c) => {
      const s = statsById.get(String(c._id));
      return {
        id: c._id,
        name: c.name,
        email: c.email,
        phone: c.phone || "",
        status: c.status,
        addressCount: (c.addresses || []).length,
        joinedAt: c.createdAt,
        lastLoginAt: c.lastLoginAt,
        orders: s?.orders || 0,
        totalSpent: Math.round(s?.spent || 0),
        lastOrderAt: s?.lastOrderAt || null,
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

// PATCH /api/woven-essence/admin/customers/:id/status   { status }
const setCustomerStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "blocked"].includes(status)) {
    res.status(400);
    throw new Error("Status must be active or blocked");
  }

  const customer = await Customer.findOneAndUpdate(
    { _id: req.params.id, isDeleted: { $ne: true } },
    { status },
    { new: true }
  );
  if (!customer) {
    res.status(404);
    throw new Error("Customer not found");
  }

  res.json({ success: true, data: customer.toPublic(), message: `Customer ${status}` });
});

module.exports = { dashboard, listCustomers, setCustomerStatus };
