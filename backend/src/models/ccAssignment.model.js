const { pool } = require('../config/db');

const CCAssignmentModel = {
  /** List all CC assignments with batch, division, and faculty details */
  async list(opts = {}) {
    const deptId     = opts.departmentId || null;
    const batchId    = opts.batchId || null;
    const divisionId = opts.divisionId || null;

    let where = [];
    let params = [];
    if (deptId)     { where.push('b.department_id = ?');  params.push(deptId); }
    if (batchId)    { where.push('ca.batch_id = ?');      params.push(batchId); }
    if (divisionId) { where.push('ca.division_id = ?');   params.push(divisionId); }
    const whereSQL = where.length ? `AND ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT ca.*,
              b.name AS batch_name, b.department_id,
              d.name AS department_name,
              ay.name AS academic_year_name,
              dv.name AS division_name,
              sem.number AS semester_number,
              u.name AS faculty_name, u.email AS faculty_email,
              f.employee_id, f.designation,
              au.name AS assigned_by_name
       FROM cc_assignments ca
       JOIN batches b ON b.id = ca.batch_id
       JOIN departments d ON d.id = b.department_id
       JOIN academic_years ay ON ay.id = b.academic_year_id
       JOIN faculty f ON f.id = ca.faculty_id
       JOIN users u ON u.id = f.user_id
       LEFT JOIN divisions dv ON dv.id = ca.division_id
       LEFT JOIN semesters sem ON sem.id = dv.semester_id
       LEFT JOIN users au ON au.id = ca.assigned_by
       WHERE ca.is_active = 1 ${whereSQL}
       ORDER BY b.name ASC, dv.name ASC`,
      params
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT ca.*,
              b.name AS batch_name, b.department_id,
              d.name AS department_name,
              ay.name AS academic_year_name,
              dv.name AS division_name,
              sem.number AS semester_number,
              u.name AS faculty_name, u.email AS faculty_email,
              f.employee_id, f.designation
       FROM cc_assignments ca
       JOIN batches b ON b.id = ca.batch_id
       JOIN departments d ON d.id = b.department_id
       JOIN academic_years ay ON ay.id = b.academic_year_id
       JOIN faculty f ON f.id = ca.faculty_id
       JOIN users u ON u.id = f.user_id
       LEFT JOIN divisions dv ON dv.id = ca.division_id
       LEFT JOIN semesters sem ON sem.id = dv.semester_id
       WHERE ca.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByBatchId(batchId) {
    const [rows] = await pool.query(
      `SELECT ca.*,
              b.name AS batch_name,
              dv.name AS division_name,
              u.name AS faculty_name, u.email AS faculty_email,
              f.employee_id, f.id AS fac_id
       FROM cc_assignments ca
       JOIN batches b ON b.id = ca.batch_id
       JOIN faculty f ON f.id = ca.faculty_id
       JOIN users u ON u.id = f.user_id
       LEFT JOIN divisions dv ON dv.id = ca.division_id
       WHERE ca.batch_id = ? AND ca.division_id IS NULL AND ca.is_active = 1 LIMIT 1`,
      [batchId]
    );
    return rows[0] || null;
  },

  async findByBatchAndDivision(batchId, divisionId = null) {
    let sql = `SELECT ca.*,
                      b.name AS batch_name,
                      dv.name AS division_name,
                      u.name AS faculty_name, u.email AS faculty_email,
                      f.employee_id, f.id AS fac_id
               FROM cc_assignments ca
               JOIN batches b ON b.id = ca.batch_id
               JOIN faculty f ON f.id = ca.faculty_id
               JOIN users u ON u.id = f.user_id
               LEFT JOIN divisions dv ON dv.id = ca.division_id
               WHERE ca.batch_id = ? AND ca.is_active = 1`;
    const params = [batchId];
    if (divisionId) {
      sql += ` AND ca.division_id = ? LIMIT 1`;
      params.push(divisionId);
    } else {
      sql += ` AND ca.division_id IS NULL LIMIT 1`;
    }
    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
  },

  /** Find all batches / divisions where a faculty (by user_id) is assigned as CC */
  async findByFacultyUserId(userId) {
    const [rows] = await pool.query(
      `SELECT ca.*,
              b.name AS batch_name, b.department_id, b.academic_year_id,
              d.name AS department_name,
              ay.name AS academic_year_name,
              dv.name AS division_name, dv.semester_id,
              sem.number AS semester_number
       FROM cc_assignments ca
       JOIN batches b ON b.id = ca.batch_id
       JOIN departments d ON d.id = b.department_id
       JOIN academic_years ay ON ay.id = b.academic_year_id
       JOIN faculty f ON f.id = ca.faculty_id
       LEFT JOIN divisions dv ON dv.id = ca.division_id
       LEFT JOIN semesters sem ON sem.id = dv.semester_id
       WHERE f.user_id = ? AND ca.is_active = 1
       ORDER BY b.name ASC, dv.name ASC`,
      [userId]
    );
    return rows;
  },

  async create({ batchId, divisionId = null, facultyId, assignedBy }) {
    const divId = divisionId ? Number(divisionId) : null;

    // Find any existing active assignment for this batch and division
    let findSql = 'SELECT * FROM cc_assignments WHERE batch_id = ?';
    let findParams = [batchId];
    if (divId) {
      findSql += ' AND division_id = ?';
      findParams.push(divId);
    } else {
      findSql += ' AND division_id IS NULL';
    }

    const [existingRows] = await pool.query(findSql, findParams);
    if (existingRows.length > 0) {
      const primary = existingRows[0];
      await pool.query(
        `UPDATE cc_assignments 
         SET faculty_id = ?, assigned_by = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [facultyId, assignedBy || null, primary.id]
      );
      // If any extra duplicate records exist, deactivate them
      if (existingRows.length > 1) {
        const extraIds = existingRows.slice(1).map(r => r.id);
        await pool.query(
          `UPDATE cc_assignments SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id IN (?)`,
          [extraIds]
        );
      }
      return this.findById(primary.id);
    }

    const [result] = await pool.query(
      `INSERT INTO cc_assignments (batch_id, division_id, faculty_id, assigned_by, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         faculty_id = VALUES(faculty_id),
         assigned_by = VALUES(assigned_by),
         is_active = 1,
         updated_at = CURRENT_TIMESTAMP`,
      [batchId, divId, facultyId, assignedBy || null]
    );
    if (result.insertId) return this.findById(result.insertId);
    return this.findByBatchAndDivision(batchId, divId);
  },

  async update(id, { facultyId, divisionId, assignedBy }) {
    let updates = ['faculty_id = ?', 'assigned_by = ?', 'is_active = 1'];
    let params = [facultyId, assignedBy || null];
    if (divisionId !== undefined) {
      updates.push('division_id = ?');
      params.push(divisionId ? Number(divisionId) : null);
    }
    params.push(id);

    await pool.query(
      `UPDATE cc_assignments SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return this.findById(id);
  },

  async remove(id) {
    await pool.query(
      `UPDATE cc_assignments SET is_active = 0 WHERE id = ?`,
      [id]
    );
    return true;
  },

  async hardDelete(id) {
    const [result] = await pool.query('DELETE FROM cc_assignments WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = CCAssignmentModel;
