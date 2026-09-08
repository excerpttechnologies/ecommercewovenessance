// const asyncHandler = require("express-async-handler");
// const PDFDocument = require("pdfkit");
// const Order = require("../models/Order");
// const Item = require("../models/Item");
// const { FULFILMENT_FLOW } = require("../models/Order");
// const { publicOrder } = require("./checkoutController");

// /**
//  * A customer's own orders.
//  *
//  * Every query is scoped to req.customer._id, so an order id from another account
//  * returns 404 rather than someone else's invoice.
//  */

// // GET /api/woven-essence/orders
// const listOrders = asyncHandler(async (req, res) => {
//   const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
//   const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

//   const filter = { customer: req.customer._id };
//   if (req.query.status) filter.status = req.query.status;

//   const [total, orders] = await Promise.all([
//     Order.countDocuments(filter),
//     Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
//   ]);

//   res.json({
//     success: true,
//     data: orders.map(publicOrder),
//     pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
//   });
// });

// // GET /api/woven-essence/orders/:id
// // Accepts the order number as well as the id — that's what a customer has to hand.
// const getOrder = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const or = [{ orderNumber: id.toUpperCase() }];
//   if (/^[a-f\d]{24}$/i.test(id)) or.push({ _id: id });

//   const order = await Order.findOne({ customer: req.customer._id, $or: or }).lean();
//   if (!order) {
//     res.status(404);
//     throw new Error("Order not found");
//   }

//   // The tracker the UI draws: which steps are done, which is current.
//   const reached = new Set(order.timeline.map((t) => t.status));
//   const currentIndex = FULFILMENT_FLOW.indexOf(order.status);
//   const tracker = FULFILMENT_FLOW.map((step, i) => ({
//     step,
//     done: reached.has(step),
//     current: order.status === step,
//     upcoming: currentIndex >= 0 ? i > currentIndex : !reached.has(step),
//     at: order.timeline.find((t) => t.status === step)?.at || null,
//   }));

//   const terminal = ["cancelled", "returned", "refunded"].includes(order.status);

//   res.json({
//     success: true,
//     data: {
//       ...publicOrder(order),
//       tracker: terminal ? [] : tracker,
//       terminalStatus: terminal ? order.status : null,
//       cancellable: ["pending_payment", "confirmed", "packed"].includes(order.status),
//       invoiceAvailable: Boolean(order.invoiceNumber) && order.status === "delivered",
//       cancelledReason: order.cancelledReason || null,
//     },
//   });
// });

// // POST /api/woven-essence/orders/:id/cancel
// const cancelOrder = asyncHandler(async (req, res) => {
//   const order = await Order.findOne({ _id: req.params.id, customer: req.customer._id });
//   if (!order) {
//     res.status(404);
//     throw new Error("Order not found");
//   }
//   if (!["pending_payment", "confirmed", "packed"].includes(order.status)) {
//     res.status(409);
//     throw new Error(
//       order.status === "shipped" || order.status === "out_for_delivery"
//         ? "This order has already shipped — please refuse delivery or raise a return instead."
//         : `An order that is ${order.status.replace(/_/g, " ")} can't be cancelled`
//     );
//   }

//   // Stock was only reduced once the order was live, so only put it back then.
//   const stockWasTaken = order.payment.status === "paid" || order.payment.status === "cod_pending";
//   if (stockWasTaken) {
//     for (const line of order.lines) {
//       await Item.updateOne(
//         { _id: line.item },
//         {
//           $inc: {
//             "inventory.currentStock": line.quantity,
//             "salesIntelligence.totalOrders": -1,
//             "salesIntelligence.totalQuantitySold": -line.quantity,
//             "salesIntelligence.totalRevenue": -line.lineSubtotal,
//             "salesIntelligence.cancellationCount": 1,
//           },
//         }
//       );
//     }
//   }

//   order.cancelledReason = String(req.body.reason || "Cancelled by customer").slice(0, 300);
//   if (order.payment.status === "paid") {
//     // Money is refunded out of band; the record says so rather than implying
//     // the customer has been paid back automatically.
//     order.payment.status = "refunded";
//     order.pushStatus("cancelled", "Cancelled — refund to be processed by the store", "customer");
//   } else {
//     order.pushStatus("cancelled", order.cancelledReason, "customer");
//   }
//   await order.save();

//   res.json({ success: true, data: publicOrder(order) });
// });

