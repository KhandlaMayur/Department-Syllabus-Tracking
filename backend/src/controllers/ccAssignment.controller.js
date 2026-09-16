const CCAssignmentModel = require('../models/ccAssignment.model');
const FacultyModel      = require('../models/faculty.model');
const BatchModel        = require('../models/batch.model');
const DivisionModel     = require('../models/division.model');
const catchAsync        = require('../utils/catchAsync');
const ApiError          = require('../utils/ApiError');

/** GET /cc-assignments — list all CC assignments */
const list = catchAsync(async (req, res) => {
  const rows = await CCAssignmentModel.list(req.query);
  res.json({ success: true, data: rows });
});

/** GET /cc-assignments/my — CC sees their own batch/division assignments */
const myAssignment = catchAsync(async (req, res) => {
  const rows = await CCAssignmentModel.findByFacultyUserId(req.user.sub);
  res.json({ success: true, data: rows });
});

/** POST /cc-assignments — HOD assigns CC to a batch and optional division */
const assign = catchAsync(async (req, res) => {
  const { batchId, divisionId, facultyId } = req.body;
  if (!batchId || !facultyId) {
    throw ApiError.badRequest('batchId and facultyId are required');
  }

  // Validate batch exists
  const batch = await BatchModel.findById(batchId);
  if (!batch) throw ApiError.notFound('Batch not found');

  // Validate division exists and belongs to batch if provided
  if (divisionId) {
    const division = await DivisionModel.findById(divisionId);
    if (!division) throw ApiError.notFound('Division not found');
    if (String(division.batch_id) !== String(batchId)) {
      throw ApiError.badRequest('Selected division does not belong to this batch');
    }
  }

  // Validate faculty exists
  const faculty = await FacultyModel.findById(facultyId);
  if (!faculty) throw ApiError.notFound('Faculty member not found');

  const item = await CCAssignmentModel.create({
    batchId,
    divisionId: divisionId ? Number(divisionId) : null,
    facultyId,
    assignedBy: req.user.sub,
  });

  res.status(201).json({ success: true, data: item });
});

/** PUT /cc-assignments/:id — HOD reassigns CC */
const reassign = catchAsync(async (req, res) => {
  const { facultyId, divisionId } = req.body;
  if (!facultyId) throw ApiError.badRequest('facultyId is required');

  const existing = await CCAssignmentModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('CC Assignment not found');

  const faculty = await FacultyModel.findById(facultyId);
  if (!faculty) throw ApiError.notFound('Faculty member not found');

  if (divisionId !== undefined && divisionId !== null && divisionId !== '') {
    const division = await DivisionModel.findById(divisionId);
    if (!division) throw ApiError.notFound('Division not found');
    if (String(division.batch_id) !== String(existing.batch_id)) {
      throw ApiError.badRequest('Selected division does not belong to this batch');
    }
  }

  const item = await CCAssignmentModel.update(req.params.id, {
    facultyId,
    divisionId: divisionId !== undefined ? (divisionId ? Number(divisionId) : null) : undefined,
    assignedBy: req.user.sub,
  });

  res.json({ success: true, data: item });
});

/** DELETE /cc-assignments/:id — HOD removes CC assignment */
const remove = catchAsync(async (req, res) => {
  const existing = await CCAssignmentModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('CC Assignment not found');
  await CCAssignmentModel.hardDelete(req.params.id);
  res.json({ success: true, data: { message: 'CC assignment removed successfully' } });
});

module.exports = { list, myAssignment, assign, reassign, remove };

