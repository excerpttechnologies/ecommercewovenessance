// const asyncHandler = require("express-async-handler");
// const GroupSession = require("../models/GroupSession");
// const Order = require("../models/Order");
// const Item = require("../models/Item");
// const Branch = require("../models/Branch");
// const Cart = require("../models/Cart");
// const { priceLines, reserveStock, publicOrder } = require("./checkoutController");
// const razorpay = require("../services/razorpayService");

// /**
//  * Group shopping.
//  *
//  * Several shoppers share a pin and fill one cart together, then settle up either
//  * as a single payment or one payment each. Orders raised here are ordinary
//  * Orders carrying the session's `groupKey`, which is what lets every member see
//  * the same delivery address and the same delivery status without owning the
//  * order.
//  *
//  * Named groupShoppingController rather than groupController because the latter
//  * already belongs to product Groups in the catalogue hierarchy.
//  */

// const LIVE_ITEM = {
//   isDeleted: { $ne: true },
//   status: "active",
//   lifecycleStage: "published",
//   "visibility.onlineSaleEnabled": { $ne: false },
// };

// const SESSION_DAYS = 7;
// const MAX_MEMBERS = 12;

// function fail(message, statusCode = 400) {
//   const err = new Error(message);
//   err.statusCode = statusCode;
//   throw err;
// }

// async function activeSessionFor(customerId) {
//   return GroupSession.findOne({
//     status: { $in: ["open", "confirmed"] },
//     members: { $elemMatch: { customer: customerId, leftAt: null } },
//   });
// }

// /**
//  * Membership lookup that also matches a finished session, so a member revisiting
//  * a completed group gets an accurate message instead of "you're not in a group".
//  */
// async function memberSessionAnyStatus(customerId) {
//   return GroupSession.findOne({
//     status: { $in: ["open", "confirmed", "ordered"] },
//     members: { $elemMatch: { customer: customerId, leftAt: null } },
//   }).sort({ updatedAt: -1 });
// }

// async function loadJoined(customerId, { requireOpen = false } = {}) {
//   const session = await activeSessionFor(customerId);
//   if (!session) fail("You're not in a group shopping session", 404);
//   if (requireOpen && session.status !== "open") {
//     fail("This group is already confirmed — the list can't be changed now", 409);
//   }
//   return session;
// }

// /**
//  * Prices the group cart and splits it per member.
//  *
//  * Uses the same pricer as solo checkout, so a saree costs the same however it is
//  * bought. The split is by who added each line, which is what makes "pay
//  * separately" meaningful.
//  */
// async function buildSessionView(session, viewerId) {
//   const branch = await Branch.findById(session.branch).select("branchName branchCode address.city").lean();

//   let priced = { lines: [], amounts: null };
//   let issue = null;

//   if (session.lines.length > 0) {
//     try {
//       priced = await priceLines(
//         session.lines.map((l) => ({ item: l.item, quantity: l.quantity })),
//         { method: "razorpay" }
//       );
//     } catch (err) {
//       // A sold-out saree must not stop the whole group page from loading.
//       issue = err.message;
//     }
//   }

//   const pricedByItem = new Map((priced.lines || []).map((l) => [String(l.item), l]));

//   const lines = session.lines.map((l) => {
//     const p = pricedByItem.get(String(l.item));
//     return {
//       lineId: l._id,
//       itemId: l.item,
//       quantity: l.quantity,
//       addedBy: l.addedBy,
//       addedByName: l.addedByName,
//       addedByYou: String(l.addedBy) === String(viewerId),
//       addedAt: l.addedAt,
//       name: p?.productName || null,
//       itemCode: p?.itemCode || "",
//       slug: p?.slug || "",
//       imageUrl: p?.imageUrl || "",
//       unitPrice: p?.unitPrice ?? null,
//       lineSubtotal: p?.lineSubtotal ?? null,
//       available: !!p,
//     };
//   });

//   const perMember = session.activeMembers().map((m) => {
//     const mine = lines.filter((l) => String(l.addedBy) === String(m.customer) && l.available);
//     return {
//       customer: m.customer,
//       name: m.name,
//       isHost: m.isHost,
//       isYou: String(m.customer) === String(viewerId),
//       joinedAt: m.joinedAt,
//       itemCount: mine.reduce((n, l) => n + l.quantity, 0),
//       subtotal: Math.round(mine.reduce((sum, l) => sum + (l.lineSubtotal || 0), 0) * 100) / 100,
//     };
//   });

//   const paidBy = new Set(session.orders.map((o) => String(o.customer)));

//   return {
//     key: session.key,
//     status: session.status,
//     paymentMode: session.paymentMode,
//     branch: branch ? { id: branch._id, name: branch.branchName, city: branch.address?.city || "" } : null,
//     youAreHost: session.isHost(viewerId),
//     memberCount: session.activeMembers().length,
//     members: perMember.map((m) => ({ ...m, hasPaid: paidBy.has(String(m.customer)) })),
//     lines,
//     amounts: priced.amounts || null,
//     issue,
//     shippingAddress: session.status === "open" ? null : session.shippingAddress || null,
//     orders: session.orders.map((o) => ({
//       customer: o.customer,
//       orderNumber: o.orderNumber,
//       amount: o.amount,
//       isYours: String(o.customer) === String(viewerId),
//     })),
//     yourShare: perMember.find((m) => m.isYou)?.subtotal ?? 0,
//     youHavePaid: paidBy.has(String(viewerId)),
//     expiresAt: session.expiresAt,
//   };
// }

// // POST /api/woven-essence/group
// const createSession = asyncHandler(async (req, res) => {
//   const existing = await activeSessionFor(req.customer._id);
//   if (existing) {
//     return res.json({
//       success: true,
//       data: await buildSessionView(existing, req.customer._id),
//       message: `You're already in group ${existing.key}`,
//     });
//   }

//   // The group shops one store: the customer's cart branch, else their preferred
//   // store, else the only live branch if there happens to be just one.
//   const cart = await Cart.findOne({ customer: req.customer._id });
//   let branchId = req.body?.branch || cart?.branch || req.customer.preferredBranch;

