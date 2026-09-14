const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { ApiError } = require('../utils/helpers');

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Authentication required'));
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // COMPANY MODE: all staff share the Super Admin's data pool
    const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    req.userId = superAdmin ? superAdmin.id : decoded.userId;

    // Keep the REAL logged-in user for names & permission checks
    req.realUserId = decoded.userId;
    const currentUser = await prisma.user.findUnique({ where: { id: decoded.userId } });
    req.userRole = currentUser ? currentUser.role : 'USER';

    next();
  } catch (err) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
};

const requireSuperAdmin = async (req, res, next) => {
  try {
    let userId = req.realUserId;
    if (!userId) {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) return next(new ApiError(401, 'Authentication required'));
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      userId = decoded.userId;
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'SUPER_ADMIN') {
      return next(new ApiError(403, 'Forbidden: Super Admin access required'));
    }
    req.realUserId = userId;
    req.userRole = user.role;
    next();
  } catch (error) {
    next(new ApiError(401, 'Authentication required'));
  }
};

module.exports = { authenticate, requireSuperAdmin };