





// // const asyncHandler = require("express-async-handler");
// // const mongoose = require("mongoose");
// // const Order = require("../models/Order");
// // const { FULFILMENT_FLOW } = require("../models/Order");
// // const Item = require("../models/Item");
// // const { assertBranchAccess } = require("../middleware/branchScope");

// // /**
// //  * Order management for staff.
// //  *
// //  * Status changes follow the fulfilment flow rather than allowing any jump: an
// //  * order can move forward one step, or be cancelled. Letting an admin set
// //  * "delivered" on an unpaid order would make the revenue figures meaningless.
// //  */

// // const CANCELLABLE = ["pending_payment", "confirmed", "packed"];

// // // GET /api/woven-essence/admin/orders?branch=&status=&q=&page=&limit=
// // const listOrders = asyncHandler(async (req, res) => {
// //   const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
// //   const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

// //   const filter = {};
// //   if (/^[a-f\d]{24}$/i.test(String(req.query.branch || "")))
// //     // ObjectId, not the raw string: the status-count aggregate below is passed
// //     // to MongoDB uncast and would match nothing.
// //     filter.branch = new mongoose.Types.ObjectId(String(req.query.branch));
// //   if (req.query.status) filter.status = req.query.status;
// //   if (req.query.paymentMethod) filter["payment.method"] = req.query.paymentMethod;

// //   if (req.query.q) {
// //     const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
// //     filter.$or = [
// //       { orderNumber: rx },
// //       { customerName: rx },
// //       { customerEmail: rx },
// //       { customerPhone: rx },
// //       { "shippingAddress.pincode": rx },
// //       { "shipment.awbCode": rx },
// //     ];
// //   }

// //   const [total, orders, statusCounts] = await Promise.all([
// //     Order.countDocuments(filter),
// //     Order.find(filter)
// //       .select(
// //         "orderNumber status amounts payment customerName customerEmail customerPhone shippingAddress.city shippingAddress.pincode " +
// //           "lines.productName lines.quantity shipment.awbCode shipment.courierName createdAt invoiceNumber branch"
// //       )
// //       .populate("branch", "branchName branchCode")
// //       .sort("-createdAt")
// //       .skip((page - 1) * limit)
// //       .limit(limit)
// //       .lean(),
// //     Order.aggregate([
// //       ...(filter.branch ? [{ $match: { branch: filter.branch } }] : []),
// //       { $group: { _id: "$status", count: { $sum: 1 } } },
// //     ]),
// //   ]);

// //   res.json({
// //     success: true,
// //     data: orders.map((o) => ({
// //       id: o._id,
// //       orderNumber: o.orderNumber,
// //       status: o.status,
// //       total: o.amounts?.grandTotal ?? 0,
// //       currency: o.amounts?.currency || "INR",
// //       paymentMethod: o.payment?.method,
// //       paymentStatus: o.payment?.status,
// //       customerName: o.customerName || "",
// //       customerEmail: o.customerEmail || "",
// //       customerPhone: o.customerPhone || "",
// //       city: o.shippingAddress?.city || "",
// //       pincode: o.shippingAddress?.pincode || "",
// //       itemCount: (o.lines || []).reduce((n, l) => n + (l.quantity || 0), 0),
// //       firstProduct: o.lines?.[0]?.productName || "",
// //       awbCode: o.shipment?.awbCode || "",
// //       courierName: o.shipment?.courierName || "",
// //       invoiceNumber: o.invoiceNumber || "",
// //       branchName: o.branch?.branchName || "",
// //       placedAt: o.createdAt,
// //     })),
// //     counts: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])),
// //     pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
// //   });
// // });

// // // GET /api/woven-essence/admin/orders/:id
// // const getOrder = asyncHandler(async (req, res) => {
// //   const { id } = req.params;
// //   const query = /^[a-f\d]{24}$/i.test(id) ? { _id: id } : { orderNumber: id.toUpperCase() };

// //   const order = await Order.findOne(query)
// //     .populate("branch", "branchName branchCode address contact")
// //     .lean();