//   if (!branchId) {
//     const live = await Branch.find({ isDeleted: { $ne: true }, status: "active" }).select("_id").limit(2).lean();
//     if (live.length === 1) branchId = live[0]._id;
//   }
//   if (!branchId) fail("Choose a store before starting group shopping", 400);

//   const branch = await Branch.findOne({ _id: branchId, isDeleted: { $ne: true }, status: "active" });
//   if (!branch) fail("That store isn't open for online orders", 404);

//   const session = await GroupSession.create({
//     key: await GroupSession.generateKey(),
//     branch: branch._id,
//     createdBy: req.customer._id,
//     members: [{ customer: req.customer._id, name: req.customer.name, isHost: true }],
//     expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
//   });

//   res.status(201).json({
//     success: true,
//     data: await buildSessionView(session, req.customer._id),
//     message: `Group ${session.key} created — share the pin with your family`,
//   });
// });

// // POST /api/woven-essence/group/join   { key }
// const joinSession = asyncHandler(async (req, res) => {
//   const raw = String(req.body?.key || "").trim().toUpperCase();

//   // Accept "482913", "wovenessence-482913" or the full pin — people will read it
//   // out loud and type it in every variation.
//   const digits = raw.match(/(\d{6})$/);
//   if (!digits) fail("That doesn't look like a group pin. It ends in 6 digits.", 400);
//   const key = `WOVENESSENCE-${digits[1]}`;

//   const session = await GroupSession.findOne({ key });
//   if (!session) fail("No group found with that pin", 404);
//   if (["ordered", "cancelled"].includes(session.status)) {
//     fail(`That group is already ${session.status}`, 409);
//   }

//   const already = session.members.find((m) => String(m.customer) === String(req.customer._id));
//   if (already && !already.leftAt) {
//     return res.json({
//       success: true,
//       data: await buildSessionView(session, req.customer._id),
//       message: "You're already in this group",
//     });
//   }

//   const other = await activeSessionFor(req.customer._id);
//   if (other && other.key !== key) fail(`Leave group ${other.key} before joining another`, 409);

//   if (session.activeMembers().length >= MAX_MEMBERS) {
//     fail(`This group is full (${MAX_MEMBERS} people)`, 409);
//   }

//   if (already) {
//     // Rejoining: clear the leave marker rather than adding a duplicate member.
//     already.leftAt = null;
//     already.joinedAt = new Date();
//     already.name = req.customer.name;
//   } else {
//     session.members.push({ customer: req.customer._id, name: req.customer.name, isHost: false });
//   }

//   await session.save();
//   res.json({
//     success: true,
//     data: await buildSessionView(session, req.customer._id),
//     message: `Joined ${session.key}`,
//   });
// });

// // GET /api/woven-essence/group/current
// const currentSession = asyncHandler(async (req, res) => {
//   const session = await activeSessionFor(req.customer._id);
//   if (!session) return res.json({ success: true, data: null });
//   res.json({ success: true, data: await buildSessionView(session, req.customer._id) });
// });

// // POST /api/woven-essence/group/items   { itemId, quantity? }
// const addLine = asyncHandler(async (req, res) => {
//   const session = await loadJoined(req.customer._id, { requireOpen: true });
//   const quantity = Math.min(Math.max(parseInt(req.body?.quantity, 10) || 1, 1), 20);

//   if (!/^[a-f\d]{24}$/i.test(String(req.body?.itemId || ""))) fail("Invalid product", 400);

//   const item = await Item.findOne({ _id: req.body.itemId, ...LIVE_ITEM }).select(
//     "branch inventory.currentStock pricing.sellingPrice identity.productName"
//   );
//   if (!item) fail("This saree isn't available to buy", 404);
//   if (item.pricing?.sellingPrice == null) fail("This saree is priced on request", 409);
//   if (String(item.branch) !== String(session.branch)) {
//     fail("This saree is from a different store than the group is shopping", 409);
//   }

//   const stock = item.inventory?.currentStock || 0;
//   if (stock <= 0) fail("This saree is sold out", 409);

//   // Stock is shared across the whole group, so count everyone's lines, not just
//   // the caller's — two members can't each claim the last piece.
//   const alreadyInGroup = session.lines
//     .filter((l) => String(l.item) === String(item._id))
//     .reduce((n, l) => n + l.quantity, 0);

//   if (alreadyInGroup + quantity > stock) {
//     fail(
//       alreadyInGroup > 0
//         ? `The group already has ${alreadyInGroup} of these and only ${stock} are in stock`
//         : `Only ${stock} of these are in stock`,
//       409
//     );
//   }

//   // One line per person per saree: two people each wanting one is two lines so
//   // the split stays right, but the same person adding twice just increments.
//   const mine = session.lines.find(
//     (l) => String(l.item) === String(item._id) && String(l.addedBy) === String(req.customer._id)
//   );
//   if (mine) mine.quantity = Math.min(mine.quantity + quantity, 20);
//   else {
//     session.lines.push({
//       item: item._id,
//       quantity,
//       addedBy: req.customer._id,
//       addedByName: req.customer.name,
//     });
//   }

//   await session.save();
//   res.status(201).json({ success: true, data: await buildSessionView(session, req.customer._id) });
// });

// // PATCH /api/woven-essence/group/items/:lineId   { quantity }
// const updateLine = asyncHandler(async (req, res) => {
//   const session = await loadJoined(req.customer._id, { requireOpen: true });
//   const line = session.lines.id(req.params.lineId);
//   if (!line) fail("That item isn't in the group cart", 404);

//   const canEdit = String(line.addedBy) === String(req.customer._id) || session.isHost(req.customer._id);
//   if (!canEdit) fail("Only the person who added this — or the group host — can change it", 403);

//   const quantity = parseInt(req.body?.quantity, 10);
//   if (!Number.isFinite(quantity) || quantity < 0 || quantity > 20) fail("Quantity must be 0-20", 400);

//   if (quantity === 0) {
//     line.deleteOne();
//   } else {
//     const item = await Item.findOne({ _id: line.item, ...LIVE_ITEM }).select("inventory.currentStock");
//     const stock = item?.inventory?.currentStock || 0;
//     const others = session.lines
//       .filter((l) => String(l.item) === String(line.item) && String(l._id) !== String(line._id))
//       .reduce((n, l) => n + l.quantity, 0);
//     if (others + quantity > stock) fail(`Only ${stock} in stock, and the group already has ${others}`, 409);
//     line.quantity = quantity;
//   }

