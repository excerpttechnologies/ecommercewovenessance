// const express = require("express");
// const multer = require("multer");
// const { protect, requireRole } = require("../middleware/auth");
// const ctrl = require("../controllers/branchController");

// const router = express.Router();
// const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// router.use(protect);

// router.get("/dashboard", ctrl.branchDashboard);
// router.get("/export/excel", ctrl.exportBranchesExcel);
// router.get("/export/pdf", ctrl.exportBranchesPdf);
// router.post(
//   "/import/excel",
//   requireRole("super_admin", "branch_admin"),
//   upload.single("file"),
//   ctrl.importBranchesExcel
// );

// router.get("/", ctrl.listBranches);
// router.post("/", requireRole("super_admin"), ctrl.createBranch);

// router.get("/:id", ctrl.getBranch);
// router.put("/:id", requireRole("super_admin", "branch_admin"), ctrl.updateBranch);
// router.patch("/:id/lifecycle", requireRole("super_admin", "branch_admin"), ctrl.setLifecycleStage);
// router.post("/:id/restore", requireRole("super_admin"), ctrl.restoreBranch);
// router.delete("/:id", requireRole("super_admin", "branch_admin"), ctrl.softDeleteBranch);
// router.delete("/:id/hard", requireRole("super_admin"), ctrl.hardDeleteBranch);

// module.exports = router;

const express = require("express");
const multer = require("multer");
const { protect, requireRole } = require("../middleware/auth");
const { scopeToAssignedBranch } = require("../middleware/branchScope");
const ctrl = require("../controllers/branchController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(protect);
// Pins branch_admin and staff to their own branch; super_admin unaffected.
router.use(scopeToAssignedBranch);

router.get("/dashboard", ctrl.branchDashboard);
router.get("/export/excel", ctrl.exportBranchesExcel);
router.get("/export/pdf", ctrl.exportBranchesPdf);
router.post(
  "/import/excel",
  requireRole("super_admin", "branch_admin"),
  upload.single("file"),
  ctrl.importBranchesExcel
);

router.get("/", ctrl.listBranches);
router.post("/", requireRole("super_admin"), ctrl.createBranch);

router.get("/:id", ctrl.getBranch);
router.put("/:id", requireRole("super_admin", "branch_admin"), ctrl.updateBranch);
router.patch("/:id/lifecycle", requireRole("super_admin", "branch_admin"), ctrl.setLifecycleStage);
router.post("/:id/restore", requireRole("super_admin"), ctrl.restoreBranch);
router.delete("/:id", requireRole("super_admin", "branch_admin"), ctrl.softDeleteBranch);
router.delete("/:id/hard", requireRole("super_admin"), ctrl.hardDeleteBranch);

module.exports = router;