








// // const asyncHandler = require("express-async-handler");
// // const mongoose = require("mongoose");
// // const Cart = require("../models/Cart");
// // const Order = require("../models/Order");
// // const Item = require("../models/Item");
// // const Branch = require("../models/Branch");
// // const razorpay = require("../services/razorpayService");
// // const email = require("../services/emailService");
// // const { buildCartView, LIVE_ITEM } = require("./cartController");

// // /**
// //  * Checkout.
// //  *
// //  * The client never sends money. It sends an address, a payment method, and
// //  * nothing else; every amount is recomputed here from the live products, then
// //  * frozen onto the order. Anything else would let a shopper set their own price.
// //  */

// // const round = (n) => Math.round(n * 100) / 100;

// // function requiredAddressFields(address, label) {
// //   const missing = ["fullName", "phone", "line1", "city", "state", "pincode"].filter(
// //     (k) => !String(address?.[k] || "").trim()
// //   );
// //   if (missing.length) {
// //     const err = new Error(`${label} is incomplete: ${missing.join(", ")} required`);
// //     err.statusCode = 400;
// //     throw err;
// //   }
// //   if (!/^\d{6}$/.test(String(address.pincode).trim())) {
// //     const err = new Error(`${label} needs a valid 6-digit pincode`);
// //     err.statusCode = 400;
// //     throw err;
// //   }
// // }

// // function pickAddress(a) {
// //   return {
// //     fullName: String(a.fullName || "").trim(),
// //     phone: String(a.phone || "").trim(),
// //     line1: String(a.line1 || "").trim(),
// //     line2: String(a.line2 || "").trim(),
// //     landmark: String(a.landmark || "").trim(),
// //     city: String(a.city || "").trim(),
// //     state: String(a.state || "").trim(),
// //     pincode: String(a.pincode || "").trim(),
// //     country: String(a.country || "India").trim(),
// //   };
// // }

// // /**
// //  * Prices a set of {item, quantity} lines and returns the snapshot to freeze onto
// //  * an order. Throws if anything can't actually be bought right now.
// //  *
// //  * Shared by normal checkout and by group shopping, so a group order is priced,
// //  * taxed and shipping-charged by exactly the same rules as a solo one — the one
// //  * thing that must never diverge between the two paths.
// //  */
// // async function priceLines(rawLines, { method }) {
// //   const cart = { lines: rawLines };
// //   if (!rawLines || rawLines.length === 0) {
// //     const err = new Error("There's nothing to check out");
// //     err.statusCode = 400;
// //     throw err;
// //   }

// //   const items = await Item.find({ _id: { $in: cart.lines.map((l) => l.item) }, ...LIVE_ITEM }).lean();
// //   const byId = new Map(items.map((i) => [String(i._id), i]));

// //   const lines = [];
// //   let mrpTotal = 0;
// //   let subtotal = 0;
// //   let gstTotal = 0;
// //   let shippingCharge = 0;
// //   let codCharge = 0;
// //   let anyCodBlocked = false;

// //   for (const cartLine of cart.lines) {
// //     const item = byId.get(String(cartLine.item));
// //     if (!item) {
// //       const err = new Error("A saree in your cart is no longer available. Please review your cart.");
// //       err.statusCode = 409;
// //       throw err;
// //     }

// //     const stock = item.inventory?.currentStock || 0;
// //     const price = item.pricing?.sellingPrice;
// //     const name = item.identity?.displayName || item.identity?.productName || "Saree";

// //     if (price == null) {
// //       const err = new Error(`"${name}" is priced on request and can't be checked out online`);
// //       err.statusCode = 409;
// //       throw err;
// //     }
// //     if (stock < cartLine.quantity) {
// //       const err = new Error(
// //         stock === 0 ? `"${name}" has sold out` : `Only ${stock} of "${name}" left — please reduce the quantity`
// //       );
// //       err.statusCode = 409;
// //       throw err;
// //     }
// //     if (item.shipping?.codAvailable === false) anyCodBlocked = true;

// //     const qty = cartLine.quantity;
// //     const lineSubtotal = round(price * qty);
// //     const rate = item.tax?.gstRate || 0;
// //     const inclusive = item.pricing?.taxInclusive !== false;
// //     const gstAmount = rate > 0 ? round(inclusive ? lineSubtotal - lineSubtotal / (1 + rate / 100) : (lineSubtotal * rate) / 100) : 0;

// //     const hero =
// //       (item.images || []).find((i) => i.category === "Main Product Image") || (item.images || [])[0] || null;

// //     lines.push({
// //       item: item._id,
// //       productName: name,
// //       itemCode: item.identity?.itemCode || "",
// //       sku: item.identity?.sku || "",
// //       barcode: item.identity?.barcode || "",
// //       hsnCode: item.tax?.hsnCode || item.identity?.hsnCode || "",
// //       sareeType: item.saree?.sareeType || "",
// //       fabric: item.saree?.fabricType || "",
// //       colour: item.color?.primaryColor || "",
// //       imageUrl: hero?.url || "",
// //       slug: item.seo?.slug || "",
// //       quantity: qty,
// //       unitPrice: price,
// //       mrp: item.pricing?.mrp ?? price,
// //       lineSubtotal,
// //       gstRate: rate,
// //       gstAmount,
// //       taxInclusive: inclusive,
// //     });

// //     mrpTotal += (item.pricing?.mrp ?? price) * qty;
// //     subtotal += lineSubtotal;
// //     gstTotal += gstAmount;

// //     // Per-item shipping: the highest charge across the cart, not the sum —
// //     // a shopper buying three sarees pays one delivery, not three.
// //     if (item.shipping?.freeShipping !== true && item.shipping?.shippingCharge) {
// //       shippingCharge = Math.max(shippingCharge, Number(item.shipping.shippingCharge) || 0);
// //     }
// //     if (method === "cod" && item.shipping?.codCharge) {
// //       codCharge = Math.max(codCharge, Number(item.shipping.codCharge) || 0);
// //     }
// //   }

// //   if (method === "cod" && anyCodBlocked) {
// //     const err = new Error("One of the sarees in your cart isn't available for cash on delivery");
// //     err.statusCode = 409;
// //     throw err;
// //   }

// //   const grandTotal = round(subtotal + shippingCharge + codCharge);

// //   return {
// //     cart,
// //     lines,
// //     amounts: {
// //       mrpTotal: round(mrpTotal),
// //       subtotal: round(subtotal),
// //       discount: round(Math.max(mrpTotal - subtotal, 0)),
// //       gstTotal: round(gstTotal),
// //       shippingCharge: round(shippingCharge),
// //       codCharge: round(codCharge),
// //       grandTotal,
// //       currency: "INR",
// //     },
// //   };
// // }

// // /**
// //  * Loads the customer's cart and prices it PER STORE.
// //  *
// //  * A cart may span several branches. Each branch ships its own parcel from its
// //  * own stock, so each becomes its own order — and shipping is charged per store,
// //  * because two parcels from two cities genuinely cost two deliveries. The
// //  * per-store pricing goes through the same priceLines() the solo and group paths
// //  * use, so nothing about tax or shipping diverges between them.
// //  */
// // async function priceCartForCheckout(customerId, { method }) {
// //   const cart = await Cart.findOne({ customer: customerId });
// //   if (!cart || cart.lines.length === 0) {
// //     const err = new Error("Your cart is empty");
// //     err.statusCode = 400;
// //     throw err;
// //   }

// //   // Which store does each line belong to? Read from the live Item, never the cart.
// //   const items = await Item.find({ _id: { $in: cart.lines.map((l) => l.item) } })
// //     .select("branch")
// //     .lean();
// //   const branchOf = new Map(items.map((i) => [String(i._id), String(i.branch)]));

// //   const byBranch = new Map();
// //   for (const line of cart.lines) {
// //     const bid = branchOf.get(String(line.item));
// //     if (!bid) {
// //       const err = new Error("A saree in your cart is no longer available. Please review your cart.");
// //       err.statusCode = 409;
// //       throw err;
// //     }
// //     if (!byBranch.has(bid)) byBranch.set(bid, []);
// //     byBranch.get(bid).push({ item: line.item, quantity: line.quantity });
// //   }

// //   const branchDocs = await Branch.find({ _id: { $in: [...byBranch.keys()] } })
// //     .select("branchName branchCode address gstNumber")
// //     .lean();
// //   const branchById = new Map(branchDocs.map((b) => [String(b._id), b]));

