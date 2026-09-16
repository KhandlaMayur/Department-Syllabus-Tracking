const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');

/**
 * Verifies the Bearer JWT and attaches the decoded payload to req.user.
 * Responds 401 if the header is missing, the token is invalid, or expired.
 */
const requireAuth = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const parts  = header.split(' ');
  const scheme = parts[0];
  const token  = parts[1];

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized(
      'Authentication required. Please sign in with your university Google account.'
    );
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Your session has expired. Please sign in again.');
    }
    throw ApiError.unauthorized('Invalid authentication token. Please sign in again.');
  }
});

/**
 * Restricts a route to one or more specific roles.
 * Must run AFTER requireAuth.
 * e.g. requireRole('hod', 'cc')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required.');
    }

    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(
        'Access denied. This resource requires the role: ' + roles.join(' or ') +
        '. Your current role is: ' + req.user.role + '.'
      );
    }

    next();
  };
}

/**
 * Standalone 401 handler for routes that want to be explicit about
 * unauthenticated access without a JWT check.
 */
function unauthorizedHandler(req, res) {
  res.status(401).json({
    success: false,
    error: {
      message: 'Authentication required. Please sign in with your university Google account.',
    },
  });
}

/**
 * Standalone 403 handler for routes where the user is authenticated
 * but definitively does not have permission.
 */
function forbiddenHandler(req, res) {
  res.status(403).json({
    success: false,
    error: {
      message: 'You do not have permission to access this resource.',
    },
  });
}

module.exports = { requireAuth, requireRole, unauthorizedHandler, forbiddenHandler };