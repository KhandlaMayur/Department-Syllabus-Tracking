const express = require('express');
const ctrl = require('../../controllers/division.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/',    requireRole('hod', 'cc', 'faculty'), ctrl.list);
router.get('/:id/students', requireRole('hod', 'cc', 'faculty'), ctrl.getStudents);
router.get('/:id', requireRole('hod', 'cc', 'faculty'), ctrl.getById);
router.post('/',   requireRole('hod'), ctrl.create);
router.put('/:id', requireRole('hod'), ctrl.update);
router.delete('/:id', requireRole('hod'), ctrl.remove);

module.exports = router;
