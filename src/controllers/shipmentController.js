







// const asyncHandler = require("express-async-handler");
// const Order = require("../models/Order");
// const Branch = require("../models/Branch");
// const sr = require("../services/shiprocketService");
// const { assertBranchAccess } = require("../middleware/branchScope");

// /**
//  * Shipment handling for staff, plus Shiprocket's status webhook.
//  *
//  * The order is the source of truth for our own workflow; Shiprocket only ever
//  * *advances* it. A courier scan is never allowed to walk an order backwards, and
//  * an unrecognised courier status changes nothing but the recorded scan list —
//  * guessing would corrupt the timeline the customer is watching.
//  */

// /** Total shipment weight in kg, from the frozen order lines. */
// function orderWeightKg(order) {
//   const grams = (order.lines || []).reduce((sum, l) => sum + (l.weightGrams || 0) * (l.quantity || 1), 0);
//   // Fall back to a sensible saree weight rather than sending 0, which Shiprocket rejects.
//   return Math.max(Math.round((grams || (order.lines || []).length * 700) / 10) / 100, 0.1);
// }

// function shipmentOf(order) {
//   return order.shipment?.toObject?.() || order.shipment || {};
// }

// /** Note a courier event on the order timeline, without duplicating it. */
// function pushTimeline(order, status, note) {
//   const last = order.timeline[order.timeline.length - 1];
//   if (last && last.status === status && last.note === note) return;
//   order.timeline.push({ status, at: new Date(), by: "courier", note });
// }

// async function loadOrder(id, req) {
//   const query = /^[a-f\d]{24}$/i.test(id) ? { _id: id } : { orderNumber: String(id).toUpperCase() };
//   const order = await Order.findOne(query);
//   if (!order) {
//     const err = new Error("Order not found");
//     err.statusCode = 404;
//     throw err;
//   }
//   // Shipment actions reach an order by id or number, so scope it here.
//   if (req) assertBranchAccess(req, order, "Order");
//   return order;
// }

// // GET /api/woven-essence/admin/shipments/:id/couriers
// const listCouriers = asyncHandler(async (req, res) => {
//   const order = await loadOrder(req.params.id, req);
//   const branch = await Branch.findById(order.branch).select("address");

//   const pickupPostcode = branch?.address?.pincode;
//   if (!pickupPostcode) {
//     res.status(409);
//     throw new Error(
//       "This branch has no pincode saved. Add it in Branch management — Shiprocket needs a pickup pincode."
//     );
//   }

//   const couriers = await sr.checkServiceability({
//     pickupPostcode,
//     deliveryPostcode: order.shippingAddress?.pincode,
//     weightKg: orderWeightKg(order),
//     cod: order.payment?.method === "cod",
//     declaredValue: order.amounts?.grandTotal,
//   });

//   res.json({
//     success: true,
//     data: {
//       pickupPostcode,
//       deliveryPostcode: order.shippingAddress?.pincode,
//       weightKg: orderWeightKg(order),
//       couriers,
//     },
//   });
// });

// // POST /api/woven-essence/admin/shipments/:id/create
// // Pushes the order into Shiprocket. Idempotent: if it is already there, returns
// // the existing ids rather than creating a duplicate shipment.
// const createShipment = asyncHandler(async (req, res) => {
//   const order = await loadOrder(req.params.id, req);
//   const existing = shipmentOf(order);

//   if (existing.shiprocketOrderId) {
//     return res.json({
//       success: true,
//       data: existing,
//       message: "This order is already in Shiprocket",
//     });
//   }

//   if (order.status === "pending_payment") {
//     res.status(409);
//     throw new Error("This order hasn't been paid for yet");
//   }
//   if (["cancelled", "returned", "refunded"].includes(order.status)) {
//     res.status(409);
//     throw new Error(`A ${order.status} order can't be shipped`);
//   }

//   const branch = await Branch.findById(order.branch).select("branchName address contact");
//   const ship = order.shippingAddress || {};
//   const bill = order.billingAddress || ship;