//   await session.save();
//   res.json({ success: true, data: await buildSessionView(session, req.customer._id) });
// });

// // DELETE /api/woven-essence/group/items/:lineId
// const removeLine = asyncHandler(async (req, res) => {
//   const session = await loadJoined(req.customer._id, { requireOpen: true });
//   const line = session.lines.id(req.params.lineId);
//   if (!line) fail("That item isn't in the group cart", 404);

//   const canRemove = String(line.addedBy) === String(req.customer._id) || session.isHost(req.customer._id);
//   if (!canRemove) fail("Only the person who added this — or the group host — can remove it", 403);

//   line.deleteOne();
//   await session.save();
//   res.json({ success: true, data: await buildSessionView(session, req.customer._id) });
// });

// // POST /api/woven-essence/group/leave
// const leaveSession = asyncHandler(async (req, res) => {
//   const session = await loadJoined(req.customer._id);

//   if (session.orders.some((o) => String(o.customer) === String(req.customer._id))) {
//     fail("You've already paid for this group order, so you can't leave it", 409);
//   }

//   const me = session.activeMembers().find((m) => String(m.customer) === String(req.customer._id));
//   me.leftAt = new Date();

//   // Their lines leave with them — nobody should end up paying for a saree chosen
//   // by someone who has walked away.
//   session.lines = session.lines.filter((l) => String(l.addedBy) !== String(req.customer._id));

//   const remaining = session.activeMembers();
//   if (remaining.length === 0) {
//     session.status = "cancelled";
//   } else if (me.isHost) {
//     // Hand the group to the longest-standing remaining member.
//     remaining.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
//     remaining[0].isHost = true;
//   }

//   await session.save();
//   res.json({
//     success: true,
//     data: null,
//     message:
//       remaining.length === 0
//         ? "You left and the group closed"
//         : `You left ${session.key}. Rejoin any time with the same pin.`,
//   });
// });

// // POST /api/woven-essence/group/confirm   { paymentMode, shippingAddress }
// const confirmSession = asyncHandler(async (req, res) => {
//   const session = await loadJoined(req.customer._id, { requireOpen: true });
//   if (!session.isHost(req.customer._id)) fail("Only the group host can confirm the order", 403);
//   if (session.lines.length === 0) fail("The group cart is empty", 400);

//   const mode = req.body?.paymentMode;
//   if (!["together", "separate"].includes(mode)) {
//     fail("Choose whether the group pays together or separately", 400);
//   }

//   const a = req.body?.shippingAddress || {};
//   for (const field of ["fullName", "phone", "line1", "city", "state", "pincode"]) {
//     if (!String(a[field] || "").trim()) fail(`Delivery address: ${field} is required`, 400);
//   }

//   // Re-price now, so a group can't confirm something that has sold out while
//   // they were deciding.
//   await priceLines(
//     session.lines.map((l) => ({ item: l.item, quantity: l.quantity })),
//     { method: "razorpay" }
//   );

//   session.status = "confirmed";
//   session.paymentMode = mode;
//   session.shippingAddress = {
//     fullName: String(a.fullName).trim(),
//     phone: String(a.phone).trim(),
//     line1: String(a.line1).trim(),
//     line2: String(a.line2 || "").trim(),
//     landmark: String(a.landmark || "").trim(),
//     city: String(a.city).trim(),
//     state: String(a.state).trim(),
//     pincode: String(a.pincode).trim(),
//     country: String(a.country || "India").trim(),
//   };
//   session.confirmedAt = new Date();
//   await session.save();

//   res.json({
//     success: true,
//     data: await buildSessionView(session, req.customer._id),
//     message:
//       mode === "together"
//         ? "Confirmed — the host can now pay for the whole group"
//         : "Confirmed — everyone can now pay for their own items",
//   });
// });

// // POST /api/woven-essence/group/reopen
// const reopenSession = asyncHandler(async (req, res) => {
//   const session = await loadJoined(req.customer._id);
//   if (!session.isHost(req.customer._id)) fail("Only the group host can reopen the list", 403);
//   if (session.orders.length > 0) fail("Someone has already paid — the list can't be reopened", 409);

//   session.status = "open";
//   session.paymentMode = null;
//   session.confirmedAt = null;
//   await session.save();
//   res.json({ success: true, data: await buildSessionView(session, req.customer._id) });
// });

// /** The lines this customer is responsible for, given the payment mode. */
// function linesPayableBy(session, customerId) {
//   if (session.paymentMode === "together") return session.lines;
//   return session.lines.filter((l) => String(l.addedBy) === String(customerId));
// }

// async function buildGroupOrder({ session, customer, method, payableLines }) {
//   const priced = await priceLines(
//     payableLines.map((l) => ({ item: l.item, quantity: l.quantity })),
//     { method }
//   );

//   const branch = await Branch.findById(session.branch)
//     .select("branchName branchCode address gstNumber")
//     .lean();

//   const order = await Order.create({
//     orderNumber: await Order.generateOrderNumber(branch?.branchCode),
//     customer: customer._id,
//     customerName: customer.name,
//     customerEmail: customer.email,
//     customerPhone: customer.phone || session.shippingAddress?.phone || "",
//     branch: session.branch,
//     branchName: branch?.branchName || "",
//     branchCity: branch?.address?.city || "",
//     branchGst: branch?.gstNumber || "",
//     lines: priced.lines,
//     shippingAddress: session.shippingAddress,
//     billingAddress: session.shippingAddress,
//     amounts: priced.amounts,
//     payment: { method, status: method === "cod" ? "cod_pending" : "pending" },
//     status: method === "cod" ? "confirmed" : "pending_payment",
//     timeline: [
//       {
//         status: method === "cod" ? "confirmed" : "pending_payment",
//         at: new Date(),
//         by: "customer",
//         note:
//           `Group order ${session.key} — ` +
//           (session.paymentMode === "together" ? "paid for the whole group" : "paying for own items") +
//           (method === "cod" ? " — cash on delivery" : ""),
//       },
//     ],
//     groupKey: session.key,
//   });

