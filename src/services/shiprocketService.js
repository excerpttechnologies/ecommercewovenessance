/**
 * Shiprocket integration.
 *
 * Talks to Shiprocket's REST API with the built-in fetch — no new dependency,
 * same approach as razorpayService.
 *
 * Two design points worth knowing:
 *
 * 1. The auth token lasts 10 days, so it is cached in memory and reused. Logging
 *    in on every call would burn the rate limit and add a round trip to every
 *    request.
 * 2. When credentials are absent, every function throws a single clear
 *    "not configured" error rather than failing with a confusing 401 from
 *    Shiprocket. The rest of the app keeps working — orders are still placed and
 *    fulfilled, staff just enter the AWB by hand.
 */

const BASE = process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external";

/** Cached token: { value, expiresAt }. Cleared on any 401 so the next call re-logs in. */
let session = null;

class ShiprocketError extends Error {
  constructor(message, statusCode = 502, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function isConfigured() {
  return !!(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

function assertConfigured() {
  if (!isConfigured()) {
    throw new ShiprocketError(
      "Shiprocket isn't connected. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to the backend .env, " +
        "or enter the courier and AWB manually on the order.",
      503
    );
  }
}

async function login() {
  assertConfigured();

  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) {
    throw new ShiprocketError(
      body.message || "Shiprocket rejected the credentials in your .env",
      res.status === 400 || res.status === 401 ? 502 : 502,
      body
    );
  }

  // Documented lifetime is 10 days; refresh a day early to avoid an edge expiry.
  session = { value: body.token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 };
  return session.value;
}

async function token() {
  if (session && session.expiresAt > Date.now()) return session.value;
  return login();
}

/** One request, retried once on 401 with a fresh token. */
async function call(path, { method = "GET", body, query } = {}, retry = true) {
  assertConfigured();

  const url = new URL(`${BASE}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry) {
    session = null; // token expired or revoked — log in again once
    return call(path, { method, body, query }, false);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Shiprocket returns errors in several shapes; surface whichever is present.
    const message =
      data.message ||
      (data.errors && JSON.stringify(data.errors)) ||
      `Shiprocket returned ${res.status}`;
    throw new ShiprocketError(message, 502, data);
  }

  return data;
}

/* ── operations ────────────────────────────────────────────────────────────── */

/**
 * Which couriers can serve this pincode, and at what rate.
 * Called before pushing an order so staff pick a courier instead of guessing.
 */
async function checkServiceability({ pickupPostcode, deliveryPostcode, weightKg, cod, declaredValue }) {
  const data = await call("/courier/serviceability/", {
    query: {
      pickup_postcode: pickupPostcode,
      delivery_postcode: deliveryPostcode,
      weight: weightKg,
      cod: cod ? 1 : 0,
      declared_value: declaredValue,
    },
  });

  const couriers = data?.data?.available_courier_companies || [];
  return couriers.map((c) => ({
    courierCompanyId: c.courier_company_id,
    name: c.courier_name,
    rate: c.rate,
    estimatedDays: c.estimated_delivery_days || c.etd || null,
    codAvailable: c.cod === 1,
    rating: c.rating ?? null,
  }));
}

/** Creates the order inside Shiprocket. Returns their order + shipment ids. */
async function createOrder(payload) {
  const data = await call("/orders/create/adhoc", { method: "POST", body: payload });
  return {
    shiprocketOrderId: data.order_id ? String(data.order_id) : null,
    shipmentId: data.shipment_id ? String(data.shipment_id) : null,
    status: data.status || null,
    raw: data,
  };
}

/** Assigns an AWB (tracking number) to a shipment, optionally on a chosen courier. */
async function assignAwb({ shipmentId, courierCompanyId }) {
  const data = await call("/courier/assign/awb", {
    method: "POST",
    body: {
      shipment_id: Number(shipmentId),
      ...(courierCompanyId ? { courier_id: Number(courierCompanyId) } : {}),
    },
  });

  const r = data?.response?.data || {};
  return {
    awbCode: r.awb_code ? String(r.awb_code) : null,
    courierName: r.courier_name || null,
    courierCompanyId: r.courier_company_id ?? null,
    freightCharge: r.freight_charges ?? null,
    raw: data,
  };
}

/** Books the pickup with the courier. */
async function requestPickup(shipmentId) {
  const data = await call("/courier/generate/pickup", {
    method: "POST",
    body: { shipment_id: [Number(shipmentId)] },
  });
  return {
    scheduledDate: data?.response?.pickup_scheduled_date || null,
    pickupToken: data?.response?.pickup_token_number || null,
    raw: data,
  };
}

/** The shipping label PDF, for printing. */
async function generateLabel(shipmentId) {
  const data = await call("/courier/generate/label", {
    method: "POST",
    body: { shipment_id: [Number(shipmentId)] },
  });
  return { labelUrl: data?.label_url || null, raw: data };
}

/**
 * Courier scans for an AWB, newest last.
 *
 * Shiprocket nests this response inconsistently between accounts, hence the
 * defensive unwrapping rather than a single fixed path.
 */
async function trackByAwb(awbCode) {
  const data = await call(`/courier/track/awb/${encodeURIComponent(awbCode)}`);

  const tracking =
    data?.tracking_data ||
    data?.[awbCode]?.tracking_data ||
    (Array.isArray(data) ? data[0]?.tracking_data : null) ||
    {};

  const activities = tracking.shipment_track_activities || [];
  const track = (tracking.shipment_track || [])[0] || {};

  return {
    currentStatus: track.current_status || tracking.shipment_status || null,
    courierName: track.courier_name || null,
    expectedDelivery: track.edd || tracking.etd || null,
    deliveredAt: track.delivered_date || null,
    trackUrl: tracking.track_url || null,
    scans: activities.map((a) => ({
      at: a.date ? new Date(a.date) : null,
      status: a.status || "",
      activity: a.activity || "",
      location: a.location || "",
    })),
    raw: data,
  };
}

async function cancelShipment(awbCodes) {
  return call("/orders/cancel/shipment/awbs", { method: "POST", body: { awbs: awbCodes } });
}

/**
 * Maps a Shiprocket status string onto our own order status.
 *
 * Returns null when there is no safe mapping — an unknown courier status must
 * not silently move an order along its timeline.
 */
function mapToOrderStatus(shiprocketStatus) {
  const s = String(shiprocketStatus || "").toUpperCase();
  if (/DELIVERED/.test(s)) return "delivered";
  if (/OUT FOR DELIVERY|OUT-FOR-DELIVERY/.test(s)) return "out_for_delivery";
  if (/IN TRANSIT|SHIPPED|PICKED UP|PICKUP COMPLETE|DISPATCH/.test(s)) return "shipped";
  if (/CANCEL/.test(s)) return "cancelled";
  if (/RTO|RETURN/.test(s)) return "returned";
  return null;
}

module.exports = {
  isConfigured,
  checkServiceability,
  createOrder,
  assignAwb,
  requestPickup,
  generateLabel,
  trackByAwb,
  cancelShipment,
  mapToOrderStatus,
  ShiprocketError,
  /** Exposed for tests only. */
  _resetSession: () => {
    session = null;
  },
};