// //   if (!order) {
// //     res.status(404);
// //     throw new Error("Order not found");
// //   }
// //   assertBranchAccess(req, order, "Order");

// //   const current = FULFILMENT_FLOW.indexOf(order.status);
// //   res.json({
// //     success: true,
// //     data: {
// //       ...order,
// //       /** What this order can legally become next — the UI renders exactly these. */
// //       allowedNextStatuses: [
// //         ...(current >= 0 && current < FULFILMENT_FLOW.length - 1 ? [FULFILMENT_FLOW[current + 1]] : []),
// //         ...(CANCELLABLE.includes(order.status) ? ["cancelled"] : []),
// //       ],
// //     },
// //   });
// // });

// // // PATCH /api/woven-essence/admin/orders/:id/status   { status, note? }
// // const updateStatus = asyncHandler(async (req, res) => {
// //   const { status, note } = req.body;

// //   const order = await Order.findById(req.params.id);
// //   if (!order) {
// //     res.status(404);
// //     throw new Error("Order not found");
// //   }
// //   assertBranchAccess(req, order, "Order");

// //   if (status === "cancelled") {
// //     if (!CANCELLABLE.includes(order.status)) {
// //       res.status(409);
// //       throw new Error(`A ${order.status.replace(/_/g, " ")} order can no longer be cancelled`);
// //     }

// //     // Put the stock back, and undo the sales counters this order added.
// //     for (const line of order.lines) {
// //       await Item.updateOne(
// //         { _id: line.item },
// //         {
// //           $inc: {
// //             "inventory.currentStock": line.quantity,
// //             "salesIntelligence.totalQuantitySold": -line.quantity,
// //             "salesIntelligence.totalRevenue": -(line.lineSubtotal || 0),
// //             "salesIntelligence.cancellationCount": 1,
// //           },
// //         }
// //       );
// //     }

// //     order.status = "cancelled";
// //     order.timeline.push({ status: "cancelled", at: new Date(), by: "admin", note: note || "Cancelled by store" });
// //     await order.save();
// //     return res.json({ success: true, data: order, message: "Order cancelled and stock restored" });
// //   }

// //   const current = FULFILMENT_FLOW.indexOf(order.status);
// //   const target = FULFILMENT_FLOW.indexOf(status);

// //   if (target < 0) {
// //     res.status(400);
// //     throw new Error(`Unknown status: ${status}`);
// //   }
// //   // One step forward only — skipping steps makes the timeline a lie.
// //   if (target !== current + 1) {
// //     res.status(409);
// //     throw new Error(
// //       current < 0
// //         ? `An order that is "${order.status.replace(/_/g, " ")}" can't be moved along the fulfilment flow`
// //         : `Next step is "${FULFILMENT_FLOW[current + 1].replace(/_/g, " ")}", not "${status.replace(/_/g, " ")}"`
// //     );
// //   }

// //   order.status = status;
// //   order.timeline.push({ status, at: new Date(), by: "admin", note: note || undefined });

// //   if (status === "delivered") {
// //     order.shipment = { ...(order.shipment?.toObject?.() || order.shipment || {}), deliveredAt: new Date() };
// //     // A COD order is only invoiceable now — the Razorpay path issues its number
// //     // at payment time, this covers everything else.
// //     order.ensureInvoiceNumber();
// //     // Cash collected on delivery for a COD order.
// //     if (order.payment?.method === "cod" && order.payment?.status === "cod_pending") {
// //       order.payment.status = "cod_collected";
// //       order.payment.paidAt = new Date();
// //     }
// //   }

// //   await order.save();
// //   res.json({ success: true, data: order, message: `Order marked ${status.replace(/_/g, " ")}` });
// // });

// // // PATCH /api/woven-essence/admin/orders/:id/shipment
// // // Manual courier details, for stores shipping before Shiprocket is connected.
// // const updateShipment = asyncHandler(async (req, res) => {
// //   const order = await Order.findById(req.params.id);
// //   if (!order) {
// //     res.status(404);
// //     throw new Error("Order not found");
// //   }
// //   assertBranchAccess(req, order, "Order");

