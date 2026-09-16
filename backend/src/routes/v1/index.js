const express = require('express');
const healthRoutes            = require('./health.routes');
const authRoutes              = require('./auth.routes');
const departmentRoutes        = require('./departments.routes');
const academicYearRoutes      = require('./academicYears.routes');
const semesterRoutes          = require('./semesters.routes');
const batchRoutes             = require('./batches.routes');
const divisionRoutes          = require('./divisions.routes');
const studentRoutes           = require('./students.routes');
const facultyMemberRoutes     = require('./facultyMembers.routes');
const subjectRoutes           = require('./subjects.routes');
const subjectAssignmentRoutes = require('./subjectAssignments.routes');
const excelImportRoutes       = require('./excelImport.routes');
const timetableRoutes         = require('./timetable.routes');
const ccAssignmentRoutes      = require('./ccAssignments.routes');
const topicCompletionRoutes   = require('./topicCompletions.routes');
const studentFeedbackRoutes   = require('./studentFeedback.routes');
const ccFeedbackRoutes        = require('./ccFeedback.routes');

const router = express.Router();

router.use('/health',              healthRoutes);
router.use('/auth',                authRoutes);
router.use('/departments',         departmentRoutes);
router.use('/academic-years',      academicYearRoutes);
router.use('/semesters',           semesterRoutes);
router.use('/batches',             batchRoutes);
router.use('/divisions',           divisionRoutes);
router.use('/students',            studentRoutes);
router.use('/faculty-members',     facultyMemberRoutes);
router.use('/subjects',            subjectRoutes);
router.use('/subject-assignments', subjectAssignmentRoutes);
router.use('/excel-import',        excelImportRoutes);
router.use('/timetables',          timetableRoutes);
router.use('/cc-assignments',      ccAssignmentRoutes);
router.use('/topic-completions',   topicCompletionRoutes);
router.use('/student-feedback',    studentFeedbackRoutes);
router.use('/cc-feedback',         ccFeedbackRoutes);

module.exports = router;

