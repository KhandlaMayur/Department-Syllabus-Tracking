const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

/**
 * Catches any error thrown/forwarded in the app and returns a consistent
 * JSON shape. Must be registered LAST, after all routes.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let { statusCode, message, details } = err;

  if (!(err instanceof ApiError)) {
    // Unexpected / programming error — don't leak internals to the client
    statusCode = 500;
    message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
    details = null;
    logger.error(`Unhandled error: ${err.stack || err.message}`);
  } else if (statusCode >= 500) {
    logger.error(`${statusCode} ${message}`);
  } else {
    logger.warn(`${statusCode} ${message}`);
  }

  res.status(statusCode || 500).json({
    success: false,
    error: {
      message: message || 'Something went wrong',
      ...(details ? { details } : {}),
    },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}

module.exports = { errorHandler, notFoundHandler };
