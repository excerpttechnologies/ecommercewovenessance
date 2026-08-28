const asyncHandler = require("express-async-handler");
const AdminUser = require("../models/AdminUser");
const Branch = require("../models/Branch");

/**
 * Staff accounts.
 *
 * Super-admin only, for a reason worth stating: whoever can create accounts and
 * set roles can hand themselves any level of access, so this is the one area
 * that must not be delegated to a branch admin.
 *
 * The branch-scoping middleware reads AdminUser.assignedBranch, and until now
 * there was no way to set it except editing MongoDB by hand. This is that
 * missing screen's API.
 */

const ROLES = ["super_admin", "branch_admin", "staff"];
const MIN_PASSWORD = 8;

function fail(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

/**
 * Resolves one user's branch name for a single-record response.
 *
 * publicStaff() takes a pre-built map because the list endpoint fetches every
 * branch in one query; create/update/reset return a single user, and without
 * this they came back with assignedBranchName: null even though the id was saved
 * — so the table showed "Not assigned" until the next reload.
 */
async function publicStaffOne(user) {
  if (!user.assignedBranch) return publicStaff(user);
  const branch = await Branch.findById(user.assignedBranch).select("branchName address.city").lean();
  return publicStaff(user, new Map(branch ? [[String(branch._id), branch]] : []));
}

/** Shape sent to the browser — never the password hash. */
function publicStaff(user, branchesById = new Map()) {
  const branch = user.assignedBranch ? branchesById.get(String(user.assignedBranch)) : null;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    assignedBranch: user.assignedBranch || null,
    assignedBranchName: branch ? branch.branchName : null,
    assignedBranchCity: branch?.address?.city || null,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
  };
}

/**
 * A branch_admin or staff account is meaningless without a branch — the scoping
 * middleware refuses every request until one is set, so it's required up front
 * rather than left to be discovered as a 403 later.
 */
async function resolveAssignedBranch(role, rawBranch) {
  if (role === "super_admin") return null; // unrestricted by definition

  if (!rawBranch || !/^[a-f\d]{24}$/i.test(String(rawBranch))) {
    fail(`A ${role.replace("_", " ")} must be assigned to a branch`, 400);
  }

  const branch = await Branch.findOne({ _id: rawBranch, isDeleted: { $ne: true } }).select("_id");
  if (!branch) fail("That branch doesn't exist", 404);
  return branch._id;
}

// GET /api/woven-essence/admin/staff
const listStaff = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role && ROLES.includes(req.query.role)) filter.role = req.query.role;
  if (["active", "inactive"].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const users = await AdminUser.find(filter).select("-passwordHash").sort("name").lean();

  // One query for the branch names rather than one per user.
  const branchIds = [...new Set(users.map((u) => u.assignedBranch).filter(Boolean).map(String))];
  const branches = await Branch.find({ _id: { $in: branchIds } }).select("branchName address.city").lean();
  const byId = new Map(branches.map((b) => [String(b._id), b]));

  res.json({
    success: true,
    data: users.map((u) => publicStaff(u, byId)),
    counts: {
      total: users.length,
      superAdmins: users.filter((u) => u.role === "super_admin").length,
      unassigned: users.filter((u) => u.role !== "super_admin" && !u.assignedBranch).length,
    },
  });
});

// POST /api/woven-essence/admin/staff
const createStaff = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = req.body?.role;

  if (!name) fail("Name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email address");
  if (!ROLES.includes(role)) fail(`Role must be one of: ${ROLES.join(", ")}`);
  if (password.length < MIN_PASSWORD) fail(`Password must be at least ${MIN_PASSWORD} characters`);

  if (await AdminUser.findOne({ email })) fail("A staff account with this email already exists", 409);

  const assignedBranch = await resolveAssignedBranch(role, req.body?.branch);

  const user = await AdminUser.create({
    name,
    email,
    passwordHash: await AdminUser.hashPassword(password),
    role,
    assignedBranch,
    status: "active",
  });

  res.status(201).json({
    success: true,
    data: await publicStaffOne(user),
    message: `${name} can now sign in with ${email}`,
  });
});

