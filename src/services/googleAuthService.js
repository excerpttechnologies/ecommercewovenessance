const crypto = require("crypto");

/**
 * Google Sign-In verification.
 *
 * The browser runs Google Identity Services, which hands back a signed ID token
 * (a JWT). This verifies that token server-side. Trusting the browser's claim of
 * "I am alice@gmail.com" would let anyone sign in as anyone, so the signature,
 * audience, issuer and expiry are all checked here.
 *
 * Verification is done locally against Google's published JWKS rather than by
 * calling their tokeninfo endpoint: no network round trip on every sign-in, no
 * dependency on that endpoint staying up, and the keys are cacheable. Node's
 * built-in crypto handles RS256, so this adds no package.
 */

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const VALID_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Cached JWKS: { keys: Map<kid, KeyObject>, expiresAt } */
let jwks = null;

class GoogleAuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

function isConfigured() {
  return !!process.env.GOOGLE_CLIENT_ID;
}

function clientId() {
  return process.env.GOOGLE_CLIENT_ID || "";
}

const base64UrlDecode = (part) => Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/**
 * Google's signing keys, cached until their Cache-Control expiry.
 *
 * Google rotates these, so a hard-coded key would break silently. Refetching on
 * an unknown `kid` handles rotation mid-cache.
 */
async function fetchKeys(force = false) {
  if (!force && jwks && jwks.expiresAt > Date.now()) return jwks.keys;

  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new GoogleAuthError("Couldn't reach Google to verify your sign-in", 502);

  const body = await res.json();
  const keys = new Map();
  for (const jwk of body.keys || []) {
    try {
      keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
    } catch {
      // Skip a key we can't parse rather than failing every sign-in.
    }
  }
  if (keys.size === 0) throw new GoogleAuthError("Google returned no usable signing keys", 502);

  // Respect Google's own cache window, defaulting to an hour.
  const maxAge = Number((res.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 3600);
  jwks = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
}

async function keyFor(kid) {
  let keys = await fetchKeys();
  if (!keys.has(kid)) keys = await fetchKeys(true); // likely a rotation
  const key = keys.get(kid);
  if (!key) throw new GoogleAuthError("Your sign-in couldn't be verified — please try again");
  return key;
}

/**
 * Verifies a Google ID token and returns the profile it asserts.
 *
 * Every check here matters:
 *   signature      — proves Google issued it
 *   aud            — proves it was issued for THIS app, not another site's
 *   iss            — proves it came from Google's issuer
 *   exp/iat        — proves it isn't stale or replayed from long ago
 *   email_verified — proves the address belongs to that Google account
 */
async function verifyIdToken(idToken) {
  if (!isConfigured()) {
    throw new GoogleAuthError(
      "Google sign-in isn't configured on this server. Add GOOGLE_CLIENT_ID to the backend .env, " +
        "or sign in with an email and password.",
      503
    );
  }

  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new GoogleAuthError("That Google sign-in couldn't be read");

  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
  } catch {
    throw new GoogleAuthError("That Google sign-in couldn't be read");
  }

  if (header.alg !== "RS256") {
    // Refusing anything else blocks the classic "alg: none" forgery.
    throw new GoogleAuthError("Unexpected signing algorithm on the Google token");
  }

  const key = await keyFor(header.kid);
  const signed = `${headerB64}.${payloadB64}`;
  const valid = crypto.verify(
    "RSA-SHA256",
    Buffer.from(signed),
    key,
    base64UrlDecode(signatureB64)
  );
  if (!valid) throw new GoogleAuthError("That Google sign-in failed verification");

  // Audience: the token must have been minted for our client id.
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(clientId())) {
    throw new GoogleAuthError("That Google sign-in was issued for a different application");
  }

  if (!VALID_ISSUERS.includes(payload.iss)) {
    throw new GoogleAuthError("That Google sign-in came from an unexpected issuer");
  }

  const now = Math.floor(Date.now() / 1000);
  const SKEW = 60; // tolerate a minute of clock drift either way
  if (typeof payload.exp !== "number" || payload.exp + SKEW < now) {
    throw new GoogleAuthError("That Google sign-in has expired — please try again");
  }
  if (typeof payload.iat === "number" && payload.iat - SKEW > now) {
    throw new GoogleAuthError("That Google sign-in isn't valid yet — check your device clock");
  }

  if (!payload.email) throw new GoogleAuthError("Google didn't share an email address");
  // Google sends this as a boolean or the string "true" depending on the flow.
  if (payload.email_verified !== true && payload.email_verified !== "true") {
    throw new GoogleAuthError("That Google account's email isn't verified");
  }

  return {
    googleId: payload.sub,
    email: String(payload.email).toLowerCase(),
    name: payload.name || payload.given_name || "",
    picture: payload.picture || "",
  };
}

module.exports = {
  isConfigured,
  clientId,
  verifyIdToken,
  GoogleAuthError,
  /** Test hook — clears the cached JWKS. */
  _resetKeys: () => {
    jwks = null;
  },
};
