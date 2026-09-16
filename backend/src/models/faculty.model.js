const { pool } = require('../config/db');

const FacultyModel = {
  async list(opts = {}) {
    const page   = Math.max(1, parseInt(opts.page) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(opts.limit) || 20));
    const offset = (page - 1) * limit;
    const search = opts.search ? `%${opts.search}%` : null;
    const deptId = opts.departmentId || null;

    let where  = [];
    let params = [];
    if (deptId) { where.push('u.department_id = ?'); params.push(deptId); }
    if (search) {
      where.push('(u.name LIKE ? OR u.email LIKE ? OR f.employee_id LIKE ?)');
      params.push(search, search, search);
    }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM faculty f JOIN users u ON u.id = f.user_id ${whereSQL}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT f.*, u.name, u.email, u.avatar_url, u.department_id,
              r.name AS role, d.name AS department_name
       FROM faculty f
       JOIN users u ON u.id = f.user_id
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
       ${whereSQL}
       ORDER BY u.name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT f.*, u.name, u.email, u.avatar_url, r.name AS role,
              d.name AS department_name
       FROM faculty f
       JOIN users u ON u.id = f.user_id
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE f.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByUserId(userId) {
    const [rows] = await pool.query(
      `SELECT f.*, u.name, u.email, u.avatar_url
       FROM faculty f JOIN users u ON u.id = f.user_id
       WHERE f.user_id = ? LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  async create({ userId, employeeId, designation }) {
    const [result] = await pool.query(
      'INSERT INTO faculty (user_id, employee_id, designation) VALUES (?, ?, ?)',
      [userId, employeeId, designation || null]
    );
    return this.findById(result.insertId);
  },

  async update(id, { employeeId, designation, isActive, departmentId }) {
    await pool.query(
      'UPDATE faculty SET employee_id=?, designation=?, is_active=? WHERE id=?',
      [employeeId, designation || null, isActive !== undefined ? isActive : 1, id]
    );
    // If departmentId is provided, update the user's department
    if (departmentId !== undefined) {
      const [facRow] = await pool.query('SELECT user_id FROM faculty WHERE id = ?', [id]);
      if (facRow[0]) {
        await pool.query('UPDATE users SET department_id = ? WHERE id = ?', [departmentId || null, facRow[0].user_id]);
      }
    }
    return this.findById(id);
  },

  async remove(id) {
    const [rows] = await pool.query('SELECT user_id FROM faculty WHERE id = ?', [id]);
    if (!rows[0]) return false;
    await pool.query('UPDATE faculty SET is_active = 0 WHERE id = ?', [id]);
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [rows[0].user_id]);
    return true;
  },

  /** All active faculty – used by dropdowns */
  async allActive() {
    const [rows] = await pool.query(
      `SELECT f.id, u.name, u.email, f.designation, f.employee_id,
              u.department_id, d.name AS department_name
       FROM faculty f
       JOIN users u ON u.id = f.user_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE f.is_active = 1 ORDER BY u.name ASC`
    );
    return rows;
  },
};

module.exports = FacultyModel;