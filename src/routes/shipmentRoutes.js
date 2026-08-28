const express = require("express");
const ctrl = require("../controllers/shipmentController");
const { protect, requireRole } = require("../middleware/auth");

/** Staff-only shipment actions. The webhook is mounted separately, unprotected
 *  but token-verified, because Shiprocket can't carry an admin JWT. */
const router = express.Router();
router.use(protect);

router.get("/status", ctrl.connectionStatus);
router.get("/:id/couriers", ctrl.listCouriers);

const writers = requireRole("super_admin", "branch_admin");
router.post("/:id/create", writers, ctrl.createShipment);
router.post("/:id/awb", writers, ctrl.assignAwb);
router.post("/:id/pickup", writers, ctrl.schedulePickup);
router.post("/:id/track", writers, ctrl.refreshTracking);

module.exports = router;
