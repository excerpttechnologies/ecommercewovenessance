const express = require("express");
const { protect, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/erpScopeController");

const router = express.Router();

// Admin-only. Not branch-scoped: these ARE the branch options, and they come
// from the ERP's own master rather than Woven Essence's Branch collection.
router.use(protect);

router.get("/businesses", ctrl.businesses);

// Branch management reads the ERP business master - the real branch list.
router.get("/branches/dashboard", ctrl.branchStats);
// Turns the working branch into the branch id products are filed against.
router.get("/resolve-branch", ctrl.resolveBranch);
router.get("/branches", ctrl.branchList);

// The one write: which Woven Essence branch an ERP branch corresponds to.
router.put("/branches/:id/link", requireRole("super_admin", "branch_admin"), ctrl.linkBranch);

module.exports = router;
