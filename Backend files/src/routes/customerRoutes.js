const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate } = require("../middleware/auth");

// 🛡️ Apply authenticate middleware to ALL routes in this file
router.use(authenticate);

// Static routes MUST be above /:id routes
router.get('/', customerController.getCustomers);
router.get('/plans', customerController.getUserPlans);
router.post('/', customerController.createCustomer);

// Optional role endpoint for older pages / debugging
router.get('/me/role', customerController.getMyRole);

// Admin-only bulk delete — controller enforces SUPER_ADMIN
router.delete('/all', customerController.deleteAllCustomers);

// Single customer delete — used by profile Delete button
router.delete('/:id', customerController.deleteCustomer);

// Dynamic /:id routes come last
router.get('/:id', customerController.getCustomerById);
router.put('/:id', customerController.updateCustomer);
router.post('/:id/extend', customerController.extendService);
router.post('/:id/change-plan', customerController.changePlan);
router.post('/:id/deactivate', customerController.deactivateCustomer);

module.exports = router;