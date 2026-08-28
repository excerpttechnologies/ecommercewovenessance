// // // const mongoose = require("mongoose");
// // // const { Schema } = mongoose;

// // // /**
// // //  * A placed order.
// // //  *
// // //  * Unlike the cart — which stores only references and recomputes prices live —
// // //  * an order FREEZES everything: name, price, GST rate, address. An invoice must
// // //  * still be correct in three years, after the saree has been repriced, renamed or
// // //  * delisted. So each line is a snapshot, not a lookup.
// // //  */

// // // const ORDER_STATUSES = [
// // //   "pending_payment",
// // //   "confirmed",
// // //   "packed",
// // //   "shipped",
// // //   "out_for_delivery",
// // //   "delivered",
// // //   "cancelled",
// // //   "returned",
// // //   "refunded",
// // // ];

// // // /** The happy path, in order — used to render the tracker. */
// // // const FULFILMENT_FLOW = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"];

// // // const orderLineSchema = new Schema(
// // //   {
// // //     item: { type: Schema.Types.ObjectId, ref: "Item", required: true },

// // //     // ── snapshot, never re-read from the Item ──
// // //     productName: { type: String, required: true },
// // //     itemCode: String,
// // //     sku: String,
// // //     barcode: String,
// // //     hsnCode: String,
// // //     sareeType: String,
// // //     fabric: String,
// // //     colour: String,
// // //     imageUrl: String,
// // //     slug: String,

// // //     quantity: { type: Number, required: true, min: 1 },
// // //     unitPrice: { type: Number, required: true },
// // //     mrp: Number,
// // //     lineSubtotal: { type: Number, required: true },
// // //     gstRate: { type: Number, default: 0 },
// // //     gstAmount: { type: Number, default: 0 },
// // //     taxInclusive: { type: Boolean, default: true },
// // //   },
// // //   { _id: true }
// // // );

// // // const addressSnapshotSchema = new Schema(
// // //   {
// // //     fullName: String,
// // //     phone: String,
// // //     line1: String,
// // //     line2: String,
// // //     landmark: String,
// // //     city: String,
// // //     state: String,
// // //     pincode: String,
// // //     country: { type: String, default: "India" },
// // //   },
// // //   { _id: false }
// // // );

// // // const timelineSchema = new Schema(
// // //   {
// // //     status: { type: String, enum: ORDER_STATUSES, required: true },
// // //     note: String,
// // //     at: { type: Date, default: Date.now },
// // //     by: { type: String, enum: ["customer", "admin", "system", "payment", "courier"], default: "system" },
// // //   },
// // //   { _id: true }
// // // );

// // // const orderSchema = new Schema(
// // //   {
// // //     orderNumber: { type: String, required: true, unique: true, index: true },

// // //     customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
// // //     customerName: String,
// // //     customerEmail: String,
// // //     customerPhone: String,

// // //     /** Orders are raised against one branch — it fulfils and invoices them. */
// // //     branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
// // //     branchName: String,
// // //     branchCity: String,
// // //     branchGst: String,

// // //     lines: { type: [orderLineSchema], default: [] },

// // //     shippingAddress: { type: addressSnapshotSchema, required: true },
// // //     billingAddress: { type: addressSnapshotSchema, required: true },

// // //     amounts: {
// // //       mrpTotal: { type: Number, default: 0 },
// // //       subtotal: { type: Number, default: 0 },
// // //       discount: { type: Number, default: 0 },
// // //       gstTotal: { type: Number, default: 0 },
// // //       shippingCharge: { type: Number, default: 0 },
// // //       codCharge: { type: Number, default: 0 },
// // //       grandTotal: { type: Number, required: true },
// // //       currency: { type: String, default: "INR" },
// // //     },

// // //     payment: {
// // //       method: { type: String, enum: ["razorpay", "cod"], required: true },
// // //       status: {
// // //         type: String,
// // //         enum: ["pending", "paid", "failed", "refunded", "cod_pending", "cod_collected"],
// // //         default: "pending",
// // //       },
// // //       razorpayOrderId: { type: String, index: true, sparse: true },
// // //       razorpayPaymentId: String,
// // //       razorpaySignature: String,
// // //       paidAt: Date,
// // //       failureReason: String,
// // //     },

