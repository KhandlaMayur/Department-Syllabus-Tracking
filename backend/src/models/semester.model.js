const { pool } = require('../config/db');

const SemesterModel = {
  async list(opts = {}) {
    const page    = Math.max(1, parseInt(opts.page) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(opts.limit) || 20));
    const offset  = (page - 1) * limit;
    const yearId  = opts.academicYearId || null;

    let where  = yearId ? 'WHERE s.academic_year_id = ?' : '';
    let params = yearId ? [yearId] : [];

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM semesters s ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT s.*, ay.name AS academic_year_name
       FROM semesters s
       JOIN academic_years ay ON ay.id = s.academic_year_id
       ${where}
       ORDER BY s.academic_year_id DESC, s.number ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT s.*, ay.name AS academic_year_name
       FROM semesters s
       JOIN academic_years ay ON ay.id = s.academic_year_id
       WHERE s.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ academicYearId, number, startDate, endDate }) {
    const [result] = await pool.query(
      'INSERT INTO semesters (academic_year_id, number, start_date, end_date) VALUES (?, ?, ?, ?)',
      [academicYearId, number, startDate || null, endDate || null]
    );
    return this.findById(result.insertId);
  },

  async update(id, { academicYearId, number, startDate, endDate, isActive }) {
    await pool.query(
      'UPDATE semesters SET academic_year_id=?, number=?, start_date=?, end_date=?, is_active=? WHERE id=?',
      [academicYearId, number, startDate || null, endDate || null, isActive !== undefined ? isActive : 1, id]
    );
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query('DELETE FROM semesters WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = SemesterModel;
