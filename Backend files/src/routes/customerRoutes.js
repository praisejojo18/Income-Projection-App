const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// Only map routes that exist in the CLEAN controller
router.get('/', customerController.getCustomers);
router.get('/plans', customerController.getUserPlans);
router.post('/', customerController.createCustomer);
router.delete("/all", customerController.deleteAllCustomers);
router.put('/:id', customerController.updateCustomer);
router.post('/:id/extend', customerController.extendService);
router.post('/:id/change-plan', customerController.changePlan);
router.post('/:id/deactivate', customerController.deactivateCustomer);

module.exports = router;