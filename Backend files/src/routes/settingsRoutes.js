const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");

// General settings
router.get("/", settingsController.getSettings);
router.put("/", settingsController.updateSettings);

// Plans & pricing (the control room)
router.get("/plans", settingsController.getPlans);
router.post("/plans", settingsController.createPlan);
router.put("/plans/:id", settingsController.updatePlan);
router.delete("/plans/:id", settingsController.deletePlan);  // 🆕 Permanent delete

module.exports = router;