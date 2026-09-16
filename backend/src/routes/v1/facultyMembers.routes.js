const express = require('express');
const ctrl = require('../../controllers/faculty.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Self-lookup for any faculty-type role
router.get('/me',         requireRole('faculty', 'cc', 'hod'), ctrl.getMe);
router.get('/all-active', requireRole('hod', 'cc'),            ctrl.allActive);

// Admin: HOD manage, all authenticated see list/detail
router.get('/',    ctrl.list);
router.get('/:id', ctrl.getById);
router.put('/:id', requireRole('hod'), ctrl.update);
router.delete('/:id', requireRole('hod'), ctrl.remove);

module.exports = router;