// //   const fields = ["awbCode", "courierName", "trackingUrl", "expectedDeliveryAt", "pickupScheduledAt"];
// //   const incoming = {};
// //   fields.forEach((f) => {
// //     if (req.body[f] !== undefined && req.body[f] !== "") incoming[f] = req.body[f];
// //   });

// //   if (Object.keys(incoming).length === 0) {
// //     res.status(400);
// //     throw new Error("Provide at least a courier name or AWB number");
// //   }

// //   order.shipment = { ...(order.shipment?.toObject?.() || order.shipment || {}), ...incoming };
// //   order.timeline.push({
// //     status: order.status,
// //     at: new Date(),
// //     by: "admin",
// //     note: `Tracking updated${incoming.awbCode ? ` — AWB ${incoming.awbCode}` : ""}${
// //       incoming.courierName ? ` via ${incoming.courierName}` : ""
// //     }`,
// //   });

// //   await order.save();
// //   res.json({ success: true, data: order, message: "Tracking details saved" });
// // });

// // module.exports = { listOrders, getOrder, updateStatus, updateShipment };








// const asyncHandler = require("express-async-handler");
// const mongoose = require("mongoose");
// const Order = require("../models/Order");
// const { FULFILMENT_FLOW } = require("../models/Order");
// const Item = require("../models/Item");
// const { assertBranchAccess } = require("../middleware/branchScope");
// const email = require("../services/emailService");

// /**
//  * Order management for staff.
//  *
//  * Status changes follow the fulfilment flow rather than allowing any jump: an
//  * order can move forward one step, or be cancelled. Letting an admin set
//  * "delivered" on an unpaid order would make the revenue figures meaningless.
//  */

// const CANCELLABLE = ["pending_payment", "confirmed", "packed"];

// // GET /api/woven-essence/admin/orders?branch=&status=&q=&page=&limit=
// const listOrders = asyncHandler(async (req, res) => {
//   const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
//   const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

//   const filter = {};
//   if (/^[a-f\d]{24}$/i.test(String(req.query.branch || "")))
//     // ObjectId, not the raw string: the status-count aggregate below is passed
//     // to MongoDB uncast and would match nothing.
//     filter.branch = new mongoose.Types.ObjectId(String(req.query.branch));
//   if (req.query.status) filter.status = req.query.status;
//   if (req.query.paymentMethod) filter["payment.method"] = req.query.paymentMethod;

//   if (req.query.q) {
//     const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
//     filter.$or = [
//       { orderNumber: rx },
//       { customerName: rx },
//       { customerEmail: rx },
//       { customerPhone: rx },
//       { "shippingAddress.pincode": rx },
//       { "shipment.awbCode": rx },
//     ];
//   }

//   const [total, orders, statusCounts] = await Promise.all([
//     Order.countDocuments(filter),
//     Order.find(filter)
//       .select(
//         "orderNumber status amounts payment customerName customerEmail customerPhone shippingAddress.city shippingAddress.pincode " +
//           "lines.productName lines.quantity shipment.awbCode shipment.courierName createdAt invoiceNumber branch"
//       )
//       .populate("branch", "branchName branchCode")
//       .sort("-createdAt")
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .lean(),
//     Order.aggregate([
//       ...(filter.branch ? [{ $match: { branch: filter.branch } }] : []),
//       { $group: { _id: "$status", count: { $sum: 1 } } },
//     ]),
//   ]);

//   res.json({
//     success: true,
//     data: orders.map((o) => ({
//       id: o._id,
//       orderNumber: o.orderNumber,
//       status: o.status,
//       total: o.amounts?.grandTotal ?? 0,
//       currency: o.amounts?.currency || "INR",
//       paymentMethod: o.payment?.method,
//       paymentStatus: o.payment?.status,
//       customerName: o.customerName || "",
//       customerEmail: o.customerEmail || "",
//       customerPhone: o.customerPhone || "",
//       city: o.shippingAddress?.city || "",
//       pincode: o.shippingAddress?.pincode || "",
//       itemCount: (o.lines || []).reduce((n, l) => n + (l.quantity || 0), 0),
//       firstProduct: o.lines?.[0]?.productName || "",
//       awbCode: o.shipment?.awbCode || "",
//       courierName: o.shipment?.courierName || "",
//       invoiceNumber: o.invoiceNumber || "",
//       branchName: o.branch?.branchName || "",
//       placedAt: o.createdAt,
//     })),
//     counts: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])),
//     pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
//   });
// });