// //   const groups = [];
// //   for (const [bid, rawLines] of byBranch) {
// //     const branch = branchById.get(bid);
// //     if (!branch) {
// //       const err = new Error("One of the stores in your cart is no longer available");
// //       err.statusCode = 409;
// //       throw err;
// //     }
// //     // eslint-disable-next-line no-await-in-loop
// //     const priced = await priceLines(rawLines, { method });
// //     groups.push({ branch, lines: priced.lines, amounts: priced.amounts });
// //   }

// //   // Combined figures are the SUM across stores, including one shipping charge
// //   // per store rather than one for the whole basket.
// //   const combined = groups.reduce(
// //     (acc, g) => ({
// //       mrpTotal: round(acc.mrpTotal + g.amounts.mrpTotal),
// //       subtotal: round(acc.subtotal + g.amounts.subtotal),
// //       discount: round(acc.discount + g.amounts.discount),
// //       gstTotal: round(acc.gstTotal + g.amounts.gstTotal),
// //       shippingCharge: round(acc.shippingCharge + g.amounts.shippingCharge),
// //       codCharge: round(acc.codCharge + g.amounts.codCharge),
// //       grandTotal: round(acc.grandTotal + g.amounts.grandTotal),
// //       currency: "INR",
// //     }),
// //     { mrpTotal: 0, subtotal: 0, discount: 0, gstTotal: 0, shippingCharge: 0, codCharge: 0, grandTotal: 0 }
// //   );

// //   return { cart, groups, amounts: combined, storeCount: groups.length };
// // }

// // /** Shared reference tying the sibling orders of one payment together. */
// // function newPaymentGroupId() {
// //   return `PG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
// // }

// // // GET /api/woven-essence/checkout
// // // What the checkout page needs: priced cart, saved addresses, payment options.
// // const getCheckout = asyncHandler(async (req, res) => {
// //   const cart = await Cart.findOne({ customer: req.customer._id });
// //   const view = cart ? await buildCartView(cart) : null;

// //   let branch = null;
// //   if (cart?.branch) {
// //     branch = await Branch.findById(cart.branch).select("branchName branchCode address contact gstNumber").lean();
// //   }

// //   // Priced without a method so the page can show a total before one is chosen.
// //   let priced = null;
// //   let stores = [];
// //   try {
// //     const result = await priceCartForCheckout(req.customer._id, { method: "razorpay" });
// //     priced = result.amounts;
// //     // The checkout page shows the per-store split BEFORE payment, so several
// //     // orders appearing afterwards is expected rather than a surprise.
// //     stores = result.groups.map((g) => ({
// //       branchId: g.branch._id,
// //       branchName: g.branch.branchName,
// //       branchCity: g.branch.address?.city || "",
// //       itemCount: g.lines.reduce((n, l) => n + l.quantity, 0),
// //       amounts: g.amounts,
// //     }));
// //   } catch (err) {
// //     priced = null;
// //     res.locals.checkoutBlocker = err.message;
// //   }

// //   res.json({
// //     success: true,
// //     data: {
// //       cart: view,
// //       amounts: priced,
// //       stores,
// //       storeCount: stores.length,
// //       multiStore: stores.length > 1,
// //       blocker: res.locals.checkoutBlocker || null,
// //       addresses: req.customer.addresses || [],
// //       customer: { name: req.customer.name, email: req.customer.email, phone: req.customer.phone || "" },
// //       branch: branch
// //         ? { id: branch._id, name: branch.branchName, city: branch.address?.city || "", phone: branch.contact?.phone || "" }
// //         : null,
// //       payment: {
// //         razorpayEnabled: razorpay.isConfigured(),
// //         razorpayKeyId: razorpay.publicKeyId(),
// //         codEnabled: true,
// //       },
// //     },
// //   });
// // });

// // // POST /api/woven-essence/checkout/orders
// // // Creates the order. For Razorpay it also creates the gateway order and returns
// // // what the browser needs to open the checkout sheet. Stock is NOT reduced here —
// // // only once payment succeeds (or immediately for COD).
// // const placeOrder = asyncHandler(async (req, res) => {
// //   const method = req.body.paymentMethod === "cod" ? "cod" : "razorpay";

// //   const shippingAddress = pickAddress(req.body.shippingAddress || {});
// //   requiredAddressFields(shippingAddress, "Shipping address");

// //   const billingAddress = req.body.sameAsBilling === false
// //     ? pickAddress(req.body.billingAddress || {})
// //     : shippingAddress;
// //   if (req.body.sameAsBilling === false) requiredAddressFields(billingAddress, "Billing address");

// //   if (method === "razorpay" && !razorpay.isConfigured()) {
// //     res.status(503);
// //     throw new Error("Online payment isn't configured yet — please choose cash on delivery.");
// //   }

// //   const { cart, groups, amounts } = await priceCartForCheckout(req.customer._id, { method });

// //   // One order per store, all sharing a single payment. Even a single-store
// //   // checkout goes through this path so there is only one flow to reason about.
// //   const paymentGroupId = groups.length > 1 ? newPaymentGroupId() : null;
// //   const orders = [];

// //   for (const group of groups) {
// //     const { branch, lines, amounts: groupAmounts } = group;
// //     // eslint-disable-next-line no-await-in-loop
// //     const orderNumber = await Order.generateOrderNumber(branch.branchCode);

// //     orders.push(
// //       new Order({
// //         orderNumber,
// //         customer: req.customer._id,
// //         customerName: req.customer.name,
// //         customerEmail: req.customer.email,
// //         customerPhone: req.customer.phone || shippingAddress.phone,
// //         branch: branch._id,
// //         branchName: branch.branchName,
// //         branchCity: branch.address?.city || "",
// //         branchGst: branch.gstNumber || "",
// //         lines,
// //         shippingAddress,
// //         billingAddress,
// //         amounts: groupAmounts,
// //         payment: { method, status: method === "cod" ? "cod_pending" : "pending" },
// //         groupKey: cart.groupKey || null,
// //         paymentGroup: paymentGroupId
// //           ? {
// //               id: paymentGroupId,
// //               combinedTotal: amounts.grandTotal,
// //               orderCount: groups.length,
// //               branchShare: groupAmounts.grandTotal,
// //             }
// //           : { id: null },
// //         notes: String(req.body.notes || "").slice(0, 500),
// //       })
// //     );
// //   }

// //   if (method === "cod") {
// //     // Nothing to collect online, so every order is live immediately.
// //     for (const order of orders) {
// //       // eslint-disable-next-line no-await-in-loop
// //       await reserveStock(order);
// //       order.pushStatus("confirmed", "Order placed — cash on delivery", "customer");
// //       // eslint-disable-next-line no-await-in-loop
// //       await order.save();
// //       // Fire and forget: a mail failure must never fail a placed order. One
// //       // email per order, because a multi-store checkout produces one order per
// //       // store and each ships separately.
// //       email.sendOrderPlaced(order, true).catch(() => {});
// //     }

// //     cart.lines = [];
// //     cart.branch = null;
// //     await cart.save();

// //     return res.status(201).json({
// //       success: true,
// //       data: {
// //         orders: orders.map(publicOrder),
// //         /** Kept for older clients that expected a single order. */
// //         order: publicOrder(orders[0]),
// //         payment: { method: "cod" },
// //         paymentGroup: paymentGroupId
// //           ? { id: paymentGroupId, combinedTotal: amounts.grandTotal, orderCount: orders.length }
// //           : null,
// //         amounts,
// //       },
// //     });
// //   }

// //   // ── one Razorpay order covering every store ──
// //   const receipt = orders.length === 1 ? orders[0].orderNumber : paymentGroupId;
// //   const rzOrder = await razorpay.createOrder({
// //     amountInRupees: amounts.grandTotal,
// //     receipt,
// //     notes: {
// //       customer: String(req.customer._id),
// //       orderNumbers: orders.map((o) => o.orderNumber).join(","),
// //       stores: orders.map((o) => o.branchName).join(", "),
// //       ...(paymentGroupId ? { paymentGroup: paymentGroupId } : {}),
// //     },
// //   });

// //   for (const order of orders) {
// //     order.payment.razorpayOrderId = rzOrder.id;
// //     order.pushStatus("pending_payment", "Awaiting payment", "system");
// //     // eslint-disable-next-line no-await-in-loop
// //     await order.save();
// //   }

