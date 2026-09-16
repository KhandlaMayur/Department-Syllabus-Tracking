const { pool } = require('../config/db');

const SubjectModel = {
  async list(opts = {}) {
    const page    = Math.max(1, parseInt(opts.page) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(opts.limit) || 20));
    const offset  = (page - 1) * limit;
    const search  = opts.search ? `%${opts.search}%` : null;
    const deptId  = opts.departmentId || null;
    const semNum  = opts.semesterNumber || null;

    let where  = [];
    let params = [];
    if (deptId) { where.push('s.department_id = ?');     params.push(deptId); }
    if (semNum) { where.push('s.semester_number = ?');   params.push(semNum); }
    if (search) { where.push('(s.name LIKE ? OR s.code LIKE ?)'); params.push(search, search); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM subjects s ${whereSQL}`, params
    );
    const [rows] = await pool.query(
      `SELECT s.*, d.name AS department_name,
              COUNT(DISTINCT sa.id) AS assignment_count,
              GROUP_CONCAT(DISTINCT u.name ORDER BY u.name SEPARATOR ', ') AS assigned_faculty_names
       FROM subjects s
       JOIN departments d ON d.id = s.department_id
       LEFT JOIN subject_assignments sa ON sa.subject_id = s.id AND sa.is_active = 1
       LEFT JOIN faculty f ON f.id = sa.faculty_id
       LEFT JOIN users u ON u.id = f.user_id
       ${whereSQL}
       GROUP BY s.id, d.name
       ORDER BY s.code ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT s.*, d.name AS department_name
       FROM subjects s
       JOIN departments d ON d.id = s.department_id
       WHERE s.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByCode(code) {
    const [rows] = await pool.query('SELECT * FROM subjects WHERE code = ? LIMIT 1', [code]);
    return rows[0] || null;
  },

  async create({ code, name, departmentId, semesterNumber, credits }) {
    const [result] = await pool.query(
      'INSERT INTO subjects (code, name, department_id, semester_number, credits) VALUES (?, ?, ?, ?, ?)',
      [code.toUpperCase(), name, departmentId, semesterNumber, credits || 4.0]
    );
    return this.findById(result.insertId);
  },

  async update(id, { code, name, departmentId, semesterNumber, credits, isActive }) {
    await pool.query(
      'UPDATE subjects SET code=?, name=?, department_id=?, semester_number=?, credits=?, is_active=? WHERE id=?',
      [code.toUpperCase(), name, departmentId, semesterNumber, credits || 4.0,
       isActive !== undefined ? isActive : 1, id]
    );
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query('DELETE FROM subjects WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = SubjectModel;
