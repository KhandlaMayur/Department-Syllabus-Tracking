const { pool } = require('../config/db');

const FacultyInitialModel = {
  async listByDept(deptId = null) {
    let sql = `
      SELECT fi.*, f.employee_id, u.name AS faculty_user_name, u.email AS faculty_email, d.name AS department_name
      FROM faculty_initials fi
      LEFT JOIN faculty f ON f.id = fi.faculty_id
      LEFT JOIN users u ON u.id = f.user_id
      LEFT JOIN departments d ON d.id = fi.department_id
    `;
    const params = [];
    if (deptId) {
      sql += ` WHERE fi.department_id = ?`;
      params.push(deptId);
    }
    sql += ` ORDER BY fi.initials ASC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async findByInitial(initials, deptId = null) {
    let sql = `SELECT * FROM faculty_initials WHERE UPPER(initials) = UPPER(?)`;
    const params = [initials.trim()];
    if (deptId) {
      sql += ` AND (department_id = ? OR department_id IS NULL)`;
      params.push(deptId);
    }
    sql += ` ORDER BY department_id DESC LIMIT 1`;
    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
  },

  async upsert({ initials, facultyId, facultyName, departmentId }) {
    const cleanInitials = initials.trim().toUpperCase();
    const [existing] = await pool.query(
      `SELECT id FROM faculty_initials WHERE UPPER(initials) = ? AND (department_id = ? OR (department_id IS NULL AND ? IS NULL))`,
      [cleanInitials, departmentId || null, departmentId || null]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE faculty_initials SET faculty_id = ?, faculty_name = ?, department_id = ? WHERE id = ?`,
        [facultyId || null, facultyName || null, departmentId || null, existing[0].id]
      );
      return existing[0].id;
    } else {
      const [res] = await pool.query(
        `INSERT INTO faculty_initials (initials, faculty_id, faculty_name, department_id) VALUES (?, ?, ?, ?)`,
        [cleanInitials, facultyId || null, facultyName || null, departmentId || null]
      );
      return res.insertId;
    }
  },

  async delete(id) {
    const [res] = await pool.query(`DELETE FROM faculty_initials WHERE id = ?`, [id]);
    return res.affectedRows > 0;
  }
};

module.exports = FacultyInitialModel;
