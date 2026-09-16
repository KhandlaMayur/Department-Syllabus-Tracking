/**
 * Centralized environment configuration.
 * Every other module should read config from here instead of
 * touching process.env directly — keeps env access in one place
 * and lets us validate required vars at startup.
 */
require('dotenv').config();

const required = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];

function assertRequiredEnv() {
  const missing = required.filter((key) => process.env[key] === undefined);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[config] Warning: missing environment variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in the values.'
    );
  }
}

assertRequiredEnv();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiVersion: process.env.API_VERSION || 'v1',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'syllabus_tracker',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  },

  auth0: {
    domain: process.env.AUTH0_DOMAIN || 'dev-f3x1gt78huzgn1l3.us.auth0.com',
    clientId: process.env.AUTH0_CLIENT_ID || 'pFOaF5HlbMhpGIdYtMqv2j1CZmbr8IVn',
    clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  allowedEmailDomain: process.env.ALLOWED_EMAIL_DOMAIN || '',

  // Phase 2: dual-domain routing
  studentEmailDomain: process.env.STUDENT_EMAIL_DOMAIN || 'marwadiuniversity.ac.in',
  facultyEmailDomain: process.env.FACULTY_EMAIL_DOMAIN || 'marwadieducation.edu.in',
};