// // //     status: { type: String, enum: ORDER_STATUSES, default: "pending_payment", index: true },
// // //     timeline: { type: [timelineSchema], default: [] },

// // //     shipment: {
// // //       provider: { type: String, default: "shiprocket" },
// // //       shiprocketOrderId: String,
// // //       shipmentId: String,
// // //       awbCode: String,
// // //       courierName: String,
// // //       trackingUrl: String,
// // //       labelUrl: String,
// // //       pickupScheduledAt: Date,
// // //       expectedDeliveryAt: Date,
// // //       deliveredAt: Date,
// // //     },

// // //     invoiceNumber: { type: String, index: true, sparse: true },
// // //     invoicedAt: Date,

// // //     /** Set when the order came out of a group-shopping session. */
// // //     groupKey: { type: String, default: null, index: true },

// // //     notes: String,
// // //     cancelledReason: String,
// // //   },
// // //   { timestamps: true }
// // // );

// // // orderSchema.index({ customer: 1, createdAt: -1 });
// // // orderSchema.index({ orderNumber: "text", customerEmail: "text", customerPhone: "text" });

// // // /**
// // //  * Sequential order number per branch: WE-TF0001-000001.
// // //  *
// // //  * Reads the highest existing number rather than counting documents, so deleting
// // //  * an order can never cause a duplicate.
// // //  */
// // // orderSchema.statics.generateOrderNumber = async function (branchCode) {
// // //   const prefix = `WE-${String(branchCode || "TF0000").replace(/[^A-Z0-9]/gi, "")}`;
// // //   const last = await this.findOne({ orderNumber: new RegExp(`^${prefix}-`) })
// // //     .sort({ orderNumber: -1 })
// // //     .select("orderNumber")
// // //     .lean();

// // //   let next = 1;
// // //   if (last?.orderNumber) {
// // //     const m = last.orderNumber.match(/(\d+)$/);
// // //     if (m) next = parseInt(m[1], 10) + 1;
// // //   }

// // //   let candidate;
// // //   let clash = true;
// // //   while (clash) {
// // //     candidate = `${prefix}-${String(next).padStart(6, "0")}`;
// // //     clash = await this.exists({ orderNumber: candidate });
// // //     if (clash) next += 1;
// // //   }
// // //   return candidate;
// // // };

// // // orderSchema.methods.pushStatus = function pushStatus(status, note, by = "system") {
// // //   this.status = status;
// // //   this.timeline.push({ status, note, by, at: new Date() });
// // // };

// // // module.exports = mongoose.model("Order", orderSchema);
// // // module.exports.ORDER_STATUSES = ORDER_STATUSES;
// // // module.exports.FULFILMENT_FLOW = FULFILMENT_FLOW;











// // const mongoose = require("mongoose");
// // const { Schema } = mongoose;

// // /**
// //  * A placed order.
// //  *
// //  * Unlike the cart — which stores only references and recomputes prices live —
// //  * an order FREEZES everything: name, price, GST rate, address. An invoice must
// //  * still be correct in three years, after the saree has been repriced, renamed or
// //  * delisted. So each line is a snapshot, not a lookup.
// //  */

// // const ORDER_STATUSES = [
// //   "pending_payment",
// //   "confirmed",
// //   "packed",
// //   "shipped",
// //   "out_for_delivery",
// //   "delivered",
// //   "cancelled",
// //   "returned",
// //   "refunded",
// // ];

// // /** The happy path, in order — used to render the tracker. */
// // const FULFILMENT_FLOW = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"];

// // const orderLineSchema = new Schema(
// //   {
// //     item: { type: Schema.Types.ObjectId, ref: "Item", required: true },

// //     // ── snapshot, never re-read from the Item ──
// //     productName: { type: String, required: true },
// //     itemCode: String,
// //     sku: String,
// //     barcode: String,
// //     hsnCode: String,
// //     sareeType: String,
// //     fabric: String,
// //     colour: String,
// //     imageUrl: String,
// //     slug: String,