// //   res.status(201).json({
// //     success: true,
// //     data: {
// //       orders: orders.map(publicOrder),
// //       order: publicOrder(orders[0]),
// //       amounts,
// //       paymentGroup: paymentGroupId
// //         ? { id: paymentGroupId, combinedTotal: amounts.grandTotal, orderCount: orders.length }
// //         : null,
// //       payment: {
// //         method: "razorpay",
// //         keyId: razorpay.publicKeyId(),
// //         razorpayOrderId: rzOrder.id,
// //         amount: rzOrder.amount, // paise, as Razorpay's checkout expects
// //         currency: rzOrder.currency,
// //         name: "Woven Essence",
// //         description:
// //           orders.length === 1
// //             ? `Order ${orders[0].orderNumber}`
// //             : `${orders.length} orders from ${orders.length} stores`,
// //         prefill: {
// //           name: shippingAddress.fullName,
// //           email: req.customer.email,
// //           contact: shippingAddress.phone,
// //         },
// //       },
// //     },
// //   });
// // });

// // /**
// //  * Reduces stock for each line, guarded so it can't go negative under
// //  * concurrency: the update only applies while enough stock remains.
// //  */
// // async function reserveStock(order) {
// //   for (const line of order.lines) {
// //     const result = await Item.updateOne(
// //       { _id: line.item, "inventory.currentStock": { $gte: line.quantity } },
// //       {
// //         $inc: {
// //           "inventory.currentStock": -line.quantity,
// //           "salesIntelligence.totalOrders": 1,
// //           "salesIntelligence.totalQuantitySold": line.quantity,
// //           "salesIntelligence.totalRevenue": line.lineSubtotal,
// //         },
// //       }
// //     );

// //     if (result.modifiedCount === 0) {
// //       const err = new Error(`"${line.productName}" sold out while you were checking out`);
// //       err.statusCode = 409;
// //       throw err;
// //     }
// //   }
// // }

// // // POST /api/woven-essence/checkout/verify
// // // Called by the browser after Razorpay's sheet succeeds. The signature is what
// // // proves the payment is real — an unverified callback is just a claim.
// // const verifyPayment = asyncHandler(async (req, res) => {
// //   const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

// //   // One Razorpay order can cover several of our orders — one per store. Settle
// //   // them all together, so a multi-store payment can never leave some stores paid
// //   // and others pending.
// //   const orders = await Order.find({
// //     "payment.razorpayOrderId": razorpay_order_id,
// //     customer: req.customer._id,
// //   }).sort("orderNumber");

// //   if (orders.length === 0) {
// //     res.status(404);
// //     throw new Error("Order not found");
// //   }

// //   // Already handled (double callback, or the webhook got there first).
// //   if (orders.every((o) => o.payment.status === "paid")) {
// //     return res.json({
// //       success: true,
// //       data: {
// //         orders: orders.map(publicOrder),
// //         order: publicOrder(orders[0]),
// //         alreadyPaid: true,
// //       },
// //     });
// //   }

// //   const valid = razorpay.verifyPaymentSignature({
// //     razorpayOrderId: razorpay_order_id,
// //     razorpayPaymentId: razorpay_payment_id,
// //     signature: razorpay_signature,
// //   });

// //   if (!valid) {
// //     for (const order of orders) {
// //       order.payment.status = "failed";
// //       order.payment.failureReason = "Signature verification failed";
// //       order.pushStatus("pending_payment", "Payment could not be verified", "payment");
// //       // eslint-disable-next-line no-await-in-loop
// //       await order.save();
// //     }
// //     res.status(400);
// //     throw new Error("We couldn't verify that payment. You have not been charged for this order.");
// //   }

// //   // Stock first: if a saree sold out mid-payment this throws, and the caller is
// //   // told before any order is marked paid.
// //   for (const order of orders) {
// //     if (order.payment.status === "paid") continue;
// //     // eslint-disable-next-line no-await-in-loop
// //     await reserveStock(order);
// //   }

// //   for (const order of orders) {
// //     if (order.payment.status === "paid") continue;
// //     order.payment.status = "paid";
// //     order.payment.razorpayPaymentId = razorpay_payment_id;
// //     order.payment.razorpaySignature = razorpay_signature;
// //     order.payment.paidAt = new Date();
// //     order.ensureInvoiceNumber();
// //     order.pushStatus(
// //       "confirmed",
// //       orders.length > 1
// //         ? `Payment received — part of a ${orders.length}-store payment`
// //         : "Payment received",
// //       "payment"
// //     );
// //     // eslint-disable-next-line no-await-in-loop
// //     await order.save();
// //     email.sendOrderPlaced(order, false).catch(() => {});
// //   }

// //   const cart = await Cart.findOne({ customer: req.customer._id });
// //   if (cart) {
// //     cart.lines = [];
// //     cart.branch = null;
// //     await cart.save();
// //   }

// //   const group = orders[0].paymentGroup?.id
// //     ? {
// //         id: orders[0].paymentGroup.id,
// //         combinedTotal: orders[0].paymentGroup.combinedTotal,
// //         orderCount: orders.length,
// //         /** What each store is owed out of the single payment. */
// //         shares: orders.map((o) => ({
// //           orderNumber: o.orderNumber,
// //           branchName: o.branchName,
// //           amount: o.amounts.grandTotal,
// //         })),
// //       }
// //     : null;

// //   res.json({
// //     success: true,
// //     data: { orders: orders.map(publicOrder), order: publicOrder(orders[0]), paymentGroup: group },
// //   });
// // });

// // /**
// //  * Shape sent to the browser. Deliberately narrower than the document — the
// //  * gateway signature, internal notes and audit fields have no business on the
// //  * client.
// //  */
// // function publicOrder(order) {
// //   const o = order.toObject ? order.toObject() : order;
// //   return {
// //     id: o._id,
// //     orderNumber: o.orderNumber,
// //     status: o.status,
// //     branchName: o.branchName,
// //     branchCity: o.branchCity,
// //     lines: o.lines,
// //     amounts: o.amounts,
// //     shippingAddress: o.shippingAddress,
// //     billingAddress: o.billingAddress,
// //     payment: {
// //       method: o.payment?.method,
// //       status: o.payment?.status,
// //       razorpayOrderId: o.payment?.razorpayOrderId || null,
// //       paidAt: o.payment?.paidAt || null,
// //     },
// //     shipment: o.shipment || null,
// //     timeline: o.timeline || [],
// //     invoiceNumber: o.invoiceNumber || null,
// //     groupKey: o.groupKey || null,
// //     paymentGroup: o.paymentGroup?.id ? o.paymentGroup : null,
// //     createdAt: o.createdAt,
// //   };
// // }

// // module.exports = { getCheckout, placeOrder, verifyPayment, publicOrder, priceCartForCheckout, priceLines, reserveStock };













// const asyncHandler = require("express-async-handler");
// const Cart = require("../models/Cart");
// const Order = require("../models/Order");
// const Item = require("../models/Item");
// const Branch = require("../models/Branch");
// const razorpay = require("../services/razorpayService");
// const email = require("../services/emailService");
// const { buildCartView, LIVE_ITEM } = require("./cartController");

// /**
//  * Checkout.
//  *
//  * The client never sends money. It sends an address, a payment method, and
//  * nothing else; every amount is recomputed here from the live products, then
//  * frozen onto the order. Anything else would let a shopper set their own price.
//  *
//  * ONE ORDER, HOWEVER MANY STORES
//  * ------------------------------
//  * A cart may span stores. It still becomes ONE order, because that is what
//  * physically happens: the team collects each saree from the store holding it,
//  * consolidates at the fulfilment warehouse and ships a single parcel. So:
//  *
//  *   • ONE order number, ONE invoice, ONE AWB, ONE tracking page.
//  *   • Shipping and any COD fee are charged ONCE for the whole basket, not once
//  *     per store — the customer receives one delivery and should pay for one.
//  *   • order.sourceBranches[] is the pick list: which store owes what, with its
//  *     own subtotal, so inter-store settlement is a lookup rather than a guess.
//  *   • order.branch is the FULFILLING store — it invoices under its GSTIN and
//  *     Shiprocket collects from its pincode. Set FULFILMENT_BRANCH_CODE in .env
//  *     to pin that to your warehouse; otherwise the store contributing the most
//  *     value is used.
//  */

// const round = (n) => Math.round(n * 100) / 100;

