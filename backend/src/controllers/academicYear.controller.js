const AcademicYearModel = require('../models/academicYear.model');
const { makeCrudControllers } = require('./crudFactory');
const catchAsync = require('../utils/catchAsync');
const ApiError   = require('../utils/ApiError');

const base = makeCrudControllers(AcademicYearModel, 'Academic Year');

const create = catchAsync(async (req, res) => {
  const { name, startDate, endDate } = req.body;
  if (!name || !startDate || !endDate) throw ApiError.badRequest('name, startDate and endDate are required');
  const item = await AcademicYearModel.create({ name, startDate, endDate });
  res.status(201).json({ success: true, data: item });
});

const update = catchAsync(async (req, res) => {
  const { name, startDate, endDate, isActive } = req.body;
  if (!name || !startDate || !endDate) throw ApiError.badRequest('name, startDate and endDate are required');
  const existing = await AcademicYearModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Academic Year not found');
  const item = await AcademicYearModel.update(req.params.id, { name, startDate, endDate, isActive });
  res.json({ success: true, data: item });
});

module.exports = { list: base.list, getById: base.getById, create, update, remove: base.remove };