// //     quantity: { type: Number, required: true, min: 1 },
// //     unitPrice: { type: Number, required: true },
// //     mrp: Number,
// //     lineSubtotal: { type: Number, required: true },
// //     gstRate: { type: Number, default: 0 },
// //     gstAmount: { type: Number, default: 0 },
// //     taxInclusive: { type: Boolean, default: true },
// //   },
// //   { _id: true }
// // );

// // const addressSnapshotSchema = new Schema(
// //   {
// //     fullName: String,
// //     phone: String,
// //     line1: String,
// //     line2: String,
// //     landmark: String,
// //     city: String,
// //     state: String,
// //     pincode: String,
// //     country: { type: String, default: "India" },
// //   },
// //   { _id: false }
// // );

// // const timelineSchema = new Schema(
// //   {
// //     status: { type: String, enum: ORDER_STATUSES, required: true },
// //     note: String,
// //     at: { type: Date, default: Date.now },
// //     by: { type: String, enum: ["customer", "admin", "system", "payment", "courier"], default: "system" },
// //   },
// //   { _id: true }
// // );

// // const orderSchema = new Schema(
// //   {
// //     orderNumber: { type: String, required: true, unique: true, index: true },

// //     customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
// //     customerName: String,
// //     customerEmail: String,
// //     customerPhone: String,

// //     /** Orders are raised against one branch — it fulfils and invoices them. */
// //     branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
// //     branchName: String,
// //     branchCity: String,
// //     branchGst: String,

// //     lines: { type: [orderLineSchema], default: [] },

// //     shippingAddress: { type: addressSnapshotSchema, required: true },
// //     billingAddress: { type: addressSnapshotSchema, required: true },

// //     amounts: {
// //       mrpTotal: { type: Number, default: 0 },
// //       subtotal: { type: Number, default: 0 },
// //       discount: { type: Number, default: 0 },
// //       gstTotal: { type: Number, default: 0 },
// //       shippingCharge: { type: Number, default: 0 },
// //       codCharge: { type: Number, default: 0 },
// //       grandTotal: { type: Number, required: true },
// //       currency: { type: String, default: "INR" },
// //     },

// //     payment: {
// //       method: { type: String, enum: ["razorpay", "cod"], required: true },
// //       status: {
// //         type: String,
// //         enum: ["pending", "paid", "failed", "refunded", "cod_pending", "cod_collected"],
// //         default: "pending",
// //       },
// //       razorpayOrderId: { type: String, index: true, sparse: true },
// //       razorpayPaymentId: String,
// //       razorpaySignature: String,
// //       paidAt: Date,
// //       failureReason: String,
// //     },

// //     status: { type: String, enum: ORDER_STATUSES, default: "pending_payment", index: true },
// //     timeline: { type: [timelineSchema], default: [] },

// //     shipment: {
// //       provider: { type: String, default: "shiprocket" },
// //       shiprocketOrderId: String,
// //       shipmentId: String,
// //       awbCode: String,
// //       courierName: String,
// //       trackingUrl: String,
// //       labelUrl: String,
// //       pickupScheduledAt: Date,
// //       expectedDeliveryAt: Date,
// //       deliveredAt: Date,

// //       /** Latest courier status string, verbatim from Shiprocket. */
// //       lastScanStatus: String,
// //       lastSyncedAt: Date,

// //       /**
// //        * Courier scans, replaced wholesale on each sync — the courier is the
// //        * source of truth for its own history, so merging would risk keeping a
// //        * scan the courier has since corrected.
// //        */
// //       scans: {
// //         type: [
// //           new Schema(
// //             {
// //               at: Date,
// //               status: String,
// //               activity: String,
// //               location: String,
// //             },
// //             { _id: false }
// //           ),
// //         ],
// //         default: [],
// //       },
// //     },

// //     invoiceNumber: { type: String, index: true, sparse: true },
// //     invoicedAt: Date,

