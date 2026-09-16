const express = require('express');
const ctrl = require('../../controllers/topicCompletion.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Unit level teaching activation
router.post('/unit/activate', requireRole('faculty', 'cc', 'hod'), ctrl.activateUnit);
router.delete('/unit/:unitId/batch/:batchId/activate', requireRole('faculty', 'cc', 'hod'), ctrl.deactivateUnit);

// Unit level completion
router.post('/unit', requireRole('faculty', 'cc', 'hod'), ctrl.markUnitComplete);
router.delete('/unit/:unitId/batch/:batchId', requireRole('faculty', 'cc', 'hod'), ctrl.unmarkUnit);

// Faculty/CC mark topics as covered
router.post('/', requireRole('faculty', 'cc', 'hod'), ctrl.markComplete);

// Faculty/CC unmark topics
router.delete('/:subtopicId/batch/:batchId', requireRole('faculty', 'cc', 'hod'), ctrl.markIncomplete);

// Get completion status for a subject+batch (all authenticated roles can view)
router.get('/subject/:subjectId/batch/:batchId', ctrl.getBySubjectAndBatch);

// Bulk progress for dashboard cards
router.get('/progress', ctrl.getProgressBulk);

module.exports = router;
