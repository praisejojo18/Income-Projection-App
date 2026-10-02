const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const { authenticate, requireSuperAdmin } = require("../middleware/auth");

// 🛡️ Apply authenticate to ALL routes (so staff can read, admin can write)
router.use(authenticate);

// General settings (read/write for authenticated users)
router.get("/", settingsController.getSettings);
router.put("/", settingsController.updateSettings);

// Plans & pricing:
// - GET /plans → open to all logged-in users (staff can VIEW pricing)
// - POST/PUT/DELETE → SUPER_ADMIN only (staff can't EDIT pricing)
router.get("/plans", settingsController.getPlans);
router.post("/plans", requireSuperAdmin, settingsController.createPlan);
router.put("/plans/:id", requireSuperAdmin, settingsController.updatePlan);
router.delete("/plans/:id", requireSuperAdmin, settingsController.deletePlan);

module.exports = router;