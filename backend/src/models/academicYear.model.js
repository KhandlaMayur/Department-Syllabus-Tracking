const { pool } = require('../config/db');
const { paginatedList } = require('./queryHelper');

const AcademicYearModel = {
  async list(opts = {}) {
    return paginatedList('academic_years', ['name'], ['name', 'start_date', 'created_at'], opts);
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM academic_years WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async create({ name, startDate, endDate }) {
    const [result] = await pool.query(
      'INSERT INTO academic_years (name, start_date, end_date) VALUES (?, ?, ?)',
      [name, startDate, endDate]
    );
    return this.findById(result.insertId);
  },

  async update(id, { name, startDate, endDate, isActive }) {
    await pool.query(
      'UPDATE academic_years SET name = ?, start_date = ?, end_date = ?, is_active = ? WHERE id = ?',
      [name, startDate, endDate, isActive !== undefined ? isActive : 1, id]
    );
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query('DELETE FROM academic_years WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = AcademicYearModel;
