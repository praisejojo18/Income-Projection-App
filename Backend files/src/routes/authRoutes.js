const router = require("express").Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");


router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);

// 🔑 CRUCIAL: This line MUST be at the very bottom
module.exports = router; 