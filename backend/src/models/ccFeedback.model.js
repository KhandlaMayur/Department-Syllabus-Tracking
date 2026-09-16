const { pool } = require('../config/db');

const CCFeedbackModel = {
  /** Submit or update feedback by CC for a covered topic */
  async create({ subtopicId, subjectId, batchId, divisionId, semesterNumber, facultyId, rating, comment }) {
    // Check if this specific CC already submitted feedback for this topic
    const [existing] = await pool.query(
      `SELECT id FROM cc_feedback 
       WHERE subtopic_id = ? AND batch_id = ? AND faculty_id = ? LIMIT 1`,
      [subtopicId, batchId, facultyId]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE cc_feedback
         SET rating = ?, comment = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [rating, comment || null, existing[0].id]
      );
      return this.findById(existing[0].id);
    }

    const [result] = await pool.query(
      `INSERT INTO cc_feedback
         (subtopic_id, subject_id, batch_id, division_id, semester_number, faculty_id, rating, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subtopicId,
        subjectId,
        batchId,
        divisionId || null,
        semesterNumber,
        facultyId,
        rating,
        comment || null,
      ]
    );
    return this.findById(result.insertId);
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT cf.*, u.name AS cc_faculty_name, u.email AS cc_faculty_email,
              f.designation, f.employee_id
       FROM cc_feedback cf
       JOIN users u ON u.id = cf.faculty_id
       LEFT JOIN faculty f ON f.user_id = u.id
       WHERE cf.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /** Get all CC feedback for a subtopic in a batch (supports seeing previous CC feedback) */
  async findBySubtopic(subtopicId, batchId) {
    const [rows] = await pool.query(
      `SELECT cf.*, u.name AS cc_faculty_name, u.email AS cc_faculty_email,
              f.designation, f.employee_id
       FROM cc_feedback cf
       JOIN users u ON u.id = cf.faculty_id
       LEFT JOIN faculty f ON f.user_id = u.id
       WHERE cf.subtopic_id = ? AND cf.batch_id = ?
       ORDER BY cf.created_at DESC`,
      [subtopicId, batchId]
    );
    return rows;
  },

  /** Get all CC feedback for an entire subject in a batch */
  async findBySubjectAndBatch(subjectId, batchId) {
    const [rows] = await pool.query(
      `SELECT cf.*, u.name AS cc_faculty_name, u.email AS cc_faculty_email,
              f.designation, f.employee_id,
              st.title AS subtopic_title, st.unit_id
       FROM cc_feedback cf
       JOIN users u ON u.id = cf.faculty_id
       LEFT JOIN faculty f ON f.user_id = u.id
       JOIN syllabus_subtopics st ON st.id = cf.subtopic_id
       WHERE cf.subject_id = ? AND cf.batch_id = ?
       ORDER BY cf.created_at DESC`,
      [subjectId, batchId]
    );
    return rows;
  },
};

module.exports = CCFeedbackModel;