// //     /** Set when the order came out of a group-shopping session. */
// //     groupKey: { type: String, default: null, index: true },

// //     notes: String,
// //     cancelledReason: String,
// //   },
// //   { timestamps: true }
// // );

// // orderSchema.index({ customer: 1, createdAt: -1 });
// // orderSchema.index({ orderNumber: "text", customerEmail: "text", customerPhone: "text" });

// // /**
// //  * Sequential order number per branch: WE-TF0001-000001.
// //  *
// //  * Reads the highest existing number rather than counting documents, so deleting
// //  * an order can never cause a duplicate.
// //  */
// // orderSchema.statics.generateOrderNumber = async function (branchCode) {
// //   const prefix = `WE-${String(branchCode || "TF0000").replace(/[^A-Z0-9]/gi, "")}`;
// //   const last = await this.findOne({ orderNumber: new RegExp(`^${prefix}-`) })
// //     .sort({ orderNumber: -1 })
// //     .select("orderNumber")
// //     .lean();

// //   let next = 1;
// //   if (last?.orderNumber) {
// //     const m = last.orderNumber.match(/(\d+)$/);
// //     if (m) next = parseInt(m[1], 10) + 1;
// //   }

// //   let candidate;
// //   let clash = true;
// //   while (clash) {
// //     candidate = `${prefix}-${String(next).padStart(6, "0")}`;
// //     clash = await this.exists({ orderNumber: candidate });
// //     if (clash) next += 1;
// //   }
// //   return candidate;
// // };

// // orderSchema.methods.pushStatus = function pushStatus(status, note, by = "system") {
// //   this.status = status;
// //   this.timeline.push({ status, note, by, at: new Date() });
// // };

// // /**
// //  * Issues the GST invoice number, once.
// //  *
// //  * Called wherever an order becomes deliverable-and-paid, not just on the
// //  * Razorpay callback — a COD order that reaches "delivered" is every bit as
// //  * invoiceable, and previously got no number at all, so the customer could never
// //  * download their invoice.
// //  */
// // orderSchema.methods.ensureInvoiceNumber = function ensureInvoiceNumber() {
// //   if (this.invoiceNumber) return this.invoiceNumber;
// //   this.invoiceNumber = `INV-${this.orderNumber.replace(/^WE-/, "")}`;
// //   this.invoicedAt = new Date();
// //   return this.invoiceNumber;
// // };

// // module.exports = mongoose.model("Order", orderSchema);
// // module.exports.ORDER_STATUSES = ORDER_STATUSES;
// // module.exports.FULFILMENT_FLOW = FULFILMENT_FLOW;



























// const mongoose = require("mongoose");
// const { Schema } = mongoose;

// /**
//  * A placed order.
//  *
//  * Unlike the cart — which stores only references and recomputes prices live —
//  * an order FREEZES everything: name, price, GST rate, address. An invoice must
//  * still be correct in three years, after the saree has been repriced, renamed or
//  * delisted. So each line is a snapshot, not a lookup.
//  *
//  * MULTI-STORE ORDERS
//  * ------------------
//  * A shopper may fill one cart from several stores. That still produces ONE
//  * order, because operationally it is one parcel: the team collects each saree
//  * from the store that holds it, packs everything together at the fulfilment
//  * warehouse, and ships once. One order therefore means one delivery, one AWB,
//  * one invoice and one tracking page — which is what the customer experiences.
//  *
//  * Two fields carry the store detail:
//  *   line.sourceBranch  — where THAT saree is physically collected from
//  *   sourceBranches[]   — the pick list, one row per store, with its own subtotal
//  *
//  * `branch` remains the FULFILLING store: the one that packs, invoices under its
//  * GSTIN, and whose pincode Shiprocket collects from. It may be the only store
//  * involved, or a dedicated warehouse branch (see FULFILMENT_BRANCH_CODE).
//  */

// const ORDER_STATUSES = [
//   "pending_payment",
//   "confirmed",
//   "packed",
//   "shipped",
//   "out_for_delivery",
//   "delivered",
//   "cancelled",
//   "returned",
//   "refunded",
// ];