//   const payload = {
//     order_id: order.orderNumber,
//     order_date: new Date(order.createdAt).toISOString().slice(0, 19).replace("T", " "),
//     // Must match a pickup location configured in the Shiprocket dashboard.
//     pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || branch?.branchName || "Primary",
//     channel_id: process.env.SHIPROCKET_CHANNEL_ID || undefined,

//     billing_customer_name: bill.fullName || order.customerName || "Customer",
//     billing_last_name: "",
//     billing_address: bill.line1 || "",
//     billing_address_2: bill.line2 || "",
//     billing_city: bill.city || "",
//     billing_pincode: bill.pincode || "",
//     billing_state: bill.state || "",
//     billing_country: bill.country || "India",
//     billing_email: order.customerEmail || "",
//     billing_phone: bill.phone || order.customerPhone || "",

//     shipping_is_billing: false,
//     shipping_customer_name: ship.fullName || order.customerName || "Customer",
//     shipping_address: ship.line1 || "",
//     shipping_address_2: ship.line2 || "",
//     shipping_city: ship.city || "",
//     shipping_pincode: ship.pincode || "",
//     shipping_state: ship.state || "",
//     shipping_country: ship.country || "India",
//     shipping_email: order.customerEmail || "",
//     shipping_phone: ship.phone || order.customerPhone || "",

//     order_items: (order.lines || []).map((l) => ({
//       name: l.productName,
//       sku: l.sku || l.itemCode || String(l.item),
//       units: l.quantity,
//       selling_price: l.unitPrice,
//       hsn: l.hsnCode || undefined,
//     })),

//     payment_method: order.payment?.method === "cod" ? "COD" : "Prepaid",
//     sub_total: order.amounts?.subtotal ?? order.amounts?.grandTotal,

//     // Shiprocket requires non-zero dimensions; these are a folded saree box.
//     length: Number(process.env.SHIPROCKET_BOX_LENGTH_CM || 30),
//     breadth: Number(process.env.SHIPROCKET_BOX_BREADTH_CM || 24),
//     height: Number(process.env.SHIPROCKET_BOX_HEIGHT_CM || 8),
//     weight: orderWeightKg(order),
//   };

//   const created = await sr.createOrder(payload);

//   order.shipment = {
//     ...existing,
//     provider: "shiprocket",
//     shiprocketOrderId: created.shiprocketOrderId,
//     shipmentId: created.shipmentId,
//   };
//   order.timeline.push({
//     status: order.status,
//     at: new Date(),
//     by: "admin",
//     note: `Sent to Shiprocket (shipment ${created.shipmentId})`,
//   });
//   await order.save();

//   res.status(201).json({ success: true, data: shipmentOf(order), message: "Order sent to Shiprocket" });
// });

// // POST /api/woven-essence/admin/shipments/:id/awb   { courierCompanyId? }
// const assignAwb = asyncHandler(async (req, res) => {
//   const order = await loadOrder(req.params.id, req);
//   const existing = shipmentOf(order);

//   if (!existing.shipmentId) {
//     res.status(409);
//     throw new Error("Send this order to Shiprocket first");
//   }
//   if (existing.awbCode) {
//     return res.json({ success: true, data: existing, message: `AWB already assigned (${existing.awbCode})` });
//   }

//   const result = await sr.assignAwb({
//     shipmentId: existing.shipmentId,
//     courierCompanyId: req.body?.courierCompanyId,
//   });

//   if (!result.awbCode) {
//     res.status(502);
//     throw new Error("Shiprocket didn't return an AWB. Check the courier is serviceable for this pincode.");
//   }

//   order.shipment = {
//     ...existing,
//     awbCode: result.awbCode,
//     courierName: result.courierName,
//     trackingUrl: `https://shiprocket.co/tracking/${result.awbCode}`,
//   };
//   order.timeline.push({
//     status: order.status,
//     at: new Date(),
//     by: "admin",
//     note: `AWB ${result.awbCode} assigned via ${result.courierName || "courier"}`,
//   });
//   await order.save();

