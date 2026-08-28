const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const AdminUser = require("../models/AdminUser");

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;

  if (!token) {
    res.status(401);
    throw new Error("Not authorized - no token provided");
  }

  // Only the verify call belongs in the try. Wrapping the database lookup and
  // the status checks too meant a Mongo outage and a deactivated account both
  // reported "invalid or expired token", which is misleading to debug.
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401);
    throw new Error("Not authorized - invalid or expired token");
  }

  // Customer tokens are signed with the same secret, so reject them by claim
  // rather than relying on the id simply not matching an AdminUser.
  if (decoded.kind && decoded.kind !== "admin") {
    res.status(401);
    throw new Error("Not authorized - this is not an admin session");
  }

  const user = await AdminUser.findById(decoded.id).select("-passwordHash");
  if (!user) {
    res.status(401);
    throw new Error("Not authorized - account not found");
  }
  if (user.status !== "active") {
    res.status(403);
    throw new Error("Your admin account has been deactivated");
  }

  req.adminUser = user;
  next();
});

const requireRole = (...roles) => (req, res, next) => {
  if (!req.adminUser || !roles.includes(req.adminUser.role)) {
    res.status(403);
    throw new Error("Forbidden - insufficient role permissions");
  }
  next();
};

module.exports = { protect, requireRole };