//   return { order, priced };
// }

// /** Marks the session ordered once everyone who owes something has paid. */
// async function settleSession(session) {
//   const payersNeeded =
//     session.paymentMode === "together" ? 1 : new Set(session.lines.map((l) => String(l.addedBy))).size;

//   if (session.orders.length >= payersNeeded) {
//     session.status = "ordered";
//     session.orderedAt = new Date();
//   }
//   await session.save();
// }

// // POST /api/woven-essence/group/pay   { paymentMethod }
// const payShare = asyncHandler(async (req, res) => {
//   const session = await memberSessionAnyStatus(req.customer._id);
//   if (!session) fail("You're not in a group shopping session", 404);

//   // Checked before the status guard so someone who has already paid is told so,
//   // rather than being told the (now completed) group doesn't exist.
//   if (session.orders.some((o) => String(o.customer) === String(req.customer._id))) {
//     fail("You've already paid for this group order", 409);
//   }
//   if (session.status === "ordered") fail("This group order is already fully paid", 409);
//   if (session.status !== "confirmed") fail("The host needs to confirm the group order first", 409);

//   const method = req.body?.paymentMethod === "cod" ? "cod" : "razorpay";

//   if (session.paymentMode === "together" && !session.isHost(req.customer._id)) {
//     fail("This group is paying together — the host settles the whole order", 403);
//   }

//   const payableLines = linesPayableBy(session, req.customer._id);
//   if (payableLines.length === 0) fail("You haven't added anything to the group cart", 400);

//   const { order, priced } = await buildGroupOrder({ session, customer: req.customer, method, payableLines });

//   if (method === "cod") {
//     await reserveStock(order);
//     session.orders.push({
//       customer: req.customer._id,
//       order: order._id,
//       orderNumber: order.orderNumber,
//       amount: priced.amounts.grandTotal,
//     });
//     await settleSession(session);

//     return res.status(201).json({
//       success: true,
//       data: { order: publicOrder(order), session: await buildSessionView(session, req.customer._id) },
//       message: `Order ${order.orderNumber} placed — pay on delivery`,
//     });
//   }

//   const rp = await razorpay.createOrder({
//     amountInRupees: priced.amounts.grandTotal,
//     receipt: order.orderNumber,
//     notes: { orderNumber: order.orderNumber, groupKey: session.key },
//   });

//   order.payment.razorpayOrderId = rp.id;
//   await order.save();

//   res.status(201).json({
//     success: true,
//     data: {
//       order: publicOrder(order),
//       razorpay: { orderId: rp.id, amount: rp.amount, currency: rp.currency, keyId: razorpay.publicKeyId() },
//     },
//   });
// });

// // POST /api/woven-essence/group/pay/verify
// const verifyGroupPayment = asyncHandler(async (req, res) => {
//   const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};

//   const order = await Order.findOne({
//     "payment.razorpayOrderId": razorpayOrderId,
//     customer: req.customer._id,
//   });
//   if (!order) fail("That payment doesn't match any of your orders", 404);

//   // Replays are harmless rather than double-counting.
//   if (order.payment.status === "paid") {
//     return res.json({ success: true, data: { order: publicOrder(order) }, message: "Already confirmed" });
//   }

//   const valid = razorpay.verifyPaymentSignature({
//     orderId: razorpayOrderId,
//     paymentId: razorpayPaymentId,
//     signature: razorpaySignature,
//   });
//   if (!valid) {
//     order.payment.status = "failed";
//     order.payment.failureReason = "Signature verification failed";
//     await order.save();
//     fail("We couldn't verify that payment", 400);
//   }

//   order.payment.status = "paid";
//   order.payment.razorpayPaymentId = razorpayPaymentId;
//   order.payment.razorpaySignature = razorpaySignature;
//   order.payment.paidAt = new Date();
//   order.status = "confirmed";
//   order.timeline.push({ status: "confirmed", at: new Date(), by: "payment", note: "Group payment received" });
//   await reserveStock(order);
//   await order.save();

//   const session = await GroupSession.findOne({ key: order.groupKey });
//   if (session && !session.orders.some((o) => String(o.order) === String(order._id))) {
//     session.orders.push({
//       customer: req.customer._id,
//       order: order._id,
//       orderNumber: order.orderNumber,
//       amount: order.amounts.grandTotal,
//     });
//     await settleSession(session);
//   }

//   res.json({
//     success: true,
//     data: {
//       order: publicOrder(order),
//       session: session ? await buildSessionView(session, req.customer._id) : null,
//     },
//     message: `Payment received for ${order.orderNumber}`,
//   });
// });

// /**
//  * GET /api/woven-essence/group/orders/:key
//  *
//  * Every order in a group, visible to anyone who was in it — the brief's rule
//  * that all members see the delivery address and the delivery status, even for
//  * the parts somebody else paid for.
//  */
// const groupOrders = asyncHandler(async (req, res) => {
//   const key = String(req.params.key || "").toUpperCase();

//   const session = await GroupSession.findOne({
//     key,
//     members: { $elemMatch: { customer: req.customer._id } },
//   });
//   if (!session) fail("You weren't part of that group", 404);

//   const orders = await Order.find({ groupKey: key })
//     .select("orderNumber status customer customerName amounts.grandTotal shipment lines payment createdAt")
//     .sort("createdAt")
//     .lean();

//   res.json({
//     success: true,
//     data: {
//       key,
//       status: session.status,
//       paymentMode: session.paymentMode,
//       shippingAddress: session.shippingAddress || null,
//       orders: orders.map((o) => ({
//         orderNumber: o.orderNumber,
//         status: o.status,
//         paidBy: o.customerName,
//         isYours: String(o.customer) === String(req.customer._id),
//         total: o.amounts?.grandTotal ?? 0,
//         itemCount: (o.lines || []).reduce((n, l) => n + (l.quantity || 0), 0),
//         paymentStatus: o.payment?.status || null,
//         courier: o.shipment?.courierName || null,
//         awbCode: o.shipment?.awbCode || null,
//         trackingUrl: o.shipment?.trackingUrl || null,
//         placedAt: o.createdAt,
//       })),
//     },
//   });
// });