//   res.json({ success: true, data: shipmentOf(order), message: `AWB ${result.awbCode} assigned` });
// });

// // POST /api/woven-essence/admin/shipments/:id/pickup
// const schedulePickup = asyncHandler(async (req, res) => {
//   const order = await loadOrder(req.params.id, req);
//   const existing = shipmentOf(order);

//   if (!existing.awbCode) {
//     res.status(409);
//     throw new Error("Assign an AWB before booking the pickup");
//   }

//   const pickup = await sr.requestPickup(existing.shipmentId);
//   const label = await sr.generateLabel(existing.shipmentId).catch(() => ({ labelUrl: null }));

//   order.shipment = {
//     ...existing,
//     pickupScheduledAt: pickup.scheduledDate ? new Date(pickup.scheduledDate) : new Date(),
//     labelUrl: label.labelUrl || existing.labelUrl,
//   };

//   // Handing the parcel over is what "shipped" means, so advance the order if it
//   // is still sitting at confirmed or packed.
//   if (["confirmed", "packed"].includes(order.status)) {
//     order.status = "shipped";
//     pushTimeline(order, "shipped", `Picked up by ${existing.courierName || "courier"}`);
//   }

//   await order.save();
//   res.json({
//     success: true,
//     data: shipmentOf(order),
//     message: pickup.scheduledDate ? `Pickup scheduled for ${pickup.scheduledDate}` : "Pickup requested",
//   });
// });

// /**
//  * Applies courier tracking to an order. Shared by the manual refresh and the
//  * webhook so both behave identically.
//  */
// async function applyTracking(order, tracking) {
//   const existing = shipmentOf(order);

//   order.shipment = {
//     ...existing,
//     courierName: tracking.courierName || existing.courierName,
//     trackingUrl: tracking.trackUrl || existing.trackingUrl,
//     expectedDeliveryAt: tracking.expectedDelivery ? new Date(tracking.expectedDelivery) : existing.expectedDeliveryAt,
//     deliveredAt: tracking.deliveredAt ? new Date(tracking.deliveredAt) : existing.deliveredAt,
//     lastScanStatus: tracking.currentStatus || existing.lastScanStatus,
//     lastSyncedAt: new Date(),
//     scans: (tracking.scans || []).map((s) => ({
//       at: s.at,
//       status: s.status,
//       activity: s.activity,
//       location: s.location,
//     })),
//   };

//   const mapped = sr.mapToOrderStatus(tracking.currentStatus);
//   const FLOW = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"];
//   const currentIndex = FLOW.indexOf(order.status);
//   const targetIndex = FLOW.indexOf(mapped);

//   // Only ever move forward. A stale scan must not un-deliver an order.
//   if (mapped && targetIndex > currentIndex) {
//     order.status = mapped;
//     pushTimeline(order, mapped, `Courier: ${tracking.currentStatus}`);

//     if (mapped === "delivered") {
//       order.shipment.deliveredAt = order.shipment.deliveredAt || new Date();
//       order.ensureInvoiceNumber();
//       if (order.payment?.method === "cod" && order.payment?.status === "cod_pending") {
//         order.payment.status = "cod_collected";
//         order.payment.paidAt = new Date();
//       }
//     }
//   }

//   await order.save();
//   return { mapped, applied: !!(mapped && targetIndex > currentIndex) };
// }

// // POST /api/woven-essence/admin/shipments/:id/track
// const refreshTracking = asyncHandler(async (req, res) => {
//   const order = await loadOrder(req.params.id, req);
//   const existing = shipmentOf(order);

//   if (!existing.awbCode) {
//     res.status(409);
//     throw new Error("There's no AWB on this order yet");
//   }

//   const tracking = await sr.trackByAwb(existing.awbCode);
//   const result = await applyTracking(order, tracking);

//   res.json({
//     success: true,
//     data: { shipment: shipmentOf(order), status: order.status },
//     message: result.applied
//       ? `Updated to ${order.status.replace(/_/g, " ")}`
//       : `Courier says "${tracking.currentStatus || "no update"}" — order left at ${order.status.replace(/_/g, " ")}`,
//   });
// });

