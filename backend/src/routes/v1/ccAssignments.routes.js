const express = require('express');
const ctrl = require('../../controllers/ccAssignment.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// CC sees their own batch assignments
router.get('/my', requireRole('cc', 'faculty', 'hod'), ctrl.myAssignment);

// HOD and CC can list all
router.get('/', requireRole('hod', 'cc'), ctrl.list);

// HOD only: assign, reassign, remove
router.post('/',   requireRole('hod'), ctrl.assign);
router.put('/:id', requireRole('hod'), ctrl.reassign);
router.delete('/:id', requireRole('hod'), ctrl.remove);

module.exports = router;