// module.exports = {
//   createSession,
//   joinSession,
//   currentSession,
//   addLine,
//   updateLine,
//   removeLine,
//   leaveSession,
//   confirmSession,
//   reopenSession,
//   payShare,
//   verifyGroupPayment,
//   groupOrders,
// };










const asyncHandler = require("express-async-handler");
const GroupSession = require("../models/GroupSession");
const Order = require("../models/Order");
const Item = require("../models/Item");
const Branch = require("../models/Branch");
const Cart = require("../models/Cart");
const { priceLines, reserveStock, publicOrder } = require("./checkoutController");
const razorpay = require("../services/razorpayService");
const email = require("../services/emailService");

/**
 * Group shopping.
 *
 * Several shoppers share a pin and fill one cart together, then settle up either
 * as a single payment or one payment each. Orders raised here are ordinary
 * Orders carrying the session's `groupKey`, which is what lets every member see
 * the same delivery address and the same delivery status without owning the
 * order.
 *
 * Named groupShoppingController rather than groupController because the latter
 * already belongs to product Groups in the catalogue hierarchy.
 */

const LIVE_ITEM = {
  isDeleted: { $ne: true },
  status: "active",
  lifecycleStage: "published",
  "visibility.onlineSaleEnabled": { $ne: false },
};

const SESSION_DAYS = 7;
const MAX_MEMBERS = 12;

