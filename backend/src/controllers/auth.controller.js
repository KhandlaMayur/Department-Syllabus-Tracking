const catchAsync = require('../utils/catchAsync');
const authService = require('../services/auth.service');
const UserModel = require('../models/user.model');

/**
 * POST /api/v1/auth/google
 * Body: { idToken: string }
 *
 * Security flow:
 *  1. Verify token signature against Google public keys.
 *  2. Classify domain (student vs faculty) -- reject everything else.
 *  3. Look up email in database -- reject if not pre-registered.
 *  4. Check is_active on users + students/faculty table.
 *  5. Backfill google_id if this is the user first login.
 *  6. Issue JWT with role read from DB (never from token).
 */
async function formatUserResponse(user) {
  const { pool } = require('../config/db');
  let isCC = false;
  let ccAssignments = [];
  if (user.role === 'faculty' || user.role === 'cc') {
    try {
      const [cca] = await pool.query(
        `SELECT ca.*, b.name as batch_name, d.name as division_name, dept.name as department_name, sem.number as semester_number
         FROM cc_assignments ca
         JOIN faculty f ON f.id = ca.faculty_id
         JOIN batches b ON b.id = ca.batch_id
         JOIN departments dept ON dept.id = b.department_id
         LEFT JOIN divisions d ON d.id = ca.division_id
         LEFT JOIN semesters sem ON sem.id = d.semester_id
         WHERE f.user_id = ? AND ca.is_active = 1`,
        [user.id]
      );
      if (cca.length > 0) {
        isCC = true;
        ccAssignments = cca;
      }
    } catch (e) {
      // ignore
    }
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatar_url,
    isCC,
    ccAssignments,
  };
}

/**
 * POST /api/v1/auth/auth0
 * Body: { token?: string, idToken?: string }
 */
const auth0Login = catchAsync(async (req, res) => {
  const token = req.body.token || req.body.idToken;
  if (!token) {
    return res.status(400).json({
      success: false,
      error: { message: 'token is required' },
    });
  }

  const profile = await authService.verifyAuth0Token(token);
  const user = await authService.findRegisteredUser(profile);
  const appToken = authService.issueJwt(user);
  const userResp = await formatUserResponse(user);

  res.status(200).json({
    success: true,
    data: {
      token: appToken,
      user: userResp,
    },
  });
});

const googleLogin = catchAsync(async (req, res) => {
  const idToken = req.body.idToken || req.body.token;

  let profile;
  try {
    profile = await authService.verifyGoogleToken(idToken);
  } catch (err) {
    // Fall back to Auth0 verification if client passes an Auth0 token to google endpoint
    profile = await authService.verifyAuth0Token(idToken);
  }

  const user = await authService.findRegisteredUser(profile);
  const token = authService.issueJwt(user);
  const userResp = await formatUserResponse(user);

  res.status(200).json({
    success: true,
    data: {
      token,
      user: userResp,
    },
  });
});

/**
 * GET /api/v1/auth/me
 * Returns fresh user data from the DB (not just what is in the JWT).
 */
const getCurrentUser = catchAsync(async (req, res) => {
  const user = await UserModel.findById(req.user.sub);

  if (!user || !user.is_active) {
    return res.status(401).json({
      success: false,
      error: { message: 'Your account is no longer active. Please contact your administrator.' },
    });
  }

  const userResp = await formatUserResponse(user);

  res.status(200).json({
    success: true,
    data: userResp,
  });
});

/**
 * POST /api/v1/auth/logout
 * Stateless JWT logout -- primarily signals the client to clear its session.
 * Also logs the event for the audit trail.
 */
const logout = catchAsync(async (req, res) => {
  const logger = require('../utils/logger');
  const userId = req.user && req.user.sub;
  const email  = req.user && req.user.email;
  if (userId) {
    logger.info('User logged out: ' + email + ' (id: ' + userId + ')');
  }

  res.status(200).json({
    success: true,
    data: { message: 'Logged out successfully.' },
  });
});

