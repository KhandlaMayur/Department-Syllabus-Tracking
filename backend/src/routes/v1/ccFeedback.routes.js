const express = require('express');
const ctrl = require('../../controllers/ccFeedback.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// CC/Faculty/HOD submits CC feedback for a covered topic (requires student feedback first)
router.post('/', requireRole('faculty', 'cc', 'hod'), ctrl.submit);

// View CC feedback for a specific topic (includes previous CC records)
router.get('/topic/:subtopicId/batch/:batchId', requireRole('faculty', 'cc', 'hod'), ctrl.getByTopic);

// View all CC feedback for a subject in a batch
router.get('/subject/:subjectId/batch/:batchId', requireRole('faculty', 'cc', 'hod'), ctrl.getBySubject);

module.exports = router;
