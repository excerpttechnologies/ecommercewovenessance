



// // const express = require("express");
// // const dash = require("../controllers/adminDashboardController");
// // const orders = require("../controllers/adminOrderController");
// // const staff = require("../controllers/staffController");
// // const { protect, requireRole } = require("../middleware/auth");
// // const { scopeToAssignedBranch } = require("../middleware/branchScope");

// // /**
// //  * Staff-only reporting and order management.
// //  *
// //  * `protect` already rejects customer tokens by their `kind` claim, so no
// //  * shopper can reach these routes even though both tokens share a secret.
// //  * Reads are open to any signed-in staff member; anything that mutates an order
// //  * or a customer requires super_admin or branch_admin.
// //  */
// // const router = express.Router();
// // router.use(protect);
// // // Pins branch_admin and staff to their own branch; super_admin unaffected.
// // router.use(scopeToAssignedBranch);

// // const writers = requireRole("super_admin", "branch_admin");

// // // ── reporting ──
// // router.get("/dashboard", dash.dashboard);
// // router.get("/customers", dash.listCustomers);
// // router.patch("/customers/:id/status", writers, dash.setCustomerStatus);

// // /**
// //  * Staff accounts — super_admin only.
// //  *
// //  * Whoever can set roles can grant themselves any access, so this is the one
// //  * area that isn't delegated to a branch admin. Mounted BEFORE the scoping
// //  * middleware would matter: super admins are unscoped anyway, and everyone else
// //  * is refused here by role.
// //  */
// // const superOnly = requireRole("super_admin");
// // router.get("/staff", superOnly, staff.listStaff);
// // router.post("/staff", superOnly, staff.createStaff);
// // router.patch("/staff/:id", superOnly, staff.updateStaff);
// // router.post("/staff/:id/reset-password", superOnly, staff.resetStaffPassword);
// // router.delete("/staff/:id", superOnly, staff.deactivateStaff);

// // // ── orders ──
// // router.get("/orders", orders.listOrders);
// // router.get("/orders/:id", orders.getOrder);
// // router.patch("/orders/:id/status", writers, orders.updateStatus);
// // router.patch("/orders/:id/shipment", writers, orders.updateShipment);

// // module.exports = router;





// const express = require("express");
// const dash = require("../controllers/adminDashboardController");
// const orders = require("../controllers/adminOrderController");
// const staff = require("../controllers/staffController");
// const { protect, requireRole } = require("../middleware/auth");
// const { scopeToAssignedBranch } = require("../middleware/branchScope");

// /**
//  * Staff-only reporting and order management.
//  *
//  * `protect` already rejects customer tokens by their `kind` claim, so no
//  * shopper can reach these routes even though both tokens share a secret.
//  * Reads are open to any signed-in staff member; anything that mutates an order
//  * or a customer requires super_admin or branch_admin.
//  */
// const router = express.Router();
// router.use(protect);
// // Pins branch_admin and staff to their own branch; super_admin unaffected.
// router.use(scopeToAssignedBranch);

// const writers = requireRole("super_admin", "branch_admin");

// // ── reporting ──
// router.get("/dashboard", dash.dashboard);
// router.get("/customers", dash.listCustomers);
// router.patch("/customers/:id/status", writers, dash.setCustomerStatus);

// /**
//  * Staff accounts — super_admin only.
//  *
//  * Whoever can set roles can grant themselves any access, so this is the one
//  * area that isn't delegated to a branch admin. Mounted BEFORE the scoping
//  * middleware would matter: super admins are unscoped anyway, and everyone else
//  * is refused here by role.
//  */
// const superOnly = requireRole("super_admin");
// router.get("/staff", superOnly, staff.listStaff);
// router.post("/staff", superOnly, staff.createStaff);
// router.patch("/staff/:id", superOnly, staff.updateStaff);
// router.post("/staff/:id/reset-password", superOnly, staff.resetStaffPassword);
// router.delete("/staff/:id", superOnly, staff.deactivateStaff);

// // ── orders ──
// router.get("/orders", orders.listOrders);
// router.get("/orders/:id", orders.getOrder);
// router.patch("/orders/:id/status", writers, orders.updateStatus);
// router.patch("/orders/:id/shipment", writers, orders.updateShipment);
// /** Tick a store off the pick list once its items reach the warehouse. */
// router.patch("/orders/:id/collection", writers, orders.setCollectionStatus);

// module.exports = router;










const express = require("express");
const dash = require("../controllers/adminDashboardController");
const orders = require("../controllers/adminOrderController");
const staff = require("../controllers/staffController");
const coupons = require("../controllers/couponController");
const { protect, requireRole } = require("../middleware/auth");
const { scopeToAssignedBranch } = require("../middleware/branchScope");

/**
 * Staff-only reporting and order management.
 *
 * `protect` already rejects customer tokens by their `kind` claim, so no
 * shopper can reach these routes even though both tokens share a secret.
 * Reads are open to any signed-in staff member; anything that mutates an order
 * or a customer requires super_admin or branch_admin.
 */
const router = express.Router();
router.use(protect);
// Pins branch_admin and staff to their own branch; super_admin unaffected.
router.use(scopeToAssignedBranch);

const writers = requireRole("super_admin", "branch_admin");

// ── reporting ──
router.get("/dashboard", dash.dashboard);
router.get("/customers", dash.listCustomers);
router.patch("/customers/:id/status", writers, dash.setCustomerStatus);

/**
 * Staff accounts — super_admin only.
 *
 * Whoever can set roles can grant themselves any access, so this is the one
 * area that isn't delegated to a branch admin. Mounted BEFORE the scoping
 * middleware would matter: super admins are unscoped anyway, and everyone else
 * is refused here by role.
 */
const superOnly = requireRole("super_admin");
router.get("/staff", superOnly, staff.listStaff);
router.post("/staff", superOnly, staff.createStaff);
router.patch("/staff/:id", superOnly, staff.updateStaff);
router.post("/staff/:id/reset-password", superOnly, staff.resetStaffPassword);
router.delete("/staff/:id", superOnly, staff.deactivateStaff);

// ── orders ──
router.get("/orders", orders.listOrders);
router.get("/orders/:id", orders.getOrder);
router.patch("/orders/:id/status", writers, orders.updateStatus);
router.patch("/orders/:id/shipment", writers, orders.updateShipment);
/** Tick a store off the pick list once its items reach the warehouse. */
router.patch("/orders/:id/collection", writers, orders.setCollectionStatus);

// ── coupons, festival offers and discounts ──
// Reads are open to any signed-in staff member; creating or changing a discount
// moves money, so it stays with super_admin and branch_admin.
router.get("/coupons", coupons.listCoupons);
router.get("/coupons/:id/redemptions", coupons.listRedemptions);
router.post("/coupons", writers, coupons.createCoupon);
router.patch("/coupons/:id", writers, coupons.updateCoupon);
router.delete("/coupons/:id", writers, coupons.deleteCoupon);

module.exports = router;