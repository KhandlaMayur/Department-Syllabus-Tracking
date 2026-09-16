const express = require('express');
const ctrl = require('../../controllers/batch.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// HOD: full CRUD. CC: read-only list
router.get('/',    requireRole('hod', 'cc', 'faculty'), ctrl.list);
router.get('/:id', requireRole('hod', 'cc', 'faculty'), ctrl.getById);
router.post('/',   requireRole('hod'), ctrl.create);
router.put('/:id', requireRole('hod'), ctrl.update);
router.delete('/:id', requireRole('hod'), ctrl.remove);

module.exports = router;
