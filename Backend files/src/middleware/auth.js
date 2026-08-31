const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { ApiError } = require('../utils/helpers');

const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Authentication required'));
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token'));
  }
};

// 🛡️ NEW: Super Admin Check
const requireSuperAdmin = async (req, res, next) => {
  try {
    if (!req.userId) return next(new ApiError(401, 'Authentication required'));
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.role !== 'SUPER_ADMIN') {
      return next(new ApiError(403, 'Forbidden: Super Admin access required'));
    }
    req.userRole = user.role;
    next();
  } catch (error) {
    next(new ApiError(500, 'Authorization check failed'));
  }
};

module.exports = { authenticate, requireSuperAdmin };