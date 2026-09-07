const express = require("express");
const { protect } = require("../middleware/auth");
const ctrl = require("../controllers/erpItemController");

const router = express.Router();

// Admin-only, and deliberately NOT wrapped in scopeToAssignedBranch: these
// rows are the ERP's, scoped by business rather than by Woven Essence branch,
// so there is no req.query.branch for that middleware to pin.
router.use(protect);

router.get("/dashboard", ctrl.dashboard);
router.get("/groups", ctrl.groups);
router.get("/", ctrl.list);

module.exports = router;
