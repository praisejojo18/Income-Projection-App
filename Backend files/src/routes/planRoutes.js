const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { planSchemas } = require('../utils/validators');
const { getPlans, createPlan, updatePlan, deletePlan } = require('../controllers/planController');

router.use(authenticate);

router.get('/', getPlans);
router.post('/', validate(planSchemas.create), createPlan);
router.patch('/:id', validate(planSchemas.update), updatePlan);
router.delete('/:id', deletePlan);

module.exports = router;