// // GET /api/woven-essence/admin/orders/:id
// const getOrder = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const query = /^[a-f\d]{24}$/i.test(id) ? { _id: id } : { orderNumber: id.toUpperCase() };

//   const order = await Order.findOne(query)
//     .populate("branch", "branchName branchCode address contact")
//     .lean();

//   if (!order) {
//     res.status(404);
//     throw new Error("Order not found");
//   }
//   assertBranchAccess(req, order, "Order");

//   const current = FULFILMENT_FLOW.indexOf(order.status);
//   res.json({
//     success: true,
//     data: {
//       ...order,
//       /** What this order can legally become next — the UI renders exactly these. */
//       allowedNextStatuses: [
//         ...(current >= 0 && current < FULFILMENT_FLOW.length - 1 ? [FULFILMENT_FLOW[current + 1]] : []),
//         ...(CANCELLABLE.includes(order.status) ? ["cancelled"] : []),
//       ],
//     },
//   });
// });

// // PATCH /api/woven-essence/admin/orders/:id/status   { status, note? }
// const updateStatus = asyncHandler(async (req, res) => {
//   const { status, note } = req.body;

//   const order = await Order.findById(req.params.id);
//   if (!order) {
//     res.status(404);
//     throw new Error("Order not found");
//   }
//   assertBranchAccess(req, order, "Order");

//   if (status === "cancelled") {
//     if (!CANCELLABLE.includes(order.status)) {
//       res.status(409);
//       throw new Error(`A ${order.status.replace(/_/g, " ")} order can no longer be cancelled`);
//     }

//     // Put the stock back, and undo the sales counters this order added.
//     for (const line of order.lines) {
//       await Item.updateOne(
//         { _id: line.item },
//         {
//           $inc: {
//             "inventory.currentStock": line.quantity,
//             "salesIntelligence.totalQuantitySold": -line.quantity,
//             "salesIntelligence.totalRevenue": -(line.lineSubtotal || 0),
//             "salesIntelligence.cancellationCount": 1,
//           },
//         }
//       );
//     }

//     order.status = "cancelled";
//     order.timeline.push({ status: "cancelled", at: new Date(), by: "admin", note: note || "Cancelled by store" });
//     await order.save();
//     email.sendOrderCancelled(order, note).catch(() => {});
//     return res.json({ success: true, data: order, message: "Order cancelled and stock restored" });
//   }

//   const current = FULFILMENT_FLOW.indexOf(order.status);
//   const target = FULFILMENT_FLOW.indexOf(status);

//   if (target < 0) {
//     res.status(400);
//     throw new Error(`Unknown status: ${status}`);
//   }
//   // One step forward only — skipping steps makes the timeline a lie.
//   if (target !== current + 1) {
//     res.status(409);
//     throw new Error(
//       current < 0
//         ? `An order that is "${order.status.replace(/_/g, " ")}" can't be moved along the fulfilment flow`
//         : `Next step is "${FULFILMENT_FLOW[current + 1].replace(/_/g, " ")}", not "${status.replace(/_/g, " ")}"`
//     );
//   }

//   order.status = status;
//   order.timeline.push({ status, at: new Date(), by: "admin", note: note || undefined });

//   if (status === "delivered") {
//     order.shipment = { ...(order.shipment?.toObject?.() || order.shipment || {}), deliveredAt: new Date() };
//     // A COD order is only invoiceable now — the Razorpay path issues its number
//     // at payment time, this covers everything else.
//     order.ensureInvoiceNumber();
//     // Cash collected on delivery for a COD order.
//     if (order.payment?.method === "cod" && order.payment?.status === "cod_pending") {
//       order.payment.status = "cod_collected";
//       order.payment.paidAt = new Date();
//     }
//   }

