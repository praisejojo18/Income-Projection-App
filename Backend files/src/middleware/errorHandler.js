const { Prisma } = require('@prisma/client');
const { ApiError } = require('../utils/helpers');

const notFound = (req, res, next) =>
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));

// Central error handler — every error funnels here
const errorHandler = (err, req, res, next) => {
  // Prisma-specific errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002')
      return res.status(409).json({ success: false, message: 'Duplicate value — record already exists' });
    if (err.code === 'P2025')
      return res.status(404).json({ success: false, message: 'Record not found' });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : err.message,
    ...(err.details && { details: err.details }),
    ...(process.env.NODE_ENV === 'development' && status === 500 && { stack: err.stack }),
  });
};

module.exports = { errorHandler, notFound };