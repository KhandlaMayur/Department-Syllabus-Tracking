const { pool } = require('../config/db');
const { paginatedList } = require('./queryHelper');

const DepartmentModel = {
  async list(opts = {}) {
    return paginatedList('departments', ['name', 'code'], ['name', 'code', 'created_at'], opts);
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM departments WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async findByCode(code) {
    const [rows] = await pool.query('SELECT * FROM departments WHERE code = ? LIMIT 1', [code]);
    return rows[0] || null;
  },

  async create({ name, code }) {
    const [result] = await pool.query(
      'INSERT INTO departments (name, code) VALUES (?, ?)',
      [name, code.toUpperCase()]
    );
    return this.findById(result.insertId);
  },

  async update(id, { name, code }) {
    await pool.query(
      'UPDATE departments SET name = ?, code = ? WHERE id = ?',
      [name, code.toUpperCase(), id]
    );
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query('DELETE FROM departments WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = DepartmentModel;
