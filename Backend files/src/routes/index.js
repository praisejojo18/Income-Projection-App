const router = require('express').Router();

// 🚧 Colleague's routes (Temporarily commented out because planRoutes.js has a missing schema error)
// router.use('/settings', require('./settingsRoutes'));
 router.use('/auth', require('./authRoutes'))
 router.use('/plans', require('./planRoutes'));
// router.use('/payments', require('./paymentRoutes'));
// router.use('/projections', require('./projectionRoutes'));

// ✅ YOUR ROUTES
router.use('/customers', require('./customerRoutes'));
router.use('/actual', require('./actualRoutes')); // This powers the Monthly Income page

module.exports = router;