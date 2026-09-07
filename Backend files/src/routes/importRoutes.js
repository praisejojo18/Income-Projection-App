const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const importController = require('../controllers/importController');

router.use(authenticate);
router.post('/preview', importController.preview);
router.post('/execute', importController.execute);

module.exports = router;