// /** The happy path, in order — used to render the tracker. */
// const FULFILMENT_FLOW = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"];

// const orderLineSchema = new Schema(
//   {
//     item: { type: Schema.Types.ObjectId, ref: "Item", required: true },

//     // ── snapshot, never re-read from the Item ──
//     productName: { type: String, required: true },
//     itemCode: String,
//     sku: String,
//     barcode: String,
//     hsnCode: String,
//     sareeType: String,
//     fabric: String,
//     colour: String,
//     imageUrl: String,
//     slug: String,

//     /**
//      * Which store this saree is collected from. Snapshotted like everything
//      * else: moving stock between stores later must not rewrite the pick list of
//      * an order that was already packed.
//      */
//     sourceBranch: { type: Schema.Types.ObjectId, ref: "Branch" },
//     sourceBranchName: String,
//     sourceBranchCity: String,

//     quantity: { type: Number, required: true, min: 1 },
//     unitPrice: { type: Number, required: true },
//     mrp: Number,
//     lineSubtotal: { type: Number, required: true },
//     gstRate: { type: Number, default: 0 },
//     gstAmount: { type: Number, default: 0 },
//     taxInclusive: { type: Boolean, default: true },
//   },
//   { _id: true }
// );

// const addressSnapshotSchema = new Schema(
//   {
//     fullName: String,
//     phone: String,
//     line1: String,
//     line2: String,
//     landmark: String,
//     city: String,
//     state: String,
//     pincode: String,
//     country: { type: String, default: "India" },
//   },
//   { _id: false }
// );

// const timelineSchema = new Schema(
//   {
//     status: { type: String, enum: ORDER_STATUSES, required: true },
//     note: String,
//     at: { type: Date, default: Date.now },
//     by: { type: String, enum: ["customer", "admin", "system", "payment", "courier"], default: "system" },
//   },
//   { _id: true }
// );

// /** One row of the pick list — what to collect from which store. */
// const sourceBranchSchema = new Schema(
//   {
//     branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
//     branchName: String,
//     branchCity: String,
//     /** Units to collect from this store. */
//     itemCount: { type: Number, default: 0 },
//     /** Value of this store's share, for settlement between stores. */
//     subtotal: { type: Number, default: 0 },
//     /** Ticked by staff once the items have physically reached the warehouse. */
//     collected: { type: Boolean, default: false },
//     collectedAt: Date,
//   },
//   { _id: false }
// );

// const orderSchema = new Schema(
//   {
//     orderNumber: { type: String, required: true, unique: true, index: true },

//     customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
//     customerName: String,
//     customerEmail: String,
//     customerPhone: String,

//     /** The store that packs, invoices and ships this order. */
//     branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
//     branchName: String,
//     branchCity: String,
//     branchGst: String,

//     /**
//      * Every store this order draws stock from, including the fulfilling one.
//      * Indexed so a branch admin can find the orders that involve their store
//      * even when another store is doing the shipping.
//      */
//     sourceBranches: { type: [sourceBranchSchema], default: [] },

//     lines: { type: [orderLineSchema], default: [] },

//     shippingAddress: { type: addressSnapshotSchema, required: true },
//     billingAddress: { type: addressSnapshotSchema, required: true },

//     amounts: {
//       mrpTotal: { type: Number, default: 0 },
//       subtotal: { type: Number, default: 0 },
//       discount: { type: Number, default: 0 },
//       gstTotal: { type: Number, default: 0 },
//       shippingCharge: { type: Number, default: 0 },
//       codCharge: { type: Number, default: 0 },
//       grandTotal: { type: Number, required: true },
//       currency: { type: String, default: "INR" },
//     },

//     payment: {
//       method: { type: String, enum: ["razorpay", "cod"], required: true },
//       status: {
//         type: String,
//         enum: ["pending", "paid", "failed", "refunded", "cod_pending", "cod_collected"],
//         default: "pending",
//       },
//       razorpayOrderId: { type: String, index: true, sparse: true },
//       razorpayPaymentId: String,
//       razorpaySignature: String,
//       paidAt: Date,
//       failureReason: String,
//     },

