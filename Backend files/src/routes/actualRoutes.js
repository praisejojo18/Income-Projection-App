const express = require("express");
const router = express.Router();
const actualController = require("../controllers/actualController");

router.get("/monthly-income", actualController.getMonthlyIncome);
router.get("/projection-vs-actual", actualController.getProjectionVsActual);

module.exports = router;