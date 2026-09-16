const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs an array of express-validator chains, then rejects with a 400
 * ApiError if any failed. Usage:
 *
 *   router.post('/x', validate([body('email').isEmail()]), controller)
 */
function validate(validations) {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    return next(ApiError.badRequest('Validation failed', details));
  };
}

module.exports = validate;
