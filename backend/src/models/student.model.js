const { pool } = require('../config/db');

const StudentModel = {
  async list(opts = {}) {
    const page    = Math.max(1, parseInt(opts.page) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(opts.limit) || 20));
    const offset  = (page - 1) * limit;
    const search  = opts.search ? `%${opts.search}%` : null;
    const batchId = opts.batchId || null;
    const divId   = opts.divisionId || null;

    let where  = [];
    let params = [];
    if (batchId) { where.push('st.batch_id = ?');    params.push(batchId); }
    if (divId)   { where.push('st.division_id = ?'); params.push(divId); }
    if (search)  {
      where.push('(u.name LIKE ? OR u.email LIKE ? OR st.enrollment_number LIKE ?)');
      params.push(search, search, search);
    }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM students st JOIN users u ON u.id = st.user_id ${whereSQL}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT st.*, u.name, u.email, u.avatar_url,
              b.name AS batch_name, dv.name AS division_name
       FROM students st
       JOIN users u ON u.id = st.user_id
       LEFT JOIN batches   b  ON b.id  = st.batch_id
       LEFT JOIN divisions dv ON dv.id = st.division_id
       ${whereSQL}
       ORDER BY u.name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT st.*, u.name, u.email, u.avatar_url, r.name AS role,
              b.name AS batch_name, dv.name AS division_name
       FROM students st
       JOIN users u ON u.id = st.user_id
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN batches   b  ON b.id  = st.batch_id
       LEFT JOIN divisions dv ON dv.id = st.division_id
       WHERE st.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByUserId(userId) {
    const [rows] = await pool.query(
      `SELECT st.*, u.name, u.email, u.avatar_url, u.department_id,
              dv.name AS division_name,
              sem.number AS semester_number,
              b.name AS batch_name
       FROM students st
       JOIN users u ON u.id = st.user_id
       LEFT JOIN divisions dv ON dv.id = st.division_id
       LEFT JOIN semesters sem ON sem.id = st.semester_id
       LEFT JOIN batches b ON b.id = st.batch_id
       WHERE st.user_id = ? LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  async create({ userId, enrollmentNumber, semester, division, batch, batchId, divisionId, semesterId }) {
    const [result] = await pool.query(
      `INSERT INTO students
         (user_id, enrollment_number, semester, division, batch, batch_id, division_id, semester_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, enrollmentNumber, semester || null, division || null, batch || null,
       batchId || null, divisionId || null, semesterId || null]
    );
    return this.findById(result.insertId);
  },

  async update(id, { enrollmentNumber, semester, division, batch, batchId, divisionId, semesterId, isActive }) {
    await pool.query(
      `UPDATE students SET
         enrollment_number=?, semester=?, division=?, batch=?,
         batch_id=?, division_id=?, semester_id=?, is_active=?
       WHERE id=?`,
      [enrollmentNumber, semester || null, division || null, batch || null,
       batchId || null, divisionId || null, semesterId || null,
       isActive !== undefined ? isActive : 1, id]
    );
    return this.findById(id);
  },

  async remove(id) {
    // Soft-delete: deactivate student record and user
    const [rows] = await pool.query('SELECT user_id FROM students WHERE id = ?', [id]);
    if (!rows[0]) return false;
    await pool.query('UPDATE students SET is_active = 0 WHERE id = ?', [id]);
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [rows[0].user_id]);
    return true;
  },
};

module.exports = StudentModel;