/**
 * POST /api/v1/auth/dev-login
 * Body: { email: string }
 * Enables instant role testing without passwords or external OAuth dependencies.
 */
const devLogin = catchAsync(async (req, res) => {
  const config = require('../config/env');
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Email is required' },
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const domain = normalizedEmail.split('@')[1] || '';

  const studentDomain = (config.studentEmailDomain || 'marwadiuniversity.ac.in').toLowerCase();
  const facultyDomain = (config.facultyEmailDomain || 'marwadieducation.edu.in').toLowerCase();
  const allowedFacultyDomains = [facultyDomain, 'marwadieducation.ed'];
  const isFaculty = allowedFacultyDomains.includes(domain);
  const isStudent = domain === studentDomain;

  if (!isStudent && !isFaculty) {
    return res.status(403).json({
      success: false,
      error: {
        message:
          'Sign-in is restricted to official Marwadi University accounts (@' +
          studentDomain +
          ', @' +
          facultyDomain +
          ', or @marwadieducation.ed).',
      },
    });
  }

  // 1. Check if user already exists
  let user = await UserModel.findByEmail(normalizedEmail);

  // 2. If not found, auto-create for testing
  if (!user) {
    let roleName = 'student';
    if (isFaculty) {
      if (
        normalizedEmail === 'chandrasinh.parmar@marwadieducation.edu.in' ||
        normalizedEmail === 'chandrasinh.parmar@marwadieducation.ed' ||
        normalizedEmail.startsWith('hod')
      ) {
        roleName = 'hod';
      } else if (normalizedEmail.includes('cc') || normalizedEmail.includes('coordinator')) {
        roleName = 'cc';
      } else {
        roleName = 'faculty';
      }
    }

    const role = await UserModel.findRoleByName(roleName);
    const roleId = role
      ? role.id
      : roleName === 'hod'
      ? 4
      : roleName === 'cc'
      ? 3
      : roleName === 'faculty'
      ? 2
      : 1;

    const prettyName = normalizedEmail
      .split('@')[0]
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    user = await UserModel.create({
      googleId: null,
      name: prettyName,
      email: normalizedEmail,
      avatarUrl: null,
      roleId,
      departmentId: 1,
    });

    const { pool } = require('../config/db');
    if (domain === studentDomain) {
      const [semRow] = await pool.query('SELECT id, number FROM semesters WHERE number = 5 LIMIT 1');
      const semId = semRow[0]?.id || 2;
      const [divRow] = await pool.query('SELECT id FROM divisions WHERE name = "EK1" AND (semester_id = ? OR semester_id IS NULL) LIMIT 1', [semId]);
      const divId = divRow[0]?.id || 9;
      await pool.query(
        `INSERT IGNORE INTO students (user_id, enrollment_number, semester, semester_id, division, division_id, batch, is_active)
         VALUES (?, CONCAT('MU', LPAD(?, 6, '0')), 5, ?, 'EK1', ?, '2022-26', 1)`,
        [user.id, user.id, semId, divId]
      );
    } else {
      const designation =
        roleName === 'hod'
          ? 'Head of Department'
          : roleName === 'cc'
          ? 'Course Coordinator'
          : 'Assistant Professor';
      await pool.query(
        `INSERT IGNORE INTO faculty (user_id, employee_id, designation, is_active)
         VALUES (?, CONCAT('EMP', LPAD(?, 5, '0')), ?, 1)`,
        [user.id, user.id, designation]
      );
    }
  }

  if (!user.is_active) {
    return res.status(403).json({
      success: false,
      error: { message: 'Your account has been deactivated. Please contact your administrator.' },
    });
  }

  await UserModel.updateLastLogin(user.id);
  const token = authService.issueJwt(user);

  const userResp = await formatUserResponse(user);

  res.status(200).json({
    success: true,
    data: {
      token,
      user: userResp,
    },
  });
});

module.exports = { auth0Login, googleLogin, getCurrentUser, logout, devLogin };