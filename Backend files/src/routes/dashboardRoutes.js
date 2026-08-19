const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

// GET /api/dashboard  (supports ?timeframe=daily|weekly|monthly)
router.get("/", dashboardController.getDashboardStats);

module.exports = router; // 👈 never forget this line!