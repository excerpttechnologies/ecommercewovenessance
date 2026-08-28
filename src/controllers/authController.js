const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const AdminUser = require("../models/AdminUser");

const signToken = (user) =>
  // `kind` lets the customer guard reject admin tokens and vice versa.
  jwt.sign(
    { id: user._id, role: user.role, kind: "admin" },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );

// POST /api/woven-essence/auth/bootstrap
// One-time route: creates the first super_admin only if no AdminUser exists yet.
// Disable/remove this route in production once the first admin is created.
const bootstrapSuperAdmin = asyncHandler(async (req, res) => {
  const existing = await AdminUser.countDocuments();
  if (existing > 0) {
    res.status(403);
    throw new Error(
      "Bootstrap disabled - an admin user already exists. Use /auth/login.",
    );
  }

  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 8) {
    res.status(400);
    throw new Error(
      "name, email, and a password of 8+ characters are required",
    );
  }

  const passwordHash = await AdminUser.hashPassword(password);
  const user = await AdminUser.create({
    name,
    email,
    passwordHash,
    role: "super_admin",
  });

  res.status(201).json({
    success: true,
    data: { id: user._id, name: user.name, email: user.email, role: user.role },
    token: signToken(user),
  });
});

// POST /api/woven-essence/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await AdminUser.findOne({
    email: (email || "").toLowerCase().trim(),
  });

  let passwordMatches = false;
  if (user?.passwordHash && password) {
    try {
      passwordMatches = await user.comparePassword(password);
    } catch {
      passwordMatches = false;
    }
  }

  if (!user || !passwordMatches) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  if (user.status !== "active") {
    res.status(403);
    throw new Error("This admin account is inactive");
  }

  res.json({
    success: true,
    data: { id: user._id, name: user.name, email: user.email, role: user.role },
    token: signToken(user),
  });
});

// GET /api/woven-essence/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.adminUser });
});

// PATCH /api/woven-essence/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await require("../models/AdminUser").findById(req.adminUser._id);

  if (!(await user.comparePassword(currentPassword || ""))) {
    res.status(401);
    throw new Error("Current password is incorrect");
  }
  if (!newPassword || newPassword.length < 8) {
    res.status(400);
    throw new Error("New password must be at least 8 characters");
  }

  user.passwordHash = await AdminUser.hashPassword(newPassword);
  await user.save();
  res.json({ success: true, message: "Password updated" });
});

module.exports = { bootstrapSuperAdmin, login, me, changePassword };
