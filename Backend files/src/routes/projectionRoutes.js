const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { projectionSchemas } = require('../utils/validators');
const {
  createProjection,
  getProjections,
  getProjectionSummary,
  getAutoProjections, // 🆕 AUTO engine
  updateProjection,
  deleteProjection,
} = require('../controllers/projectionController');

// 🆕 AUTO engine — same protection level as /api/dashboard (userId header).
// (Want it behind real login later? Just move this line BELOW router.use(authenticate).)
router.get('/auto', getAutoProjections);

router.use(authenticate); // 🔒 Locked! Now requires a real login token.

router.get('/', getProjections);
router.get('/summary', getProjectionSummary);
router.post('/', validate(projectionSchemas.create), createProjection);
router.patch('/:id', validate(projectionSchemas.update), updateProjection);
router.delete('/:id', deleteProjection);

module.exports = router;