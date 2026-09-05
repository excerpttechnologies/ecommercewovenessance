// const express = require("express");
// const multer = require("multer");
// const { protect, requireRole } = require("../middleware/auth");
// const ctrl = require("../controllers/itemController");

// const router = express.Router();
// const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// router.use(protect);

// router.get("/dashboard", ctrl.dashboard);
// router.get("/export/excel", ctrl.exportExcel);
// router.get("/export/pdf", ctrl.exportPdf);
// router.post("/import/excel", requireRole("super_admin", "branch_admin"), upload.single("file"), ctrl.importExcel);

// router.get("/", ctrl.list);
// router.post("/", requireRole("super_admin", "branch_admin"), ctrl.create);

// router.get("/:id", ctrl.getOne);
// router.put("/:id", requireRole("super_admin", "branch_admin"), ctrl.update);
// router.patch("/:id/lifecycle", requireRole("super_admin", "branch_admin"), ctrl.setLifecycleStage);
// router.post("/:id/restore", requireRole("super_admin"), ctrl.restore);
// router.delete("/:id", requireRole("super_admin", "branch_admin"), ctrl.softDelete);
// router.delete("/:id/hard", requireRole("super_admin"), ctrl.hardDelete);

// module.exports = router;

const express = require("express");
const multer = require("multer");
const { protect, requireRole } = require("../middleware/auth");
const { scopeToAssignedBranch } = require("../middleware/branchScope");
const ctrl = require("../controllers/itemController");
const barcode = require("../controllers/barcodeController"); // ← ADD
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(protect);
// Pins branch_admin and staff to their own branch; super_admin unaffected.
router.use(scopeToAssignedBranch);

router.get("/dashboard", ctrl.dashboard);
router.get("/barcode-label-products", ctrl.listAugustProducts);
router.get("/export/excel", ctrl.exportExcel);
router.get("/export/pdf", ctrl.exportPdf);
router.post(
  "/import/excel",
  requireRole("super_admin", "branch_admin"),
  upload.single("file"),
  ctrl.importExcel,
);

router.get("/", ctrl.list);
router.post("/", requireRole("super_admin", "branch_admin"), ctrl.create);
router.get("/:id/barcode.png", barcode.barcodePng); // ← ADD
router.get("/:id/labels.pdf", barcode.labelsPdf); // ← ADD

router.get("/:id", ctrl.getOne);
router.put("/:id", requireRole("super_admin", "branch_admin"), ctrl.update);
router.patch(
  "/:id/lifecycle",
  requireRole("super_admin", "branch_admin"),
  ctrl.setLifecycleStage,
);
router.post("/:id/restore", requireRole("super_admin"), ctrl.restore);
router.delete(
  "/:id",
  requireRole("super_admin", "branch_admin"),
  ctrl.softDelete,
);
router.delete("/:id/hard", requireRole("super_admin"), ctrl.hardDelete);

module.exports = router;