// function requiredAddressFields(address, label) {
//   const missing = ["fullName", "phone", "line1", "city", "state", "pincode"].filter(
//     (k) => !String(address?.[k] || "").trim()
//   );
//   if (missing.length) {
//     const err = new Error(`${label} is incomplete: ${missing.join(", ")} required`);
//     err.statusCode = 400;
//     throw err;
//   }
//   if (!/^\d{6}$/.test(String(address.pincode).trim())) {
//     const err = new Error(`${label} needs a valid 6-digit pincode`);
//     err.statusCode = 400;
//     throw err;
//   }
// }

// function pickAddress(a) {
//   return {
//     fullName: String(a.fullName || "").trim(),
//     phone: String(a.phone || "").trim(),
//     line1: String(a.line1 || "").trim(),
//     line2: String(a.line2 || "").trim(),
//     landmark: String(a.landmark || "").trim(),
//     city: String(a.city || "").trim(),
//     state: String(a.state || "").trim(),
//     pincode: String(a.pincode || "").trim(),
//     country: String(a.country || "India").trim(),
//   };
// }

// /**
//  * Prices a set of {item, quantity} lines and returns the snapshot to freeze onto
//  * an order. Throws if anything can't actually be bought right now.
//  *
//  * Shared by normal checkout and by group shopping, so a group order is priced,
//  * taxed and shipping-charged by exactly the same rules as a solo one — the one
//  * thing that must never diverge.
//  *
//  * Shipping and COD are the MAX across the basket, not the sum: one parcel, one
//  * delivery charge, regardless of how many stores or sarees are in it.
//  */
// async function priceLines(rawLines, { method }) {
//   if (!rawLines || rawLines.length === 0) {
//     const err = new Error("There's nothing to check out");
//     err.statusCode = 400;
//     throw err;
//   }

//   const items = await Item.find({ _id: { $in: rawLines.map((l) => l.item) }, ...LIVE_ITEM }).lean();
//   const byId = new Map(items.map((i) => [String(i._id), i]));

//   const lines = [];
//   let mrpTotal = 0;
//   let subtotal = 0;
//   let gstTotal = 0;
//   let shippingCharge = 0;
//   let codCharge = 0;
//   let anyCodBlocked = false;

//   for (const cartLine of rawLines) {
//     const item = byId.get(String(cartLine.item));
//     if (!item) {
//       const err = new Error("A saree in your cart is no longer available. Please review your cart.");
//       err.statusCode = 409;
//       throw err;
//     }

//     const stock = item.inventory?.currentStock || 0;
//     const price = item.pricing?.sellingPrice;
//     const name = item.identity?.displayName || item.identity?.productName || "Saree";

//     if (price == null) {
//       const err = new Error(`"${name}" is priced on request and can't be checked out online`);
//       err.statusCode = 409;
//       throw err;
//     }
//     if (stock < cartLine.quantity) {
//       const err = new Error(
//         stock === 0 ? `"${name}" has sold out` : `Only ${stock} of "${name}" left — please reduce the quantity`
//       );
//       err.statusCode = 409;
//       throw err;
//     }
//     if (item.shipping?.codAvailable === false) anyCodBlocked = true;

//     const qty = cartLine.quantity;
//     const lineSubtotal = round(price * qty);
//     const rate = item.tax?.gstRate || 0;
//     const inclusive = item.pricing?.taxInclusive !== false;
//     const gstAmount =
//       rate > 0
//         ? round(inclusive ? lineSubtotal - lineSubtotal / (1 + rate / 100) : (lineSubtotal * rate) / 100)
//         : 0;

//     const hero =
//       (item.images || []).find((i) => i.category === "Main Product Image") || (item.images || [])[0] || null;

//     lines.push({
//       item: item._id,
//       productName: name,
//       itemCode: item.identity?.itemCode || "",
//       sku: item.identity?.sku || "",
//       barcode: item.identity?.barcode || "",
//       hsnCode: item.tax?.hsnCode || item.identity?.hsnCode || "",
//       sareeType: item.saree?.sareeType || "",
//       fabric: item.saree?.fabricType || "",
//       colour: item.color?.primaryColor || "",
//       imageUrl: hero?.url || "",
//       slug: item.seo?.slug || "",
//       // Which store this saree is collected from. Names are filled in below,
//       // once, rather than with a lookup per line.
//       sourceBranch: item.branch,
//       quantity: qty,
//       unitPrice: price,
//       mrp: item.pricing?.mrp ?? price,
//       lineSubtotal,
//       gstRate: rate,
//       gstAmount,
//       taxInclusive: inclusive,
//     });

//     mrpTotal += (item.pricing?.mrp ?? price) * qty;
//     subtotal += lineSubtotal;
//     gstTotal += gstAmount;

//     // One parcel, one delivery: take the dearest line's charge, never the sum.
//     if (item.shipping?.freeShipping !== true && item.shipping?.shippingCharge) {
//       shippingCharge = Math.max(shippingCharge, Number(item.shipping.shippingCharge) || 0);
//     }
//     if (method === "cod" && item.shipping?.codCharge) {
//       codCharge = Math.max(codCharge, Number(item.shipping.codCharge) || 0);
//     }
//   }

//   if (method === "cod" && anyCodBlocked) {
//     const err = new Error("One of the sarees in your cart isn't available for cash on delivery");
//     err.statusCode = 409;
//     throw err;
//   }

//   return {
//     lines,
//     amounts: {
//       mrpTotal: round(mrpTotal),
//       subtotal: round(subtotal),
//       discount: round(Math.max(mrpTotal - subtotal, 0)),
//       gstTotal: round(gstTotal),
//       shippingCharge: round(shippingCharge),
//       codCharge: round(codCharge),
//       grandTotal: round(subtotal + shippingCharge + codCharge),
//       currency: "INR",
//     },
//   };
// }

// /**
//  * Fills in store names on each line and builds the pick list.
//  *
//  * Returns { lines, sourceBranches, branches } where branches is a Map of the
//  * full branch documents, so the caller can pick a fulfilling store without a
//  * second round trip.
//  */
// async function attachSourceBranches(lines) {
//   const ids = [...new Set(lines.map((l) => String(l.sourceBranch)).filter(Boolean))];

//   const docs = await Branch.find({ _id: { $in: ids } })
//     .select("branchName branchCode address gstNumber")
//     .lean();
//   const branches = new Map(docs.map((b) => [String(b._id), b]));

//   const rollup = new Map();

//   for (const line of lines) {
//     const key = String(line.sourceBranch || "");
//     const branch = branches.get(key);
//     line.sourceBranchName = branch?.branchName || "";
//     line.sourceBranchCity = branch?.address?.city || "";

//     if (!branch) continue;
//     const bucket = rollup.get(key) || {
//       branch: branch._id,
//       branchName: branch.branchName,
//       branchCity: branch.address?.city || "",
//       itemCount: 0,
//       subtotal: 0,
//     };
//     bucket.itemCount += line.quantity;
//     bucket.subtotal += line.lineSubtotal;
//     rollup.set(key, bucket);
//   }

//   const sourceBranches = [...rollup.values()]
//     .map((s) => ({ ...s, subtotal: round(s.subtotal) }))
//     .sort((a, b) => b.subtotal - a.subtotal);

//   return { lines, sourceBranches, branches };
// }

// /**
//  * Chooses the store that packs, invoices and ships.
//  *
//  * Pinned by FULFILMENT_BRANCH_CODE when set — that is the warehouse. Otherwise
//  * the store contributing the most value, which for a single-store cart is
//  * simply that store, so nothing changes for the common case.
//  */
// async function resolveFulfilmentBranch(sourceBranches, branches) {
//   const pinned = String(process.env.FULFILMENT_BRANCH_CODE || "").trim();
//   if (pinned) {
//     const warehouse = await Branch.findOne({
//       branchCode: pinned.toUpperCase(),
//       isDeleted: { $ne: true },
//       status: "active",
//     })
//       .select("branchName branchCode address gstNumber")
//       .lean();
//     if (warehouse) return warehouse;
//     console.warn(
//       `[checkout] FULFILMENT_BRANCH_CODE=${pinned} matches no active branch — ` +
//         "falling back to the largest source store."
//     );
//   }

//   const top = sourceBranches[0];
//   return top ? branches.get(String(top.branch)) : null;
// }

// /** Loads the customer's cart and prices the whole basket as one consignment. */
// async function priceCartForCheckout(customerId, { method }) {
//   const cart = await Cart.findOne({ customer: customerId });
//   if (!cart || cart.lines.length === 0) {
//     const err = new Error("Your cart is empty");
//     err.statusCode = 400;
//     throw err;
//   }

