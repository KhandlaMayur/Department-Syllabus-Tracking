const StudentModel   = require('../models/student.model');
const UserModel      = require('../models/user.model');
const { pool }       = require('../config/db');
const catchAsync     = require('../utils/catchAsync');
const ApiError       = require('../utils/ApiError');

const list = catchAsync(async (req, res) => {
  const result = await StudentModel.list(req.query);
  res.json({ success: true, data: result });
});

const getById = catchAsync(async (req, res) => {
  const item = await StudentModel.findById(req.params.id);
  if (!item) throw ApiError.notFound('Student not found');
  res.json({ success: true, data: item });
});

/** GET /api/v1/students/me - students see their own record */
const getMe = catchAsync(async (req, res) => {
  const item = await StudentModel.findByUserId(req.user.sub);
  if (!item) throw ApiError.notFound('Student record not found');
  res.json({ success: true, data: item });
});

const create = catchAsync(async (req, res) => {
  const { name, email, enrollmentNumber, semester, division, batch, batchId, divisionId, semesterId, roleId } = req.body;
  if (!name || !email || !enrollmentNumber)
    throw ApiError.badRequest('name, email and enrollmentNumber are required');

  // Check enrollment uniqueness
  const [existing] = await pool.query('SELECT id FROM students WHERE enrollment_number = ?', [enrollmentNumber]);
  if (existing.length) throw ApiError.conflict(`Enrollment number "${enrollmentNumber}" is already in use`);

  // Create user row
  const user = await UserModel.create({
    googleId: null, name, email,
    avatarUrl: null, roleId: roleId || 1, departmentId: req.body.departmentId || null,
  });

  const item = await StudentModel.create({
    userId: user.id, enrollmentNumber,
    semester, division, batch, batchId, divisionId, semesterId,
  });
  res.status(201).json({ success: true, data: item });
});

const update = catchAsync(async (req, res) => {
  const { enrollmentNumber, semester, division, batch, batchId, divisionId, semesterId, isActive } = req.body;
  const existing = await StudentModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Student not found');

  // Check enrollment uniqueness (exclude self)
  if (enrollmentNumber && enrollmentNumber !== existing.enrollment_number) {
    const [dup] = await pool.query(
      'SELECT id FROM students WHERE enrollment_number = ? AND id != ?',
      [enrollmentNumber, req.params.id]
    );
    if (dup.length) throw ApiError.conflict(`Enrollment number "${enrollmentNumber}" is already in use`);
  }

  const item = await StudentModel.update(req.params.id, {
    enrollmentNumber: enrollmentNumber || existing.enrollment_number,
    semester, division, batch, batchId, divisionId, semesterId, isActive,
  });
  res.json({ success: true, data: item });
});

const remove = catchAsync(async (req, res) => {
  const existing = await StudentModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Student not found');
  await StudentModel.remove(req.params.id);
  res.json({ success: true, data: { message: 'Student deactivated successfully' } });
});

module.exports = { list, getById, getMe, create, update, remove };
