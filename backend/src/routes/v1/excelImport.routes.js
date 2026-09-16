/**
 * excelImport.routes.js
 * HOD-only Excel import endpoints.
 * Uses multer with memory storage so we get a Buffer to pass to xlsx.
 */

const express = require('express');
const multer  = require('multer');
const { requireAuth, requireRole } = require('../../middleware/auth');
const {
  uploadImport,
  getHistory,
  getImportDetail,
  getFailedRows,
} = require('../../controllers/excelImport.controller');

const router = express.Router();

// Multer: store in memory (buffer), limit 20 MB per file
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter(req, file, cb) {
    const ext = (file.originalname || '').split('.').pop().toLowerCase();
    if (['xlsx', 'xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .xls files are allowed.'));
    }
  },
});

// All routes require HOD authentication
router.use(requireAuth, requireRole('hod'));

// Import history (must be before /:id to avoid conflict)
router.get('/history', getHistory);

// Upload & process an Excel file
router.post('/:type', upload.single('file'), uploadImport);

// Single import detail
router.get('/:id', getImportDetail);

// Download failed rows
router.get('/:id/failed-rows', getFailedRows);

module.exports = router;