//   await order.save();

//   // Only the two moments a customer actually wants to hear about.
//   if (status === "shipped") email.sendOrderShipped(order).catch(() => {});
//   if (status === "delivered") email.sendOrderDelivered(order).catch(() => {});

//   res.json({ success: true, data: order, message: `Order marked ${status.replace(/_/g, " ")}` });
// });

// // PATCH /api/woven-essence/admin/orders/:id/shipment
// // Manual courier details, for stores shipping before Shiprocket is connected.
// const updateShipment = asyncHandler(async (req, res) => {
//   const order = await Order.findById(req.params.id);
//   if (!order) {
//     res.status(404);
//     throw new Error("Order not found");
//   }
//   assertBranchAccess(req, order, "Order");

//   const fields = ["awbCode", "courierName", "trackingUrl", "expectedDeliveryAt", "pickupScheduledAt"];
//   const incoming = {};
//   fields.forEach((f) => {
//     if (req.body[f] !== undefined && req.body[f] !== "") incoming[f] = req.body[f];
//   });

//   if (Object.keys(incoming).length === 0) {
//     res.status(400);
//     throw new Error("Provide at least a courier name or AWB number");
//   }

//   order.shipment = { ...(order.shipment?.toObject?.() || order.shipment || {}), ...incoming };
//   order.timeline.push({
//     status: order.status,
//     at: new Date(),
//     by: "admin",
//     note: `Tracking updated${incoming.awbCode ? ` — AWB ${incoming.awbCode}` : ""}${
//       incoming.courierName ? ` via ${incoming.courierName}` : ""
//     }`,
//   });

//   await order.save();
//   res.json({ success: true, data: order, message: "Tracking details saved" });
// });

// module.exports = { listOrders, getOrder, updateStatus, updateShipment };











const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { FULFILMENT_FLOW } = require("../models/Order");
const Item = require("../models/Item");
const { assertBranchAccess, orderBranchFilter } = require("../middleware/branchScope");
const email = require("../services/emailService");

/**
 * Order management for staff.
 *
 * Status changes follow the fulfilment flow rather than allowing any jump: an
 * order can move forward one step, or be cancelled. Letting an admin set
 * "delivered" on an unpaid order would make the revenue figures meaningless.
 *
 * MULTI-STORE: one order can draw stock from several stores. The branch filter
 * therefore matches the fulfilling store OR any source store, so a branch admin
 * still sees the orders that owe them a saree. Each order carries a pick list
 * (sourceBranches) that staff tick off as items reach the warehouse.
 */

const CANCELLABLE = ["pending_payment", "confirmed", "packed"];

