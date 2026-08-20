const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// Define routes
router.get('/', customerController.getCustomers);
router.get('/plans', customerController.getUserPlans);
router.get('/:id', customerController.getCustomerById);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.post('/:id/extend', customerController.extendService);
router.post('/:id/change-plan', customerController.changePlan);
router.post('/:id/deactivate', customerController.deactivateCustomer);

// ⚠️ THIS LAST LINE IS VERY IMPORTANT
// It must be exactly `module.exports = router;` (without curly braces)
module.exports = router; 