const SubjectModel = require('../models/subject.model');
const { makeCrudControllers } = require('./crudFactory');
const catchAsync = require('../utils/catchAsync');
const ApiError   = require('../utils/ApiError');

const base = makeCrudControllers(SubjectModel, 'Subject');

const create = catchAsync(async (req, res) => {
  const { code, name, departmentId, semesterNumber, credits } = req.body;
  if (!code || !name || !departmentId || !semesterNumber)
    throw ApiError.badRequest('code, name, departmentId and semesterNumber are required');

  const existing = await SubjectModel.findByCode(code);
  if (existing) throw ApiError.conflict(`Subject with code "${code.toUpperCase()}" already exists`);

  const item = await SubjectModel.create({ code, name, departmentId, semesterNumber, credits });
  res.status(201).json({ success: true, data: item });
});

const update = catchAsync(async (req, res) => {
  const { code, name, departmentId, semesterNumber, credits, isActive } = req.body;
  if (!code || !name || !departmentId || !semesterNumber)
    throw ApiError.badRequest('code, name, departmentId and semesterNumber are required');

  const existing = await SubjectModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Subject not found');

  const codeConflict = await SubjectModel.findByCode(code);
  if (codeConflict && codeConflict.id !== Number(req.params.id))
    throw ApiError.conflict(`Subject with code "${code.toUpperCase()}" already exists`);

  const item = await SubjectModel.update(req.params.id, { code, name, departmentId, semesterNumber, credits, isActive });
  res.json({ success: true, data: item });
});

const getSyllabus = catchAsync(async (req, res) => {
  const SyllabusModel = require('../models/syllabus.model');
  const units = await SyllabusModel.listBySubject(req.params.id);
  res.json({ success: true, data: units });
});

const createSyllabusUnit = catchAsync(async (req, res) => {
  const SyllabusModel = require('../models/syllabus.model');
  const { unitNumber, unitTitle, topics, totalHours } = req.body;
  if (!unitNumber || !unitTitle) {
    throw ApiError.badRequest('unitNumber and unitTitle are required');
  }
  const id = await SyllabusModel.create({
    subjectId: req.params.id,
    unitNumber: parseInt(unitNumber, 10),
    unitTitle: unitTitle.trim(),
    topics: topics ? topics.trim() : null,
    totalHours: totalHours ? parseInt(totalHours, 10) : null,
  });
  const unit = await SyllabusModel.findById(id);
  res.status(201).json({ success: true, data: unit });
});

const updateSyllabusUnit = catchAsync(async (req, res) => {
  const SyllabusModel = require('../models/syllabus.model');
  const { unitNumber, unitTitle, topics, totalHours, isActive } = req.body;
  const unit = await SyllabusModel.update(req.params.unitId, {
    unitNumber: unitNumber ? parseInt(unitNumber, 10) : undefined,
    unitTitle: unitTitle ? unitTitle.trim() : undefined,
    topics: topics !== undefined ? (topics ? topics.trim() : null) : undefined,
    totalHours: totalHours !== undefined ? (totalHours ? parseInt(totalHours, 10) : null) : undefined,
    isActive,
  });
  if (!unit) throw ApiError.notFound('Syllabus unit not found');
  res.json({ success: true, data: unit });
});

const deleteSyllabusUnit = catchAsync(async (req, res) => {
  const SyllabusModel = require('../models/syllabus.model');
  const deleted = await SyllabusModel.remove(req.params.unitId);
  if (!deleted) throw ApiError.notFound('Syllabus unit not found');
  res.json({ success: true, message: 'Syllabus unit deleted successfully' });
});

const addSubtopic = catchAsync(async (req, res) => {
  const SyllabusModel = require('../models/syllabus.model');
  const { title, orderIndex } = req.body;
  if (!title || !title.trim()) {
    throw ApiError.badRequest('Subtopic title is required');
  }
  const unit = await SyllabusModel.findById(req.params.unitId);
  if (!unit) throw ApiError.notFound('Syllabus unit not found');

  const subtopic = await SyllabusModel.createSubtopic({
    unitId: req.params.unitId,
    title: title.trim(),
    orderIndex: orderIndex !== undefined ? parseInt(orderIndex, 10) : undefined,
  });
  res.status(201).json({ success: true, data: subtopic });
});

const updateSubtopic = catchAsync(async (req, res) => {
  const SyllabusModel = require('../models/syllabus.model');
  const { title, orderIndex, isActive } = req.body;
  const subtopic = await SyllabusModel.updateSubtopic(req.params.subtopicId, {
    title: title ? title.trim() : undefined,
    orderIndex: orderIndex !== undefined ? parseInt(orderIndex, 10) : undefined,
    isActive,
  });
  if (!subtopic) throw ApiError.notFound('Subtopic not found');
  res.json({ success: true, data: subtopic });
});

const deleteSubtopic = catchAsync(async (req, res) => {
  const SyllabusModel = require('../models/syllabus.model');
  const deleted = await SyllabusModel.removeSubtopic(req.params.subtopicId);
  if (!deleted) throw ApiError.notFound('Subtopic not found');
  res.json({ success: true, message: 'Subtopic deleted successfully' });
});

module.exports = {
  list: base.list,
  getById: base.getById,
  create,
  update,
  remove: base.remove,
  getSyllabus,
  createSyllabusUnit,
  updateSyllabusUnit,
  deleteSyllabusUnit,
  addSubtopic,
  updateSubtopic,
  deleteSubtopic,
};

