

// const express = require("express");
// const ctrl = require("../controllers/customerAuthController");
// const reset = require("../controllers/passwordResetController");
// const recent = require("../controllers/recentlyViewedController");
// const { protectCustomer } = require("../middleware/customerAuth");

// /**
//  * Customer account routes — the shop's own auth, separate from /auth (admin).
//  */
// const router = express.Router();

// // public
// router.post("/register", ctrl.register);
// router.post("/login", ctrl.login);

// // Public: a locked-out customer has no token by definition.
// router.get("/google/config", ctrl.googleConfig);
// router.post("/google", ctrl.googleSignIn);

// router.post("/forgot-password", reset.requestReset);
// router.post("/reset-password", reset.performReset);

// // signed-in customers only
// router.get("/me", protectCustomer, ctrl.me);
// router.patch("/me", protectCustomer, ctrl.updateProfile);
// router.patch("/password", protectCustomer, ctrl.changePassword);
// router.post("/addresses", protectCustomer, ctrl.addAddress);
// router.delete("/addresses/:addressId", protectCustomer, ctrl.removeAddress);

// // Recently viewed — signed-in only. Anonymous visitors keep theirs in the
// // browser, so nothing here tracks them.
// router.get("/recently-viewed", protectCustomer, recent.listRecentlyViewed);
// router.post("/recently-viewed", protectCustomer, recent.recordRecentlyViewed);
// router.delete("/recently-viewed", protectCustomer, recent.clearRecentlyViewed);

// module.exports = router;





const express = require("express");
const ctrl = require("../controllers/customerAuthController");
const reset = require("../controllers/passwordResetController");
const recent = require("../controllers/recentlyViewedController");
const { protectCustomer } = require("../middleware/customerAuth");
 
/**
 * Customer account routes — the shop's own auth, separate from /auth (admin).
 */
const router = express.Router();
 
// public
router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
 
// Public: a locked-out customer has no token by definition.
router.get("/google/config", ctrl.googleConfig);
router.post("/google", ctrl.googleSignIn);
 
router.post("/forgot-password", reset.requestReset);
router.post("/reset-password", reset.performReset);
 
// signed-in customers only
router.get("/me", protectCustomer, ctrl.me);
router.patch("/me", protectCustomer, ctrl.updateProfile);
router.patch("/password", protectCustomer, ctrl.changePassword);
router.post("/addresses", protectCustomer, ctrl.addAddress);
router.patch("/addresses/:addressId", protectCustomer, ctrl.updateAddress);
router.patch("/addresses/:addressId/default", protectCustomer, ctrl.setDefaultAddress);
router.delete("/addresses/:addressId", protectCustomer, ctrl.removeAddress);
 
// Recently viewed — signed-in only. Anonymous visitors keep theirs in the
// browser, so nothing here tracks them.
router.get("/recently-viewed", protectCustomer, recent.listRecentlyViewed);
router.post("/recently-viewed", protectCustomer, recent.recordRecentlyViewed);
router.delete("/recently-viewed", protectCustomer, recent.clearRecentlyViewed);
 
module.exports = router;