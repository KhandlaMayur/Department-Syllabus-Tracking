const { pool } = require('../config/db');

const BatchModel = {
  async list(opts = {}) {
    const page    = Math.max(1, parseInt(opts.page) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(opts.limit) || 20));
    const offset  = (page - 1) * limit;
    const search  = opts.search ? `%${opts.search}%` : null;
    const deptId  = opts.departmentId || null;

    let where  = [];
    let params = [];
    if (deptId)  { where.push('b.department_id = ?');  params.push(deptId); }
    if (search)  { where.push('b.name LIKE ?');         params.push(search); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM batches b ${whereSQL}`, params
    );
    const [rows] = await pool.query(
      `SELECT b.*, d.name AS department_name, ay.name AS academic_year_name,
              ca.id AS cc_assignment_id, ca.faculty_id AS cc_faculty_id,
              u.name AS cc_faculty_name, u.email AS cc_faculty_email,
              f.employee_id AS cc_employee_id, f.designation AS cc_designation,
              (SELECT COUNT(*) FROM cc_assignments ca2 WHERE ca2.batch_id = b.id AND ca2.is_active = 1) AS total_cc_count
       FROM batches b
       JOIN departments  d  ON d.id  = b.department_id
       JOIN academic_years ay ON ay.id = b.academic_year_id
       LEFT JOIN cc_assignments ca ON ca.batch_id = b.id AND ca.division_id IS NULL AND ca.is_active = 1
       LEFT JOIN faculty f ON f.id = ca.faculty_id
       LEFT JOIN users u ON u.id = f.user_id
       ${whereSQL}
       ORDER BY b.name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    if (rows.length > 0) {
      const batchIds = rows.map(r => r.id);
      const [ccRows] = await pool.query(
        `SELECT ca.id, ca.batch_id, ca.division_id, ca.faculty_id,
                u.name AS faculty_name, u.email AS faculty_email,
                f.employee_id, f.designation,
                dv.name AS division_name, sem.number AS semester_number
         FROM cc_assignments ca
         JOIN faculty f ON f.id = ca.faculty_id
         JOIN users u ON u.id = f.user_id
         LEFT JOIN divisions dv ON dv.id = ca.division_id
         LEFT JOIN semesters sem ON sem.id = dv.semester_id
         WHERE ca.batch_id IN (?) AND ca.is_active = 1
         ORDER BY (ca.division_id IS NOT NULL), dv.name ASC`,
        [batchIds]
      );
      const ccMap = {};
      for (const cc of ccRows) {
        if (!ccMap[cc.batch_id]) ccMap[cc.batch_id] = [];
        ccMap[cc.batch_id].push(cc);
      }
      for (const r of rows) {
        r.cc_assignments = ccMap[r.id] || [];
      }
    }

    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT b.*, d.name AS department_name, ay.name AS academic_year_name,
              ca.id AS cc_assignment_id, ca.faculty_id AS cc_faculty_id,
              u.name AS cc_faculty_name, u.email AS cc_faculty_email,
              f.employee_id AS cc_employee_id, f.designation AS cc_designation,
              (SELECT COUNT(*) FROM cc_assignments ca2 WHERE ca2.batch_id = b.id AND ca2.is_active = 1) AS total_cc_count
       FROM batches b
       JOIN departments  d  ON d.id  = b.department_id
       JOIN academic_years ay ON ay.id = b.academic_year_id
       LEFT JOIN cc_assignments ca ON ca.batch_id = b.id AND ca.division_id IS NULL AND ca.is_active = 1
       LEFT JOIN faculty f ON f.id = ca.faculty_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE b.id = ? LIMIT 1`,
      [id]
    );

    if (rows[0]) {
      const [ccRows] = await pool.query(
        `SELECT ca.id, ca.batch_id, ca.division_id, ca.faculty_id,
                u.name AS faculty_name, u.email AS faculty_email,
                f.employee_id, f.designation,
                dv.name AS division_name, sem.number AS semester_number
         FROM cc_assignments ca
         JOIN faculty f ON f.id = ca.faculty_id
         JOIN users u ON u.id = f.user_id
         LEFT JOIN divisions dv ON dv.id = ca.division_id
         LEFT JOIN semesters sem ON sem.id = dv.semester_id
         WHERE ca.batch_id = ? AND ca.is_active = 1
         ORDER BY (ca.division_id IS NOT NULL), dv.name ASC`,
        [id]
      );
      rows[0].cc_assignments = ccRows;
    }

    return rows[0] || null;
  },

  async create({ name, departmentId, academicYearId }) {
    const [result] = await pool.query(
      'INSERT INTO batches (name, department_id, academic_year_id) VALUES (?, ?, ?)',
      [name, departmentId, academicYearId]
    );
    return this.findById(result.insertId);
  },

  async update(id, { name, departmentId, academicYearId, isActive }) {
    await pool.query(
      'UPDATE batches SET name=?, department_id=?, academic_year_id=?, is_active=? WHERE id=?',
      [name, departmentId, academicYearId, isActive !== undefined ? isActive : 1, id]
    );
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query('DELETE FROM batches WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = BatchModel;
