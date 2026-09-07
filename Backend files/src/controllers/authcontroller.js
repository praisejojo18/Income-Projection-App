const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { ApiError } = require('../utils/helpers');

const hashPassword = (pw) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return salt + ':' + hash;
};

const verifyPassword = (plain, stored) => {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(plain, salt, 64).toString('hex');
  return check === hash;
};

exports.register = async (req, res, next) => {
  // Public signup is disabled!
  return next(new ApiError(403, 'Public registration is disabled. Contact Super Admin.'));
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return next(new ApiError(400, 'Email and password required'));

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return next(new ApiError(401, 'Invalid email or password'));

    if (!verifyPassword(password, user.password)) {
      return next(new ApiError(401, 'Invalid email or password'));
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      token,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }
    });
  } catch (err) { next(err); }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: req.userId }, 
      select: { id: true, firstName: true, lastName: true, email: true, role: true } 
    });
    if (!user) return next(new ApiError(404, 'User not found'));
    res.json(user);
  } catch (err) { next(err); }
};