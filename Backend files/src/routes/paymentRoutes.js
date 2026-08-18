const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { paymentSchemas } = require('../utils/validators');
const {
  recordPayment,
  getPaymentStats,
  getPayments,
  updatePayment,
  deletePayment,
} = require('../controllers/paymentController');

router.use(authenticate);

router.get('/', getPayments);
router.get('/stats', getPaymentStats);
router.post('/', validate(paymentSchemas.create), recordPayment);
router.patch('/:id', validate(paymentSchemas.update), updatePayment);
router.delete('/:id', deletePayment);

module.exports = router;