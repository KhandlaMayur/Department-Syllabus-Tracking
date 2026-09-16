const TopicCompletionModel = require('../models/topicCompletion.model');
const SyllabusModel        = require('../models/syllabus.model');
const catchAsync           = require('../utils/catchAsync');
const ApiError             = require('../utils/ApiError');

async function checkFacultyCanMarkSubject(userId, userRole, subjectId) {
  if (userRole === 'hod') return true;
  const { pool } = require('../config/db');
  const [assignments] = await pool.query(
    `SELECT sa.id FROM subject_assignments sa
     JOIN faculty f ON f.id = sa.faculty_id
     WHERE f.user_id = ? AND sa.subject_id = ? AND sa.is_active = 1`,
    [userId, subjectId]
  );
  if (!assignments || assignments.length === 0) {
    throw ApiError.forbidden('You are not assigned to teach this subject. Only the assigned subject faculty can mark or unmark topics.');
  }
  return true;
}

/** POST /topic-completions — mark a subtopic as covered */
const markComplete = catchAsync(async (req, res) => {
  const { subtopicId, subjectId, batchId, semesterNumber } = req.body;
  if (!subtopicId || !subjectId || !batchId || !semesterNumber) {
    throw ApiError.badRequest('subtopicId, subjectId, batchId and semesterNumber are required');
  }

  // Ensure only the assigned subject teacher (or HOD) can mark
  await checkFacultyCanMarkSubject(req.user.sub, req.user.role, subjectId);

  // Verify subtopic exists
  const subtopic = await SyllabusModel.findSubtopicById(subtopicId);
  if (!subtopic) throw ApiError.notFound('Subtopic not found');

  const item = await TopicCompletionModel.markComplete({
    subtopicId,
    subjectId,
    batchId,
    semesterNumber,
    completedBy: req.user.sub,
  });

  res.status(201).json({ success: true, data: item });
});

/** DELETE /topic-completions/:subtopicId/batch/:batchId — unmark a subtopic */
const markIncomplete = catchAsync(async (req, res) => {
  const { subtopicId, batchId } = req.params;

  if (req.user.role !== 'hod') {
    const { pool } = require('../config/db');
    const [rows] = await pool.query(
      `SELECT u.subject_id FROM syllabus_subtopics st
       JOIN syllabus_units u ON u.id = st.unit_id
       WHERE st.id = ? LIMIT 1`,
      [subtopicId]
    );
    if (rows.length > 0) {
      await checkFacultyCanMarkSubject(req.user.sub, req.user.role, rows[0].subject_id);
    }
  }

  const removed = await TopicCompletionModel.removeBySubtopicAndBatch(subtopicId, batchId);
  if (!removed) throw ApiError.notFound('Topic completion record not found');
  res.json({ success: true, data: { message: 'Topic unmarked as covered' } });
});

/** GET /topic-completions/subject/:subjectId/batch/:batchId — get completion status */
const getBySubjectAndBatch = catchAsync(async (req, res) => {
  const { subjectId, batchId } = req.params;
  const divisionId = req.query.divisionId || null;
  const result = await TopicCompletionModel.findBySubjectAndBatch(subjectId, batchId, divisionId);
  const completions = result.completions || [];
  const activatedUnits = result.activatedUnits || [];
  const progress = await TopicCompletionModel.getProgress(subjectId, batchId, divisionId);
  res.json({ success: true, data: { completions, activatedUnits, progress } });
});

/** GET /topic-completions/progress — bulk progress for multiple subjects */
const getProgressBulk = catchAsync(async (req, res) => {
  const { subjectIds, batchId } = req.query;
  if (!subjectIds || !batchId) {
    throw ApiError.badRequest('subjectIds and batchId are required');
  }
  const ids = Array.isArray(subjectIds) ? subjectIds.map(Number) : subjectIds.split(',').map(Number);
  const progress = await TopicCompletionModel.getProgressBulk(ids, batchId);
  res.json({ success: true, data: progress });
});

/** POST /topic-completions/unit/activate — start teaching a unit */
const activateUnit = catchAsync(async (req, res) => {
  const { unitId, subjectId, batchId } = req.body;
  if (!unitId || !subjectId || !batchId) {
    throw ApiError.badRequest('unitId, subjectId, and batchId are required');
  }

  await checkFacultyCanMarkSubject(req.user.sub, req.user.role, Number(subjectId));

  const result = await TopicCompletionModel.activateUnit({
    unitId: Number(unitId),
    subjectId: Number(subjectId),
    batchId: Number(batchId),
    activatedBy: req.user.sub,
  });

  res.status(200).json({ success: true, data: result });
});

/** DELETE /topic-completions/unit/:unitId/batch/:batchId/activate — deactivate a unit */
const deactivateUnit = catchAsync(async (req, res) => {
  const { unitId, batchId } = req.params;

  if (req.user.role !== 'hod') {
    const { pool } = require('../config/db');
    const [rows] = await pool.query('SELECT subject_id FROM syllabus_units WHERE id = ? LIMIT 1', [unitId]);
    if (rows.length > 0) {
      await checkFacultyCanMarkSubject(req.user.sub, req.user.role, rows[0].subject_id);
    }
  }

  const result = await TopicCompletionModel.deactivateUnit(Number(unitId), Number(batchId));
  res.json({ success: true, data: result });
});

/** POST /topic-completions/unit — mark all topics in a unit as covered */
const markUnitComplete = catchAsync(async (req, res) => {
  const { unitId, subjectId, batchId, semesterNumber } = req.body;
  if (!unitId || !subjectId || !batchId) {
    throw ApiError.badRequest('unitId, subjectId, and batchId are required');
  }

  await checkFacultyCanMarkSubject(req.user.sub, req.user.role, Number(subjectId));

  const items = await TopicCompletionModel.markUnitComplete({
    unitId: Number(unitId),
    subjectId: Number(subjectId),
    batchId: Number(batchId),
    semesterNumber: Number(semesterNumber) || 1,
    completedBy: req.user.sub,
  });

  res.status(200).json({ success: true, data: items });
});

/** DELETE /topic-completions/unit/:unitId/batch/:batchId — unmark all topics in a unit */
const unmarkUnit = catchAsync(async (req, res) => {
  const { unitId, batchId } = req.params;

  if (req.user.role !== 'hod') {
    const { pool } = require('../config/db');
    const [rows] = await pool.query('SELECT subject_id FROM syllabus_units WHERE id = ? LIMIT 1', [unitId]);
    if (rows.length > 0) {
      await checkFacultyCanMarkSubject(req.user.sub, req.user.role, rows[0].subject_id);
    }
  }

  const count = await TopicCompletionModel.unmarkUnit(Number(unitId), Number(batchId));
  res.json({ success: true, data: { message: `Unit unmarked (${count} topics removed)` } });
});

module.exports = {
  markComplete,
  markIncomplete,
  markUnitComplete,
  unmarkUnit,
  activateUnit,
  deactivateUnit,
  getBySubjectAndBatch,
  getProgressBulk,
};

