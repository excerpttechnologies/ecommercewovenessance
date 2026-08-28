const express = require("express");
const ctrl = require("../controllers/cartController");
const { protectCustomer } = require("../middleware/customerAuth");

/** Every cart route requires a signed-in customer — there is no guest cart. */
const router = express.Router();
router.use(protectCustomer);

router.get("/", ctrl.getCart);
router.post("/items", ctrl.addToCart);
router.patch("/items/:lineId", ctrl.updateLine);
router.delete("/items/:lineId", ctrl.removeLine);
router.delete("/", ctrl.clearCart);

module.exports = router;