// // POST /api/woven-essence/webhooks/shiprocket   (public, token-verified)
// // Shiprocket pushes status changes here so tracking updates without polling.
// const webhook = asyncHandler(async (req, res) => {
//   const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;
//   const provided = req.headers["x-api-key"] || req.body?.token;

//   // Reject unless a token is configured AND matches — an unauthenticated
//   // endpoint that can change order status is not acceptable.
//   if (!expected || provided !== expected) {
//     res.status(401);
//     throw new Error("Invalid webhook token");
//   }

//   const awb = req.body?.awb || req.body?.awb_code;
//   if (!awb) {
//     // 200 so Shiprocket doesn't retry a payload we will never understand.
//     return res.json({ success: true, message: "No AWB in payload, ignored" });
//   }

//   const order = await Order.findOne({ "shipment.awbCode": String(awb) });
//   if (!order) {
//     return res.json({ success: true, message: "No matching order, ignored" });
//   }

//   // Prefer the webhook's own fields; fall back to a fresh pull if it is sparse.
//   const tracking = req.body?.current_status
//     ? {
//         currentStatus: req.body.current_status,
//         courierName: req.body.courier_name || null,
//         expectedDelivery: req.body.etd || null,
//         deliveredAt: /DELIVERED/i.test(req.body.current_status) ? req.body.delivered_date || new Date() : null,
//         trackUrl: null,
//         scans: (req.body.scans || []).map((s) => ({
//           at: s.date ? new Date(s.date) : new Date(),
//           status: s.status || req.body.current_status,
//           activity: s.activity || "",
//           location: s.location || "",
//         })),
//       }
//     : await sr.trackByAwb(awb);

//   await applyTracking(order, tracking);
//   res.json({ success: true, orderNumber: order.orderNumber, status: order.status });
// });

// // GET /api/woven-essence/admin/shipments/status
// const connectionStatus = asyncHandler(async (req, res) => {
//   res.json({
//     success: true,
//     data: {
//       configured: sr.isConfigured(),
//       webhookConfigured: !!process.env.SHIPROCKET_WEBHOOK_TOKEN,
//       pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION || null,
//     },
//   });
// });

// module.exports = {
//   listCouriers,
//   createShipment,
//   assignAwb,
//   schedulePickup,
//   refreshTracking,
//   webhook,
//   connectionStatus,
//   applyTracking,
// };
















const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const Branch = require("../models/Branch");
const sr = require("../services/shiprocketService");
const { assertBranchAccess } = require("../middleware/branchScope");
const email = require("../services/emailService");

/**
 * Shipment handling for staff, plus Shiprocket's status webhook.
 *
 * The order is the source of truth for our own workflow; Shiprocket only ever
 * *advances* it. A courier scan is never allowed to walk an order backwards, and
 * an unrecognised courier status changes nothing but the recorded scan list —
 * guessing would corrupt the timeline the customer is watching.
 */

/** Total shipment weight in kg, from the frozen order lines. */
function orderWeightKg(order) {
  const grams = (order.lines || []).reduce((sum, l) => sum + (l.weightGrams || 0) * (l.quantity || 1), 0);
  // Fall back to a sensible saree weight rather than sending 0, which Shiprocket rejects.
  return Math.max(Math.round((grams || (order.lines || []).length * 700) / 10) / 100, 0.1);
}

function shipmentOf(order) {
  return order.shipment?.toObject?.() || order.shipment || {};
}

/** Note a courier event on the order timeline, without duplicating it. */
function pushTimeline(order, status, note) {
  const last = order.timeline[order.timeline.length - 1];
  if (last && last.status === status && last.note === note) return;
  order.timeline.push({ status, at: new Date(), by: "courier", note });
}

async function loadOrder(id, req) {
  const query = /^[a-f\d]{24}$/i.test(id) ? { _id: id } : { orderNumber: String(id).toUpperCase() };
  const order = await Order.findOne(query);
  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }
  // Shipment actions reach an order by id or number, so scope it here.
  if (req) assertBranchAccess(req, order, "Order");
  return order;
}