// GET /api/woven-essence/admin/orders?branch=&status=&q=&page=&limit=
const listOrders = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const filter = {};
  let branchId = null;

  if (/^[a-f\d]{24}$/i.test(String(req.query.branch || ""))) {
    // ObjectId, not the raw string: the status-count aggregate below is passed
    // to MongoDB uncast and would match nothing.
    branchId = new mongoose.Types.ObjectId(String(req.query.branch));
    Object.assign(filter, orderBranchFilter(branchId));
  }

  if (req.query.status) filter.status = req.query.status;
  if (req.query.paymentMethod) filter["payment.method"] = req.query.paymentMethod;

  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const search = [
      { orderNumber: rx },
      { customerName: rx },
      { customerEmail: rx },
      { customerPhone: rx },
      { "shippingAddress.pincode": rx },
      { "shipment.awbCode": rx },
    ];
    // A branch filter already occupies $or, so combine them with $and rather
    // than letting the search overwrite the scope — that would leak other
    // branches' orders to a scoped admin the moment they typed in the box.
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: search }];
      delete filter.$or;
    } else {
      filter.$or = search;
    }
  }

  const countMatch = branchId ? orderBranchFilter(branchId) : {};

  const [total, orders, statusCounts] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .select(
        "orderNumber status amounts payment customerName customerEmail customerPhone shippingAddress.city shippingAddress.pincode " +
          "lines.productName lines.quantity shipment.awbCode shipment.courierName createdAt invoiceNumber branch sourceBranches"
      )
      .populate("branch", "branchName branchCode")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.aggregate([
      ...(branchId ? [{ $match: countMatch }] : []),
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    success: true,
    data: orders.map((o) => ({
      id: o._id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.amounts?.grandTotal ?? 0,
      currency: o.amounts?.currency || "INR",
      paymentMethod: o.payment?.method,
      paymentStatus: o.payment?.status,
      customerName: o.customerName || "",
      customerEmail: o.customerEmail || "",
      customerPhone: o.customerPhone || "",
      city: o.shippingAddress?.city || "",
      pincode: o.shippingAddress?.pincode || "",
      itemCount: (o.lines || []).reduce((n, l) => n + (l.quantity || 0), 0),
      firstProduct: o.lines?.[0]?.productName || "",
      awbCode: o.shipment?.awbCode || "",
      courierName: o.shipment?.courierName || "",
      invoiceNumber: o.invoiceNumber || "",
      branchName: o.branch?.branchName || "",
      /** Stores this order has to be collected from, for the queue view. */
      sourceStores: (o.sourceBranches || []).map((s) => s.branchCity || s.branchName).filter(Boolean),
      storeCount: (o.sourceBranches || []).length,
      multiStore: (o.sourceBranches || []).length > 1,
      pendingCollection: (o.sourceBranches || []).filter((s) => !s.collected).length,
      placedAt: o.createdAt,
    })),
    counts: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

// GET /api/woven-essence/admin/orders/:id
const getOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = /^[a-f\d]{24}$/i.test(id) ? { _id: id } : { orderNumber: id.toUpperCase() };

  const order = await Order.findOne(query)
    .populate("branch", "branchName branchCode address contact")
    .lean();

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  assertBranchAccess(req, order, "Order");

  const current = FULFILMENT_FLOW.indexOf(order.status);
  res.json({
    success: true,
    data: {
      ...order,
      /** What this order can legally become next — the UI renders exactly these. */
      allowedNextStatuses: [
        ...(current >= 0 && current < FULFILMENT_FLOW.length - 1 ? [FULFILMENT_FLOW[current + 1]] : []),
        ...(CANCELLABLE.includes(order.status) ? ["cancelled"] : []),
      ],
      /** True once every source store's items are at the warehouse. */
      readyToPack: (order.sourceBranches || []).every((s) => s.collected),
    },
  });
});

/**
 * PATCH /api/woven-essence/admin/orders/:id/collection   { branch, collected }
 *
 * Ticks off one store on the pick list. Exists because a multi-store order sits
 * in limbo between "confirmed" and "packed" while stock travels to the
 * warehouse, and staff need somewhere to record what has actually arrived
 * rather than keeping it on paper.
 */
const setCollectionStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  assertBranchAccess(req, order, "Order");

  const branchId = String(req.body?.branch || "");
  const row = (order.sourceBranches || []).find((s) => String(s.branch) === branchId);
  if (!row) {
    res.status(404);
    throw new Error("That store isn't on this order's pick list");
  }

  const collected = req.body?.collected !== false;
  row.collected = collected;
  row.collectedAt = collected ? new Date() : null;

  order.timeline.push({
    status: order.status,
    at: new Date(),
    by: "admin",
    note: `${row.branchName || "Store"} items ${collected ? "collected" : "marked not collected"}`,
  });

  await order.save();

  const pending = order.sourceBranches.filter((s) => !s.collected);
  res.json({
    success: true,
    data: order,
    message: pending.length
      ? `${pending.length} store${pending.length === 1 ? "" : "s"} still to collect from`
      : "Everything is at the warehouse — ready to pack",
  });
});