function fail(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

async function activeSessionFor(customerId) {
  return GroupSession.findOne({
    status: { $in: ["open", "confirmed"] },
    members: { $elemMatch: { customer: customerId, leftAt: null } },
  });
}

/**
 * Membership lookup that also matches a finished session, so a member revisiting
 * a completed group gets an accurate message instead of "you're not in a group".
 */
async function memberSessionAnyStatus(customerId) {
  return GroupSession.findOne({
    status: { $in: ["open", "confirmed", "ordered"] },
    members: { $elemMatch: { customer: customerId, leftAt: null } },
  }).sort({ updatedAt: -1 });
}

async function loadJoined(customerId, { requireOpen = false } = {}) {
  const session = await activeSessionFor(customerId);
  if (!session) fail("You're not in a group shopping session", 404);
  if (requireOpen && session.status !== "open") {
    fail("This group is already confirmed — the list can't be changed now", 409);
  }
  return session;
}

/**
 * Prices the group cart and splits it per member.
 *
 * Uses the same pricer as solo checkout, so a saree costs the same however it is
 * bought. The split is by who added each line, which is what makes "pay
 * separately" meaningful.
 */
async function buildSessionView(session, viewerId) {
  const branch = await Branch.findById(session.branch).select("branchName branchCode address.city").lean();

  let priced = { lines: [], amounts: null };
  let issue = null;

  if (session.lines.length > 0) {
    try {
      priced = await priceLines(
        session.lines.map((l) => ({ item: l.item, quantity: l.quantity })),
        { method: "razorpay" }
      );
    } catch (err) {
      // A sold-out saree must not stop the whole group page from loading.
      issue = err.message;
    }
  }

  const pricedByItem = new Map((priced.lines || []).map((l) => [String(l.item), l]));

  const lines = session.lines.map((l) => {
    const p = pricedByItem.get(String(l.item));
    return {
      lineId: l._id,
      itemId: l.item,
      quantity: l.quantity,
      addedBy: l.addedBy,
      addedByName: l.addedByName,
      addedByYou: String(l.addedBy) === String(viewerId),
      addedAt: l.addedAt,
      name: p?.productName || null,
      itemCode: p?.itemCode || "",
      slug: p?.slug || "",
      imageUrl: p?.imageUrl || "",
      unitPrice: p?.unitPrice ?? null,
      lineSubtotal: p?.lineSubtotal ?? null,
      available: !!p,
    };
  });

  const perMember = session.activeMembers().map((m) => {
    const mine = lines.filter((l) => String(l.addedBy) === String(m.customer) && l.available);
    return {
      customer: m.customer,
      name: m.name,
      isHost: m.isHost,
      isYou: String(m.customer) === String(viewerId),
      joinedAt: m.joinedAt,
      itemCount: mine.reduce((n, l) => n + l.quantity, 0),
      subtotal: Math.round(mine.reduce((sum, l) => sum + (l.lineSubtotal || 0), 0) * 100) / 100,
    };
  });

  const paidBy = new Set(session.orders.map((o) => String(o.customer)));

  return {
    key: session.key,
    status: session.status,
    paymentMode: session.paymentMode,
    branch: branch ? { id: branch._id, name: branch.branchName, city: branch.address?.city || "" } : null,
    youAreHost: session.isHost(viewerId),
    memberCount: session.activeMembers().length,
    members: perMember.map((m) => ({ ...m, hasPaid: paidBy.has(String(m.customer)) })),
    lines,
    amounts: priced.amounts || null,
    issue,
    shippingAddress: session.status === "open" ? null : session.shippingAddress || null,
    orders: session.orders.map((o) => ({
      customer: o.customer,
      orderNumber: o.orderNumber,
      amount: o.amount,
      isYours: String(o.customer) === String(viewerId),
    })),
    yourShare: perMember.find((m) => m.isYou)?.subtotal ?? 0,
    youHavePaid: paidBy.has(String(viewerId)),
    expiresAt: session.expiresAt,
  };
}

// POST /api/woven-essence/group
const createSession = asyncHandler(async (req, res) => {
  const existing = await activeSessionFor(req.customer._id);
  if (existing) {
    return res.json({
      success: true,
      data: await buildSessionView(existing, req.customer._id),
      message: `You're already in group ${existing.key}`,
    });
  }

  // The group shops one store: the customer's cart branch, else their preferred
  // store, else the only live branch if there happens to be just one.
  const cart = await Cart.findOne({ customer: req.customer._id });
  let branchId = req.body?.branch || cart?.branch || req.customer.preferredBranch;

  if (!branchId) {
    const live = await Branch.find({ isDeleted: { $ne: true }, status: "active" }).select("_id").limit(2).lean();
    if (live.length === 1) branchId = live[0]._id;
  }
  if (!branchId) fail("Choose a store before starting group shopping", 400);

  const branch = await Branch.findOne({ _id: branchId, isDeleted: { $ne: true }, status: "active" });
  if (!branch) fail("That store isn't open for online orders", 404);

  const session = await GroupSession.create({
    key: await GroupSession.generateKey(),
    branch: branch._id,
    createdBy: req.customer._id,
    members: [{ customer: req.customer._id, name: req.customer.name, isHost: true }],
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
  });

  res.status(201).json({
    success: true,
    data: await buildSessionView(session, req.customer._id),
    message: `Group ${session.key} created — share the pin with your family`,
  });
});

// POST /api/woven-essence/group/join   { key }
const joinSession = asyncHandler(async (req, res) => {
  const raw = String(req.body?.key || "").trim().toUpperCase();

  // Accept "482913", "wovenessence-482913" or the full pin — people will read it
  // out loud and type it in every variation.
  const digits = raw.match(/(\d{6})$/);
  if (!digits) fail("That doesn't look like a group pin. It ends in 6 digits.", 400);
  const key = `WOVENESSENCE-${digits[1]}`;

  const session = await GroupSession.findOne({ key });
  if (!session) fail("No group found with that pin", 404);
  if (["ordered", "cancelled"].includes(session.status)) {
    fail(`That group is already ${session.status}`, 409);
  }

  const already = session.members.find((m) => String(m.customer) === String(req.customer._id));
  if (already && !already.leftAt) {
    return res.json({
      success: true,
      data: await buildSessionView(session, req.customer._id),
      message: "You're already in this group",
    });
  }

  const other = await activeSessionFor(req.customer._id);
  if (other && other.key !== key) fail(`Leave group ${other.key} before joining another`, 409);

  if (session.activeMembers().length >= MAX_MEMBERS) {
    fail(`This group is full (${MAX_MEMBERS} people)`, 409);
  }

  if (already) {
    // Rejoining: clear the leave marker rather than adding a duplicate member.
    already.leftAt = null;
    already.joinedAt = new Date();
    already.name = req.customer.name;
  } else {
    session.members.push({ customer: req.customer._id, name: req.customer.name, isHost: false });
  }

  await session.save();
  res.json({
    success: true,
    data: await buildSessionView(session, req.customer._id),
    message: `Joined ${session.key}`,
  });
});

// GET /api/woven-essence/group/current
const currentSession = asyncHandler(async (req, res) => {
  const session = await activeSessionFor(req.customer._id);
  if (!session) return res.json({ success: true, data: null });
  res.json({ success: true, data: await buildSessionView(session, req.customer._id) });
});

// POST /api/woven-essence/group/items   { itemId, quantity? }
const addLine = asyncHandler(async (req, res) => {
  const session = await loadJoined(req.customer._id, { requireOpen: true });
  const quantity = Math.min(Math.max(parseInt(req.body?.quantity, 10) || 1, 1), 20);

  if (!/^[a-f\d]{24}$/i.test(String(req.body?.itemId || ""))) fail("Invalid product", 400);

  const item = await Item.findOne({ _id: req.body.itemId, ...LIVE_ITEM }).select(
    "branch inventory.currentStock pricing.sellingPrice identity.productName"
  );
  if (!item) fail("This saree isn't available to buy", 404);
  if (item.pricing?.sellingPrice == null) fail("This saree is priced on request", 409);
  if (String(item.branch) !== String(session.branch)) {
    fail("This saree is from a different store than the group is shopping", 409);
  }

  const stock = item.inventory?.currentStock || 0;
  if (stock <= 0) fail("This saree is sold out", 409);

  // Stock is shared across the whole group, so count everyone's lines, not just
  // the caller's — two members can't each claim the last piece.
  const alreadyInGroup = session.lines
    .filter((l) => String(l.item) === String(item._id))
    .reduce((n, l) => n + l.quantity, 0);

  if (alreadyInGroup + quantity > stock) {
    fail(
      alreadyInGroup > 0
        ? `The group already has ${alreadyInGroup} of these and only ${stock} are in stock`
        : `Only ${stock} of these are in stock`,
      409
    );
  }

  // One line per person per saree: two people each wanting one is two lines so
  // the split stays right, but the same person adding twice just increments.
  const mine = session.lines.find(
    (l) => String(l.item) === String(item._id) && String(l.addedBy) === String(req.customer._id)
  );
  if (mine) mine.quantity = Math.min(mine.quantity + quantity, 20);
  else {
    session.lines.push({
      item: item._id,
      quantity,
      addedBy: req.customer._id,
      addedByName: req.customer.name,
    });
  }

  await session.save();
  res.status(201).json({ success: true, data: await buildSessionView(session, req.customer._id) });
});

// PATCH /api/woven-essence/group/items/:lineId   { quantity }
const updateLine = asyncHandler(async (req, res) => {
  const session = await loadJoined(req.customer._id, { requireOpen: true });
  const line = session.lines.id(req.params.lineId);
  if (!line) fail("That item isn't in the group cart", 404);

  const canEdit = String(line.addedBy) === String(req.customer._id) || session.isHost(req.customer._id);
  if (!canEdit) fail("Only the person who added this — or the group host — can change it", 403);

  const quantity = parseInt(req.body?.quantity, 10);
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 20) fail("Quantity must be 0-20", 400);

  if (quantity === 0) {
    line.deleteOne();
  } else {
    const item = await Item.findOne({ _id: line.item, ...LIVE_ITEM }).select("inventory.currentStock");
    const stock = item?.inventory?.currentStock || 0;
    const others = session.lines
      .filter((l) => String(l.item) === String(line.item) && String(l._id) !== String(line._id))
      .reduce((n, l) => n + l.quantity, 0);
    if (others + quantity > stock) fail(`Only ${stock} in stock, and the group already has ${others}`, 409);
    line.quantity = quantity;
  }

  await session.save();
  res.json({ success: true, data: await buildSessionView(session, req.customer._id) });
});

// DELETE /api/woven-essence/group/items/:lineId
const removeLine = asyncHandler(async (req, res) => {
  const session = await loadJoined(req.customer._id, { requireOpen: true });
  const line = session.lines.id(req.params.lineId);
  if (!line) fail("That item isn't in the group cart", 404);

  const canRemove = String(line.addedBy) === String(req.customer._id) || session.isHost(req.customer._id);
  if (!canRemove) fail("Only the person who added this — or the group host — can remove it", 403);

  line.deleteOne();
  await session.save();
  res.json({ success: true, data: await buildSessionView(session, req.customer._id) });
});

