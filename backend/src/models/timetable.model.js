const { pool } = require('../config/db');

const TimetableModel = {
  async list(opts = {}) {
    const page = Math.max(1, parseInt(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(opts.limit) || 20));
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];

    if (opts.academicYearId) {
      where.push('t.academic_year_id = ?');
      params.push(opts.academicYearId);
    }
    if (opts.semesterId) {
      where.push('t.semester_id = ?');
      params.push(opts.semesterId);
    }
    if (opts.divisionId) {
      where.push('t.division_id = ?');
      params.push(opts.divisionId);
    }
    if (opts.departmentId) {
      where.push('t.department_id = ?');
      params.push(opts.departmentId);
    }
    if (opts.status) {
      where.push('t.status = ?');
      params.push(opts.status);
    }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM timetables t ${whereSQL}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT t.*,
              ay.name AS academic_year_name,
              s.number AS semester_number,
              d.name AS division_name,
              dept.name AS department_name,
              u.name AS uploaded_by_name,
              COUNT(te.id) AS total_entries,
              COUNT(DISTINCT te.subject_id) AS distinct_subjects,
              COUNT(DISTINCT te.faculty_id) AS distinct_faculty
       FROM timetables t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       JOIN semesters s ON s.id = t.semester_id
       LEFT JOIN divisions d ON d.id = t.division_id
       LEFT JOIN departments dept ON dept.id = t.department_id
       JOIN users u ON u.id = t.uploaded_by
       LEFT JOIN timetable_entries te ON te.timetable_id = t.id
       ${whereSQL}
       GROUP BY t.id
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT t.*,
              ay.name AS academic_year_name,
              s.number AS semester_number,
              d.name AS division_name,
              dept.name AS department_name,
              u.name AS uploaded_by_name
       FROM timetables t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       JOIN semesters s ON s.id = t.semester_id
       LEFT JOIN divisions d ON d.id = t.division_id
       LEFT JOIN departments dept ON dept.id = t.department_id
       JOIN users u ON u.id = t.uploaded_by
       WHERE t.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async findActiveByScope({ academicYearId, semesterId, divisionId }) {
    let sql = `
      SELECT t.*, ay.name AS academic_year_name, s.number AS semester_number, d.name AS division_name
      FROM timetables t
      JOIN academic_years ay ON ay.id = t.academic_year_id
      JOIN semesters s ON s.id = t.semester_id
      LEFT JOIN divisions d ON d.id = t.division_id
      WHERE t.academic_year_id = ? AND t.semester_id = ? AND t.status = 'active'
    `;
    const params = [academicYearId, semesterId];
    if (divisionId) {
      sql += ` AND t.division_id = ?`;
      params.push(divisionId);
    } else {
      sql += ` AND t.division_id IS NULL`;
    }
    sql += ` ORDER BY t.version DESC LIMIT 1`;
    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
  },

  async getLatestVersion({ academicYearId, semesterId, divisionId }) {
    let sql = `
      SELECT MAX(version) AS max_version
      FROM timetables
      WHERE academic_year_id = ? AND semester_id = ?
    `;
    const params = [academicYearId, semesterId];
    if (divisionId) {
      sql += ` AND division_id = ?`;
      params.push(divisionId);
    } else {
      sql += ` AND division_id IS NULL`;
    }
    const [[{ max_version }]] = await pool.query(sql, params);
    return max_version || 0;
  },

  async create(data, conn = pool) {
    const [result] = await conn.query(
      `INSERT INTO timetables (
        academic_year_id, semester_id, division_id, department_id,
        file_name, file_type, file_path, uploaded_by, status, version, source_format, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.academicYearId,
        data.semesterId,
        data.divisionId || null,
        data.departmentId || null,
        data.fileName,
        data.fileType || null,
        data.filePath || null,
        data.uploadedBy,
        data.status || 'active',
        data.version || 1,
        data.sourceFormat || 'pdf',
        data.notes || null,
      ]
    );
    return result.insertId;
  },

  async update(id, data, conn = pool) {
    const fields = [];
    const params = [];
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
    if (data.notes !== undefined) { fields.push('notes = ?'); params.push(data.notes); }
    if (data.version !== undefined) { fields.push('version = ?'); params.push(data.version); }

    if (!fields.length) return false;
    params.push(id);
    const [result] = await conn.query(
      `UPDATE timetables SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    return result.affectedRows > 0;
  },

  async archivePreviousVersions({ academicYearId, semesterId, divisionId }, conn = pool) {
    let sql = `UPDATE timetables SET status = 'archived' WHERE academic_year_id = ? AND semester_id = ? AND status = 'active'`;
    const params = [academicYearId, semesterId];
    if (divisionId) {
      sql += ` AND division_id = ?`;
      params.push(divisionId);
    } else {
      sql += ` AND division_id IS NULL`;
    }
    const [result] = await conn.query(sql, params);
    return result.affectedRows;
  },

  async delete(id, conn = pool) {
    const [result] = await conn.query(`DELETE FROM timetables WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  },

  async logImport(logData, conn = pool) {
    const [res] = await conn.query(
      `INSERT INTO timetable_import_logs (
        timetable_id, uploaded_by, action, result, subjects_count, entries_count, conflicts_count, message, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logData.timetableId || null,
        logData.uploadedBy,
        logData.action,
        logData.result || 'success',
        logData.subjectsCount || 0,
        logData.entriesCount || 0,
        logData.conflictsCount || 0,
        logData.message || null,
        logData.details ? JSON.stringify(logData.details) : null,
      ]
    );
    return res.insertId;
  },

  async getLogs(timetableId = null) {
    let sql = `
      SELECT til.*, u.name AS user_name, t.file_name
      FROM timetable_import_logs til
      JOIN users u ON u.id = til.uploaded_by
      LEFT JOIN timetables t ON t.id = til.timetable_id
    `;
    const params = [];
    if (timetableId) {
      sql += ` WHERE til.timetable_id = ?`;
      params.push(timetableId);
    }
    sql += ` ORDER BY til.created_at DESC LIMIT 100`;
    const [rows] = await pool.query(sql, params);
    return rows;
  }
};

module.exports = TimetableModel;