// PATCH /api/woven-essence/admin/orders/:id/status   { status, note? }
const updateStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  assertBranchAccess(req, order, "Order");

  if (status === "cancelled") {
    if (!CANCELLABLE.includes(order.status)) {
      res.status(409);
      throw new Error(`A ${order.status.replace(/_/g, " ")} order can no longer be cancelled`);
    }

    // Put the stock back, and undo the sales counters this order added.
    for (const line of order.lines) {
      await Item.updateOne(
        { _id: line.item },
        {
          $inc: {
            "inventory.currentStock": line.quantity,
            // totalOrders is decremented here too, matching the customer-side
            // cancel — leaving it out made the two paths disagree.
            "salesIntelligence.totalOrders": -1,
            "salesIntelligence.totalQuantitySold": -line.quantity,
            "salesIntelligence.totalRevenue": -(line.lineSubtotal || 0),
            "salesIntelligence.cancellationCount": 1,
          },
        }
      );
    }

    order.status = "cancelled";
    order.timeline.push({ status: "cancelled", at: new Date(), by: "admin", note: note || "Cancelled by store" });
    await order.save();
    email.sendOrderCancelled(order, note).catch(() => {});
    return res.json({ success: true, data: order, message: "Order cancelled and stock restored" });
  }

  const current = FULFILMENT_FLOW.indexOf(order.status);
  const target = FULFILMENT_FLOW.indexOf(status);

  if (target < 0) {
    res.status(400);
    throw new Error(`Unknown status: ${status}`);
  }
  // One step forward only — skipping steps makes the timeline a lie.
  if (target !== current + 1) {
    res.status(409);
    throw new Error(
      current < 0
        ? `An order that is "${order.status.replace(/_/g, " ")}" can't be moved along the fulfilment flow`
        : `Next step is "${FULFILMENT_FLOW[current + 1].replace(/_/g, " ")}", not "${status.replace(/_/g, " ")}"`
    );
  }

  order.status = status;
  order.timeline.push({ status, at: new Date(), by: "admin", note: note || undefined });

  if (status === "delivered") {
    order.shipment = { ...(order.shipment?.toObject?.() || order.shipment || {}), deliveredAt: new Date() };
    // A COD order is only invoiceable now — the Razorpay path issues its number
    // at payment time, this covers everything else.
    order.ensureInvoiceNumber();
    // Cash collected on delivery for a COD order.
    if (order.payment?.method === "cod" && order.payment?.status === "cod_pending") {
      order.payment.status = "cod_collected";
      order.payment.paidAt = new Date();
    }
  }

  await order.save();

  // Only the two moments a customer actually wants to hear about.
  if (status === "shipped") email.sendOrderShipped(order).catch(() => {});
  if (status === "delivered") email.sendOrderDelivered(order).catch(() => {});

  res.json({ success: true, data: order, message: `Order marked ${status.replace(/_/g, " ")}` });
});

// PATCH /api/woven-essence/admin/orders/:id/shipment
// Manual courier details, for stores shipping before Shiprocket is connected.
const updateShipment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  assertBranchAccess(req, order, "Order");

  const fields = ["awbCode", "courierName", "trackingUrl", "expectedDeliveryAt", "pickupScheduledAt"];
  const incoming = {};
  fields.forEach((f) => {
    if (req.body[f] !== undefined && req.body[f] !== "") incoming[f] = req.body[f];
  });

  if (Object.keys(incoming).length === 0) {
    res.status(400);
    throw new Error("Provide at least a courier name or AWB number");
  }

  order.shipment = { ...(order.shipment?.toObject?.() || order.shipment || {}), ...incoming };
  order.timeline.push({
    status: order.status,
    at: new Date(),
    by: "admin",
    note: `Tracking updated${incoming.awbCode ? ` — AWB ${incoming.awbCode}` : ""}${
      incoming.courierName ? ` via ${incoming.courierName}` : ""
    }`,
  });

  await order.save();
  res.json({ success: true, data: order, message: "Tracking details saved" });
});

module.exports = { listOrders, getOrder, updateStatus, updateShipment, setCollectionStatus };