const { ApiError } = require('../utils/helpers');

// Usage: router.post('/', validate(schema), controller)
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return next(new ApiError(400, 'Validation failed', errors));
  }

  req.body = result.data; // cleaned + coerced data
  next();
};

module.exports = { validate };