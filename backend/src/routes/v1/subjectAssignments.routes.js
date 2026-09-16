const express = require('express');
const ctrl = require('../../controllers/subjectAssignment.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Faculty sees their own assignments
router.get('/my', requireRole('faculty', 'cc', 'hod'), ctrl.myAssignments);

// HOD full CRUD, CC read
router.get('/',    requireRole('hod', 'cc'), ctrl.list);
router.get('/:id', requireRole('hod', 'cc'), ctrl.getById);
router.post('/',   requireRole('hod', 'cc'), ctrl.create);
router.put('/:id', requireRole('hod', 'cc'), ctrl.update);
router.delete('/:id', requireRole('hod'), ctrl.remove);

module.exports = router;
