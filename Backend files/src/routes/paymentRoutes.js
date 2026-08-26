const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// List all payments + summary
router.get("/", paymentController.getPayments);

// Create a new payment
router.post("/", paymentController.createPayment);

// Get single payment (MUST be above /:id if you add named routes later)
router.get("/:id", paymentController.getPaymentById);

// Update a payment
router.put("/:id", paymentController.updatePayment);

// Delete a payment
router.delete("/:id", paymentController.deletePayment);

module.exports = router;