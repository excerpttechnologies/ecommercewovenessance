const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Customer = require("../models/Customer");

/**
 * Customer authentication — entirely separate from the admin's `protect`.
 *
 * Both issue JWTs signed with the same secret, so every token carries a `kind`
 * claim and each middleware refuses the other's. Without that, a customer token
 * would at least be *parseable* by the admin guard, and the only thing stopping
 * it would be that the id happens not to match an AdminUser — security by
 * coincidence. The claim check makes the separation explicit.
 */

const CUSTOMER_KIND = "customer";

function signCustomerToken(customer) {
  return jwt.sign(
    { id: customer._id, kind: CUSTOMER_KIND },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "30d" }
  );
}

/** Requires a signed-in customer. */
const protectCustomer = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;

  if (!token) {
    res.status(401);
    throw new Error("Please sign in to continue");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401);
    throw new Error("Your session has expired — please sign in again");
  }

  if (decoded.kind !== CUSTOMER_KIND) {
    res.status(401);
    throw new Error("This is not a customer session");
  }

  // Kept outside the try above so a database problem surfaces as a 500 rather
  // than being mislabelled as an expired session.
  const customer = await Customer.findOne({ _id: decoded.id, isDeleted: { $ne: true } });

  if (!customer) {
    res.status(401);
    throw new Error("Account not found");
  }
  if (customer.status === "blocked") {
    res.status(403);
    throw new Error("This account has been suspended. Contact us for help.");
  }

  req.customer = customer;
  next();
});

/** Attaches the customer when signed in, but never blocks. */
const optionalCustomer = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.kind !== CUSTOMER_KIND) return next();
    const customer = await Customer.findOne({
      _id: decoded.id,
      isDeleted: { $ne: true },
      status: "active",
    });
    if (customer) req.customer = customer;
  } catch {
    // An invalid token is simply treated as "not signed in".
  }
  next();
});

module.exports = { protectCustomer, optionalCustomer, signCustomerToken, CUSTOMER_KIND };