// GET /api/woven-essence/admin/shipments/:id/couriers
const listCouriers = asyncHandler(async (req, res) => {
  const order = await loadOrder(req.params.id, req);
  const branch = await Branch.findById(order.branch).select("address");

  const pickupPostcode = branch?.address?.pincode;
  if (!pickupPostcode) {
    res.status(409);
    throw new Error(
      "This branch has no pincode saved. Add it in Branch management — Shiprocket needs a pickup pincode."
    );
  }

  const couriers = await sr.checkServiceability({
    pickupPostcode,
    deliveryPostcode: order.shippingAddress?.pincode,
    weightKg: orderWeightKg(order),
    cod: order.payment?.method === "cod",
    declaredValue: order.amounts?.grandTotal,
  });

  res.json({
    success: true,
    data: {
      pickupPostcode,
      deliveryPostcode: order.shippingAddress?.pincode,
      weightKg: orderWeightKg(order),
      couriers,
    },
  });
});

// POST /api/woven-essence/admin/shipments/:id/create
// Pushes the order into Shiprocket. Idempotent: if it is already there, returns
// the existing ids rather than creating a duplicate shipment.
const createShipment = asyncHandler(async (req, res) => {
  const order = await loadOrder(req.params.id, req);
  const existing = shipmentOf(order);

  if (existing.shiprocketOrderId) {
    return res.json({
      success: true,
      data: existing,
      message: "This order is already in Shiprocket",
    });
  }

  if (order.status === "pending_payment") {
    res.status(409);
    throw new Error("This order hasn't been paid for yet");
  }
  if (["cancelled", "returned", "refunded"].includes(order.status)) {
    res.status(409);
    throw new Error(`A ${order.status} order can't be shipped`);
  }

  const branch = await Branch.findById(order.branch).select("branchName address contact");
  const ship = order.shippingAddress || {};
  const bill = order.billingAddress || ship;

  const payload = {
    order_id: order.orderNumber,
    order_date: new Date(order.createdAt).toISOString().slice(0, 19).replace("T", " "),
    // Must match a pickup location configured in the Shiprocket dashboard.
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || branch?.branchName || "Primary",
    channel_id: process.env.SHIPROCKET_CHANNEL_ID || undefined,

    billing_customer_name: bill.fullName || order.customerName || "Customer",
    billing_last_name: "",
    billing_address: bill.line1 || "",
    billing_address_2: bill.line2 || "",
    billing_city: bill.city || "",
    billing_pincode: bill.pincode || "",
    billing_state: bill.state || "",
    billing_country: bill.country || "India",
    billing_email: order.customerEmail || "",
    billing_phone: bill.phone || order.customerPhone || "",

    shipping_is_billing: false,
    shipping_customer_name: ship.fullName || order.customerName || "Customer",
    shipping_address: ship.line1 || "",
    shipping_address_2: ship.line2 || "",
    shipping_city: ship.city || "",
    shipping_pincode: ship.pincode || "",
    shipping_state: ship.state || "",
    shipping_country: ship.country || "India",
    shipping_email: order.customerEmail || "",
    shipping_phone: ship.phone || order.customerPhone || "",

    order_items: (order.lines || []).map((l) => ({
      name: l.productName,
      sku: l.sku || l.itemCode || String(l.item),
      units: l.quantity,
      selling_price: l.unitPrice,
      hsn: l.hsnCode || undefined,
    })),

    payment_method: order.payment?.method === "cod" ? "COD" : "Prepaid",
    sub_total: order.amounts?.subtotal ?? order.amounts?.grandTotal,

    // Shiprocket requires non-zero dimensions; these are a folded saree box.
    length: Number(process.env.SHIPROCKET_BOX_LENGTH_CM || 30),
    breadth: Number(process.env.SHIPROCKET_BOX_BREADTH_CM || 24),
    height: Number(process.env.SHIPROCKET_BOX_HEIGHT_CM || 8),
    weight: orderWeightKg(order),
  };

  const created = await sr.createOrder(payload);

  order.shipment = {
    ...existing,
    provider: "shiprocket",
    shiprocketOrderId: created.shiprocketOrderId,
    shipmentId: created.shipmentId,
  };
  order.timeline.push({
    status: order.status,
    at: new Date(),
    by: "admin",
    note: `Sent to Shiprocket (shipment ${created.shipmentId})`,
  });
  await order.save();

  res.status(201).json({ success: true, data: shipmentOf(order), message: "Order sent to Shiprocket" });
});

