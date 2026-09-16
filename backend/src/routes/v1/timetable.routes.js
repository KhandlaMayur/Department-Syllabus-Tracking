const express = require('express');
const multer = require('multer');
const { requireAuth, requireRole } = require('../../middleware/auth');
const TimetableController = require('../../controllers/timetable.controller');

const router = express.Router();

// Multer memory storage supporting PDF, Excel, and Images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter(req, file, cb) {
    const ext = (file.originalname || '').split('.').pop().toLowerCase();
    if (['pdf', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .pdf, .xlsx, .xls, .png, and .jpg files are allowed.'));
    }
  },
});

// All routes require authenticated user
router.use(requireAuth);

// Student schedule (Strict RBAC: semester and division taken from DB student record)
router.get('/student/schedule', requireRole('student'), TimetableController.getStudentSchedule);

// Faculty schedule (Personal teaching timetable)
router.get('/faculty/schedule', requireRole('faculty', 'cc', 'hod'), TimetableController.getFacultySchedule);

// Class Coordinator schedule (CC, HOD, and Faculty who are CC)
router.get('/cc/schedule', requireRole('cc', 'hod', 'faculty'), TimetableController.getCCSchedule);

// Import preview (HOD & CC can preview)
router.post('/preview', requireRole('hod', 'cc'), upload.single('file'), TimetableController.preview);

// Commit import (HOD only)
router.post('/commit', requireRole('hod'), TimetableController.commit);

// Faculty initials lookup & mapping
router.get('/initials', requireRole('hod', 'cc'), TimetableController.listInitials);
router.post('/initials', requireRole('hod'), TimetableController.upsertInitial);
router.delete('/initials/:id', requireRole('hod'), TimetableController.deleteInitial);

// Audit logs (HOD only)
router.get('/logs', requireRole('hod'), TimetableController.getLogs);

// Timetable listing (HOD, CC, Faculty)
router.get('/', requireRole('hod', 'cc', 'faculty'), TimetableController.list);

// Single timetable detail and analysis
router.get('/:id', TimetableController.getById);
router.get('/:id/analysis', TimetableController.getAnalysis);

// Manual timetable creation (HOD & CC)
router.post('/manual', requireRole('hod', 'cc'), TimetableController.createManual);

// Slot management for timetable (HOD & CC)
router.post('/:id/slots', requireRole('hod', 'cc'), TimetableController.addSlot);
router.put('/:id/slots/:slotId', requireRole('hod', 'cc'), TimetableController.updateSlot);
router.delete('/:id/slots/:slotId', requireRole('hod', 'cc'), TimetableController.deleteSlot);

// Update status/notes and Delete (HOD only)
router.put('/:id', requireRole('hod'), TimetableController.update);
router.delete('/:id', requireRole('hod'), TimetableController.delete);

module.exports = router;
