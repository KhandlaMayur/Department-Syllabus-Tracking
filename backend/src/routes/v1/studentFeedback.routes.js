const express = require('express');
const ctrl = require('../../controllers/studentFeedback.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Student submits feedback
router.post('/', requireRole('student'), ctrl.submit);

// Faculty/CC/HOD list feedback with role scoping & filters
router.get('/', requireRole('faculty', 'cc', 'hod'), ctrl.listFeedbacks);

// Student sees their own feedback for a subject
router.get('/my/:subjectId/:batchId', requireRole('student'), ctrl.getMyFeedback);

// Faculty/CC/HOD view feedback for a specific topic
router.get('/topic/:subtopicId/batch/:batchId', requireRole('faculty', 'cc', 'hod'), ctrl.getByTopic);

// Faculty/CC/HOD view all feedback for a subject
router.get('/subject/:subjectId/batch/:batchId', requireRole('faculty', 'cc', 'hod'), ctrl.getBySubject);

module.exports = router;
