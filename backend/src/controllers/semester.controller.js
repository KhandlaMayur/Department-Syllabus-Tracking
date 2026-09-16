const SemesterModel = require('../models/semester.model');
const { makeCrudControllers } = require('./crudFactory');
const catchAsync = require('../utils/catchAsync');
const ApiError   = require('../utils/ApiError');

const base = makeCrudControllers(SemesterModel, 'Semester');

const create = catchAsync(async (req, res) => {
  const { academicYearId, number, startDate, endDate } = req.body;
  if (!academicYearId || !number) throw ApiError.badRequest('academicYearId and number are required');
  if (number < 1 || number > 8) throw ApiError.badRequest('Semester number must be between 1 and 8');
  const item = await SemesterModel.create({ academicYearId, number, startDate, endDate });
  res.status(201).json({ success: true, data: item });
});

const update = catchAsync(async (req, res) => {
  const { academicYearId, number, startDate, endDate, isActive } = req.body;
  if (!academicYearId || !number) throw ApiError.badRequest('academicYearId and number are required');
  const existing = await SemesterModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Semester not found');
  const item = await SemesterModel.update(req.params.id, { academicYearId, number, startDate, endDate, isActive });
  res.json({ success: true, data: item });
});

module.exports = { list: base.list, getById: base.getById, create, update, remove: base.remove };
