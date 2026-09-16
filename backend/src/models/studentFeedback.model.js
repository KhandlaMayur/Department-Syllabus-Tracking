const { pool } = require('../config/db');

const StudentFeedbackModel = {
  /** Submit or update feedback for a covered topic */
  async create({ subtopicId, subjectId, studentId, batchId, divisionId = null, semesterNumber, facultyId, rating, comment, isCompleted = 1 }) {
    const [result] = await pool.query(
      `INSERT INTO student_feedback
         (subtopic_id, subject_id, student_id, batch_id, division_id, semester_number, faculty_id, rating, comment, is_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         rating = VALUES(rating),
         comment = VALUES(comment),
         faculty_id = VALUES(faculty_id),
         division_id = COALESCE(VALUES(division_id), division_id),
         is_completed = VALUES(is_completed)`,
      [
        subtopicId,
        subjectId,
        studentId,
        batchId,
        divisionId || null,
        semesterNumber,
        facultyId || null,
        rating,
        comment || null,
        isCompleted !== undefined ? (isCompleted ? 1 : 0) : 1,
      ]
    );
    if (result.insertId) return this.findById(result.insertId);
    const [rows] = await pool.query(
      `SELECT * FROM student_feedback
       WHERE subtopic_id = ? AND student_id = ? AND batch_id = ? LIMIT 1`,
      [subtopicId, studentId, batchId]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM student_feedback WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  /** Get all feedback for a specific subtopic in a batch/division */
  async findBySubtopic(subtopicId, rawBatchId, rawDivId = null) {
    let batchId = Number(rawBatchId);
    let divisionId = rawDivId ? Number(rawDivId) : null;
    if (!divisionId && rawBatchId) {
      const [div] = await pool.query('SELECT id, batch_id FROM divisions WHERE id = ? LIMIT 1', [rawBatchId]);
      if (div.length > 0) {
        divisionId = div[0].id;
        batchId = div[0].batch_id;
      }
    }

    let sql = `SELECT sf.*, u.name AS student_name
       FROM student_feedback sf
       JOIN users u ON u.id = sf.student_id
       WHERE sf.subtopic_id = ? AND (sf.batch_id = ?`;
    let params = [subtopicId, batchId];
    if (divisionId) {
      sql += ` OR sf.division_id = ?`;
      params.push(divisionId);
    }
    sql += `) ORDER BY sf.created_at DESC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  /** Get a student's own feedback for a subject in a batch */
  async findByStudentAndSubject(studentUserId, subjectId, batchId) {
    const [rows] = await pool.query(
      `SELECT sf.*, st.title AS subtopic_title, st.unit_id
       FROM student_feedback sf
       JOIN syllabus_subtopics st ON st.id = sf.subtopic_id
       WHERE sf.student_id = ? AND sf.subject_id = ? AND sf.batch_id = ?
       ORDER BY st.unit_id ASC, sf.created_at ASC`,
      [studentUserId, subjectId, batchId]
    );
    return rows;
  },

  /** Get average rating for a subtopic in a batch */
  async getAverageRating(subtopicId, batchId) {
    const [[row]] = await pool.query(
      `SELECT AVG(rating) AS avg_rating, COUNT(*) AS feedback_count
       FROM student_feedback
       WHERE subtopic_id = ? AND batch_id = ?`,
      [subtopicId, batchId]
    );
    return {
      avgRating: row.avg_rating ? parseFloat(row.avg_rating).toFixed(1) : null,
      feedbackCount: row.feedback_count,
    };
  },

  /** Get all feedback for a subject in a batch/division (for CC/Faculty view) */
  async findBySubjectAndBatch(subjectId, rawBatchId) {
    let batchId = Number(rawBatchId);
    let divisionId = null;
    const [div] = await pool.query('SELECT id, batch_id FROM divisions WHERE id = ? LIMIT 1', [rawBatchId]);
    if (div.length > 0) {
      divisionId = div[0].id;
      batchId = div[0].batch_id;
    }

    let sql = `SELECT sf.*, u.name AS student_name, st.title AS subtopic_title, st.unit_id
       FROM student_feedback sf
       JOIN users u ON u.id = sf.student_id
       JOIN syllabus_subtopics st ON st.id = sf.subtopic_id
       WHERE sf.subject_id = ? AND (sf.batch_id = ?`;
    let params = [subjectId, batchId];
    if (divisionId) {
      sql += ` OR sf.division_id = ?`;
      params.push(divisionId);
    }
    sql += `) ORDER BY st.unit_id ASC, sf.created_at DESC`;

    const [rows] = await pool.query(sql, params);
    return rows;
  },

  /**
   * Filtered & paginated list of student feedbacks with strict role-based visibility:
   * - HOD: sees all feedback
   * - CC: strictly sees only feedback from students in that CC's assigned batch/division
   * - Faculty: sees feedback for subjects assigned to that faculty or topics taught by them
   */
  async list(opts = {}, user = {}) {
    const page    = Math.max(1, parseInt(opts.page) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(opts.limit) || 20));
    const offset  = (page - 1) * limit;

    const semesterNumber = opts.semesterNumber ? parseInt(opts.semesterNumber) : null;
    const batchId        = opts.batchId ? parseInt(opts.batchId) : null;
    const divisionId     = opts.divisionId ? parseInt(opts.divisionId) : null;
    const subjectId      = opts.subjectId ? parseInt(opts.subjectId) : null;
    const search         = opts.search ? opts.search.trim() : null;

    let where = [];
    let params = [];

    const effectiveRole = opts.roleScope || user.role;

    // ── Role-based Access Scoping ──────────────────────────────────────────
    if (effectiveRole === 'cc') {
      // Find CC assignments for this user
      const [ccAssignments] = await pool.query(
        `SELECT ca.batch_id, ca.division_id
         FROM cc_assignments ca
         JOIN faculty f ON f.id = ca.faculty_id
         WHERE f.user_id = ? AND ca.is_active = 1`,
        [user.id]
      );

      if (!ccAssignments || ccAssignments.length === 0) {
        return {
          rows: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          stats: { total: 0, avgRating: 0, completedCount: 0, commentCount: 0 },
        };
      }

      // Build scoping clause for CC: student must belong to CC's batch/division
      const ccClauses = [];
      for (const ca of ccAssignments) {
        if (ca.division_id) {
          ccClauses.push(`((sf.batch_id = ? OR stud.batch_id = ?) AND (sf.division_id = ? OR stud.division_id = ?))`);
          params.push(ca.batch_id, ca.batch_id, ca.division_id, ca.division_id);
        } else {
          ccClauses.push(`(sf.batch_id = ? OR stud.batch_id = ?)`);
          params.push(ca.batch_id, ca.batch_id);
        }
      }
      where.push(`(${ccClauses.join(' OR ')})`);

    } else if (effectiveRole === 'faculty') {
      // Find subjects assigned to this faculty
      const [assignedSubjects] = await pool.query(
        `SELECT DISTINCT sa.subject_id
         FROM subject_assignments sa
         JOIN faculty f ON f.id = sa.faculty_id
         WHERE f.user_id = ? AND sa.is_active = 1`,
        [user.id]
      );
      const subjectIds = assignedSubjects.map(s => s.subject_id);

      if (subjectIds.length > 0) {
        const placeholders = subjectIds.map(() => '?').join(',');
        where.push(`(sf.subject_id IN (${placeholders}) OR sf.faculty_id = ?)`);
        params.push(...subjectIds, user.id);
      } else {
        where.push(`sf.faculty_id = ?`);
        params.push(user.id);
      }
    }
    // HOD has global access to feedback

    // ── Additional Filters ─────────────────────────────────────────────────
    if (semesterNumber) {
      where.push('sf.semester_number = ?');
      params.push(semesterNumber);
    }
    if (batchId) {
      where.push('(sf.batch_id = ? OR stud.batch_id = ?)');
      params.push(batchId, batchId);
    }
    if (divisionId) {
      where.push('(sf.division_id = ? OR stud.division_id = ?)');
      params.push(divisionId, divisionId);
    }
    if (subjectId) {
      where.push('sf.subject_id = ?');
      params.push(subjectId);
    }
    if (search) {
      const q = `%${search}%`;
      where.push(`(
        u.name LIKE ? OR
        stud.enrollment_number LIKE ? OR
        subj.name LIKE ? OR
        subj.code LIKE ? OR
        st.title LIKE ?
      )`);
      params.push(q, q, q, q, q);
    }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Count & Stats
    const statsParams = [...params];
    const statsSql = `
      SELECT COUNT(*) AS total,
             COALESCE(AVG(sf.rating), 0) AS avg_rating,
             COALESCE(SUM(CASE WHEN sf.is_completed = 1 THEN 1 ELSE 0 END), 0) AS completed_count,
             COALESCE(SUM(CASE WHEN sf.comment IS NOT NULL AND TRIM(sf.comment) != '' THEN 1 ELSE 0 END), 0) AS comment_count
      FROM student_feedback sf
      JOIN users u ON u.id = sf.student_id
      LEFT JOIN students stud ON stud.user_id = sf.student_id
      JOIN syllabus_subtopics st ON st.id = sf.subtopic_id
      JOIN subjects subj ON subj.id = sf.subject_id
      ${whereSQL}
    `;
    const [[statsRow]] = await pool.query(statsSql, statsParams);
    const total = Number(statsRow?.total || 0);

    // List Query
    const listParams = [...params, limit, offset];
    const listSql = `
      SELECT sf.id,
             sf.subtopic_id,
             sf.subject_id,
             sf.student_id,
             sf.batch_id,
             sf.division_id,
             sf.semester_number,
             sf.faculty_id,
             sf.rating,
             sf.comment,
             sf.is_completed,
             sf.created_at,
             sf.updated_at,
             u.name AS student_name,
             u.email AS student_email,
             u.avatar_url AS student_avatar_url,
             stud.enrollment_number,
             subj.code AS subject_code,
             subj.name AS subject_name,
             st.title AS subtopic_title,
             st.unit_id,
             su.unit_number,
             su.unit_title,
             b.name AS batch_name,
             dv.name AS division_name,
             fac_u.name AS faculty_name
      FROM student_feedback sf
      JOIN users u ON u.id = sf.student_id
      LEFT JOIN students stud ON stud.user_id = sf.student_id
      JOIN syllabus_subtopics st ON st.id = sf.subtopic_id
      JOIN syllabus_units su ON su.id = st.unit_id
      JOIN subjects subj ON subj.id = sf.subject_id
      LEFT JOIN batches b ON b.id = COALESCE(sf.batch_id, stud.batch_id)
      LEFT JOIN divisions dv ON dv.id = COALESCE(sf.division_id, stud.division_id)
      LEFT JOIN users fac_u ON fac_u.id = sf.faculty_id
      ${whereSQL}
      ORDER BY sf.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(listSql, listParams);

    return {
      rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        total,
        avgRating: statsRow?.avg_rating ? parseFloat(statsRow.avg_rating).toFixed(1) : '0.0',
        completedCount: Number(statsRow?.completed_count || 0),
        commentCount: Number(statsRow?.comment_count || 0),
      },
    };
  },
};

module.exports = StudentFeedbackModel;
