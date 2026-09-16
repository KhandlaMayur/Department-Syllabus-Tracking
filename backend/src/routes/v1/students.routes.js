const express = require('express');
const ctrl = require('../../controllers/student.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Self-lookup for students
router.get('/me', requireRole('student'), ctrl.getMe);

// Admin: HOD full CRUD, CC read
router.get('/',    requireRole('hod', 'cc'), ctrl.list);
router.get('/:id', requireRole('hod', 'cc'), ctrl.getById);
router.post('/',   requireRole('hod'), ctrl.create);
router.put('/:id', requireRole('hod'), ctrl.update);
router.delete('/:id', requireRole('hod'), ctrl.remove);

module.exports = router;