//     status: { type: String, enum: ORDER_STATUSES, default: "pending_payment", index: true },
//     timeline: { type: [timelineSchema], default: [] },

//     shipment: {
//       provider: { type: String, default: "shiprocket" },
//       shiprocketOrderId: String,
//       shipmentId: String,
//       awbCode: String,
//       courierName: String,
//       trackingUrl: String,
//       labelUrl: String,
//       pickupScheduledAt: Date,
//       expectedDeliveryAt: Date,
//       deliveredAt: Date,

//       /** Latest courier status string, verbatim from Shiprocket. */
//       lastScanStatus: String,
//       lastSyncedAt: Date,

//       /**
//        * Courier scans, replaced wholesale on each sync — the courier is the
//        * source of truth for its own history, so merging would risk keeping a
//        * scan the courier has since corrected.
//        */
//       scans: {
//         type: [
//           new Schema(
//             {
//               at: Date,
//               status: String,
//               activity: String,
//               location: String,
//             },
//             { _id: false }
//           ),
//         ],
//         default: [],
//       },
//     },

//     invoiceNumber: { type: String, index: true, sparse: true },
//     invoicedAt: Date,

//     /** Set when the order came out of a group-shopping session. */
//     groupKey: { type: String, default: null, index: true },

//     notes: String,
//     cancelledReason: String,
//   },
//   { timestamps: true }
// );

// orderSchema.index({ customer: 1, createdAt: -1 });
// orderSchema.index({ "sourceBranches.branch": 1, createdAt: -1 });
// orderSchema.index({ orderNumber: "text", customerEmail: "text", customerPhone: "text" });

// /** True when this order has to be picked from more than one store. */
// orderSchema.virtual("isMultiStore").get(function isMultiStore() {
//   return (this.sourceBranches || []).length > 1;
// });

// /**
//  * Sequential order number per branch: WE-TF0001-000001.
//  *
//  * Reads the highest existing number rather than counting documents, so deleting
//  * an order can never cause a duplicate.
//  */
// orderSchema.statics.generateOrderNumber = async function (branchCode) {
//   const prefix = `WE-${String(branchCode || "TF0000").replace(/[^A-Z0-9]/gi, "")}`;
//   const last = await this.findOne({ orderNumber: new RegExp(`^${prefix}-`) })
//     .sort({ orderNumber: -1 })
//     .select("orderNumber")
//     .lean();

//   let next = 1;
//   if (last?.orderNumber) {
//     const m = last.orderNumber.match(/(\d+)$/);
//     if (m) next = parseInt(m[1], 10) + 1;
//   }

//   let candidate;
//   let clash = true;
//   while (clash) {
//     candidate = `${prefix}-${String(next).padStart(6, "0")}`;
//     clash = await this.exists({ orderNumber: candidate });
//     if (clash) next += 1;
//   }
//   return candidate;
// };

// orderSchema.methods.pushStatus = function pushStatus(status, note, by = "system") {
//   this.status = status;
//   this.timeline.push({ status, note, by, at: new Date() });
// };

// /**
//  * Issues the GST invoice number, once.
//  *
//  * Called wherever an order becomes deliverable-and-paid, not just on the
//  * Razorpay callback — a COD order that reaches "delivered" is every bit as
//  * invoiceable, and previously got no number at all, so the customer could never
//  * download their invoice.
//  */
// orderSchema.methods.ensureInvoiceNumber = function ensureInvoiceNumber() {
//   if (this.invoiceNumber) return this.invoiceNumber;
//   this.invoiceNumber = `INV-${this.orderNumber.replace(/^WE-/, "")}`;
//   this.invoicedAt = new Date();
//   return this.invoiceNumber;
// };

// module.exports = mongoose.model("Order", orderSchema);
// module.exports.ORDER_STATUSES = ORDER_STATUSES;
// module.exports.FULFILMENT_FLOW = FULFILMENT_FLOW;











