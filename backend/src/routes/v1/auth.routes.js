const express = require('express');
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const { requireAuth } = require('../../middleware/auth');
const authController = require('../../controllers/auth.controller');

const router = express.Router();

/**
 * POST /api/v1/auth/auth0
 * Exchanges an Auth0 token (ID token or access token) for an app JWT.
 * Domain + registration + is_active checks happen server-side.
 */
router.post(
  '/auth0',
  authController.auth0Login
);

/**
 * POST /api/v1/auth/dev-login
 * Instant role/domain login for development and testing.
 */
router.post(
  '/dev-login',
  authController.devLogin
);

/**
 * POST /api/v1/auth/google
 * Exchanges a Google ID token for an app JWT.
 * Domain + registration + is_active checks happen server-side.
 */
router.post(
  '/google',
  authController.googleLogin
);

/**
 * GET /api/v1/auth/me
 * Returns fresh profile data for the currently authenticated user.
 */
router.get('/me', requireAuth, authController.getCurrentUser);

/**
 * POST /api/v1/auth/logout
 * Signals logout; client must clear its local JWT after calling this.
 * Protected so the server can log which user logged out.
 */
router.post('/logout', requireAuth, authController.logout);

module.exports = router;