// // GET /api/woven-essence/orders/:id/invoice.pdf
// const downloadInvoice = asyncHandler(async (req, res) => {
//   const order = await Order.findOne({ _id: req.params.id, customer: req.customer._id }).lean();
//   if (!order) {
//     res.status(404);
//     throw new Error("Order not found");
//   }
//   if (!order.invoiceNumber) {
//     res.status(409);
//     throw new Error("An invoice is available once payment is complete");
//   }
//   if (order.status !== "delivered") {
//     res.status(409);
//     throw new Error("Your invoice will be available for download once the order is delivered");
//   }

//   const plain = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
//   const money = (n) => "Rs. " + plain(n);

//   const doc = new PDFDocument({ size: "A4", margin: 45 });
//   res.setHeader("Content-Type", "application/pdf");
//   res.setHeader("Content-Disposition", `attachment; filename="${order.invoiceNumber}.pdf"`);
//   doc.pipe(res);

//   const OX = "#6B1F2A";
//   const BRASS = "#A9791F";
//   const INK = "#1C1614";

//   // ── header ──
//   doc.fillColor(OX).fontSize(22).text("Woven Essence", 45, 45);
//   doc.fillColor(BRASS).fontSize(8).text("TEMPLE FABRIC SAREES", { characterSpacing: 1.5 });
//   doc.fillColor(INK).fontSize(16).text("TAX INVOICE", 45, 45, { align: "right" });
//   doc.fontSize(9).fillColor("#4A403A");
//   doc.text(order.invoiceNumber, { align: "right" });
//   doc.text(new Date(order.invoicedAt || order.createdAt).toLocaleDateString("en-IN"), { align: "right" });

//   doc.moveTo(45, 100).lineTo(550, 100).strokeColor(BRASS).lineWidth(1.5).stroke();

//   // ── parties ──
//   let y = 115;
//   doc.fillColor(BRASS).fontSize(8).text("SOLD BY", 45, y);
//   doc.fillColor(INK).fontSize(10).text(`Woven Essence — ${order.branchName || ""}`, 45, y + 13);
//   doc.fillColor("#4A403A").fontSize(9);
//   if (order.branchCity) doc.text(order.branchCity, 45, y + 27);
//   if (order.branchGst) doc.text(`GSTIN: ${order.branchGst}`, 45, y + 40);

//   doc.fillColor(BRASS).fontSize(8).text("BILL TO", 310, y);
//   const b = order.billingAddress || {};
//   doc.fillColor(INK).fontSize(10).text(b.fullName || order.customerName || "", 310, y + 13);
//   doc.fillColor("#4A403A").fontSize(9);
//   doc.text([b.line1, b.line2].filter(Boolean).join(", "), 310, y + 27, { width: 240 });
//   doc.text([b.city, b.state, b.pincode].filter(Boolean).join(", "), 310, doc.y, { width: 240 });
//   if (b.phone) doc.text(b.phone, 310, doc.y);

//   y = Math.max(doc.y, y + 75) + 15;
//   doc.fillColor("#4A403A").fontSize(9);
//   doc.text(`Order ${order.orderNumber}   |   Placed ${new Date(order.createdAt).toLocaleDateString("en-IN")}   |   Payment: ${order.payment.method === "cod" ? "Cash on delivery" : "Razorpay"} (${order.payment.status})`, 45, y, { width: 505 });

//   // ── line table ──
//   y = doc.y + 18;
//   // Widths tuned against a rendered page: the GST cell has to hold
//   // "5% (1,761.90)" on one line, and "Rs." is dropped inside the cells since
//   // the currency is already stated in the totals.
//   const COLS = [
//     { key: "sn", label: "#", x: 45, w: 20 },
//     { key: "desc", label: "Description", x: 65, w: 175 },
//     { key: "hsn", label: "HSN", x: 240, w: 42 },
//     { key: "qty", label: "Qty", x: 282, w: 28 },
//     { key: "rate", label: "Rate", x: 310, w: 62 },
//     { key: "gst", label: "GST", x: 372, w: 88 },
//     { key: "amt", label: "Amount", x: 460, w: 90 },
//   ];

//   doc.rect(45, y, 505, 20).fill("#F2EADC");
//   doc.fillColor(INK).fontSize(8.5);
//   COLS.forEach((c) =>
//     doc.text(c.label, c.x + 3, y + 6, { width: c.w - 6, align: ["qty", "rate", "gst", "amt"].includes(c.key) ? "right" : "left" })
//   );
//   y += 20;

