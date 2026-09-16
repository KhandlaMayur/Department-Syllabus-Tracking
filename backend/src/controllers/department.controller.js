const DepartmentModel = require('../models/department.model');
const { makeCrudControllers } = require('./crudFactory');
const catchAsync  = require('../utils/catchAsync');
const ApiError    = require('../utils/ApiError');

const base = makeCrudControllers(DepartmentModel, 'Department');

const create = catchAsync(async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) throw ApiError.badRequest('name and code are required');

  const existing = await DepartmentModel.findByCode(code);
  if (existing) throw ApiError.conflict(`Department with code "${code.toUpperCase()}" already exists`);

  const dept = await DepartmentModel.create({ name, code });
  res.status(201).json({ success: true, data: dept });
});

const update = catchAsync(async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) throw ApiError.badRequest('name and code are required');

  const existing = await DepartmentModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Department not found');

  const codeConflict = await DepartmentModel.findByCode(code);
  if (codeConflict && codeConflict.id !== Number(req.params.id)) {
    throw ApiError.conflict(`Department with code "${code.toUpperCase()}" already exists`);
  }

  const dept = await DepartmentModel.update(req.params.id, { name, code });
  res.json({ success: true, data: dept });
});

module.exports = { list: base.list, getById: base.getById, create, update, remove: base.remove };
