const express = require("express");
const ctrl = require("../controllers/wishlistController");
const { protectCustomer } = require("../middleware/customerAuth");

const router = express.Router();
router.use(protectCustomer);

router.get("/", ctrl.getWishlist);
router.post("/items", ctrl.addToWishlist);
router.delete("/items/:itemId", ctrl.removeFromWishlist);

module.exports = router;
