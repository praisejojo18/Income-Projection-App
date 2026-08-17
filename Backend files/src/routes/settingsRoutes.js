const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { settingsSchema } = require('../utils/validators');
const { getSettings, updateSettings } = require('../controllers/settingsController');

router.use(authenticate); // protect everything below

router.get('/', getSettings);
router.patch('/', validate(settingsSchema), updateSettings);

module.exports = router;