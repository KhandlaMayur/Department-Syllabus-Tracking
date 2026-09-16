const express = require('express');
const ctrl = require('../../controllers/academicYear.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/',    ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/',   requireRole('hod'), ctrl.create);
router.put('/:id', requireRole('hod'), ctrl.update);
router.delete('/:id', requireRole('hod'), ctrl.remove);

module.exports = router;
