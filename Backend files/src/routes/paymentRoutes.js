const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { authenticate } = require("../middleware/auth");

// 🛡️ Apply authenticate middleware to ALL routes in this file
router.use(authenticate);

// List all payments + summary
router.get("/", paymentController.getPayments);

// Create a new payment
router.post("/", paymentController.createPayment);

// 🛑 DELETE ALL — MUST stay ABOVE all /:id routes
router.delete("/all", paymentController.deleteAllPayments);

// Get single payment
router.get("/:id", paymentController.getPaymentById);

// Update a payment
router.put("/:id", paymentController.updatePayment);

// Delete a single payment
router.delete("/:id", paymentController.deletePayment);

module.exports = router;