//   const priced = await priceLines(
//     cart.lines.map((l) => ({ item: l.item, quantity: l.quantity })),
//     { method }
//   );

//   const { lines, sourceBranches, branches } = await attachSourceBranches(priced.lines);

//   return { cart, lines, amounts: priced.amounts, sourceBranches, branches };
// }

// // GET /api/woven-essence/checkout
// // What the checkout page needs: priced cart, saved addresses, payment options.
// const getCheckout = asyncHandler(async (req, res) => {
//   const cart = await Cart.findOne({ customer: req.customer._id });
//   const view = cart ? await buildCartView(cart) : null;

//   let priced = null;
//   let stores = [];
//   let fulfilledBy = null;

//   try {
//     const result = await priceCartForCheckout(req.customer._id, { method: "razorpay" });
//     priced = result.amounts;
//     // Shown before payment so a shopper buying across stores understands that
//     // it still arrives as one parcel.
//     stores = result.sourceBranches.map((s) => ({
//       branchId: s.branch,
//       branchName: s.branchName,
//       branchCity: s.branchCity,
//       itemCount: s.itemCount,
//       subtotal: s.subtotal,
//     }));
//     const warehouse = await resolveFulfilmentBranch(result.sourceBranches, result.branches);
//     fulfilledBy = warehouse
//       ? { id: warehouse._id, name: warehouse.branchName, city: warehouse.address?.city || "" }
//       : null;
//   } catch (err) {
//     priced = null;
//     res.locals.checkoutBlocker = err.message;
//   }

//   res.json({
//     success: true,
//     data: {
//       cart: view,
//       amounts: priced,
//       stores,
//       storeCount: stores.length,
//       multiStore: stores.length > 1,
//       /** The store that packs and ships — one parcel however many stores. */
//       fulfilledBy,
//       blocker: res.locals.checkoutBlocker || null,
//       addresses: req.customer.addresses || [],
//       customer: { name: req.customer.name, email: req.customer.email, phone: req.customer.phone || "" },
//       branch: fulfilledBy,
//       payment: {
//         razorpayEnabled: razorpay.isConfigured(),
//         razorpayKeyId: razorpay.publicKeyId(),
//         codEnabled: true,
//       },
//     },
//   });
// });

// // POST /api/woven-essence/checkout/orders
// // Creates the order. For Razorpay it also creates the gateway order and returns
// // what the browser needs to open the checkout sheet. Stock is NOT reduced here —
// // only once payment succeeds (or immediately for COD).
// const placeOrder = asyncHandler(async (req, res) => {
//   const method = req.body.paymentMethod === "cod" ? "cod" : "razorpay";

//   const shippingAddress = pickAddress(req.body.shippingAddress || {});
//   requiredAddressFields(shippingAddress, "Shipping address");

//   const billingAddress =
//     req.body.sameAsBilling === false ? pickAddress(req.body.billingAddress || {}) : shippingAddress;
//   if (req.body.sameAsBilling === false) requiredAddressFields(billingAddress, "Billing address");

//   if (method === "razorpay" && !razorpay.isConfigured()) {
//     res.status(503);
//     throw new Error("Online payment isn't configured yet — please choose cash on delivery.");
//   }

//   const { cart, lines, amounts, sourceBranches, branches } = await priceCartForCheckout(
//     req.customer._id,
//     { method }
//   );

//   const fulfilling = await resolveFulfilmentBranch(sourceBranches, branches);
//   if (!fulfilling) {
//     res.status(409);
//     throw new Error("The store for this cart is no longer available");
//   }

//   const orderNumber = await Order.generateOrderNumber(fulfilling.branchCode);

//   const order = new Order({
//     orderNumber,
//     customer: req.customer._id,
//     customerName: req.customer.name,
//     customerEmail: req.customer.email,
//     customerPhone: req.customer.phone || shippingAddress.phone,
//     branch: fulfilling._id,
//     branchName: fulfilling.branchName,
//     branchCity: fulfilling.address?.city || "",
//     branchGst: fulfilling.gstNumber || "",
//     sourceBranches,
//     lines,
//     shippingAddress,
//     billingAddress,
//     amounts,
//     payment: { method, status: method === "cod" ? "cod_pending" : "pending" },
//     groupKey: cart.groupKey || null,
//     notes: String(req.body.notes || "").slice(0, 500),
//   });

//   if (method === "cod") {
//     // Nothing to collect online, so the order is live immediately.
//     await reserveStock(order);
//     order.pushStatus(
//       "confirmed",
//       sourceBranches.length > 1
//         ? `Order placed — cash on delivery. Collect from ${sourceBranches.length} stores.`
//         : "Order placed — cash on delivery",
//       "customer"
//     );
//     await order.save();
//     // Fire and forget: a mail failure must never fail a placed order.
//     email.sendOrderPlaced(order, true).catch(() => {});

//     cart.lines = [];
//     cart.branch = null;
//     await cart.save();

//     return res.status(201).json({
//       success: true,
//       data: {
//         order: publicOrder(order),
//         /** Kept so older clients that expected a list keep working. */
//         orders: [publicOrder(order)],
//         payment: { method: "cod" },
//         amounts,
//       },
//     });
//   }

//   const rzOrder = await razorpay.createOrder({
//     amountInRupees: amounts.grandTotal,
//     receipt: orderNumber,
//     notes: {
//       orderNumber,
//       customer: String(req.customer._id),
//       fulfilledBy: fulfilling.branchCode,
//       stores: sourceBranches.map((s) => s.branchName).join(", "),
//     },
//   });

//   order.payment.razorpayOrderId = rzOrder.id;
//   order.pushStatus("pending_payment", "Awaiting payment", "system");
//   await order.save();

//   res.status(201).json({
//     success: true,
//     data: {
//       order: publicOrder(order),
//       orders: [publicOrder(order)],
//       amounts,
//       payment: {
//         method: "razorpay",
//         keyId: razorpay.publicKeyId(),
//         razorpayOrderId: rzOrder.id,
//         amount: rzOrder.amount, // paise, as Razorpay's checkout expects
//         currency: rzOrder.currency,
//         name: "Woven Essence",
//         description: `Order ${orderNumber}`,
//         prefill: {
//           name: shippingAddress.fullName,
//           email: req.customer.email,
//           contact: shippingAddress.phone,
//         },
//       },
//     },
//   });
// });

// /**
//  * Reduces stock for each line, guarded so it can't go negative under
//  * concurrency: the update only applies while enough stock remains.
//  */
// async function reserveStock(order) {
//   for (const line of order.lines) {
//     const result = await Item.updateOne(
//       { _id: line.item, "inventory.currentStock": { $gte: line.quantity } },
//       {
//         $inc: {
//           "inventory.currentStock": -line.quantity,
//           "salesIntelligence.totalOrders": 1,
//           "salesIntelligence.totalQuantitySold": line.quantity,
//           "salesIntelligence.totalRevenue": line.lineSubtotal,
//         },
//       }
//     );

//     if (result.modifiedCount === 0) {
//       const err = new Error(`"${line.productName}" sold out while you were checking out`);
//       err.statusCode = 409;
//       throw err;
//     }
//   }
// }

// // POST /api/woven-essence/checkout/verify
// // Called by the browser after Razorpay's sheet succeeds. The signature is what
// // proves the payment is real — an unverified callback is just a claim.
// const verifyPayment = asyncHandler(async (req, res) => {
//   const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

//   // Normally exactly one order per Razorpay order. The loop also settles any
//   // legacy split orders left over from the previous per-store checkout.
//   const orders = await Order.find({
//     "payment.razorpayOrderId": razorpay_order_id,
//     customer: req.customer._id,
//   }).sort("orderNumber");

//   if (orders.length === 0) {
//     res.status(404);
//     throw new Error("Order not found");
//   }

//   // Already handled (double callback, or the webhook got there first).
//   if (orders.every((o) => o.payment.status === "paid")) {
//     return res.json({
//       success: true,
//       data: { order: publicOrder(orders[0]), orders: orders.map(publicOrder), alreadyPaid: true },
//     });
//   }

//   const valid = razorpay.verifyPaymentSignature({
//     razorpayOrderId: razorpay_order_id,
//     razorpayPaymentId: razorpay_payment_id,
//     signature: razorpay_signature,
//   });

//   if (!valid) {
//     for (const order of orders) {
//       order.payment.status = "failed";
//       order.payment.failureReason = "Signature verification failed";
//       order.pushStatus("pending_payment", "Payment could not be verified", "payment");
//       await order.save();
//     }
//     res.status(400);
//     throw new Error("We couldn't verify that payment. You have not been charged for this order.");
//   }

