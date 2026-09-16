const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const jwksClient = require('jwks-rsa');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const UserModel = require('../models/user.model');
const StudentModel = require('../models/student.model');
const FacultyModel = require('../models/faculty.model');
const logger = require('../utils/logger');

const googleClient = new OAuth2Client(config.google.clientId);

const auth0Jwks = jwksClient({
  jwksUri: `https://${config.auth0.domain}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
});

function getAuth0SigningKey(header, callback) {
  auth0Jwks.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err);
    const signingKey = key.getPublicKey ? key.getPublicKey() : key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// ---------------------------------------------------------------------------
// Domain classification
// ---------------------------------------------------------------------------

/**
 * Classifies the email domain into 'student' or 'faculty'.
 * Throws 403 for any other domain (including gmail.com).
 * @param {string} email
 * @returns {'student'|'faculty'}
 */
function classifyDomain(email) {
  const normalized = (email || '').toLowerCase().trim();
  const domain = normalized.split('@')[1] || '';

  if (domain === config.studentEmailDomain.toLowerCase()) return 'student';
  if (domain === config.facultyEmailDomain.toLowerCase() || domain === 'marwadieducation.ed') return 'faculty';

  throw ApiError.forbidden(
    'Sign-in is restricted to official Marwadi University accounts. ' +
    'Use your @' + config.studentEmailDomain + ', @' + config.facultyEmailDomain + ', or @marwadieducation.ed account.'
  );
}

// ---------------------------------------------------------------------------
// Auth0 token verification
// ---------------------------------------------------------------------------

/**
 * Verifies an Auth0 ID/Access token and returns decoded profile.
 */
async function verifyAuth0Token(token) {
  if (!token) throw ApiError.badRequest('token is required');

  let decoded;
  try {
    decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getAuth0SigningKey,
        {
          issuer: `https://${config.auth0.domain}/`,
          algorithms: ['RS256'],
        },
        (err, decodedToken) => {
          if (err) return reject(err);
          resolve(decodedToken);
        }
      );
    });
  } catch (jwtErr) {
    logger.warn('Auth0 JWT verification via JWKS failed, attempting /userinfo: ' + jwtErr.message);
    try {
      const response = await fetch(`https://${config.auth0.domain}/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Userinfo returned status ${response.status}`);
      }
      decoded = await response.json();
    } catch (userinfoErr) {
      logger.warn('Auth0 userinfo verification failed: ' + userinfoErr.message);
      throw ApiError.unauthorized('Invalid Auth0 token. Please try signing in again.');
    }
  }

  const email = (decoded && decoded.email ? decoded.email : '').toLowerCase().trim();
  if (!email) {
    throw ApiError.unauthorized('Auth0 token did not contain a verified email address.');
  }

  const domainType = classifyDomain(email);

  return {
    googleId: decoded.sub,
    email,
    name: decoded.name || decoded.nickname || email.split('@')[0],
    avatarUrl: decoded.picture || null,
    domainType,
  };
}

// ---------------------------------------------------------------------------
// Google token verification
// ---------------------------------------------------------------------------

/**
 * Verifies a Google ID token and returns the decoded profile.
 * Domain classification happens here to fail fast before any DB query.
 */
async function verifyGoogleToken(idToken) {
  if (!idToken) throw ApiError.badRequest('idToken is required');

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });
  } catch (err) {
    logger.warn('Google token verification failed: ' + err.message);
    throw ApiError.unauthorized('Invalid Google token. Please try signing in again.');
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw ApiError.unauthorized('Google token did not contain a verified email address.');
  }

  if (!payload.email_verified) {
    throw ApiError.forbidden('Your Google account email is not verified.');
  }

  // Domain gate -- throws 403 for non-university accounts
  const domainType = classifyDomain(payload.email);

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    avatarUrl: payload.picture || null,
    domainType,
  };
}

// ---------------------------------------------------------------------------
// Registered-user lookup (Phase 2 -- replaces findOrCreateUser)
// ---------------------------------------------------------------------------

/**
 * Looks up the authenticated user in the database.
 *
 * Security contract:
 *  1. Domain already validated in verifyGoogleToken.
 *  2. Email MUST exist in users table (no auto-provisioning).
 *  3. users.is_active must be 1.
 *  4. Matching row in students/faculty table must exist and be active.
 *  5. Role is read from users.role_id -> roles.name; never from the token.
 *  6. On first login (google_id was NULL), the google_id is backfilled.
 */
async function findRegisteredUser(profile) {
  // 1. Try by google_id first (fastest path after first login)
  let user = await UserModel.findByGoogleId(profile.googleId);

  // 2. Fall back to email lookup (covers pre-registered users with NULL google_id)
  if (!user) {
    user = await UserModel.findByEmail(profile.email);
  }

  // 3. Not found -- reject (no auto-provisioning)
  if (!user) {
    logger.warn('Login rejected -- unregistered email: ' + profile.email);
    throw ApiError.forbidden(
      'Your account is not registered in the system. ' +
      'Please contact your department administrator to be added.'
    );
  }

  // 4. Account deactivated at the users level
  if (!user.is_active) {
    logger.warn('Login rejected -- deactivated user: ' + profile.email);
    throw ApiError.forbidden(
      'Your account has been deactivated. Please contact your administrator.'
    );
  }

  // 5. Backfill google_id on first login for pre-registered users
  if (!user.google_id) {
    await UserModel.updateGoogleId(user.id, profile.googleId);
    logger.info('Backfilled google_id for pre-registered user: ' + profile.email);
  }

  // 6. Type-specific validation
  if (profile.domainType === 'student') {
    const studentRecord = await StudentModel.findByUserId(user.id);

    if (!studentRecord) {
      logger.warn('Login rejected -- no students record for: ' + profile.email);
      throw ApiError.forbidden(
        'No student record found for your account. ' +
        'Please contact your department administrator.'
      );
    }

    if (!studentRecord.is_active) {
      logger.warn('Login rejected -- deactivated student record: ' + profile.email);
      throw ApiError.forbidden(
        'Your student record has been deactivated. Please contact your administrator.'
      );
    }
  }

  if (profile.domainType === 'faculty') {
    const facultyRecord = await FacultyModel.findByUserId(user.id);

    if (!facultyRecord) {
      logger.warn('Login rejected -- no faculty record for: ' + profile.email);
      throw ApiError.forbidden(
        'No faculty record found for your account. ' +
        'Please contact your department administrator.'
      );
    }

    if (!facultyRecord.is_active) {
      logger.warn('Login rejected -- deactivated faculty record: ' + profile.email);
      throw ApiError.forbidden(
        'Your faculty record has been deactivated. Please contact your administrator.'
      );
    }
  }

  // 7. Update last login timestamp
  await UserModel.updateLastLogin(user.id);

  logger.info('Successful login: ' + profile.email + ' (role: ' + user.role + ')');
  return user;
}

// ---------------------------------------------------------------------------
// JWT issuance
// ---------------------------------------------------------------------------

/**
 * Issues a signed JWT. Role comes from the DB, never from the Google token.
 */
function issueJwt(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

module.exports = { verifyAuth0Token, verifyGoogleToken, findRegisteredUser, issueJwt };