const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const TimetableImporter = require('../services/timetable/TimetableImporter');
const TimetableModel = require('../models/timetable.model');
const TimetableEntryModel = require('../models/timetableEntry.model');
const FacultyInitialModel = require('../models/facultyInitial.model');
const FacultyModel = require('../models/faculty.model');
const StudentModel = require('../models/student.model');
const CCAssignmentModel = require('../models/ccAssignment.model');
const TimetableSyncService = require('../services/timetable/timetableSync.service');

const TimetableController = {
  /**
   * Preview an uploaded timetable file (PDF, Excel, Image)
   * Does NOT write to DB. Returns parsed slots, mappings, conflicts, analysis.
   */
  preview: catchAsync(async (req, res) => {
    if (!req.file) {
      throw ApiError.badRequest('Please upload a timetable file (.pdf, .xlsx, .xls, .png, .jpg).');
    }

    const preview = await TimetableImporter.preview({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      departmentId: req.body.departmentId ? parseInt(req.body.departmentId, 10) : null,
      academicYearId: req.body.academicYearId ? parseInt(req.body.academicYearId, 10) : null,
      semesterId: req.body.semesterId ? parseInt(req.body.semesterId, 10) : null,
      divisionId: req.body.divisionId ? parseInt(req.body.divisionId, 10) : null,
    });

    res.json({
      success: true,
      data: preview,
    });
  }),

  /**
   * Commit the imported timetable after user preview confirmation
   */
  commit: catchAsync(async (req, res) => {
    const {
      academicYearId,
      semesterId,
      divisionId,
      departmentId,
      fileName,
      fileType,
      sourceFormat,
      entries,
      notes,
      archivePrevious,
    } = req.body;

    if (!academicYearId || !semesterId) {
      throw ApiError.badRequest('academicYearId and semesterId are required.');
    }
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      throw ApiError.badRequest('Entries array is required and must not be empty.');
    }

    const result = await TimetableImporter.commit({
      academicYearId: parseInt(academicYearId, 10),
      semesterId: parseInt(semesterId, 10),
      divisionId: divisionId ? parseInt(divisionId, 10) : null,
      departmentId: departmentId ? parseInt(departmentId, 10) : null,
      fileName: fileName || 'Timetable',
      fileType: fileType || 'application/pdf',
      sourceFormat: sourceFormat || 'pdf',
      uploadedBy: req.user.sub,
      entries,
      notes: notes || null,
      archivePrevious: archivePrevious !== false,
    });

    res.status(201).json({
      success: true,
      message: `Timetable v${result.version} imported successfully with ${result.totalEntries} entries.`,
      data: result,
    });
  }),

  /**
   * List all timetables with filters (HOD / CC / Faculty)
   */
  list: catchAsync(async (req, res) => {
    const { academicYearId, semesterId, divisionId, departmentId, status, page, limit } = req.query;

    const data = await TimetableModel.list({
      academicYearId: academicYearId ? parseInt(academicYearId, 10) : null,
      semesterId: semesterId ? parseInt(semesterId, 10) : null,
      divisionId: divisionId ? parseInt(divisionId, 10) : null,
      departmentId: departmentId ? parseInt(departmentId, 10) : null,
      status: status || null,
      page,
      limit,
    });

    res.json({
      success: true,
      data,
    });
  }),

  /**
   * Single timetable details with entries & weekly analysis
   */
  getById: catchAsync(async (req, res) => {
    const { id } = req.params;
    const timetable = await TimetableModel.findById(id);
    if (!timetable) {
      throw ApiError.notFound('Timetable not found.');
    }

    const entries = await TimetableEntryModel.getByTimetableId(id);
    const analysis = await TimetableEntryModel.getWeeklyAnalysis(id);

    res.json({
      success: true,
      data: {
        timetable,
        entries,
        analysis,
      },
    });
  }),

  /**
   * Weekly lecture analysis for a timetable
   */
  getAnalysis: catchAsync(async (req, res) => {
    const { id } = req.params;
    const analysis = await TimetableEntryModel.getWeeklyAnalysis(id);
    res.json({
      success: true,
      data: analysis,
    });
  }),

  /**
   * Update timetable status (active/archived/draft) or notes
   */
  update: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    const updated = await TimetableModel.update(id, { status, notes });
    if (!updated) {
      throw ApiError.notFound('Timetable not found or nothing updated.');
    }

    const timetable = await TimetableModel.findById(id);
    res.json({
      success: true,
      message: 'Timetable updated successfully.',
      data: timetable,
    });
  }),

  /**
   * Delete a timetable and its entries
   */
  delete: catchAsync(async (req, res) => {
    const { id } = req.params;
    const deleted = await TimetableModel.delete(id);
    if (!deleted) {
      throw ApiError.notFound('Timetable not found.');
    }
    res.json({
      success: true,
      message: 'Timetable deleted successfully.',
    });
  }),

  /**
   * Faculty schedule:
   * Faculty sees their own assigned slots across all active timetables.
   * HOD can query any faculty by ?facultyId=X.
   */
  getFacultySchedule: catchAsync(async (req, res) => {
    let facultyId = null;

    if (req.user.role === 'faculty' || req.user.role === 'cc') {
      let fac = await FacultyModel.findByUserId(req.user.sub);
      if (!fac && req.user.role === 'cc') {
        const { pool } = require('../config/db');
        await pool.query(
          `INSERT INTO faculty (user_id, employee_id, faculty_initial, designation, is_active)
           VALUES (?, CONCAT('EMP', LPAD(?, 5, '0')), 'CC', 'Class Coordinator', 1)
           ON DUPLICATE KEY UPDATE is_active = 1`,
          [req.user.sub, req.user.sub]
        );
        fac = await FacultyModel.findByUserId(req.user.sub);
      }
      if (fac) facultyId = fac.id;
    } else if (req.query.facultyId) {
      facultyId = parseInt(req.query.facultyId, 10);
    } else {
      const fac = await FacultyModel.findByUserId(req.user.sub);
      if (fac) facultyId = fac.id;
    }

    if (!facultyId) {
      throw ApiError.badRequest('Faculty ID is required.');
    }

    const { academicYearId, semesterId } = req.query;
    const entries = await TimetableEntryModel.getByFacultyId(facultyId, {
      academicYearId: academicYearId ? parseInt(academicYearId, 10) : null,
      semesterId: semesterId ? parseInt(semesterId, 10) : null,
    });

    const totalHours = (entries.reduce((acc, e) => acc + (e.duration_minutes || 55), 0) / 60).toFixed(1);

    res.json({
      success: true,
      data: {
        facultyId,
        entries,
        totalSlots: entries.length,
        totalHours,
      },
    });
  }),

  /**
   * Student schedule:
   * RBAC ENFORCED: extracts semester_id and division_id directly from DB using req.user.sub.
   * Cannot be bypassed by frontend query parameters.
   */
  getStudentSchedule: catchAsync(async (req, res) => {
    const student = await StudentModel.findByUserId(req.user.sub || req.user.id);
    if (!student) {
      throw ApiError.forbidden('No student record found for your account.');
    }

    const { pool } = require('../config/db');

    // Determine semester ID: if student has semester_id use it, or find semester by number
    let semId = student.semester_id;
    if (!semId && (student.semester || student.semester_number)) {
      const semNum = student.semester || student.semester_number;
      const [sems] = await pool.query(
        'SELECT id FROM semesters WHERE number = ? ORDER BY id DESC LIMIT 1',
        [semNum]
      );
      if (sems.length) semId = sems[0].id;
    }

    if (!semId) {
      return res.json({
        success: true,
        data: {
          student,
          entries: [],
          message: 'No semester assigned to your profile.',
        },
      });
    }

    // Determine division ID: if student has division_id use it, or find division by name and semId
    let divId = student.division_id;
    if (!divId && (student.division || student.division_name)) {
      const rawDivName = (student.division_name || student.division).replace(/^Div\s+/i, '').trim();
      const [divs] = await pool.query(
        'SELECT id FROM divisions WHERE (name = ? OR name = ?) AND (semester_id = ? OR semester_id IS NULL) ORDER BY id DESC LIMIT 1',
        [rawDivName, `Div ${rawDivName}`, semId]
      );
      if (divs.length) divId = divs[0].id;
    }

    const labGroup = (student.lab_batch || (student.batch && student.batch.length <= 2 ? student.batch : null));
    const entries = await TimetableEntryModel.getByStudentScope({
      semesterId: semId,
      divisionId: divId,
      batchGroup: labGroup,
    });

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
          enrollmentNumber: student.enrollment_number,
          semester: student.semester || student.semester_number,
          semesterId: semId,
          division: student.division_name || student.division,
          divisionId: divId,
          batch: student.batch,
        },
        entries,
        totalSlots: entries.length,
      },
    });
  }),

  /**
   * Class Coordinator (CC) schedule:
   * View entries for coordinated division / semester
   * RBAC ENFORCED: CCs can ONLY see slots for their assigned batch, semester, and divisions.
   * HOD can view all batches and divisions.
   */
  getCCSchedule: catchAsync(async (req, res) => {
    let { academicYearId, semesterId, divisionId } = req.query;
    let divisionIds = null;
    let batchIds = null;

    if (req.user.role === 'cc' || req.user.role === 'faculty') {
      const myAssignments = await CCAssignmentModel.findByFacultyUserId(req.user.sub);
      if (!myAssignments || myAssignments.length === 0) {
        return res.json({
          success: true,
          data: {
            entries: [],
            totalSlots: 0,
            message: 'No classes currently assigned for coordination.',
          },
        });
      }

      // Allowed batches & divisions for this CC
      const assignedBatchIds = [...new Set(myAssignments.map(a => a.batch_id).filter(Boolean))];
      const explicitDivisionIds = myAssignments.map(a => a.division_id).filter(Boolean);
      const isEntireBatch = myAssignments.some(a => !a.division_id);

      if (divisionId) {
        const targetDivId = parseInt(divisionId, 10);
        let allowed = explicitDivisionIds.includes(targetDivId);
        if (!allowed && isEntireBatch) {
          const { pool } = require('../config/db');
          const [divCheck] = await pool.query(
            'SELECT id FROM divisions WHERE id = ? AND batch_id IN (?)',
            [targetDivId, assignedBatchIds]
          );
          if (divCheck.length > 0) allowed = true;
        }

        if (!allowed) {
          throw ApiError.forbidden('You are not authorized to view the timetable for this division.');
        }
      } else if (!isEntireBatch) {
        divisionIds = explicitDivisionIds;
      } else {
        batchIds = assignedBatchIds;
      }
    }

    const entries = await TimetableEntryModel.getActiveByScope({
      academicYearId: academicYearId ? parseInt(academicYearId, 10) : null,
      semesterId: semesterId ? parseInt(semesterId, 10) : null,
      divisionId: divisionId ? parseInt(divisionId, 10) : null,
      divisionIds,
      batchIds,
    });

    res.json({
      success: true,
      data: {
        entries,
        totalSlots: entries.length,
      },
    });
  }),

  /**
   * Faculty initials mappings:
   * List, Upsert, Delete
   */
  listInitials: catchAsync(async (req, res) => {
    const { departmentId } = req.query;
    const rows = await FacultyInitialModel.listByDept(departmentId ? parseInt(departmentId, 10) : null);
    res.json({
      success: true,
      data: rows,
    });
  }),

  upsertInitial: catchAsync(async (req, res) => {
    const { initials, facultyId, facultyName, departmentId } = req.body;
    if (!initials) {
      throw ApiError.badRequest('Initials are required.');
    }

    const id = await FacultyInitialModel.upsert({
      initials,
      facultyId: facultyId ? parseInt(facultyId, 10) : null,
      facultyName: facultyName || null,
      departmentId: departmentId ? parseInt(departmentId, 10) : null,
    });

    res.json({
      success: true,
      message: 'Faculty initial mapped successfully.',
      data: { id },
    });
  }),

  deleteInitial: catchAsync(async (req, res) => {
    const { id } = req.params;
    await FacultyInitialModel.delete(id);
    res.json({
      success: true,
      message: 'Faculty initial mapping removed.',
    });
  }),

  /**
   * Create a manual timetable header
   */
  createManual: catchAsync(async (req, res) => {
    const {
      academicYearId,
      semesterId,
      divisionId,
      departmentId,
      name,
      notes,
      archivePrevious,
    } = req.body;

    if (!academicYearId || !semesterId) {
      throw ApiError.badRequest('academicYearId and semesterId are required.');
    }

    const userId = req.user.id || req.user.sub;
    const latestVersion = await TimetableModel.getLatestVersion({
      academicYearId: parseInt(academicYearId, 10),
      semesterId: parseInt(semesterId, 10),
      divisionId: divisionId ? parseInt(divisionId, 10) : null,
    });
    const version = (latestVersion || 0) + 1;

    if (archivePrevious !== false) {
      await TimetableModel.archivePreviousVersions({
        academicYearId: parseInt(academicYearId, 10),
        semesterId: parseInt(semesterId, 10),
        divisionId: divisionId ? parseInt(divisionId, 10) : null,
      });
    }

    let finalFileName = name && name.trim();
    if (!finalFileName) {
      const { pool } = require('../config/db');
      const [semRow] = await pool.query('SELECT number FROM semesters WHERE id = ?', [semesterId]);
      let divName = '';
      if (divisionId) {
        const [divRow] = await pool.query('SELECT name FROM divisions WHERE id = ?', [divisionId]);
        divName = divRow[0]?.name || '';
      }
      const semNum = semRow[0]?.number || semesterId;
      finalFileName = divName ? `Semester ${semNum} - ${divName}` : `Semester ${semNum}`;
    }

    const timetableId = await TimetableModel.create({
      academicYearId: parseInt(academicYearId, 10),
      semesterId: parseInt(semesterId, 10),
      divisionId: divisionId ? parseInt(divisionId, 10) : null,
      departmentId: departmentId ? parseInt(departmentId, 10) : null,
      fileName: finalFileName,
      fileType: 'manual',
      sourceFormat: 'manual',
      uploadedBy: userId,
      version,
      status: 'active',
      notes: notes || null,
    });

    const timetable = await TimetableModel.findById(timetableId);
    res.status(201).json({
      success: true,
      message: `Manual timetable v${version} created successfully.`,
      data: timetable,
    });
  }),

  /**
   * Add a single slot to a timetable
   */
  addSlot: catchAsync(async (req, res) => {
    const { id } = req.params;
    const timetable = await TimetableModel.findById(id);
    if (!timetable) {
      throw ApiError.notFound('Timetable not found.');
    }

    const {
      day,
      startTime,
      endTime,
      subjectId,
      subjectCodeRaw,
      subjectNameRaw,
      facultyId,
      facultyInitial,
      room,
      entryType,
      batchGroup,
    } = req.body;

    if (!day || !startTime || !endTime) {
      throw ApiError.badRequest('Day, Start Time, and End Time are required.');
    }

    const slot = await TimetableEntryModel.createSingle({
      timetableId: id,
      day,
      startTime,
      endTime,
      subjectId: subjectId ? parseInt(subjectId, 10) : null,
      subjectCodeRaw,
      subjectNameRaw,
      facultyId: facultyId ? parseInt(facultyId, 10) : null,
      facultyInitial,
      room,
      entryType: entryType || 'lecture',
      batchGroup: batchGroup || 'ALL',
    });

    // Auto sync timetable subjects to subject_assignments
    await TimetableSyncService.syncTimetableSubjects(id);

    res.status(201).json({
      success: true,
      message: 'Timetable slot added successfully.',
      data: slot,
    });
  }),

  /**
   * Update an existing slot
   */
  updateSlot: catchAsync(async (req, res) => {
    const { slotId } = req.params;
    const existing = await TimetableEntryModel.findById(slotId);
    if (!existing) {
      throw ApiError.notFound('Slot not found.');
    }

    const updated = await TimetableEntryModel.update(slotId, req.body);

    // Auto sync timetable subjects to subject_assignments
    if (existing.timetable_id) {
      await TimetableSyncService.syncTimetableSubjects(existing.timetable_id);
    }

    res.json({
      success: true,
      message: 'Slot updated successfully.',
      data: updated,
    });
  }),

  /**
   * Delete a single slot
   */
  deleteSlot: catchAsync(async (req, res) => {
    const { slotId } = req.params;
    const existing = await TimetableEntryModel.findById(slotId);
    if (!existing) {
      throw ApiError.notFound('Slot not found.');
    }

    await TimetableEntryModel.remove(slotId);

    if (existing.timetable_id) {
      await TimetableSyncService.syncTimetableSubjects(existing.timetable_id);
    }

    res.json({
      success: true,
      message: 'Slot deleted successfully.',
    });
  }),

  /**
   * Import audit logs
   */
  getLogs: catchAsync(async (req, res) => {
    const { timetableId } = req.query;
    const logs = await TimetableModel.getLogs(timetableId ? parseInt(timetableId, 10) : null);
    res.json({
      success: true,
      data: logs,
    });
  }),
};

module.exports = TimetableController;
