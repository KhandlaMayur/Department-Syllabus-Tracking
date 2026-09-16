const DivisionModel = require('../models/division.model');
const { makeCrudControllers } = require('./crudFactory');
const catchAsync = require('../utils/catchAsync');
const ApiError   = require('../utils/ApiError');

const base = makeCrudControllers(DivisionModel, 'Division');

const create = catchAsync(async (req, res) => {
  const { name, batchId, semesterId, ccFacultyId } = req.body;
  if (!name || !batchId || !semesterId)
    throw ApiError.badRequest('name, batchId and semesterId are required');
  const item = await DivisionModel.create({ name, batchId, semesterId });

  if (ccFacultyId) {
    const CCAssignmentModel = require('../models/ccAssignment.model');
    await CCAssignmentModel.create({
      batchId: Number(batchId),
      divisionId: item.id,
      facultyId: Number(ccFacultyId),
      assignedBy: req.user?.sub,
    });
  }

  const fresh = await DivisionModel.findById(item.id);
  res.status(201).json({ success: true, data: fresh || item });
});

const update = catchAsync(async (req, res) => {
  const { name, batchId, semesterId, isActive, ccFacultyId } = req.body;
  if (!name || !batchId || !semesterId)
    throw ApiError.badRequest('name, batchId and semesterId are required');
  const existing = await DivisionModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Division not found');
  const item = await DivisionModel.update(req.params.id, { name, batchId, semesterId, isActive });

  if (ccFacultyId !== undefined) {
    const CCAssignmentModel = require('../models/ccAssignment.model');
    if (ccFacultyId) {
      await CCAssignmentModel.create({
        batchId: Number(batchId || existing.batch_id),
        divisionId: req.params.id,
        facultyId: Number(ccFacultyId),
        assignedBy: req.user?.sub,
      });
    } else {
      const existingAssignment = await CCAssignmentModel.findByBatchAndDivision(existing.batch_id, req.params.id);
      if (existingAssignment) {
        await CCAssignmentModel.hardDelete(existingAssignment.id);
      }
    }
  }

  const fresh = await DivisionModel.findById(req.params.id);
  res.json({ success: true, data: fresh || item });
});

const getStudents = catchAsync(async (req, res) => {
  const result = await DivisionModel.getStudents(req.params.id);
  if (!result) throw ApiError.notFound('Division not found');
  res.json({ success: true, data: result });
});

module.exports = { list: base.list, getById: base.getById, create, update, remove: base.remove, getStudents };

