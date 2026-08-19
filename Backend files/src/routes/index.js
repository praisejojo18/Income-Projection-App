const router = require('express').Router();

// 🚧 Colleague's routes
router.use('/auth', require('./authRoutes'));
router.use('/customers', require('./customerRoutes'));
router.use('/actual', require('./actualRoutes')); // Powers Monthly Income page

// ✅ YOUR ROUTES 
router.use('/settings', require('./settingsRoutes'));
router.use('/plans', require('./planRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/projections', require('./projectionRoutes'));

module.exports = router;
