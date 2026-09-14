const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/paymentImportController");

router.use(authenticate);
router.post("/preview", ctrl.preview);
router.post("/execute", ctrl.execute);

module.exports = router;