const express = require('express');
const ctrl = require('../../controllers/subject.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// All authenticated roles can read subjects
router.get('/',    ctrl.list);
router.get('/:id', ctrl.getById);

// HOD manages, CC can also create subjects
router.post('/',   requireRole('hod', 'cc'), ctrl.create);
router.put('/:id', requireRole('hod', 'cc'), ctrl.update);
router.delete('/:id', requireRole('hod'), ctrl.remove);

// Syllabus units for a subject (combined in Subject management)
router.get('/:id/syllabus', ctrl.getSyllabus);
router.post('/:id/syllabus', requireRole('hod', 'cc'), ctrl.createSyllabusUnit);
router.put('/:id/syllabus/:unitId', requireRole('hod', 'cc'), ctrl.updateSyllabusUnit);
router.delete('/:id/syllabus/:unitId', requireRole('hod'), ctrl.deleteSyllabusUnit);

// Subtopics within a syllabus unit
router.post('/:id/syllabus/:unitId/subtopics', requireRole('hod', 'cc'), ctrl.addSubtopic);
router.put('/:id/syllabus/:unitId/subtopics/:subtopicId', requireRole('hod', 'cc'), ctrl.updateSubtopic);
router.delete('/:id/syllabus/:unitId/subtopics/:subtopicId', requireRole('hod', 'cc'), ctrl.deleteSubtopic);

module.exports = router;

