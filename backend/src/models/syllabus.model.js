const { pool } = require('../config/db');

const SyllabusModel = {
  async listBySubject(subjectId) {
    const [units] = await pool.query(
      `SELECT * FROM syllabus_units
       WHERE subject_id = ? AND is_active = 1
       ORDER BY unit_number ASC`,
      [subjectId]
    );

    if (units.length === 0) return [];

    const unitIds = units.map(u => u.id);
    const [subtopics] = await pool.query(
      `SELECT * FROM syllabus_subtopics
       WHERE unit_id IN (?) AND is_active = 1
       ORDER BY order_index ASC, id ASC`,
      [unitIds]
    );

    const subtopicMap = {};
    for (const st of subtopics) {
      if (!subtopicMap[st.unit_id]) subtopicMap[st.unit_id] = [];
      subtopicMap[st.unit_id].push(st);
    }

    return units.map(u => ({
      ...u,
      subtopics: subtopicMap[u.id] || [],
    }));
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT * FROM syllabus_units WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows[0]) return null;

    const unit = rows[0];
    const [subtopics] = await pool.query(
      `SELECT * FROM syllabus_subtopics
       WHERE unit_id = ? AND is_active = 1
       ORDER BY order_index ASC, id ASC`,
      [id]
    );
    unit.subtopics = subtopics;
    return unit;
  },

  async create({ subjectId, unitNumber, unitTitle, topics, totalHours }) {
    const [result] = await pool.query(
      `INSERT INTO syllabus_units (subject_id, unit_number, unit_title, topics, total_hours)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         unit_title = VALUES(unit_title),
         topics = VALUES(topics),
         total_hours = VALUES(total_hours),
         is_active = 1`,
      [subjectId, unitNumber, unitTitle, topics || null, totalHours || null]
    );
    return result.insertId;
  },

  async update(id, { unitNumber, unitTitle, topics, totalHours, isActive }) {
    await pool.query(
      `UPDATE syllabus_units SET
         unit_number = COALESCE(?, unit_number),
         unit_title = COALESCE(?, unit_title),
         topics = COALESCE(?, topics),
         total_hours = COALESCE(?, total_hours),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [unitNumber, unitTitle, topics, totalHours, isActive, id]
    );
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query(
      `DELETE FROM syllabus_units WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  },

  // ── Subtopics ──────────────────────────────────────────
  async findSubtopicById(id) {
    const [rows] = await pool.query(
      `SELECT * FROM syllabus_subtopics WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async createSubtopic({ unitId, title, orderIndex }) {
    let finalOrder = orderIndex;
    if (finalOrder === undefined || finalOrder === null) {
      const [maxRow] = await pool.query(
        `SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order
         FROM syllabus_subtopics
         WHERE unit_id = ?`,
        [unitId]
      );
      finalOrder = maxRow[0]?.next_order || 1;
    }

    const [result] = await pool.query(
      `INSERT INTO syllabus_subtopics (unit_id, title, order_index)
       VALUES (?, ?, ?)`,
      [unitId, title, finalOrder]
    );
    return this.findSubtopicById(result.insertId);
  },

  async updateSubtopic(id, { title, orderIndex, isActive }) {
    await pool.query(
      `UPDATE syllabus_subtopics SET
         title = COALESCE(?, title),
         order_index = COALESCE(?, order_index),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [title, orderIndex, isActive, id]
    );
    return this.findSubtopicById(id);
  },

  async removeSubtopic(id) {
    const [result] = await pool.query(
      `DELETE FROM syllabus_subtopics WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  },
};

module.exports = SyllabusModel;
