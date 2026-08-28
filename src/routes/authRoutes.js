const express = require("express");
const { protect } = require("../middleware/auth");
const ctrl = require("../controllers/authController");

const router = express.Router();

router.post("/bootstrap", ctrl.bootstrapSuperAdmin);
router.post("/login", ctrl.login);
router.get("/me", protect, ctrl.me);
router.patch("/change-password", protect, ctrl.changePassword);

module.exports = router;
