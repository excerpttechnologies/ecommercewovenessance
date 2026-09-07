const express = require("express");
const { protect, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/productGroupController");

const router = express.Router();

// Admin-only, but deliberately NOT wrapped in scopeToAssignedBranch: these
// rows are the ERP's, scoped by business rather than by Woven Essence branch,
// so there is no req.query.branch for that middleware to pin. See the note at
// the top of controllers/productGroupController.js.
router.use(protect);

router.get("/dashboard", ctrl.dashboard);
router.get("/published", ctrl.publishedGroups);
router.get("/", ctrl.list);

// The only write. It touches Woven Essence's storefrontGroups side table,
// not the ERP's master row, so it needs no ERP-side permission.
router.patch("/:id/publish", requireRole("super_admin", "branch_admin"), ctrl.setPublished);

module.exports = router;
