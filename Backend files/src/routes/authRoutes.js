const router = require('express').Router();

// TODO: Colleague needs to implement login/register here
router.get('/status', (req, res) => {
  res.json({ success: true, message: 'Auth routes are stubbed for now.' });
});

module.exports = router;
