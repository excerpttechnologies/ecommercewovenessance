const express = require("express");
const coupons = require("../controllers/couponController");
const { protectCustomer } = require("../middleware/customerAuth");

/**
 * Shopper-facing coupon routes.
 *
 * /public is deliberately unauthenticated — advertised offers are marketing,
 * and requiring a login to see them would defeat the point. It exposes no usage
 * counts, only what a poster would say.
 *
 * Admin coupon management lives on adminRoutes, behind the staff guard.
 */
const router = express.Router();

router.get("/public", coupons.publicCoupons);
router.post("/apply", protectCustomer, coupons.applyCoupon);

module.exports = router;