//   order.lines.forEach((line, i) => {
//     if (y > 690) {
//       doc.addPage();
//       y = 50;
//     }
//     const h = 34;
//     doc.fillColor(INK).fontSize(9);
//     doc.text(String(i + 1), 48, y + 5, { width: 16 });
//     doc.text(line.productName, 65, y + 3, { width: 172 });
//     doc.fillColor("#8A7D6D").fontSize(7.5)
//       .text([line.itemCode, line.colour].filter(Boolean).join(" · "), 65, y + 18, { width: 172 });
//     doc.fillColor(INK).fontSize(9);
//     doc.text(line.hsnCode || "—", 240, y + 5, { width: 39, align: "right" });
//     doc.text(String(line.quantity), 282, y + 5, { width: 25, align: "right" });
//     doc.text(plain(line.unitPrice), 310, y + 5, { width: 59, align: "right" });
//     doc.text(line.gstRate ? `${line.gstRate}% (${plain(line.gstAmount)})` : "—", 372, y + 5, { width: 85, align: "right" });
//     doc.text(plain(line.lineSubtotal), 460, y + 5, { width: 87, align: "right" });
//     y += h;
//     doc.moveTo(45, y).lineTo(550, y).strokeColor("#E3D9C8").lineWidth(0.5).stroke();
//   });

//   // ── totals ──
//   y += 12;
//   const a = order.amounts || {};
//   const rows = [
//     ["Subtotal", a.subtotal],
//     a.discount > 0 ? ["Discount off MRP", -a.discount] : null,
//     a.shippingCharge > 0 ? ["Shipping", a.shippingCharge] : null,
//     a.codCharge > 0 ? ["Cash-on-delivery fee", a.codCharge] : null,
//   ].filter(Boolean);

//   rows.forEach(([label, value]) => {
//     doc.fillColor("#4A403A").fontSize(9).text(String(label), 300, y, { width: 155, align: "right" });
//     doc.fillColor(INK).text(money(value), 460, y, { width: 87, align: "right" });
//     y += 15;
//   });

//   doc.rect(300, y + 2, 250, 24).fill(OX);
//   doc.fillColor("#FFFDF9").fontSize(11).text("Grand Total", 304, y + 9, { width: 151, align: "right" });
//   doc.text(money(a.grandTotal), 460, y + 9, { width: 85, align: "right" });
//   y += 34;

//   if (a.gstTotal > 0) {
//     doc.fillColor("#8A7D6D").fontSize(8)
//       .text(`Includes GST of ${money(a.gstTotal)}. Prices are inclusive of tax unless stated otherwise.`, 300, y, { width: 250, align: "right" });
//   }

//   // ── footer ──
//   doc.fillColor("#8A7D6D").fontSize(7.5).text(
//     "This is a computer-generated invoice. Woven Essence — temple-fabric sarees woven in South India.",
//     45,
//     770,
//     { width: 505, align: "center" }
//   );

//   doc.end();
// });

// module.exports = { listOrders, getOrder, cancelOrder, downloadInvoice };






const asyncHandler = require("express-async-handler");
const PDFDocument = require("pdfkit");
const Order = require("../models/Order");
const Item = require("../models/Item");
const { FULFILMENT_FLOW } = require("../models/Order");
const { publicOrder } = require("./checkoutController");

/**
 * A customer's own orders.
 *
 * Every query is scoped to req.customer._id, so an order id from another account
 * returns 404 rather than someone else's invoice.
 */

// GET /api/woven-essence/orders
const listOrders = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

  const filter = { customer: req.customer._id };
  const requestedStatus = String(req.query.status || "").trim();
  if (requestedStatus && requestedStatus.toLowerCase() !== "all") {
    filter.status = requestedStatus;
  }

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);

  res.json({
    success: true,
    data: orders.map(publicOrder),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

// GET /api/woven-essence/orders/:id
// Accepts the order number as well as the id — that's what a customer has to hand.
const getOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const or = [{ orderNumber: id.toUpperCase() }];
  if (/^[a-f\d]{24}$/i.test(id)) or.push({ _id: id });

  const order = await Order.findOne({ customer: req.customer._id, $or: or }).lean();
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // The tracker the UI draws: which steps are done, which is current.
  const reached = new Set(order.timeline.map((t) => t.status));
  const currentIndex = FULFILMENT_FLOW.indexOf(order.status);
  const tracker = FULFILMENT_FLOW.map((step, i) => ({
    step,
    done: reached.has(step),
    current: order.status === step,
    upcoming: currentIndex >= 0 ? i > currentIndex : !reached.has(step),
    at: order.timeline.find((t) => t.status === step)?.at || null,
  }));

  const terminal = ["cancelled", "returned", "refunded"].includes(order.status);

  res.json({
    success: true,
    data: {
      ...publicOrder(order),
      tracker: terminal ? [] : tracker,
      terminalStatus: terminal ? order.status : null,
      cancellable: ["pending_payment", "confirmed", "packed"].includes(order.status),
      invoiceAvailable: Boolean(order.invoiceNumber) && order.status === "delivered",
      cancelledReason: order.cancelledReason || null,
    },
  });
});