// POST /api/woven-essence/group/leave
const leaveSession = asyncHandler(async (req, res) => {
  const session = await loadJoined(req.customer._id);

  if (session.orders.some((o) => String(o.customer) === String(req.customer._id))) {
    fail("You've already paid for this group order, so you can't leave it", 409);
  }

  const me = session.activeMembers().find((m) => String(m.customer) === String(req.customer._id));
  me.leftAt = new Date();

  // Their lines leave with them — nobody should end up paying for a saree chosen
  // by someone who has walked away.
  session.lines = session.lines.filter((l) => String(l.addedBy) !== String(req.customer._id));

  const remaining = session.activeMembers();
  if (remaining.length === 0) {
    session.status = "cancelled";
  } else if (me.isHost) {
    // Hand the group to the longest-standing remaining member.
    remaining.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
    remaining[0].isHost = true;
  }

  await session.save();
  res.json({
    success: true,
    data: null,
    message:
      remaining.length === 0
        ? "You left and the group closed"
        : `You left ${session.key}. Rejoin any time with the same pin.`,
  });
});

// POST /api/woven-essence/group/confirm   { paymentMode, shippingAddress }
const confirmSession = asyncHandler(async (req, res) => {
  const session = await loadJoined(req.customer._id, { requireOpen: true });
  if (!session.isHost(req.customer._id)) fail("Only the group host can confirm the order", 403);
  if (session.lines.length === 0) fail("The group cart is empty", 400);

  const mode = req.body?.paymentMode;
  if (!["together", "separate"].includes(mode)) {
    fail("Choose whether the group pays together or separately", 400);
  }

  const a = req.body?.shippingAddress || {};
  for (const field of ["fullName", "phone", "line1", "city", "state", "pincode"]) {
    if (!String(a[field] || "").trim()) fail(`Delivery address: ${field} is required`, 400);
  }

  // Re-price now, so a group can't confirm something that has sold out while
  // they were deciding.
  await priceLines(
    session.lines.map((l) => ({ item: l.item, quantity: l.quantity })),
    { method: "razorpay" }
  );

  session.status = "confirmed";
  session.paymentMode = mode;
  session.shippingAddress = {
    fullName: String(a.fullName).trim(),
    phone: String(a.phone).trim(),
    line1: String(a.line1).trim(),
    line2: String(a.line2 || "").trim(),
    landmark: String(a.landmark || "").trim(),
    city: String(a.city).trim(),
    state: String(a.state).trim(),
    pincode: String(a.pincode).trim(),
    country: String(a.country || "India").trim(),
  };
  session.confirmedAt = new Date();
  await session.save();

  res.json({
    success: true,
    data: await buildSessionView(session, req.customer._id),
    message:
      mode === "together"
        ? "Confirmed — the host can now pay for the whole group"
        : "Confirmed — everyone can now pay for their own items",
  });
});

// POST /api/woven-essence/group/reopen
const reopenSession = asyncHandler(async (req, res) => {
  const session = await loadJoined(req.customer._id);
  if (!session.isHost(req.customer._id)) fail("Only the group host can reopen the list", 403);
  if (session.orders.length > 0) fail("Someone has already paid — the list can't be reopened", 409);

  session.status = "open";
  session.paymentMode = null;
  session.confirmedAt = null;
  await session.save();
  res.json({ success: true, data: await buildSessionView(session, req.customer._id) });
});

/** The lines this customer is responsible for, given the payment mode. */
function linesPayableBy(session, customerId) {
  if (session.paymentMode === "together") return session.lines;
  return session.lines.filter((l) => String(l.addedBy) === String(customerId));
}

async function buildGroupOrder({ session, customer, method, payableLines }) {
  const priced = await priceLines(
    payableLines.map((l) => ({ item: l.item, quantity: l.quantity })),
    { method }
  );

  const branch = await Branch.findById(session.branch)
    .select("branchName branchCode address gstNumber")
    .lean();

  const order = await Order.create({
    orderNumber: await Order.generateOrderNumber(branch?.branchCode),
    customer: customer._id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone || session.shippingAddress?.phone || "",
    branch: session.branch,
    branchName: branch?.branchName || "",
    branchCity: branch?.address?.city || "",
    branchGst: branch?.gstNumber || "",
    lines: priced.lines,
    shippingAddress: session.shippingAddress,
    billingAddress: session.shippingAddress,
    amounts: priced.amounts,
    payment: { method, status: method === "cod" ? "cod_pending" : "pending" },
    status: method === "cod" ? "confirmed" : "pending_payment",
    timeline: [
      {
        status: method === "cod" ? "confirmed" : "pending_payment",
        at: new Date(),
        by: "customer",
        note:
          `Group order ${session.key} — ` +
          (session.paymentMode === "together" ? "paid for the whole group" : "paying for own items") +
          (method === "cod" ? " — cash on delivery" : ""),
      },
    ],
    groupKey: session.key,
    // A group shops one store, so this is a single row — but the admin's pick
    // list and the branch-scoped order queue both read sourceBranches, and an
    // empty array would make group orders the odd ones out.
    sourceBranches: branch
      ? [
          {
            branch: branch._id,
            branchName: branch.branchName || "",
            branchCity: branch.address?.city || "",
            itemCount: priced.lines.reduce((n, l) => n + l.quantity, 0),
            subtotal: priced.amounts.subtotal,
            collected: false,
          },
        ]
      : [],
  });

  return { order, priced };
}

/** Marks the session ordered once everyone who owes something has paid. */
async function settleSession(session) {
  const payersNeeded =
    session.paymentMode === "together" ? 1 : new Set(session.lines.map((l) => String(l.addedBy))).size;

  if (session.orders.length >= payersNeeded) {
    session.status = "ordered";
    session.orderedAt = new Date();
  }
  await session.save();
}

