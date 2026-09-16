/**
 * excelImport.controller.js
 * HOD-only endpoints for Excel bulk imports.
 */

const catchAsync = require('../utils/catchAsync');
const ApiError   = require('../utils/ApiError');
const ExcelImportModel = require('../models/excelImport.model');
const { processImport } = require('../services/excelImport.service');

const ALLOWED_TYPES = ['students', 'faculty', 'subjects', 'batches', 'syllabus', 'timetable'];

/**
 * POST /excel-import/:type
 * Accepts multipart/form-data with field name "file".
 * Processes the upload and returns full import stats.
 */
const uploadImport = catchAsync(async (req, res) => {
  const { type } = req.params;

  if (!ALLOWED_TYPES.includes(type)) {
    throw ApiError.badRequest(`Invalid import type. Must be one of: ${ALLOWED_TYPES.join(', ')}`);
  }

  if (!req.file) {
    throw ApiError.badRequest('No file uploaded. Please attach an .xlsx or .xls file.');
  }

  const { buffer, originalname, mimetype } = req.file;

  // Validate file type
  const ext = (originalname || '').split('.').pop().toLowerCase();
  if (!['xlsx', 'xls'].includes(ext)) {
    throw ApiError.badRequest('Invalid file type. Only .xlsx and .xls files are supported.');
  }

  const result = await processImport({
    buffer,
    originalname,
    importType: type,
    importedBy: req.user.id || req.user.sub,
    departmentId: req.user.department_id || req.user.departmentId,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * GET /excel-import/history
 * Returns paginated import history for the HOD.
 */
const getHistory = catchAsync(async (req, res) => {
  const data = await ExcelImportModel.list({
    page:        req.query.page,
    limit:       req.query.limit,
    importType:  req.query.type,
  });

  res.status(200).json({ success: true, data });
});

/**
 * GET /excel-import/:id
 * Returns a single import record with preview rows.
 */
const getImportDetail = catchAsync(async (req, res) => {
  const record = await ExcelImportModel.findById(req.params.id);
  if (!record) throw ApiError.notFound('Import record not found.');

  const previewRows = await ExcelImportModel.getPreviewRows(record.id, 20);

  res.status(200).json({
    success: true,
    data: { ...record, previewRows },
  });
});

/**
 * GET /excel-import/:id/failed-rows
 * Returns failed/invalid/duplicate rows for CSV download.
 */
const getFailedRows = catchAsync(async (req, res) => {
  const record = await ExcelImportModel.findById(req.params.id);
  if (!record) throw ApiError.notFound('Import record not found.');

  const statuses = req.query.statuses
    ? req.query.statuses.split(',')
    : ['invalid', 'failed', 'duplicate'];

  const rows = await ExcelImportModel.getFailedRows(record.id, statuses);

  res.status(200).json({
    success: true,
    data: {
      importId:   record.id,
      importType: record.import_type,
      fileName:   record.file_name,
      rows,
    },
  });
});

module.exports = { uploadImport, getHistory, getImportDetail, getFailedRows };
