const asyncHandler = require("express-async-handler");
const ErpBusiness = require("../models/ErpBusiness");
const Branch = require("../models/Branch");
const { mirrorErpBranch } = require("../utils/erpMirror");

// The scope selectors Woven Essence shares with GROO RETAIL ERP.
//
// What the ERP calls a "business" is what its UI calls a branch — the schema
// says so itself (`isMainBranch`, `parentBusinessId`). retailerpv2's top-bar
// selector is fed by /api/options?ref=business, so this is the same list from
// the same collection; see retailerpv2/components/ScopeContext.jsx.

/**
 * GET /erp/businesses — the branch list for the sidebar selector.
 *
 * Main branch first, then alphabetical. The ERP opens on the main branch on
 * every load rather than restoring the last choice, and `isMainBranch` is what
 * it keys that off; returning the flag lets the sidebar do the same.
 */
const businesses = asyncHandler(async (req, res) => {
  const docs = await ErpBusiness.find({})
    .select("name isMainBranch parentBusinessId")
    .sort({ isMainBranch: -1, name: 1 })
    .lean();

  res.json({ success: true, data: docs });
});

/** Escapes user input so it is safe to embed inside a MongoDB $regex string. */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /erp/branches — the Branch management list.
 *
 * The ERP's business master is the real branch list, so this screen shows it
 * rather than a second one that drifts. Each row also carries the Woven
 * Essence branch it is linked to, because products, orders and staff reference
 * THAT collection — the ERP row alone has nothing for them to point at.
 *
 * Read-only: branches are created and edited in the ERP. The one thing this
 * screen writes is the link, and that is stored on the Woven Essence branch.
 */
const branchList = asyncHandler(async (req, res) => {
  const filter = {};
  const search = String(req.query.q || "").trim();
  if (search) {
    const rx = { $regex: escapeRegExp(search), $options: "i" };
    filter.$or = [
      { name: rx },
      { businessPrintName: rx },
      { city: rx },
      { state: rx },
      { zipCode: rx },
      { gstin: rx },
    ];
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const [docs, total, branches] = await Promise.all([
    ErpBusiness.find(filter)
      .sort({ isMainBranch: -1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ErpBusiness.countDocuments(filter),
    Branch.find({ isDeleted: { $ne: true } })
      .select("branchName branchCode erpBusinessId status")
      .lean(),
  ]);

  // Which Woven Essence branch each ERP row is linked to, if any.
  const linked = {};
  branches.forEach((b) => {
    if (b.erpBusinessId) {
      linked[String(b.erpBusinessId)] = {
        _id: String(b._id),
        branchName: b.branchName,
        branchCode: b.branchCode,
      };
    }
  });

  res.json({
    success: true,
    data: docs.map((d) => ({ ...d, linkedBranch: linked[String(d._id)] || null })),
    // Every Woven Essence branch, so the row's dropdown can offer them all.
    branches: branches.map((b) => ({
      _id: String(b._id),
      branchName: b.branchName,
      branchCode: b.branchCode,
      erpBusinessId: b.erpBusinessId ? String(b.erpBusinessId) : null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
});

/** GET /erp/branches/dashboard — the stat cards. */
const branchStats = asyncHandler(async (req, res) => {
  const [total, active, main, branches] = await Promise.all([
    ErpBusiness.countDocuments({}),
    ErpBusiness.countDocuments({ isActive: /^active$/i }),
    ErpBusiness.countDocuments({ isMainBranch: true }),
    Branch.find({ isDeleted: { $ne: true } }).select("erpBusinessId").lean(),
  ]);

  const linkedIds = branches.map((b) => b.erpBusinessId).filter(Boolean);
  const linked = linkedIds.length
    ? await ErpBusiness.countDocuments({ _id: { $in: linkedIds } })
    : 0;

  res.json({
    success: true,
    data: { total, active, main, linked, unlinked: total - linked },
  });
});

/**
 * PUT /erp/branches/:id/link — point a Woven Essence branch at this ERP branch.
 *
 * The link is stored on the Woven Essence branch, because that is the record
 * products and orders reference; the ERP row is read-only here. Body carries
 * { branchId }, or an empty one to unlink.
 *
 * Done server-side rather than as two calls from the browser so the pairing
 * stays one-to-one: whichever branch pointed here before is cleared in the
 * same request, instead of leaving two branches claiming the same ERP row if
 * the second call never lands.
 */
const linkBranch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const branchId = String(req.body.branchId || "").trim();

  const business = await ErpBusiness.findById(id).select("name").lean();
  if (!business) {
    res.status(404);
    throw new Error("That ERP branch no longer exists");
  }

  // Release whoever held this ERP branch before.
  await Branch.updateMany({ erpBusinessId: business._id }, { $set: { erpBusinessId: null } });

  let linked = null;
  if (branchId) {
    const branch = await Branch.findOne({ _id: branchId, isDeleted: { $ne: true } });
    if (!branch) {
      res.status(404);
      throw new Error("Branch not found");
    }
    branch.erpBusinessId = business._id;
    branch.updatedBy = req.adminUser?._id;
    await branch.save();
    linked = {
      _id: String(branch._id),
      branchName: branch.branchName,
      branchCode: branch.branchCode,
    };
  }

  res.json({ success: true, data: { _id: String(business._id), linkedBranch: linked } });
});

/**
 * GET /erp/resolve-branch?business=<erp id> — the Woven Essence branch id for
 * an ERP branch, creating the record on first use.
 *
 * Products, orders and staff reference a Woven Essence Branch by _id. Rather
 * than making someone pair the two lists by hand, the pairing is derived on
 * demand: an ERP branch that has been used before returns the same record, and
 * one that hasn't gets a new one built from its ERP details.
 */
const resolveBranch = asyncHandler(async (req, res) => {
  const business = String(req.query.business || "").trim();
  if (!business) {
    res.status(400);
    throw new Error("business is required");
  }

  res.json({ success: true, data: { branch: await mirrorErpBranch(business) } });
});

module.exports = { businesses, branchList, branchStats, linkBranch, resolveBranch };
