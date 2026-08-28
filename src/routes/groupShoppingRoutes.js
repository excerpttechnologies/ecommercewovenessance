const express = require("express");
const ctrl = require("../controllers/groupShoppingController");
const { protectCustomer } = require("../middleware/customerAuth");

/**
 * Group shopping. Every route needs a signed-in customer — a shared cart has to
 * know who added what, so there is no anonymous participation.
 */
const router = express.Router();
router.use(protectCustomer);

router.get("/current", ctrl.currentSession);
router.post("/", ctrl.createSession);
router.post("/join", ctrl.joinSession);
router.post("/leave", ctrl.leaveSession);

router.post("/items", ctrl.addLine);
router.patch("/items/:lineId", ctrl.updateLine);
router.delete("/items/:lineId", ctrl.removeLine);

router.post("/confirm", ctrl.confirmSession);
router.post("/reopen", ctrl.reopenSession);
router.post("/pay", ctrl.payShare);
router.post("/pay/verify", ctrl.verifyGroupPayment);

router.get("/orders/:key", ctrl.groupOrders);

module.exports = router;
