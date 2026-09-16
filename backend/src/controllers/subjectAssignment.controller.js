const SubjectAssignmentModel = require('../models/subjectAssignment.model');
const { makeCrudControllers } = require('./crudFactory');
const catchAsync = require('../utils/catchAsync');
const ApiError   = require('../utils/ApiError');

const base = makeCrudControllers(SubjectAssignmentModel, 'Subject Assignment');

const create = catchAsync(async (req, res) => {
  const { subjectId, facultyId, divisionId, divisionIds, semesterId, academicYearId } = req.body;
  if (!subjectId || !facultyId || (!divisionId && (!divisionIds || !divisionIds.length)) || !semesterId || !academicYearId) {
    throw ApiError.badRequest('subjectId, facultyId, divisionId (or divisionIds), semesterId and academicYearId are required');
  }

  const targetDivIds = Array.isArray(divisionIds) && divisionIds.length ? divisionIds : [divisionId];
  const results = [];
  const errors = [];

  for (const divId of targetDivIds) {
    try {
      const item = await SubjectAssignmentModel.create({
        subjectId,
        facultyId,
        divisionId: divId,
        semesterId,
        academicYearId,
      });
      results.push(item);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        errors.push(`Division ID ${divId} is already assigned to this subject for the selected semester/academic year.`);
      } else {
        throw err;
      }
    }
  }

  if (!results.length && errors.length) {
    throw ApiError.badRequest(errors.join(' '));
  }

  res.status(201).json({
    success: true,
    data: results.length === 1 ? results[0] : results,
    warnings: errors.length ? errors : undefined,
  });
});

const update = catchAsync(async (req, res) => {
  const { subjectId, facultyId, divisionId, semesterId, academicYearId, isActive } = req.body;
  const existing = await SubjectAssignmentModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Subject Assignment not found');
  const item = await SubjectAssignmentModel.update(req.params.id,
    { subjectId, facultyId, divisionId, semesterId, academicYearId, isActive });
  res.json({ success: true, data: item });
});

const TimetableSyncService = require('../services/timetable/timetableSync.service');

/** GET /api/v1/subject-assignments/my - for faculty: returns their own assignments */
const myAssignments = catchAsync(async (req, res) => {
  try {
    await TimetableSyncService.syncAllActiveTimetables();
  } catch (e) {
    // Non-fatal: proceed to return assignments
  }
  const rows = await SubjectAssignmentModel.findByFacultyUserId(req.user.sub);
  res.json({ success: true, data: rows });
});

module.exports = { list: base.list, getById: base.getById, create, update, remove: base.remove, myAssignments };
