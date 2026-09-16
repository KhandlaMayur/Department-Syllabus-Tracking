const { pool } = require('../config/db');

const SubjectAssignmentModel = {
  async list(opts = {}) {
    const page    = Math.max(1, parseInt(opts.page) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(opts.limit) || 20));
    const offset  = (page - 1) * limit;
    const yearId  = opts.academicYearId || null;
    const divId   = opts.divisionId || null;
    const facId   = opts.facultyId || null;
    const subjId  = opts.subjectId || null;

    let where  = [];
    let params = [];
    if (yearId) { where.push('sa.academic_year_id = ?'); params.push(yearId); }
    if (divId)  { where.push('sa.division_id = ?');      params.push(divId); }
    if (facId)  { where.push('sa.faculty_id = ?');       params.push(facId); }
    if (subjId) { where.push('sa.subject_id = ?');       params.push(subjId); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM subject_assignments sa ${whereSQL}`, params
    );
    const [rows] = await pool.query(
      `SELECT sa.*,
              subj.code AS subject_code, subj.name AS subject_name,
              u.name AS faculty_name, u.email AS faculty_email,
              dv.name AS division_name,
              sem.number AS semester_number,
              ay.name AS academic_year_name
       FROM subject_assignments sa
       JOIN subjects      subj ON subj.id = sa.subject_id
       JOIN faculty       f    ON f.id    = sa.faculty_id
       JOIN users         u    ON u.id    = f.user_id
       JOIN divisions     dv   ON dv.id   = sa.division_id
       JOIN semesters     sem  ON sem.id  = sa.semester_id
       JOIN academic_years ay  ON ay.id   = sa.academic_year_id
       ${whereSQL}
       ORDER BY ay.name DESC, sem.number ASC, subj.code ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT sa.*,
              subj.code AS subject_code, subj.name AS subject_name,
              u.name AS faculty_name,
              dv.name AS division_name,
              sem.number AS semester_number,
              ay.name AS academic_year_name
       FROM subject_assignments sa
       JOIN subjects      subj ON subj.id = sa.subject_id
       JOIN faculty       f    ON f.id    = sa.faculty_id
       JOIN users         u    ON u.id    = f.user_id
       JOIN divisions     dv   ON dv.id   = sa.division_id
       JOIN semesters     sem  ON sem.id  = sa.semester_id
       JOIN academic_years ay  ON ay.id   = sa.academic_year_id
       WHERE sa.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ subjectId, facultyId, divisionId, semesterId, academicYearId }) {
    const [result] = await pool.query(
      `INSERT INTO subject_assignments
         (subject_id, faculty_id, division_id, semester_id, academic_year_id)
       VALUES (?, ?, ?, ?, ?)`,
      [subjectId, facultyId, divisionId, semesterId, academicYearId]
    );
    return this.findById(result.insertId);
  },

  async update(id, { subjectId, facultyId, divisionId, semesterId, academicYearId, isActive }) {
    await pool.query(
      `UPDATE subject_assignments
       SET subject_id=?, faculty_id=?, division_id=?, semester_id=?, academic_year_id=?, is_active=?
       WHERE id=?`,
      [subjectId, facultyId, divisionId, semesterId, academicYearId,
       isActive !== undefined ? isActive : 1, id]
    );
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query('DELETE FROM subject_assignments WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  /** Get all assignments for a specific faculty user (by user_id, not faculty.id) */
  async findByFacultyUserId(userId) {
    const [rows] = await pool.query(
      `SELECT sa.*, subj.code, subj.name AS subject_name, subj.credits,
              dept.name AS department_name,
              dv.name AS division_name, dv.batch_id,
              b.name AS batch_name,
              sem.number AS semester_number,
              ay.name AS academic_year_name
       FROM subject_assignments sa
       JOIN faculty f ON f.id = sa.faculty_id AND f.user_id = ?
       JOIN subjects subj ON subj.id = sa.subject_id
       LEFT JOIN departments dept ON dept.id = subj.department_id
       JOIN divisions dv ON dv.id = sa.division_id
       LEFT JOIN batches b ON b.id = dv.batch_id
       JOIN semesters sem ON sem.id = sa.semester_id
       LEFT JOIN academic_years ay ON ay.id = sa.academic_year_id
       WHERE sa.is_active = 1
       ORDER BY sem.number ASC, subj.name ASC`,
      [userId]
    );
    return rows;
  },
};

module.exports = SubjectAssignmentModel;