// POST /api/woven-essence/orders/:id/cancel
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customer: req.customer._id });
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  if (!["pending_payment", "confirmed", "packed"].includes(order.status)) {
    res.status(409);
    throw new Error(
      order.status === "shipped" || order.status === "out_for_delivery"
        ? "This order has already shipped — please refuse delivery or raise a return instead."
        : `An order that is ${order.status.replace(/_/g, " ")} can't be cancelled`
    );
  }

  // Stock was only reduced once the order was live, so only put it back then.
  const stockWasTaken = order.payment.status === "paid" || order.payment.status === "cod_pending";
  if (stockWasTaken) {
    for (const line of order.lines) {
      await Item.updateOne(
        { _id: line.item },
        {
          $inc: {
            "inventory.currentStock": line.quantity,
            "salesIntelligence.totalOrders": -1,
            "salesIntelligence.totalQuantitySold": -line.quantity,
            "salesIntelligence.totalRevenue": -line.lineSubtotal,
            "salesIntelligence.cancellationCount": 1,
          },
        }
      );
    }
  }

  order.cancelledReason = String(req.body.reason || "Cancelled by customer").slice(0, 300);
  if (order.payment.status === "paid") {
    // Money is refunded out of band; the record says so rather than implying
    // the customer has been paid back automatically.
    order.payment.status = "refunded";
    order.pushStatus("cancelled", "Cancelled — refund to be processed by the store", "customer");
  } else {
    order.pushStatus("cancelled", order.cancelledReason, "customer");
  }
  await order.save();

  res.json({ success: true, data: publicOrder(order) });
});