const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * A placed order.
 *
 * Unlike the cart — which stores only references and recomputes prices live —
 * an order FREEZES everything: name, price, GST rate, address. An invoice must
 * still be correct in three years, after the saree has been repriced, renamed or
 * delisted. So each line is a snapshot, not a lookup.
 *
 * MULTI-STORE ORDERS
 * ------------------
 * A shopper may fill one cart from several stores. That still produces ONE
 * order, because operationally it is one parcel: the team collects each saree
 * from the store that holds it, packs everything together at the fulfilment
 * warehouse, and ships once. One order therefore means one delivery, one AWB,
 * one invoice and one tracking page — which is what the customer experiences.
 *
 * Two fields carry the store detail:
 *   line.sourceBranch  — where THAT saree is physically collected from
 *   sourceBranches[]   — the pick list, one row per store, with its own subtotal
 *
 * `branch` remains the FULFILLING store: the one that packs, invoices under its
 * GSTIN, and whose pincode Shiprocket collects from. It may be the only store
 * involved, or a dedicated warehouse branch (see FULFILMENT_BRANCH_CODE).
 */

const ORDER_STATUSES = [
  "pending_payment",
  "confirmed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
];

/** The happy path, in order — used to render the tracker. */
const FULFILMENT_FLOW = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"];

const orderLineSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "Item", required: true },

    // ── snapshot, never re-read from the Item ──
    productName: { type: String, required: true },
    itemCode: String,
    sku: String,
    barcode: String,
    hsnCode: String,
    sareeType: String,
    fabric: String,
    colour: String,
    imageUrl: String,
    slug: String,

    /**
     * Which store this saree is collected from. Snapshotted like everything
     * else: moving stock between stores later must not rewrite the pick list of
     * an order that was already packed.
     */
    sourceBranch: { type: Schema.Types.ObjectId, ref: "Branch" },
    sourceBranchName: String,
    sourceBranchCity: String,

    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    mrp: Number,
    lineSubtotal: { type: Number, required: true },
    gstRate: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    taxInclusive: { type: Boolean, default: true },
  },
  { _id: true }
);

const addressSnapshotSchema = new Schema(
  {
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
  { _id: false }
);

const timelineSchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    note: String,
    at: { type: Date, default: Date.now },
    by: { type: String, enum: ["customer", "admin", "system", "payment", "courier"], default: "system" },
  },
  { _id: true }
);

