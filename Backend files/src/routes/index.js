const router = require('express').Router();

router.use('/settings', require('./settingsRoutes'));
router.use('/plans', require('./planRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/projections', require('./projectionRoutes'));

// 🚧 Coming next (your pages):
// router.use('/payments', require('./paymentRoutes'));
// router.use('/projections', require('./projectionRoutes'));

// 👤 Colleague's routes mount here too:
// router.use('/auth', require('./authRoutes'));
// router.use('/customers', require('./customerRoutes'));
// router.use('/dashboard', require('./dashboardRoutes'));

module.exports = router;