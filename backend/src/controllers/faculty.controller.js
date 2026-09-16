const FacultyModel = require('../models/faculty.model');
const DepartmentModel = require('../models/department.model');
const catchAsync   = require('../utils/catchAsync');
const ApiError     = require('../utils/ApiError');

const list = catchAsync(async (req, res) => {
  const result = await FacultyModel.list(req.query);
  res.json({ success: true, data: result });
});

const getById = catchAsync(async (req, res) => {
  const item = await FacultyModel.findById(req.params.id);
  if (!item) throw ApiError.notFound('Faculty member not found');
  res.json({ success: true, data: item });
});

/** GET /api/v1/faculty-members/me - faculty sees their own record */
const getMe = catchAsync(async (req, res) => {
  const item = await FacultyModel.findByUserId(req.user.sub);
  if (!item) throw ApiError.notFound('Faculty record not found');
  res.json({ success: true, data: item });
});

/** GET /api/v1/faculty-members/all-active - for dropdowns */
const allActive = catchAsync(async (req, res) => {
  const rows = await FacultyModel.allActive();
  res.json({ success: true, data: rows });
});

const update = catchAsync(async (req, res) => {
  const { employeeId, designation, isActive, departmentId } = req.body;
  const existing = await FacultyModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Faculty member not found');

  // Validate departmentId if provided
  if (departmentId !== undefined && departmentId !== null && departmentId !== '') {
    const dept = await DepartmentModel.findById(departmentId);
    if (!dept) throw ApiError.badRequest('Selected department does not exist');
  }

  const item = await FacultyModel.update(req.params.id, { employeeId, designation, isActive, departmentId });
  res.json({ success: true, data: item });
});

const remove = catchAsync(async (req, res) => {
  const existing = await FacultyModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Faculty member not found');
  await FacultyModel.remove(req.params.id);
  res.json({ success: true, data: { message: 'Faculty member deactivated successfully' } });
});

module.exports = { list, getById, getMe, allActive, update, remove };