// POST /api/woven-essence/admin/shipments/:id/awb   { courierCompanyId? }
const assignAwb = asyncHandler(async (req, res) => {
  const order = await loadOrder(req.params.id, req);
  const existing = shipmentOf(order);

  if (!existing.shipmentId) {
    res.status(409);
    throw new Error("Send this order to Shiprocket first");
  }
  if (existing.awbCode) {
    return res.json({ success: true, data: existing, message: `AWB already assigned (${existing.awbCode})` });
  }

  const result = await sr.assignAwb({
    shipmentId: existing.shipmentId,
    courierCompanyId: req.body?.courierCompanyId,
  });

  if (!result.awbCode) {
    res.status(502);
    throw new Error("Shiprocket didn't return an AWB. Check the courier is serviceable for this pincode.");
  }

  order.shipment = {
    ...existing,
    awbCode: result.awbCode,
    courierName: result.courierName,
    trackingUrl: `https://shiprocket.co/tracking/${result.awbCode}`,
  };
  order.timeline.push({
    status: order.status,
    at: new Date(),
    by: "admin",
    note: `AWB ${result.awbCode} assigned via ${result.courierName || "courier"}`,
  });
  await order.save();

  res.json({ success: true, data: shipmentOf(order), message: `AWB ${result.awbCode} assigned` });
});

// POST /api/woven-essence/admin/shipments/:id/pickup
const schedulePickup = asyncHandler(async (req, res) => {
  const order = await loadOrder(req.params.id, req);
  const existing = shipmentOf(order);

  if (!existing.awbCode) {
    res.status(409);
    throw new Error("Assign an AWB before booking the pickup");
  }

  const pickup = await sr.requestPickup(existing.shipmentId);
  const label = await sr.generateLabel(existing.shipmentId).catch(() => ({ labelUrl: null }));

  order.shipment = {
    ...existing,
    pickupScheduledAt: pickup.scheduledDate ? new Date(pickup.scheduledDate) : new Date(),
    labelUrl: label.labelUrl || existing.labelUrl,
  };

  // Handing the parcel over is what "shipped" means, so advance the order if it
  // is still sitting at confirmed or packed.
  if (["confirmed", "packed"].includes(order.status)) {
    order.status = "shipped";
    pushTimeline(order, "shipped", `Picked up by ${existing.courierName || "courier"}`);
  }

  await order.save();
  res.json({
    success: true,
    data: shipmentOf(order),
    message: pickup.scheduledDate ? `Pickup scheduled for ${pickup.scheduledDate}` : "Pickup requested",
  });
});

/**
 * Applies courier tracking to an order. Shared by the manual refresh and the
 * webhook so both behave identically.
 */