/** One row of the pick list — what to collect from which store. */
const sourceBranchSchema = new Schema(
  {
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    branchName: String,
    branchCity: String,
    /** Units to collect from this store. */
    itemCount: { type: Number, default: 0 },
    /** Value of this store's share, for settlement between stores. */
    subtotal: { type: Number, default: 0 },
    /** Ticked by staff once the items have physically reached the warehouse. */
    collected: { type: Boolean, default: false },
    collectedAt: Date,
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },

    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    customerName: String,
    customerEmail: String,
    customerPhone: String,

    /** The store that packs, invoices and ships this order. */
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    branchName: String,
    branchCity: String,
    branchGst: String,

    /**
     * Every store this order draws stock from, including the fulfilling one.
     * Indexed so a branch admin can find the orders that involve their store
     * even when another store is doing the shipping.
     */
    sourceBranches: { type: [sourceBranchSchema], default: [] },

    lines: { type: [orderLineSchema], default: [] },

    shippingAddress: { type: addressSnapshotSchema, required: true },
    billingAddress: { type: addressSnapshotSchema, required: true },

    amounts: {
      mrpTotal: { type: Number, default: 0 },
      subtotal: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      gstTotal: { type: Number, default: 0 },
      shippingCharge: { type: Number, default: 0 },
      codCharge: { type: Number, default: 0 },
      /** Coupon saving, kept apart from `discount` (which is MRP-vs-selling). */
      couponDiscount: { type: Number, default: 0 },
      grandTotal: { type: Number, required: true },
      currency: { type: String, default: "INR" },
    },

    payment: {
      method: { type: String, enum: ["razorpay", "cod"], required: true },
      status: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded", "cod_pending", "cod_collected"],
        default: "pending",
      },
      razorpayOrderId: { type: String, index: true, sparse: true },
      razorpayPaymentId: String,
      razorpaySignature: String,
      paidAt: Date,
      failureReason: String,
    },

    status: { type: String, enum: ORDER_STATUSES, default: "pending_payment", index: true },
    timeline: { type: [timelineSchema], default: [] },

    shipment: {
      provider: { type: String, default: "shiprocket" },
      shiprocketOrderId: String,
      shipmentId: String,
      awbCode: String,
      courierName: String,
      trackingUrl: String,
      labelUrl: String,
      pickupScheduledAt: Date,
      expectedDeliveryAt: Date,
      deliveredAt: Date,

      /** Latest courier status string, verbatim from Shiprocket. */
      lastScanStatus: String,
      lastSyncedAt: Date,

      /**
       * Courier scans, replaced wholesale on each sync — the courier is the
       * source of truth for its own history, so merging would risk keeping a
       * scan the courier has since corrected.
       */
      scans: {
        type: [
          new Schema(
            {
              at: Date,
              status: String,
              activity: String,
              location: String,
            },
            { _id: false }
          ),
        ],
        default: [],
      },
    },

    invoiceNumber: { type: String, index: true, sparse: true },
    invoicedAt: Date,

    /**
     * Snapshot of the coupon used, frozen like the lines above. The Coupon
     * document can be edited or deleted later; this is what the invoice and any
     * dispute must be read against.
     */
    coupon: {
      type: new Schema(
        {
          coupon: { type: Schema.Types.ObjectId, ref: "Coupon" },
          code: String,
          title: String,
          discountType: { type: String, enum: ["percentage", "flat"] },
          value: Number,
          discountAmount: Number,
        },
        { _id: false }
      ),
      default: null,
    },

    /** Set when the order came out of a group-shopping session. */
    groupKey: { type: String, default: null, index: true },

    notes: String,
    cancelledReason: String,
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ "sourceBranches.branch": 1, createdAt: -1 });
orderSchema.index({ orderNumber: "text", customerEmail: "text", customerPhone: "text" });

/** True when this order has to be picked from more than one store. */
orderSchema.virtual("isMultiStore").get(function isMultiStore() {
  return (this.sourceBranches || []).length > 1;
});

/**
 * Sequential order number per branch: WE-TF0001-000001.
 *
 * Reads the highest existing number rather than counting documents, so deleting
 * an order can never cause a duplicate.
 */
orderSchema.statics.generateOrderNumber = async function (branchCode) {
  const prefix = `WE-${String(branchCode || "TF0000").replace(/[^A-Z0-9]/gi, "")}`;
  const last = await this.findOne({ orderNumber: new RegExp(`^${prefix}-`) })
    .sort({ orderNumber: -1 })
    .select("orderNumber")
    .lean();

  let next = 1;
  if (last?.orderNumber) {
    const m = last.orderNumber.match(/(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }

  let candidate;
  let clash = true;
  while (clash) {
    candidate = `${prefix}-${String(next).padStart(6, "0")}`;
    clash = await this.exists({ orderNumber: candidate });
    if (clash) next += 1;
  }
  return candidate;
};

orderSchema.methods.pushStatus = function pushStatus(status, note, by = "system") {
  this.status = status;
  this.timeline.push({ status, note, by, at: new Date() });
};

/**
 * Issues the GST invoice number, once.
 *
 * Called wherever an order becomes deliverable-and-paid, not just on the
 * Razorpay callback — a COD order that reaches "delivered" is every bit as
 * invoiceable, and previously got no number at all, so the customer could never
 * download their invoice.
 */
orderSchema.methods.ensureInvoiceNumber = function ensureInvoiceNumber() {
  if (this.invoiceNumber) return this.invoiceNumber;
  this.invoiceNumber = `INV-${this.orderNumber.replace(/^WE-/, "")}`;
  this.invoicedAt = new Date();
  return this.invoiceNumber;
};

module.exports = mongoose.model("Order", orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.FULFILMENT_FLOW = FULFILMENT_FLOW;