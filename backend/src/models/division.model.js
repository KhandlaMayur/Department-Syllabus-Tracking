const { pool } = require('../config/db');

const DivisionModel = {
  async list(opts = {}) {
    const page    = Math.max(1, parseInt(opts.page) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(opts.limit) || 20));
    const offset  = (page - 1) * limit;
    const search  = opts.search ? `%${opts.search}%` : null;
    const batchId = opts.batchId || null;

    let where  = [];
    let params = [];
    if (batchId) { where.push('dv.batch_id = ?');  params.push(batchId); }
    if (search)  { where.push('dv.name LIKE ?');   params.push(search); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM divisions dv ${whereSQL}`, params
    );
    const [rows] = await pool.query(
      `SELECT dv.*, b.name AS batch_name, s.number AS semester_number,
              ay.name AS academic_year_name,
              ca.id AS cc_assignment_id, ca.faculty_id AS cc_faculty_id,
              u.name AS cc_faculty_name, u.email AS cc_faculty_email,
              f.employee_id AS cc_employee_id, f.designation AS cc_designation,
              (SELECT COUNT(*) FROM students st
               WHERE st.division_id = dv.id
                  OR (st.division = dv.name AND (st.batch_id = dv.batch_id OR st.batch = b.name))
              ) AS student_count
       FROM divisions dv
       JOIN batches b ON b.id = dv.batch_id
       JOIN semesters s ON s.id = dv.semester_id
       JOIN academic_years ay ON ay.id = s.academic_year_id
       LEFT JOIN cc_assignments ca ON ca.division_id = dv.id AND ca.is_active = 1
       LEFT JOIN faculty f ON f.id = ca.faculty_id
       LEFT JOIN users u ON u.id = f.user_id
       ${whereSQL}
       ORDER BY dv.name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT dv.*, b.name AS batch_name, s.number AS semester_number,
              ay.name AS academic_year_name,
              ca.id AS cc_assignment_id, ca.faculty_id AS cc_faculty_id,
              u.name AS cc_faculty_name, u.email AS cc_faculty_email,
              f.employee_id AS cc_employee_id, f.designation AS cc_designation,
              (SELECT COUNT(*) FROM students st
               WHERE st.division_id = dv.id
                  OR (st.division = dv.name AND (st.batch_id = dv.batch_id OR st.batch = b.name))
              ) AS student_count
       FROM divisions dv
       JOIN batches b ON b.id = dv.batch_id
       JOIN semesters s ON s.id = dv.semester_id
       JOIN academic_years ay ON ay.id = s.academic_year_id
       LEFT JOIN cc_assignments ca ON ca.division_id = dv.id AND ca.is_active = 1
       LEFT JOIN faculty f ON f.id = ca.faculty_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE dv.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async getStudents(divisionId) {
    const division = await this.findById(divisionId);
    if (!division) return null;

    const [students] = await pool.query(
      `SELECT st.id, st.enrollment_number, st.roll_number, u.name, u.email, st.is_active
       FROM students st
       JOIN users u ON u.id = st.user_id
       WHERE (st.division_id = ? OR (st.division = ? AND (st.batch_id = ? OR st.batch = ?)))
         AND st.is_active = 1
       ORDER BY CAST(st.roll_number AS UNSIGNED) ASC, st.roll_number ASC, u.name ASC`,
      [divisionId, division.name, division.batch_id, division.batch_name]
    );

    return {
      division,
      students,
    };
  },

  async create({ name, batchId, semesterId }) {
    const [result] = await pool.query(
      'INSERT INTO divisions (name, batch_id, semester_id) VALUES (?, ?, ?)',
      [name, batchId, semesterId]
    );
    return this.findById(result.insertId);
  },

  async update(id, { name, batchId, semesterId, isActive }) {
    await pool.query(
      'UPDATE divisions SET name=?, batch_id=?, semester_id=?, is_active=? WHERE id=?',
      [name, batchId, semesterId, isActive !== undefined ? isActive : 1, id]
    );
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query('DELETE FROM divisions WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = DivisionModel;