// PATCH /api/woven-essence/admin/staff/:id
const updateStaff = asyncHandler(async (req, res) => {
  const user = await AdminUser.findById(req.params.id);
  if (!user) fail("Staff account not found", 404);

  const isSelf = String(user._id) === String(req.adminUser._id);

  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) fail("Name can't be empty");
    user.name = name;
  }

  if (req.body?.role !== undefined && req.body.role !== user.role) {
    if (!ROLES.includes(req.body.role)) fail(`Role must be one of: ${ROLES.join(", ")}`);
    // Demoting yourself could leave nobody able to manage staff.
    if (isSelf) fail("You can't change your own role — ask another super admin", 403);
    await assertNotLastSuperAdmin(user, req.body.role);
    user.role = req.body.role;
    user.assignedBranch = await resolveAssignedBranch(req.body.role, req.body.branch ?? user.assignedBranch);
  } else if (req.body?.branch !== undefined) {
    user.assignedBranch = await resolveAssignedBranch(user.role, req.body.branch);
  }

  if (req.body?.status !== undefined) {
    if (!["active", "inactive"].includes(req.body.status)) fail("Status must be active or inactive");
    // Deactivating yourself would log you out with no way back in.
    if (isSelf && req.body.status === "inactive") fail("You can't deactivate your own account", 403);
    if (req.body.status === "inactive") await assertNotLastSuperAdmin(user, null);
    user.status = req.body.status;
  }

  await user.save();
  res.json({ success: true, data: await publicStaffOne(user), message: "Staff account updated" });
});

/**
 * Refuses a change that would remove the last active super admin.
 *
 * Without this, one careless demotion locks everyone out of branch management,
 * staff creation and reporting — with no way to recover except editing the
 * database by hand, because /auth/bootstrap only works when no admin exists.
 */
async function assertNotLastSuperAdmin(user, nextRole) {
  if (user.role !== "super_admin" || user.status !== "active") return;
  if (nextRole === "super_admin") return;

  const others = await AdminUser.countDocuments({
    _id: { $ne: user._id },
    role: "super_admin",
    status: "active",
  });
  if (others === 0) {
    fail("This is the only active super admin — promote someone else first", 409);
  }
}

// POST /api/woven-essence/admin/staff/:id/reset-password
// A super admin sets a new password directly, for the usual "they're locked out
// and it's Monday morning" case. The staff member should change it after.
const resetStaffPassword = asyncHandler(async (req, res) => {
  const password = String(req.body?.password || "");
  if (password.length < MIN_PASSWORD) fail(`Password must be at least ${MIN_PASSWORD} characters`);

  const user = await AdminUser.findById(req.params.id);
  if (!user) fail("Staff account not found", 404);

  user.passwordHash = await AdminUser.hashPassword(password);
  await user.save();

  res.json({
    success: true,
    message: `Password reset for ${user.name}. Ask them to change it after signing in.`,
  });
});

// DELETE /api/woven-essence/admin/staff/:id
// Deactivates rather than deletes: an admin id is referenced by createdBy and
// updatedBy across branches, items and orders, and removing the row would leave
// those audit trails pointing at nothing.
const deactivateStaff = asyncHandler(async (req, res) => {
  const user = await AdminUser.findById(req.params.id);
  if (!user) fail("Staff account not found", 404);

  if (String(user._id) === String(req.adminUser._id)) {
    fail("You can't deactivate your own account", 403);
  }
  await assertNotLastSuperAdmin(user, null);

  user.status = "inactive";
  await user.save();

  res.json({
    success: true,
    data: await publicStaffOne(user),
    message: `${user.name} can no longer sign in. Their history is kept.`,
  });
});

module.exports = { listStaff, createStaff, updateStaff, resetStaffPassword, deactivateStaff, ROLES };
