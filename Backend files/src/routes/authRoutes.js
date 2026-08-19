const router = require('express').Router();
const authController = require('../controllers/authController');

// Map both login and register to our quick login function for now
router.post('/login', authController.login);
router.post('/register', authController.login); 

// ⚠️ THIS LINE IS MANDATORY. WITHOUT IT, THE SERVER CRASHES.
module.exports = router; 