async function applyTracking(order, tracking) {
  const existing = shipmentOf(order);

  order.shipment = {
    ...existing,
    courierName: tracking.courierName || existing.courierName,
    trackingUrl: tracking.trackUrl || existing.trackingUrl,
    expectedDeliveryAt: tracking.expectedDelivery ? new Date(tracking.expectedDelivery) : existing.expectedDeliveryAt,
    deliveredAt: tracking.deliveredAt ? new Date(tracking.deliveredAt) : existing.deliveredAt,
    lastScanStatus: tracking.currentStatus || existing.lastScanStatus,
    lastSyncedAt: new Date(),
    scans: (tracking.scans || []).map((s) => ({
      at: s.at,
      status: s.status,
      activity: s.activity,
      location: s.location,
    })),
  };

  const mapped = sr.mapToOrderStatus(tracking.currentStatus);
  const FLOW = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"];
  const currentIndex = FLOW.indexOf(order.status);
  const targetIndex = FLOW.indexOf(mapped);

  // Only ever move forward. A stale scan must not un-deliver an order.
  if (mapped && targetIndex > currentIndex) {
    order.status = mapped;
    pushTimeline(order, mapped, `Courier: ${tracking.currentStatus}`);

    if (mapped === "delivered") {
      order.shipment.deliveredAt = order.shipment.deliveredAt || new Date();
      order.ensureInvoiceNumber();
      if (order.payment?.method === "cod" && order.payment?.status === "cod_pending") {
        order.payment.status = "cod_collected";
        order.payment.paidAt = new Date();
      }
    }
  }

  await order.save();

  const applied = !!(mapped && targetIndex > currentIndex);
  // Courier-driven transitions notify too, so a Shiprocket webhook produces the
  // same emails as a staff member clicking through the statuses.
  if (applied && mapped === "shipped") email.sendOrderShipped(order).catch(() => {});
  if (applied && mapped === "delivered") email.sendOrderDelivered(order).catch(() => {});

  return { mapped, applied };
}

// POST /api/woven-essence/admin/shipments/:id/track
const refreshTracking = asyncHandler(async (req, res) => {
  const order = await loadOrder(req.params.id, req);
  const existing = shipmentOf(order);

  if (!existing.awbCode) {
    res.status(409);
    throw new Error("There's no AWB on this order yet");
  }

  const tracking = await sr.trackByAwb(existing.awbCode);
  const result = await applyTracking(order, tracking);

  res.json({
    success: true,
    data: { shipment: shipmentOf(order), status: order.status },
    message: result.applied
      ? `Updated to ${order.status.replace(/_/g, " ")}`
      : `Courier says "${tracking.currentStatus || "no update"}" — order left at ${order.status.replace(/_/g, " ")}`,
  });
});

// POST /api/woven-essence/webhooks/shiprocket   (public, token-verified)
// Shiprocket pushes status changes here so tracking updates without polling.
const webhook = asyncHandler(async (req, res) => {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  const provided = req.headers["x-api-key"] || req.body?.token;

  // Reject unless a token is configured AND matches — an unauthenticated
  // endpoint that can change order status is not acceptable.
  if (!expected || provided !== expected) {
    res.status(401);
    throw new Error("Invalid webhook token");
  }

  const awb = req.body?.awb || req.body?.awb_code;
  if (!awb) {
    // 200 so Shiprocket doesn't retry a payload we will never understand.
    return res.json({ success: true, message: "No AWB in payload, ignored" });
  }

  const order = await Order.findOne({ "shipment.awbCode": String(awb) });
  if (!order) {
    return res.json({ success: true, message: "No matching order, ignored" });
  }

  // Prefer the webhook's own fields; fall back to a fresh pull if it is sparse.
  const tracking = req.body?.current_status
    ? {
        currentStatus: req.body.current_status,
        courierName: req.body.courier_name || null,
        expectedDelivery: req.body.etd || null,
        deliveredAt: /DELIVERED/i.test(req.body.current_status) ? req.body.delivered_date || new Date() : null,
        trackUrl: null,
        scans: (req.body.scans || []).map((s) => ({
          at: s.date ? new Date(s.date) : new Date(),
          status: s.status || req.body.current_status,
          activity: s.activity || "",
          location: s.location || "",
        })),
      }
    : await sr.trackByAwb(awb);

  await applyTracking(order, tracking);
  res.json({ success: true, orderNumber: order.orderNumber, status: order.status });
});

// GET /api/woven-essence/admin/shipments/status
const connectionStatus = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      configured: sr.isConfigured(),
      webhookConfigured: !!process.env.SHIPROCKET_WEBHOOK_TOKEN,
      pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION || null,
    },
  });
});

module.exports = {
  listCouriers,
  createShipment,
  assignAwb,
  schedulePickup,
  refreshTracking,
  webhook,
  connectionStatus,
  applyTracking,
};