// GET /api/woven-essence/orders/:id/invoice.pdf
const downloadInvoice = asyncHandler(async (req, res) => {
  // Accept the order number as well as the id, like getOrder does. The order
  // page is routed by order number, so an id-only lookup here meant the invoice
  // button 404'd for anyone arriving from that URL.
  const { id } = req.params;
  const lookup = /^[a-f\d]{24}$/i.test(id)
    ? { _id: id }
    : { orderNumber: String(id).toUpperCase() };

  const order = await Order.findOne({ ...lookup, customer: req.customer._id }).lean();
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  if (!order.invoiceNumber) {
    res.status(409);
    throw new Error("An invoice is available once payment is complete");
  }
  if (order.status !== "delivered") {
    res.status(409);
    throw new Error("Your invoice will be available for download once the order is delivered");
  }

  const plain = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const money = (n) => "Rs. " + plain(n);

  const doc = new PDFDocument({ size: "A4", margin: 45 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${order.invoiceNumber}.pdf"`);
  doc.pipe(res);

  const OX = "#6B1F2A";
  const BRASS = "#A9791F";
  const INK = "#1C1614";

  // ── header ──
  doc.fillColor(OX).fontSize(22).text("Woven Essence", 45, 45);
  doc.fillColor(BRASS).fontSize(8).text("TEMPLE FABRIC SAREES", { characterSpacing: 1.5 });
  doc.fillColor(INK).fontSize(16).text("TAX INVOICE", 45, 45, { align: "right" });
  doc.fontSize(9).fillColor("#4A403A");
  doc.text(order.invoiceNumber, { align: "right" });
  doc.text(new Date(order.invoicedAt || order.createdAt).toLocaleDateString("en-IN"), { align: "right" });

  doc.moveTo(45, 100).lineTo(550, 100).strokeColor(BRASS).lineWidth(1.5).stroke();

  // ── parties ──
  let y = 115;
  doc.fillColor(BRASS).fontSize(8).text("SOLD BY", 45, y);
  doc.fillColor(INK).fontSize(10).text(`Woven Essence — ${order.branchName || ""}`, 45, y + 13);
  doc.fillColor("#4A403A").fontSize(9);
  if (order.branchCity) doc.text(order.branchCity, 45, y + 27);
  if (order.branchGst) doc.text(`GSTIN: ${order.branchGst}`, 45, y + 40);

  doc.fillColor(BRASS).fontSize(8).text("BILL TO", 310, y);
  const b = order.billingAddress || {};
  doc.fillColor(INK).fontSize(10).text(b.fullName || order.customerName || "", 310, y + 13);
  doc.fillColor("#4A403A").fontSize(9);
  doc.text([b.line1, b.line2].filter(Boolean).join(", "), 310, y + 27, { width: 240 });
  doc.text([b.city, b.state, b.pincode].filter(Boolean).join(", "), 310, doc.y, { width: 240 });
  if (b.phone) doc.text(b.phone, 310, doc.y);

  y = Math.max(doc.y, y + 75) + 15;
  doc.fillColor("#4A403A").fontSize(9);
  doc.text(`Order ${order.orderNumber}   |   Placed ${new Date(order.createdAt).toLocaleDateString("en-IN")}   |   Payment: ${order.payment.method === "cod" ? "Cash on delivery" : "Razorpay"} (${order.payment.status})`, 45, y, { width: 505 });

  // ── line table ──
  y = doc.y + 18;
  // Widths tuned against a rendered page: the GST cell has to hold
  // "5% (1,761.90)" on one line, and "Rs." is dropped inside the cells since
  // the currency is already stated in the totals.
  const COLS = [
    { key: "sn", label: "#", x: 45, w: 20 },
    { key: "desc", label: "Description", x: 65, w: 175 },
    { key: "hsn", label: "HSN", x: 240, w: 42 },
    { key: "qty", label: "Qty", x: 282, w: 28 },
    { key: "rate", label: "Rate", x: 310, w: 62 },
    { key: "gst", label: "GST", x: 372, w: 88 },
    { key: "amt", label: "Amount", x: 460, w: 90 },
  ];

  doc.rect(45, y, 505, 20).fill("#F2EADC");
  doc.fillColor(INK).fontSize(8.5);
  COLS.forEach((c) =>
    doc.text(c.label, c.x + 3, y + 6, { width: c.w - 6, align: ["qty", "rate", "gst", "amt"].includes(c.key) ? "right" : "left" })
  );
  y += 20;

  order.lines.forEach((line, i) => {
    if (y > 690) {
      doc.addPage();
      y = 50;
    }
    const h = 34;
    doc.fillColor(INK).fontSize(9);
    doc.text(String(i + 1), 48, y + 5, { width: 16 });
    doc.text(line.productName, 65, y + 3, { width: 172 });
    doc.fillColor("#8A7D6D").fontSize(7.5)
      .text([line.itemCode, line.colour].filter(Boolean).join(" · "), 65, y + 18, { width: 172 });
    doc.fillColor(INK).fontSize(9);
    doc.text(line.hsnCode || "—", 240, y + 5, { width: 39, align: "right" });
    doc.text(String(line.quantity), 282, y + 5, { width: 25, align: "right" });
    doc.text(plain(line.unitPrice), 310, y + 5, { width: 59, align: "right" });
    doc.text(line.gstRate ? `${line.gstRate}% (${plain(line.gstAmount)})` : "—", 372, y + 5, { width: 85, align: "right" });
    doc.text(plain(line.lineSubtotal), 460, y + 5, { width: 87, align: "right" });
    y += h;
    doc.moveTo(45, y).lineTo(550, y).strokeColor("#E3D9C8").lineWidth(0.5).stroke();
  });

  // ── totals ──
  y += 12;
  const a = order.amounts || {};
  const rows = [
    ["Subtotal", a.subtotal],
    a.discount > 0 ? ["Discount off MRP", -a.discount] : null,
    a.shippingCharge > 0 ? ["Shipping", a.shippingCharge] : null,
    a.codCharge > 0 ? ["Cash-on-delivery fee", a.codCharge] : null,
  ].filter(Boolean);

  rows.forEach(([label, value]) => {
    doc.fillColor("#4A403A").fontSize(9).text(String(label), 300, y, { width: 155, align: "right" });
    doc.fillColor(INK).text(money(value), 460, y, { width: 87, align: "right" });
    y += 15;
  });

  doc.rect(300, y + 2, 250, 24).fill(OX);
  doc.fillColor("#FFFDF9").fontSize(11).text("Grand Total", 304, y + 9, { width: 151, align: "right" });
  doc.text(money(a.grandTotal), 460, y + 9, { width: 85, align: "right" });
  y += 34;

  if (a.gstTotal > 0) {
    doc.fillColor("#8A7D6D").fontSize(8)
      .text(`Includes GST of ${money(a.gstTotal)}. Prices are inclusive of tax unless stated otherwise.`, 300, y, { width: 250, align: "right" });
  }

  // ── footer ──
  doc.fillColor("#8A7D6D").fontSize(7.5).text(
    "This is a computer-generated invoice. Woven Essence — temple-fabric sarees woven in South India.",
    45,
    770,
    { width: 505, align: "center" }
  );

  doc.end();
});

module.exports = { listOrders, getOrder, cancelOrder, downloadInvoice };