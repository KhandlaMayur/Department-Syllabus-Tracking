/**
 * Wraps an async route handler so rejected promises are forwarded to
 * Express's error-handling middleware instead of crashing the process.
 *
 * Usage: router.get('/', catchAsync(async (req, res) => { ... }))
 */
module.exports = function catchAsync(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