//   // Stock first: if a saree sold out mid-payment this throws, and the caller is
//   // told before any order is marked paid.
//   for (const order of orders) {
//     if (order.payment.status === "paid") continue;
//     await reserveStock(order);
//   }

//   for (const order of orders) {
//     if (order.payment.status === "paid") continue;
//     order.payment.status = "paid";
//     order.payment.razorpayPaymentId = razorpay_payment_id;
//     order.payment.razorpaySignature = razorpay_signature;
//     order.payment.paidAt = new Date();
//     order.ensureInvoiceNumber();
//     order.pushStatus("confirmed", "Payment received", "payment");
//     await order.save();
//     email.sendOrderPlaced(order, false).catch(() => {});
//   }

//   const cart = await Cart.findOne({ customer: req.customer._id });
//   if (cart) {
//     cart.lines = [];
//     cart.branch = null;
//     await cart.save();
//   }

//   res.json({
//     success: true,
//     data: { order: publicOrder(orders[0]), orders: orders.map(publicOrder) },
//   });
// });

// /**
//  * Shape sent to the browser. Deliberately narrower than the document — the
//  * gateway signature, internal notes and audit fields have no business on the
//  * client.
//  */
// function publicOrder(order) {
//   const o = order.toObject ? order.toObject() : order;
//   return {
//     id: o._id,
//     orderNumber: o.orderNumber,
//     status: o.status,
//     branchName: o.branchName,
//     branchCity: o.branchCity,
//     /** Where each saree was collected from — shown on the order page. */
//     sourceBranches: (o.sourceBranches || []).map((s) => ({
//       branchName: s.branchName,
//       branchCity: s.branchCity,
//       itemCount: s.itemCount,
//     })),
//     multiStore: (o.sourceBranches || []).length > 1,
//     lines: o.lines,
//     amounts: o.amounts,
//     shippingAddress: o.shippingAddress,
//     billingAddress: o.billingAddress,
//     payment: {
//       method: o.payment?.method,
//       status: o.payment?.status,
//       razorpayOrderId: o.payment?.razorpayOrderId || null,
//       paidAt: o.payment?.paidAt || null,
//     },
//     shipment: o.shipment || null,
//     timeline: o.timeline || [],
//     invoiceNumber: o.invoiceNumber || null,
//     groupKey: o.groupKey || null,
//     createdAt: o.createdAt,
//   };
// }

// module.exports = {
//   getCheckout,
//   placeOrder,
//   verifyPayment,
//   publicOrder,
//   priceCartForCheckout,
//   priceLines,
//   reserveStock,
//   attachSourceBranches,
// };








const asyncHandler = require("express-async-handler");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Item = require("../models/Item");
const Branch = require("../models/Branch");
const razorpay = require("../services/razorpayService");
const email = require("../services/emailService");
const { buildCartView, LIVE_ITEM } = require("./cartController");

/**
 * Checkout.
 *
 * The client never sends money. It sends an address, a payment method, and
 * nothing else; every amount is recomputed here from the live products, then
 * frozen onto the order. Anything else would let a shopper set their own price.
 *
 * ONE ORDER, HOWEVER MANY STORES
 * ------------------------------
 * A cart may span stores. It still becomes ONE order, because that is what
 * physically happens: the team collects each saree from the store holding it,
 * consolidates at the fulfilment warehouse and ships a single parcel. So:
 *
 *   • ONE order number, ONE invoice, ONE AWB, ONE tracking page.
 *   • Shipping and any COD fee are charged ONCE for the whole basket, not once
 *     per store — the customer receives one delivery and should pay for one.
 *   • order.sourceBranches[] is the pick list: which store owes what, with its
 *     own subtotal, so inter-store settlement is a lookup rather than a guess.
 *   • order.branch is the FULFILLING store — it invoices under its GSTIN and
 *     Shiprocket collects from its pincode. Set FULFILMENT_BRANCH_CODE in .env
 *     to pin that to your warehouse; otherwise the store contributing the most
 *     value is used.
 */

const round = (n) => Math.round(n * 100) / 100;

function requiredAddressFields(address, label) {
  const missing = ["fullName", "phone", "line1", "city", "state", "pincode"].filter(
    (k) => !String(address?.[k] || "").trim()
  );
  if (missing.length) {
    const err = new Error(`${label} is incomplete: ${missing.join(", ")} required`);
    err.statusCode = 400;
    throw err;
  }
  if (!/^\d{6}$/.test(String(address.pincode).trim())) {
    const err = new Error(`${label} needs a valid 6-digit pincode`);
    err.statusCode = 400;
    throw err;
  }
}

function pickAddress(a) {
  return {
    fullName: String(a.fullName || "").trim(),
    phone: String(a.phone || "").trim(),
    line1: String(a.line1 || "").trim(),
    line2: String(a.line2 || "").trim(),
    landmark: String(a.landmark || "").trim(),
    city: String(a.city || "").trim(),
    state: String(a.state || "").trim(),
    pincode: String(a.pincode || "").trim(),
    country: String(a.country || "India").trim(),
  };
}

/**
 * Prices a set of {item, quantity} lines and returns the snapshot to freeze onto
 * an order. Throws if anything can't actually be bought right now.
 *
 * Shared by normal checkout and by group shopping, so a group order is priced,
 * taxed and shipping-charged by exactly the same rules as a solo one — the one
 * thing that must never diverge.
 *
 * Shipping and COD are the MAX across the basket, not the sum: one parcel, one
 * delivery charge, regardless of how many stores or sarees are in it.
 */
async function priceLines(rawLines, { method }) {
  if (!rawLines || rawLines.length === 0) {
    const err = new Error("There's nothing to check out");
    err.statusCode = 400;
    throw err;
  }

  const items = await Item.find({ _id: { $in: rawLines.map((l) => l.item) }, ...LIVE_ITEM }).lean();
  const byId = new Map(items.map((i) => [String(i._id), i]));

  const lines = [];
  let mrpTotal = 0;
  let subtotal = 0;
  let gstTotal = 0;
  let shippingCharge = 0;
  let codCharge = 0;
  let anyCodBlocked = false;

  for (const cartLine of rawLines) {
    const item = byId.get(String(cartLine.item));
    if (!item) {
      const err = new Error("A saree in your cart is no longer available. Please review your cart.");
      err.statusCode = 409;
      throw err;
    }

    const stock = item.inventory?.currentStock || 0;
    const price = item.pricing?.sellingPrice;
    const name = item.identity?.displayName || item.identity?.productName || "Saree";

    if (price == null) {
      const err = new Error(`"${name}" is priced on request and can't be checked out online`);
      err.statusCode = 409;
      throw err;
    }
    if (stock < cartLine.quantity) {
      const err = new Error(
        stock === 0 ? `"${name}" has sold out` : `Only ${stock} of "${name}" left — please reduce the quantity`
      );
      err.statusCode = 409;
      throw err;
    }
    if (item.shipping?.codAvailable === false) anyCodBlocked = true;

    const qty = cartLine.quantity;
    const lineSubtotal = round(price * qty);
    const rate = item.tax?.gstRate || 0;
    const inclusive = item.pricing?.taxInclusive !== false;
    const gstAmount =
      rate > 0
        ? round(inclusive ? lineSubtotal - lineSubtotal / (1 + rate / 100) : (lineSubtotal * rate) / 100)
        : 0;

    const hero =
      (item.images || []).find((i) => i.category === "Main Product Image") || (item.images || [])[0] || null;

    lines.push({
      item: item._id,
      productName: name,
      itemCode: item.identity?.itemCode || "",
      sku: item.identity?.sku || "",
      barcode: item.identity?.barcode || "",
      hsnCode: item.tax?.hsnCode || item.identity?.hsnCode || "",
      sareeType: item.saree?.sareeType || "",
      fabric: item.saree?.fabricType || "",
      colour: item.color?.primaryColor || "",
      imageUrl: hero?.url || "",
      slug: item.seo?.slug || "",
      // Which store this saree is collected from. Names are filled in below,
      // once, rather than with a lookup per line.
      sourceBranch: item.branch,
      quantity: qty,
      unitPrice: price,
      mrp: item.pricing?.mrp ?? price,
      lineSubtotal,
      gstRate: rate,
      gstAmount,
      taxInclusive: inclusive,
    });

    mrpTotal += (item.pricing?.mrp ?? price) * qty;
    subtotal += lineSubtotal;
    gstTotal += gstAmount;

    // One parcel, one delivery: take the dearest line's charge, never the sum.
    if (item.shipping?.freeShipping !== true && item.shipping?.shippingCharge) {
      shippingCharge = Math.max(shippingCharge, Number(item.shipping.shippingCharge) || 0);
    }
    if (method === "cod" && item.shipping?.codCharge) {
      codCharge = Math.max(codCharge, Number(item.shipping.codCharge) || 0);
    }
  }

  if (method === "cod" && anyCodBlocked) {
    const err = new Error("One of the sarees in your cart isn't available for cash on delivery");
    err.statusCode = 409;
    throw err;
  }

  return {
    lines,
    amounts: {
      mrpTotal: round(mrpTotal),
      subtotal: round(subtotal),
      discount: round(Math.max(mrpTotal - subtotal, 0)),
      gstTotal: round(gstTotal),
      shippingCharge: round(shippingCharge),
      codCharge: round(codCharge),
      // Filled in by applyCouponTo() when the shopper has a valid code.
      couponDiscount: 0,
      grandTotal: round(subtotal + shippingCharge + codCharge),
      currency: "INR",
    },
  };
}

