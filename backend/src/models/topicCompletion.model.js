const { pool } = require('../config/db');

const TopicCompletionModel = {
  async resolveBatchAndDivision(batchOrDivId, explicitDivId = null) {
    let batchId = Number(batchOrDivId) || 1;
    let divisionId = explicitDivId ? Number(explicitDivId) : null;

    try {
      if (divisionId) {
        const [dRows] = await pool.query('SELECT batch_id FROM divisions WHERE id = ?', [divisionId]);
        if (dRows.length > 0) {
          batchId = dRows[0].batch_id;
        }
        return { batchId, divisionId };
      }

      // Check if it's a division (not in batches)
      const [batchRows] = await pool.query('SELECT id FROM batches WHERE id = ?', [batchOrDivId]);
      const [divRows]   = await pool.query('SELECT id, batch_id FROM divisions WHERE id = ?', [batchOrDivId]);

      if (divRows.length > 0 && batchRows.length === 0) {
        return { batchId: divRows[0].batch_id, divisionId: divRows[0].id };
      }

      if (batchRows.length > 0) {
        return { batchId: batchRows[0].id, divisionId: null };
      }

      if (divRows.length > 0) {
        return { batchId: divRows[0].batch_id, divisionId: divRows[0].id };
      }
    } catch {
      // fallback to original IDs
    }
    return { batchId, divisionId };
  },

  /** Mark a subtopic as completed for a batch */
  async markComplete({ subtopicId, subjectId, batchId: rawBatchId, divisionId: rawDivId, semesterNumber, completedBy }) {
    const { batchId, divisionId } = await this.resolveBatchAndDivision(rawBatchId, rawDivId);

    const [result] = await pool.query(
      `INSERT INTO topic_completions
         (subtopic_id, subject_id, batch_id, division_id, semester_number, completed_by, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         completed_by = VALUES(completed_by),
         completed_at = NOW(),
         division_id = VALUES(division_id)`,
      [subtopicId, subjectId, batchId, divisionId, semesterNumber, completedBy]
    );
    if (result.insertId) return this.findById(result.insertId);
    // ON DUPLICATE KEY — refetch
    const [rows] = await pool.query(
      `SELECT * FROM topic_completions WHERE subtopic_id = ? AND batch_id = ? LIMIT 1`,
      [subtopicId, batchId]
    );
    return rows[0] || null;
  },

  /** Mark all subtopics of a unit as completed */
  async markUnitComplete({ unitId, subjectId, batchId: rawBatchId, divisionId: rawDivId, semesterNumber, completedBy }) {
    const { batchId, divisionId } = await this.resolveBatchAndDivision(rawBatchId, rawDivId);
    const [subtopics] = await pool.query(
      'SELECT id FROM syllabus_subtopics WHERE unit_id = ? AND is_active = 1',
      [unitId]
    );
    if (subtopics.length === 0) return [];

    for (const st of subtopics) {
      await pool.query(
        `INSERT INTO topic_completions
           (subtopic_id, subject_id, batch_id, division_id, semester_number, completed_by, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           completed_by = VALUES(completed_by),
           completed_at = NOW(),
           division_id = VALUES(division_id)`,
        [st.id, subjectId, batchId, divisionId, semesterNumber, completedBy]
      );
    }
    return this.findBySubjectAndBatch(subjectId, rawBatchId);
  },

  /** Unmark all subtopics of a unit */
  async unmarkUnit(unitId, rawBatchId, rawDivId = null) {
    const { batchId, divisionId } = await this.resolveBatchAndDivision(rawBatchId, rawDivId);
    const [subtopics] = await pool.query(
      'SELECT id FROM syllabus_subtopics WHERE unit_id = ?',
      [unitId]
    );
    if (subtopics.length === 0) return 0;
    const subtopicIds = subtopics.map(s => s.id);
    const [result] = await pool.query(
      `DELETE FROM topic_completions
       WHERE subtopic_id IN (?) AND (batch_id = ? OR (division_id IS NOT NULL AND division_id = ?))`,
      [subtopicIds, batchId, divisionId || -1]
    );
    return result.affectedRows;
  },

  /** Unmark a subtopic completion */
  async markIncomplete(id) {
    const [result] = await pool.query('DELETE FROM topic_completions WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  /** Remove completion by subtopic and batch (alternative to by id) */
  async removeBySubtopicAndBatch(subtopicId, rawBatchId) {
    const { batchId, divisionId } = await this.resolveBatchAndDivision(rawBatchId);
    const [result] = await pool.query(
      `DELETE FROM topic_completions
       WHERE subtopic_id = ? AND (batch_id = ? OR (division_id IS NOT NULL AND division_id = ?))`,
      [subtopicId, batchId, divisionId || -1]
    );
    return result.affectedRows > 0;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM topic_completions WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  /** Activate a unit for teaching */
  async activateUnit({ unitId, subjectId, batchId: rawBatchId, divisionId: rawDivId, activatedBy }) {
    const { batchId, divisionId } = await this.resolveBatchAndDivision(rawBatchId, rawDivId);
    await pool.query(
      `INSERT INTO unit_activations
         (unit_id, subject_id, batch_id, division_id, activated_by, activated_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         activated_by = VALUES(activated_by),
         activated_at = NOW(),
         division_id = VALUES(division_id)`,
      [unitId, subjectId, batchId, divisionId, activatedBy]
    );
    return { unitId, isActivated: true };
  },

  /** Deactivate a unit */
  async deactivateUnit(unitId, rawBatchId, rawDivId = null) {
    const { batchId, divisionId } = await this.resolveBatchAndDivision(rawBatchId, rawDivId);
    await pool.query(
      `DELETE FROM unit_activations
       WHERE unit_id = ? AND (batch_id = ? OR (division_id IS NOT NULL AND division_id = ?))`,
      [unitId, batchId, divisionId || -1]
    );
    await this.unmarkUnit(unitId, rawBatchId, rawDivId);
    return { unitId, isActivated: false };
  },

  /** Get all completions & activated units for a subject + batch */
  async findBySubjectAndBatch(subjectId, rawBatchId, rawDivisionId = null) {
    const { batchId, divisionId } = await this.resolveBatchAndDivision(rawBatchId, rawDivisionId);

    let whereSql = 'tc.subject_id = ?';
    let params = [subjectId];
    if (divisionId) {
      whereSql += ' AND (tc.division_id = ? OR (tc.batch_id = ? AND tc.division_id IS NULL))';
      params.push(divisionId, batchId);
    } else {
      whereSql += ' AND tc.batch_id = ?';
      params.push(batchId);
    }

    const [rows] = await pool.query(
      `SELECT tc.*, st.title AS subtopic_title, st.unit_id,
              u.name AS completed_by_name
       FROM topic_completions tc
       JOIN syllabus_subtopics st ON st.id = tc.subtopic_id
       JOIN users u ON u.id = tc.completed_by
       WHERE ${whereSql}
       ORDER BY tc.completed_at ASC`,
      params
    );

    let actWhereSql = 'subject_id = ?';
    let actParams = [subjectId];
    if (divisionId) {
      actWhereSql += ' AND (division_id = ? OR (batch_id = ? AND division_id IS NULL))';
      actParams.push(divisionId, batchId);
    } else {
      actWhereSql += ' AND batch_id = ?';
      actParams.push(batchId);
    }

    const [actRows] = await pool.query(
      `SELECT unit_id FROM unit_activations WHERE ${actWhereSql}`,
      actParams
    );
    const activatedUnits = actRows.map(r => r.unit_id);
    for (const r of rows) {
      if (r.unit_id && !activatedUnits.includes(r.unit_id)) {
        activatedUnits.push(r.unit_id);
      }
    }

    return { completions: rows, activatedUnits };
  },

  /** Get progress summary for a subject + batch */
  async getProgress(subjectId, rawBatchId, rawDivisionId = null) {
    const { batchId, divisionId } = await this.resolveBatchAndDivision(rawBatchId, rawDivisionId);
    const [[totals]] = await pool.query(
      `SELECT COUNT(*) AS total_subtopics
       FROM syllabus_subtopics st
       JOIN syllabus_units su ON su.id = st.unit_id
       WHERE su.subject_id = ? AND st.is_active = 1 AND su.is_active = 1`,
      [subjectId]
    );

    let compWhere = 'subject_id = ?';
    let compParams = [subjectId];
    if (divisionId) {
      compWhere += ' AND (division_id = ? OR (batch_id = ? AND division_id IS NULL))';
      compParams.push(divisionId, batchId);
    } else {
      compWhere += ' AND batch_id = ?';
      compParams.push(batchId);
    }

    const [[completed]] = await pool.query(
      `SELECT COUNT(DISTINCT subtopic_id) AS completed_count
       FROM topic_completions
       WHERE ${compWhere}`,
      compParams
    );
    return {
      total: totals.total_subtopics,
      completed: completed.completed_count,
      percentage: totals.total_subtopics > 0
        ? Math.round((completed.completed_count / totals.total_subtopics) * 100)
        : 0,
    };
  },

  /** Get progress for multiple subjects at once (for dashboard cards) */
  async getProgressBulk(subjectIds, rawBatchId) {
    if (!subjectIds.length) return [];
    const { batchId, divisionId } = await this.resolveBatchAndDivision(rawBatchId);
    const [totals] = await pool.query(
      `SELECT su.subject_id, COUNT(*) AS total_subtopics
       FROM syllabus_subtopics st
       JOIN syllabus_units su ON su.id = st.unit_id
       WHERE su.subject_id IN (?) AND st.is_active = 1 AND su.is_active = 1
       GROUP BY su.subject_id`,
      [subjectIds]
    );
    const [completed] = await pool.query(
      `SELECT subject_id, COUNT(*) AS completed_count
       FROM topic_completions
       WHERE subject_id IN (?) AND (batch_id = ? OR (division_id IS NOT NULL AND division_id = ?))
       GROUP BY subject_id`,
      [subjectIds, batchId, divisionId || -1]
    );

    const totalMap = {};
    for (const r of totals) totalMap[r.subject_id] = r.total_subtopics;
    const compMap = {};
    for (const r of completed) compMap[r.subject_id] = r.completed_count;

    return subjectIds.map(id => ({
      subjectId: id,
      total: totalMap[id] || 0,
      completed: compMap[id] || 0,
      percentage: totalMap[id]
        ? Math.round(((compMap[id] || 0) / totalMap[id]) * 100)
        : 0,
    }));
  },
};

module.exports = TopicCompletionModel;