// POST /api/woven-essence/group/pay   { paymentMethod }
const payShare = asyncHandler(async (req, res) => {
  const session = await memberSessionAnyStatus(req.customer._id);
  if (!session) fail("You're not in a group shopping session", 404);

  // Checked before the status guard so someone who has already paid is told so,
  // rather than being told the (now completed) group doesn't exist.
  if (session.orders.some((o) => String(o.customer) === String(req.customer._id))) {
    fail("You've already paid for this group order", 409);
  }
  if (session.status === "ordered") fail("This group order is already fully paid", 409);
  if (session.status !== "confirmed") fail("The host needs to confirm the group order first", 409);

  const method = req.body?.paymentMethod === "cod" ? "cod" : "razorpay";

  if (session.paymentMode === "together" && !session.isHost(req.customer._id)) {
    fail("This group is paying together — the host settles the whole order", 403);
  }

  const payableLines = linesPayableBy(session, req.customer._id);
  if (payableLines.length === 0) fail("You haven't added anything to the group cart", 400);

  const { order, priced } = await buildGroupOrder({ session, customer: req.customer, method, payableLines });

  if (method === "cod") {
    await reserveStock(order);
    email.sendOrderPlaced(order, true).catch(() => {});
    session.orders.push({
      customer: req.customer._id,
      order: order._id,
      orderNumber: order.orderNumber,
      amount: priced.amounts.grandTotal,
    });
    await settleSession(session);

    return res.status(201).json({
      success: true,
      data: { order: publicOrder(order), session: await buildSessionView(session, req.customer._id) },
      message: `Order ${order.orderNumber} placed — pay on delivery`,
    });
  }

  const rp = await razorpay.createOrder({
    amountInRupees: priced.amounts.grandTotal,
    receipt: order.orderNumber,
    notes: { orderNumber: order.orderNumber, groupKey: session.key },
  });

  order.payment.razorpayOrderId = rp.id;
  await order.save();

  res.status(201).json({
    success: true,
    data: {
      order: publicOrder(order),
      razorpay: { orderId: rp.id, amount: rp.amount, currency: rp.currency, keyId: razorpay.publicKeyId() },
    },
  });
});

// POST /api/woven-essence/group/pay/verify
const verifyGroupPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};

  const order = await Order.findOne({
    "payment.razorpayOrderId": razorpayOrderId,
    customer: req.customer._id,
  });
  if (!order) fail("That payment doesn't match any of your orders", 404);

  // Replays are harmless rather than double-counting.
  if (order.payment.status === "paid") {
    return res.json({ success: true, data: { order: publicOrder(order) }, message: "Already confirmed" });
  }

  // The key names MUST match razorpayService's parameters exactly. They didn't
  // before — orderId/paymentId instead of razorpayOrderId/razorpayPaymentId —
  // so every genuine online group payment verified as false and was marked
  // failed after the shopper had been charged.
  const valid = razorpay.verifyPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId,
    signature: razorpaySignature,
  });
  if (!valid) {
    order.payment.status = "failed";
    order.payment.failureReason = "Signature verification failed";
    await order.save();
    fail("We couldn't verify that payment. You have not been charged for this order.", 400);
  }

  // Stock BEFORE marking paid, matching solo checkout. The old order did the
  // opposite: it set payment.status = "paid" in memory, then called
  // reserveStock(), then saved — so a saree selling out mid-payment threw and
  // the save never ran, losing the paid state entirely on a real payment.
  await reserveStock(order);

  order.payment.status = "paid";
  order.payment.razorpayPaymentId = razorpayPaymentId;
  order.payment.razorpaySignature = razorpaySignature;
  order.payment.paidAt = new Date();
  order.status = "confirmed";
  order.timeline.push({ status: "confirmed", at: new Date(), by: "payment", note: "Group payment received" });
  // Same as solo checkout: issue the invoice number now, and confirm by email.
  // Group orders previously did neither, so a shopper who paid in a group got
  // no confirmation and no invoice number until the order reached "delivered".
  order.ensureInvoiceNumber();
  await order.save();
  email.sendOrderPlaced(order, false).catch(() => {});

  const session = await GroupSession.findOne({ key: order.groupKey });
  if (session && !session.orders.some((o) => String(o.order) === String(order._id))) {
    session.orders.push({
      customer: req.customer._id,
      order: order._id,
      orderNumber: order.orderNumber,
      amount: order.amounts.grandTotal,
    });
    await settleSession(session);
  }

  res.json({
    success: true,
    data: {
      order: publicOrder(order),
      session: session ? await buildSessionView(session, req.customer._id) : null,
    },
    message: `Payment received for ${order.orderNumber}`,
  });
});

/**
 * GET /api/woven-essence/group/orders/:key
 *
 * Every order in a group, visible to anyone who was in it — the brief's rule
 * that all members see the delivery address and the delivery status, even for
 * the parts somebody else paid for.
 */
const groupOrders = asyncHandler(async (req, res) => {
  const key = String(req.params.key || "").toUpperCase();

  const session = await GroupSession.findOne({
    key,
    members: { $elemMatch: { customer: req.customer._id } },
  });
  if (!session) fail("You weren't part of that group", 404);

  const orders = await Order.find({ groupKey: key })
    .select("orderNumber status customer customerName amounts.grandTotal shipment lines payment createdAt")
    .sort("createdAt")
    .lean();

  res.json({
    success: true,
    data: {
      key,
      status: session.status,
      paymentMode: session.paymentMode,
      shippingAddress: session.shippingAddress || null,
      orders: orders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        paidBy: o.customerName,
        isYours: String(o.customer) === String(req.customer._id),
        total: o.amounts?.grandTotal ?? 0,
        itemCount: (o.lines || []).reduce((n, l) => n + (l.quantity || 0), 0),
        paymentStatus: o.payment?.status || null,
        courier: o.shipment?.courierName || null,
        awbCode: o.shipment?.awbCode || null,
        trackingUrl: o.shipment?.trackingUrl || null,
        placedAt: o.createdAt,
      })),
    },
  });
});

module.exports = {
  createSession,
  joinSession,
  currentSession,
  addLine,
  updateLine,
  removeLine,
  leaveSession,
  confirmSession,
  reopenSession,
  payShare,
  verifyGroupPayment,
  groupOrders,
};