/**
 * Fills in store names on each line and builds the pick list.
 *
 * Returns { lines, sourceBranches, branches } where branches is a Map of the
 * full branch documents, so the caller can pick a fulfilling store without a
 * second round trip.
 */
async function attachSourceBranches(lines) {
  const ids = [...new Set(lines.map((l) => String(l.sourceBranch)).filter(Boolean))];

  const docs = await Branch.find({ _id: { $in: ids } })
    .select("branchName branchCode address gstNumber")
    .lean();
  const branches = new Map(docs.map((b) => [String(b._id), b]));

  const rollup = new Map();

  for (const line of lines) {
    const key = String(line.sourceBranch || "");
    const branch = branches.get(key);
    line.sourceBranchName = branch?.branchName || "";
    line.sourceBranchCity = branch?.address?.city || "";

    if (!branch) continue;
    const bucket = rollup.get(key) || {
      branch: branch._id,
      branchName: branch.branchName,
      branchCity: branch.address?.city || "",
      itemCount: 0,
      subtotal: 0,
    };
    bucket.itemCount += line.quantity;
    bucket.subtotal += line.lineSubtotal;
    rollup.set(key, bucket);
  }

  const sourceBranches = [...rollup.values()]
    .map((s) => ({ ...s, subtotal: round(s.subtotal) }))
    .sort((a, b) => b.subtotal - a.subtotal);

  return { lines, sourceBranches, branches };
}

/**
 * Chooses the store that packs, invoices and ships.
 *
 * Pinned by FULFILMENT_BRANCH_CODE when set — that is the warehouse. Otherwise
 * the store contributing the most value, which for a single-store cart is
 * simply that store, so nothing changes for the common case.
 */
async function resolveFulfilmentBranch(sourceBranches, branches) {
  const pinned = String(process.env.FULFILMENT_BRANCH_CODE || "").trim();
  if (pinned) {
    const warehouse = await Branch.findOne({
      branchCode: pinned.toUpperCase(),
      isDeleted: { $ne: true },
      status: "active",
    })
      .select("branchName branchCode address gstNumber")
      .lean();
    if (warehouse) return warehouse;
    console.warn(
      `[checkout] FULFILMENT_BRANCH_CODE=${pinned} matches no active branch — ` +
        "falling back to the largest source store."
    );
  }

  const top = sourceBranches[0];
  return top ? branches.get(String(top.branch)) : null;
}

/**
 * Applies a coupon code to an already-priced basket, in place.
 *
 * Returns the Coupon document so the caller can record the redemption after the
 * order is safely placed. Returns null when no code was supplied.
 *
 * couponController is required LAZILY here: it requires this module back (to
 * price the cart for its preview endpoint), and a top-level require would make
 * that circular.
 */
async function applyCouponTo({ amounts, code, customerId, branchIds }) {
  if (!String(code || "").trim()) return null;

  const { evaluateForCustomer } = require("./couponController");
  const { coupon, discount } = await evaluateForCustomer({
    code,
    customerId,
    subtotal: amounts.subtotal,
    branchIds,
  });

  amounts.couponDiscount = discount;
  // Discount comes off goods only — shipping and any COD fee are real costs and
  // are not something a percentage coupon should erode.
  amounts.grandTotal = round(
    amounts.subtotal - discount + amounts.shippingCharge + amounts.codCharge
  );

  return coupon;
}

/** Loads the customer's cart and prices the whole basket as one consignment. */
async function priceCartForCheckout(customerId, { method }) {
  const cart = await Cart.findOne({ customer: customerId });
  if (!cart || cart.lines.length === 0) {
    const err = new Error("Your cart is empty");
    err.statusCode = 400;
    throw err;
  }

  const priced = await priceLines(
    cart.lines.map((l) => ({ item: l.item, quantity: l.quantity })),
    { method }
  );

  const { lines, sourceBranches, branches } = await attachSourceBranches(priced.lines);

  return { cart, lines, amounts: priced.amounts, sourceBranches, branches };
}

// GET /api/woven-essence/checkout
// What the checkout page needs: priced cart, saved addresses, payment options.
const getCheckout = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ customer: req.customer._id });
  const view = cart ? await buildCartView(cart) : null;

  let priced = null;
  let stores = [];
  let fulfilledBy = null;
  let appliedCoupon = null;
  let couponError = null;

  try {
    const result = await priceCartForCheckout(req.customer._id, { method: "razorpay" });
    priced = result.amounts;
    // Shown before payment so a shopper buying across stores understands that
    // it still arrives as one parcel.
    stores = result.sourceBranches.map((s) => ({
      branchId: s.branch,
      branchName: s.branchName,
      branchCity: s.branchCity,
      itemCount: s.itemCount,
      subtotal: s.subtotal,
    }));
    // A code in the query lets the page re-render its saving on reload.
    if (req.query.coupon) {
      try {
        appliedCoupon = await applyCouponTo({
          amounts: priced,
          code: req.query.coupon,
          customerId: req.customer._id,
          branchIds: result.sourceBranches.map((s) => s.branch),
        });
      } catch (couponErr) {
        // A stale code must not block checkout — quote it as unusable instead.
        couponError = couponErr.message;
      }
    }
    const warehouse = await resolveFulfilmentBranch(result.sourceBranches, result.branches);
    fulfilledBy = warehouse
      ? { id: warehouse._id, name: warehouse.branchName, city: warehouse.address?.city || "" }
      : null;
  } catch (err) {
    priced = null;
    res.locals.checkoutBlocker = err.message;
  }

  res.json({
    success: true,
    data: {
      cart: view,
      amounts: priced,
      coupon: appliedCoupon
        ? {
            code: appliedCoupon.code,
            summary: appliedCoupon.summaryText(),
            discount: priced?.couponDiscount || 0,
          }
        : null,
      couponError,
      stores,
      storeCount: stores.length,
      multiStore: stores.length > 1,
      /** The store that packs and ships — one parcel however many stores. */
      fulfilledBy,
      blocker: res.locals.checkoutBlocker || null,
      addresses: req.customer.addresses || [],
      customer: { name: req.customer.name, email: req.customer.email, phone: req.customer.phone || "" },
      branch: fulfilledBy,
      payment: {
        razorpayEnabled: razorpay.isConfigured(),
        razorpayKeyId: razorpay.publicKeyId(),
        codEnabled: true,
      },
    },
  });
});

