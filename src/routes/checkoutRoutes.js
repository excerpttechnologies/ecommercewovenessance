const express = require("express");
const ctrl = require("../controllers/checkoutController");
const { protectCustomer } = require("../middleware/customerAuth");

const router = express.Router();
router.use(protectCustomer);

router.get("/", ctrl.getCheckout);
router.post("/orders", ctrl.placeOrder);
router.post("/verify", ctrl.verifyPayment);

module.exports = router;
