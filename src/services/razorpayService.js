// const crypto = require("crypto");

// /**
//  * Razorpay integration.
//  *
//  * Uses the REST API over Node's built-in fetch, so no extra dependency. Two
//  * halves matter here and they behave differently:
//  *
//  *  - Creating an order needs network + keys.
//  *  - VERIFYING a payment is pure local crypto (HMAC-SHA256 of
//  *    "{razorpay_order_id}|{razorpay_payment_id}" with the key secret). That check
//  *    is what stops a client from claiming a payment that never happened, so it
//  *    must never be skipped, and never done client-side.
//  */

// const API = "https://api.razorpay.com/v1";

// function credentials() {
//   const keyId = process.env.RAZORPAY_KEY_ID;
//   const keySecret = process.env.RAZORPAY_KEY_SECRET;
//   return { keyId, keySecret, configured: Boolean(keyId && keySecret) };
// }

// function isConfigured() {
//   return credentials().configured;
// }

// function authHeader() {
//   const { keyId, keySecret } = credentials();
//   return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
// }

// /**
//  * Creates a Razorpay order. Amount is rupees here and converted to paise —
//  * Razorpay works in the smallest currency unit, and getting this wrong bills the
//  * customer 100x.
//  */
// async function createOrder({ amountInRupees, currency = "INR", receipt, notes = {} }) {
//   const { configured } = credentials();
//   if (!configured) {
//     const err = new Error(
//       "Online payment isn't configured yet. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or pay on delivery."
//     );
//     err.statusCode = 503;
//     throw err;
//   }

//   const amount = Math.round(Number(amountInRupees) * 100);
//   if (!Number.isFinite(amount) || amount <= 0) {
//     const err = new Error("Invalid payment amount");
//     err.statusCode = 400;
//     throw err;
//   }

//   const res = await fetch(`${API}/orders`, {
//     method: "POST",
//     headers: { Authorization: authHeader(), "Content-Type": "application/json" },
//     body: JSON.stringify({ amount, currency, receipt, notes, payment_capture: 1 }),
//   });

//   const body = await res.json().catch(() => ({}));
//   if (!res.ok) {
//     const err = new Error(body?.error?.description || "Razorpay rejected the payment request");
//     err.statusCode = 502;
//     throw err;
//   }
//   return body;
// }

// /**
//  * Verifies the signature the browser returns after a successful checkout.
//  * timingSafeEqual so the comparison can't be probed byte by byte.
//  */
// function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature }) {
//   const { keySecret, configured } = credentials();
//   if (!configured || !razorpayOrderId || !razorpayPaymentId || !signature) return false;

//   const expected = crypto
//     .createHmac("sha256", keySecret)
//     .update(`${razorpayOrderId}|${razorpayPaymentId}`)
//     .digest("hex");

//   const a = Buffer.from(expected, "utf8");
//   const b = Buffer.from(String(signature), "utf8");
//   if (a.length !== b.length) return false;
//   return crypto.timingSafeEqual(a, b);
// }

// /** Verifies a webhook body against RAZORPAY_WEBHOOK_SECRET. */
// function verifyWebhookSignature(rawBody, signature) {
//   const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
//   if (!secret || !signature) return false;
//   const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
//   const a = Buffer.from(expected, "utf8");
//   const b = Buffer.from(String(signature), "utf8");
//   if (a.length !== b.length) return false;
//   return crypto.timingSafeEqual(a, b);
// }

// /** Confirms with Razorpay directly that a payment is captured. */
// async function fetchPayment(paymentId) {
//   if (!isConfigured()) return null;
//   const res = await fetch(`${API}/payments/${paymentId}`, { headers: { Authorization: authHeader() } });
//   if (!res.ok) return null;
//   return res.json().catch(() => null);
// }

// module.exports = {
//   isConfigured,
//   publicKeyId: () => credentials().keyId || null,
//   createOrder,
//   verifyPaymentSignature,
//   verifyWebhookSignature,
//   fetchPayment,
// };







const crypto = require("crypto");

/**
 * Razorpay integration.
 *
 * Uses the REST API over Node's built-in fetch, so no extra dependency. Two
 * halves matter here and they behave differently:
 *
 *  - Creating an order needs network + keys.
 *  - VERIFYING a payment is pure local crypto (HMAC-SHA256 of
 *    "{razorpay_order_id}|{razorpay_payment_id}" with the key secret). That check
 *    is what stops a client from claiming a payment that never happened, so it
 *    must never be skipped, and never done client-side.
 */

const API = "https://api.razorpay.com/v1";

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return { keyId, keySecret, configured: Boolean(keyId && keySecret) };
}

function isConfigured() {
  return credentials().configured;
}

function authHeader() {
  const { keyId, keySecret } = credentials();
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

/**
 * Creates a Razorpay order. Amount is rupees here and converted to paise —
 * Razorpay works in the smallest currency unit, and getting this wrong bills the
 * customer 100x.
 */
async function createOrder({ amountInRupees, currency = "INR", receipt, notes = {} }) {
  const { configured } = credentials();
  if (!configured) {
    const err = new Error(
      "Online payment isn't configured yet. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or pay on delivery."
    );
    err.statusCode = 503;
    throw err;
  }

  const amount = Math.round(Number(amountInRupees) * 100);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error("Invalid payment amount");
    err.statusCode = 400;
    throw err;
  }

  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency, receipt, notes, payment_capture: 1 }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.description || "Razorpay rejected the payment request");
    err.statusCode = 502;
    throw err;
  }
  return body;
}

/**
 * Verifies the signature the browser returns after a successful checkout.
 * timingSafeEqual so the comparison can't be probed byte by byte.
 */
function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature }) {
  const { keySecret, configured } = credentials();

  // A caller that passes the wrong key names gets undefined here, and a silent
  // `return false` then looks exactly like a forged signature — which is how a
  // real bug hid for weeks, failing genuine group payments after the customer
  // had already been charged. Missing values are still refused, but loudly, so
  // a miswired call site is visible in the log instead of masquerading as fraud.
  const missing = [
    !razorpayOrderId && "razorpayOrderId",
    !razorpayPaymentId && "razorpayPaymentId",
    !signature && "signature",
  ].filter(Boolean);

  if (missing.length) {
    console.error(
      `[razorpay] verifyPaymentSignature called without ${missing.join(", ")} — ` +
        "refusing the payment. Check the calling code's argument names."
    );
    return false;
  }
  if (!configured) {
    console.error("[razorpay] verifyPaymentSignature called with no keys configured — refusing.");
    return false;
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Verifies a webhook body against RAZORPAY_WEBHOOK_SECRET. */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Confirms with Razorpay directly that a payment is captured. */
async function fetchPayment(paymentId) {
  if (!isConfigured()) return null;
  const res = await fetch(`${API}/payments/${paymentId}`, { headers: { Authorization: authHeader() } });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

module.exports = {
  isConfigured,
  publicKeyId: () => credentials().keyId || null,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
};