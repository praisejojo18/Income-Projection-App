const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { projectionSchemas } = require('../utils/validators');
const {
  createProjection,
  getProjections,
  getProjectionSummary,
  updateProjection,
  deleteProjection,
} = require('../controllers/projectionController');

router.use(authenticate);

router.get('/', getProjections);
router.get('/summary', getProjectionSummary);
router.post('/', validate(projectionSchemas.create), createProjection);
router.patch('/:id', validate(projectionSchemas.update), updateProjection);
router.delete('/:id', deleteProjection);

module.exports = router;