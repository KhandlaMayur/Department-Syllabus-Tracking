const BatchModel = require('../models/batch.model');
const { makeCrudControllers } = require('./crudFactory');
const catchAsync = require('../utils/catchAsync');
const ApiError   = require('../utils/ApiError');

const base = makeCrudControllers(BatchModel, 'Batch');

const create = catchAsync(async (req, res) => {
  const { name, departmentId, academicYearId, ccFacultyId } = req.body;
  if (!name || !departmentId || !academicYearId)
    throw ApiError.badRequest('name, departmentId and academicYearId are required');
  const item = await BatchModel.create({ name, departmentId, academicYearId });

  if (ccFacultyId) {
    const CCAssignmentModel = require('../models/ccAssignment.model');
    await CCAssignmentModel.create({
      batchId: item.id,
      facultyId: Number(ccFacultyId),
      assignedBy: req.user?.sub,
    });
  }

  const fresh = await BatchModel.findById(item.id);
  res.status(201).json({ success: true, data: fresh || item });
});

const update = catchAsync(async (req, res) => {
  const { name, departmentId, academicYearId, isActive, ccFacultyId } = req.body;
  if (!name || !departmentId || !academicYearId)
    throw ApiError.badRequest('name, departmentId and academicYearId are required');
  const existing = await BatchModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Batch not found');
  const item = await BatchModel.update(req.params.id, { name, departmentId, academicYearId, isActive });

  if (ccFacultyId !== undefined) {
    const CCAssignmentModel = require('../models/ccAssignment.model');
    if (ccFacultyId) {
      await CCAssignmentModel.create({
        batchId: req.params.id,
        facultyId: Number(ccFacultyId),
        assignedBy: req.user?.sub,
      });
    } else {
      const existingAssignment = await CCAssignmentModel.findByBatchId(req.params.id);
      if (existingAssignment) {
        await CCAssignmentModel.hardDelete(existingAssignment.id);
      }
    }
  }

  const fresh = await BatchModel.findById(req.params.id);
  res.json({ success: true, data: fresh || item });
});

module.exports = { list: base.list, getById: base.getById, create, update, remove: base.remove };
