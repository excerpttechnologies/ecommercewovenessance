const express = require("express");
const ctrl = require("../controllers/orderController");
const { protectCustomer } = require("../middleware/customerAuth");

/** A customer's own orders. Every query is scoped to the signed-in customer. */
const router = express.Router();
router.use(protectCustomer);

router.get("/", ctrl.listOrders);
router.get("/:id", ctrl.getOrder);
router.get("/:id/invoice.pdf", ctrl.downloadInvoice);
router.post("/:id/cancel", ctrl.cancelOrder);

module.exports = router;
