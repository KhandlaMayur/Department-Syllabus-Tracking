const { pool } = require('../config/db');

/**
 * Data-access layer for the `users` table. Controllers/services should
 * never write raw SQL themselves — everything goes through here so the
 * query surface is easy to audit and swap for an ORM later if needed.
 */
const UserModel = {
  async findByEmail(email) {
    const [rows] = await pool.query(
      `SELECT u.*, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = ? LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  },

  async findByGoogleId(googleId) {
    const [rows] = await pool.query(
      `SELECT u.*, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.google_id = ? LIMIT 1`,
      [googleId]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT u.*, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ googleId, name, email, avatarUrl, roleId, departmentId }) {
    const [result] = await pool.query(
      `INSERT INTO users (google_id, name, email, avatar_url, role_id, department_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [googleId, name, email, avatarUrl || null, roleId, departmentId || null]
    );
    return this.findById(result.insertId);
  },

  async updateLastLogin(id) {
    await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [id]);
  },

  async findRoleByName(name) {
    const [rows] = await pool.query(`SELECT * FROM roles WHERE name = ? LIMIT 1`, [name]);
    return rows[0] || null;
  },

  /**
   * Like findByEmail but also ensures is_active = 1.
   * Used by Phase 2 auth to reject deactivated accounts early.
   */
  async findActiveByEmail(email) {
    const [rows] = await pool.query(
      `SELECT u.*, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = ? AND u.is_active = 1 LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Backfills google_id on the first login for pre-registered users
   * (those inserted by an admin before they ever signed in).
   */
  async updateGoogleId(id, googleId) {
    await pool.query(`UPDATE users SET google_id = ? WHERE id = ?`, [googleId, id]);
  },
};

module.exports = UserModel;
