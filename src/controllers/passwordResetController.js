const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const Customer = require("../models/Customer");
const email = require("../services/emailService");
const { signCustomerToken } = require("../middleware/customerAuth");

/**
 * Customer password reset.
 *
 * Design points that matter here:
 *
 *  - The response to "forgot password" is IDENTICAL whether the email exists or
 *    not. Anything else turns this endpoint into a way to discover who has an
 *    account.
 *  - Only a SHA-256 hash of the token is stored. A database dump then can't be
 *    used to reset anyone's password.
 *  - A successful reset signs the customer straight in. They just proved control
 *    of the mailbox and typed a new password; making them type it again adds
 *    nothing.
 */

const TOKEN_BYTES = 32;
const EXPIRY_MINUTES = 60;
const MIN_PASSWORD = 8;
const THROTTLE_SECONDS = 60;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// POST /api/woven-essence/account/forgot-password   { email }
const requestReset = asyncHandler(async (req, res) => {
  const address = String(req.body?.email || "").trim().toLowerCase();

  // Same reply in every branch below — see the note above.
  const reply = () =>
    res.json({
      success: true,
      message:
        "If that email has an account with us, a reset link is on its way. " +
        "It expires in an hour — check your spam folder if you don't see it.",
    });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return reply();

  const customer = await Customer.findOne({ email: address, isDeleted: { $ne: true } }).select(
    "+passwordReset.requestedAt +passwordReset.tokenHash +passwordReset.expiresAt"
  );
  if (!customer) return reply();

  // Light throttle so the endpoint can't be used to spam someone's inbox.
  const last = customer.passwordReset?.requestedAt;
  if (last && Date.now() - new Date(last).getTime() < THROTTLE_SECONDS * 1000) return reply();

  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  customer.passwordReset = {
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000),
    requestedAt: new Date(),
    usedAt: null,
  };
  await customer.save();

  // The link points at the storefront route, which posts the token back.
  const resetUrl = `${email.siteUrl()}/account/reset-password?token=${token}&email=${encodeURIComponent(address)}`;

  await email.sendPasswordReset(address, {
    name: customer.name,
    resetUrl,
    expiryMinutes: EXPIRY_MINUTES,
  });

  return reply();
});

// POST /api/woven-essence/account/reset-password   { email, token, password }
const performReset = asyncHandler(async (req, res) => {
  const address = String(req.body?.email || "").trim().toLowerCase();
  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");

  if (password.length < MIN_PASSWORD) {
    res.status(400);
    throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
  }
  if (!address || !token) {
    res.status(400);
    throw new Error("That reset link is incomplete — please request a new one");
  }

  const customer = await Customer.findOne({ email: address, isDeleted: { $ne: true } }).select(
    "+passwordReset.tokenHash +passwordReset.expiresAt +passwordReset.usedAt +passwordHash"
  );

  const reset = customer?.passwordReset;
  const expected = reset?.tokenHash;
  const provided = hashToken(token);

  // timingSafeEqual needs equal lengths, hence the length check first.
  const matches =
    !!expected &&
    expected.length === provided.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));

  // One message for every failure mode — a wrong token, an expired one, a reused
  // one and an unknown email are indistinguishable from outside.
  const invalid = () => {
    res.status(400);
    throw new Error("That reset link is invalid or has expired. Please request a new one.");
  };

  if (!customer || !matches) invalid();
  if (reset.usedAt) invalid();
  if (!reset.expiresAt || reset.expiresAt.getTime() < Date.now()) invalid();

  customer.passwordHash = password; // the model's pre-save hook hashes it
  customer.passwordReset = {
    tokenHash: null,
    expiresAt: null,
    requestedAt: reset.requestedAt,
    usedAt: new Date(),
  };
  customer.lastLoginAt = new Date();
  await customer.save();

  res.json({
    success: true,
    data: { token: signCustomerToken(customer), customer: customer.toPublic() },
    message: "Your password has been changed and you're signed in.",
  });
});

module.exports = { requestReset, performReset };