// POST /api/woven-essence/checkout/orders
// Creates the order. For Razorpay it also creates the gateway order and returns
// what the browser needs to open the checkout sheet. Stock is NOT reduced here —
// only once payment succeeds (or immediately for COD).
const placeOrder = asyncHandler(async (req, res) => {
  const method = req.body.paymentMethod === "cod" ? "cod" : "razorpay";

  const shippingAddress = pickAddress(req.body.shippingAddress || {});
  requiredAddressFields(shippingAddress, "Shipping address");

  const billingAddress =
    req.body.sameAsBilling === false ? pickAddress(req.body.billingAddress || {}) : shippingAddress;
  if (req.body.sameAsBilling === false) requiredAddressFields(billingAddress, "Billing address");

  if (method === "razorpay" && !razorpay.isConfigured()) {
    res.status(503);
    throw new Error("Online payment isn't configured yet — please choose cash on delivery.");
  }

  const { cart, lines, amounts, sourceBranches, branches } = await priceCartForCheckout(
    req.customer._id,
    { method }
  );

  const fulfilling = await resolveFulfilmentBranch(sourceBranches, branches);
  if (!fulfilling) {
    res.status(409);
    throw new Error("The store for this cart is no longer available");
  }

  // Evaluated here, not trusted from the client: the browser sends a CODE, the
  // server decides what it is worth. A rejected code throws with the shopper's
  // reason, so they see "you've already used this offer" rather than a silent
  // price change at the moment of payment.
  const coupon = await applyCouponTo({
    amounts,
    code: req.body.couponCode,
    customerId: req.customer._id,
    branchIds: sourceBranches.map((s) => s.branch),
  });

  const orderNumber = await Order.generateOrderNumber(fulfilling.branchCode);

  const order = new Order({
    orderNumber,
    customer: req.customer._id,
    customerName: req.customer.name,
    customerEmail: req.customer.email,
    customerPhone: req.customer.phone || shippingAddress.phone,
    branch: fulfilling._id,
    branchName: fulfilling.branchName,
    branchCity: fulfilling.address?.city || "",
    branchGst: fulfilling.gstNumber || "",
    sourceBranches,
    lines,
    shippingAddress,
    billingAddress,
    amounts,
    payment: { method, status: method === "cod" ? "cod_pending" : "pending" },
    coupon: coupon
      ? {
          coupon: coupon._id,
          code: coupon.code,
          title: coupon.title,
          discountType: coupon.discountType,
          value: coupon.value,
          discountAmount: amounts.couponDiscount,
        }
      : null,
    groupKey: cart.groupKey || null,
    notes: String(req.body.notes || "").slice(0, 500),
  });

  if (method === "cod") {
    // Nothing to collect online, so the order is live immediately.
    await reserveStock(order);
    order.pushStatus(
      "confirmed",
      sourceBranches.length > 1
        ? `Order placed — cash on delivery. Collect from ${sourceBranches.length} stores.`
        : "Order placed — cash on delivery",
      "customer"
    );
    await order.save();
    // The use is consumed now, because a COD order is live immediately.
    if (coupon) {
      const { recordRedemption } = require("./couponController");
      await recordRedemption({ coupon, customer: req.customer, order });
    }
    // Fire and forget: a mail failure must never fail a placed order.
    email.sendOrderPlaced(order, true).catch(() => {});

    cart.lines = [];
    cart.branch = null;
    await cart.save();

    return res.status(201).json({
      success: true,
      data: {
        order: publicOrder(order),
        /** Kept so older clients that expected a list keep working. */
        orders: [publicOrder(order)],
        payment: { method: "cod" },
        amounts,
      },
    });
  }

  const rzOrder = await razorpay.createOrder({
    amountInRupees: amounts.grandTotal,
    receipt: orderNumber,
    notes: {
      orderNumber,
      customer: String(req.customer._id),
      fulfilledBy: fulfilling.branchCode,
      stores: sourceBranches.map((s) => s.branchName).join(", "),
    },
  });

  order.payment.razorpayOrderId = rzOrder.id;
  order.pushStatus("pending_payment", "Awaiting payment", "system");
  await order.save();

  res.status(201).json({
    success: true,
    data: {
      order: publicOrder(order),
      orders: [publicOrder(order)],
      amounts,
      payment: {
        method: "razorpay",
        keyId: razorpay.publicKeyId(),
        razorpayOrderId: rzOrder.id,
        amount: rzOrder.amount, // paise, as Razorpay's checkout expects
        currency: rzOrder.currency,
        name: "Woven Essence",
        description: `Order ${orderNumber}`,
        prefill: {
          name: shippingAddress.fullName,
          email: req.customer.email,
          contact: shippingAddress.phone,
        },
      },
    },
  });
});

/**
 * Reduces stock for each line, guarded so it can't go negative under
 * concurrency: the update only applies while enough stock remains.
 */
async function reserveStock(order) {
  for (const line of order.lines) {
    const result = await Item.updateOne(
      { _id: line.item, "inventory.currentStock": { $gte: line.quantity } },
      {
        $inc: {
          "inventory.currentStock": -line.quantity,
          "salesIntelligence.totalOrders": 1,
          "salesIntelligence.totalQuantitySold": line.quantity,
          "salesIntelligence.totalRevenue": line.lineSubtotal,
        },
      }
    );

    if (result.modifiedCount === 0) {
      const err = new Error(`"${line.productName}" sold out while you were checking out`);
      err.statusCode = 409;
      throw err;
    }
  }
}

// POST /api/woven-essence/checkout/verify
// Called by the browser after Razorpay's sheet succeeds. The signature is what
// proves the payment is real — an unverified callback is just a claim.
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Normally exactly one order per Razorpay order. The loop also settles any
  // legacy split orders left over from the previous per-store checkout.
  const orders = await Order.find({
    "payment.razorpayOrderId": razorpay_order_id,
    customer: req.customer._id,
  }).sort("orderNumber");

  if (orders.length === 0) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Already handled (double callback, or the webhook got there first).
  if (orders.every((o) => o.payment.status === "paid")) {
    return res.json({
      success: true,
      data: { order: publicOrder(orders[0]), orders: orders.map(publicOrder), alreadyPaid: true },
    });
  }

  const valid = razorpay.verifyPaymentSignature({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!valid) {
    for (const order of orders) {
      order.payment.status = "failed";
      order.payment.failureReason = "Signature verification failed";
      order.pushStatus("pending_payment", "Payment could not be verified", "payment");
      await order.save();
    }
    res.status(400);
    throw new Error("We couldn't verify that payment. You have not been charged for this order.");
  }

  // Stock first: if a saree sold out mid-payment this throws, and the caller is
  // told before any order is marked paid.
  for (const order of orders) {
    if (order.payment.status === "paid") continue;
    await reserveStock(order);
  }

  for (const order of orders) {
    if (order.payment.status === "paid") continue;
    order.payment.status = "paid";
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    order.payment.paidAt = new Date();
    order.ensureInvoiceNumber();
    order.pushStatus("confirmed", "Payment received", "payment");
    await order.save();

    // Deliberately here and not at placeOrder: an abandoned Razorpay sheet
    // would otherwise burn a use of a limited coupon for an order that never
    // happened.
    if (order.coupon?.coupon) {
      const Coupon = require("../models/Coupon");
      const { recordRedemption } = require("./couponController");
      const couponDoc = await Coupon.findById(order.coupon.coupon);
      if (couponDoc) await recordRedemption({ coupon: couponDoc, customer: req.customer, order });
    }

    email.sendOrderPlaced(order, false).catch(() => {});
  }

  const cart = await Cart.findOne({ customer: req.customer._id });
  if (cart) {
    cart.lines = [];
    cart.branch = null;
    await cart.save();
  }

  res.json({
    success: true,
    data: { order: publicOrder(orders[0]), orders: orders.map(publicOrder) },
  });
});

/**
 * Shape sent to the browser. Deliberately narrower than the document — the
 * gateway signature, internal notes and audit fields have no business on the
 * client.
 */
function publicOrder(order) {
  const o = order.toObject ? order.toObject() : order;
  return {
    id: o._id,
    orderNumber: o.orderNumber,
    status: o.status,
    branchName: o.branchName,
    branchCity: o.branchCity,
    /** Where each saree was collected from — shown on the order page. */
    sourceBranches: (o.sourceBranches || []).map((s) => ({
      branchName: s.branchName,
      branchCity: s.branchCity,
      itemCount: s.itemCount,
    })),
    multiStore: (o.sourceBranches || []).length > 1,
    lines: o.lines,
    amounts: o.amounts,
    coupon: o.coupon ? { code: o.coupon.code, discountAmount: o.coupon.discountAmount } : null,
    shippingAddress: o.shippingAddress,
    billingAddress: o.billingAddress,
    payment: {
      method: o.payment?.method,
      status: o.payment?.status,
      razorpayOrderId: o.payment?.razorpayOrderId || null,
      paidAt: o.payment?.paidAt || null,
    },
    shipment: o.shipment || null,
    timeline: o.timeline || [],
    invoiceNumber: o.invoiceNumber || null,
    groupKey: o.groupKey || null,
    createdAt: o.createdAt,
  };
}

module.exports = {
  getCheckout,
  placeOrder,
  verifyPayment,
  publicOrder,
  priceCartForCheckout,
  priceLines,
  reserveStock,
  attachSourceBranches,
};