const router = require('express').Router();
const userController = require('../controllers/userController');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

// 🛡️ ALL routes in this file require Authentication + Super Admin role
router.use(authenticate);
router.use(requireSuperAdmin);

router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.delete('/:id', userController.deleteUser);
router.put('/:id/reset-password', userController.resetPassword);

module.exports = router;