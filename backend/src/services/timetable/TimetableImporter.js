const path = require('path');
const { pool } = require('../../config/db');
const logger = require('../../utils/logger');
const PdfParser = require('./PdfParser');
const ImageOcrParser = require('./ImageOcrParser');
const ExcelTimetableParser = require('./ExcelTimetableParser');
const TimetableNormalizer = require('./TimetableNormalizer');
const SubjectMapper = require('./SubjectMapper');
const FacultyMapper = require('./FacultyMapper');
const TimetableValidator = require('./TimetableValidator');
const TimetableAnalyzer = require('./TimetableAnalyzer');
const TimetableModel = require('../../models/timetable.model');
const TimetableEntryModel = require('../../models/timetableEntry.model');
const TimetableSyncService = require('./timetableSync.service');

class TimetableImporter {
  /**
   * Parses file buffer and generates a full preview with mappings, conflicts & analysis
   */
  static async preview({ buffer, originalname, mimetype, departmentId = null, academicYearId = null, semesterId = null, divisionId = null }) {
    const ext = path.extname(originalname).toLowerCase();
    let normalizedEntries = [];
    let extractedMeta = {};
    let sourceFormat = 'pdf';

    if (ext === '.xlsx' || ext === '.xls') {
      sourceFormat = 'excel';
      const parsed = ExcelTimetableParser.parse(buffer);
      extractedMeta = parsed.meta || {};
      normalizedEntries = TimetableNormalizer.normalizeSlots(parsed.slots);
    } else if (ext === '.pdf') {
      sourceFormat = 'pdf';
      const parsed = await PdfParser.parse(buffer);
      normalizedEntries = TimetableNormalizer.parseFromTextLines(parsed.lines);
    } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      sourceFormat = 'image';
      const parsed = await ImageOcrParser.parse(buffer);
      normalizedEntries = TimetableNormalizer.parseFromTextLines(parsed.lines);
    } else {
      throw new Error(`Unsupported timetable file format: ${ext}. Use .pdf, .xlsx, .xls, .png, or .jpg.`);
    }

    if (!normalizedEntries.length) {
      throw new Error('Could not extract any timetable slots from the uploaded file. Please verify file content.');
    }

    // Load subject & faculty mapping caches
    const subjectCache = await SubjectMapper.buildCache(departmentId);
    const facultyCache = await FacultyMapper.buildCache(departmentId);

    const unmappedSubjects = new Set();
    const unmappedFaculty = new Set();

    // Map each entry
    for (const e of normalizedEntries) {
      // Match subject
      const matchedSubj = SubjectMapper.matchSubject(e.subjectCodeRaw, e.subjectNameRaw, subjectCache);
      if (matchedSubj) {
        e.subjectId = matchedSubj.id;
        e.subjectName = matchedSubj.name;
        e.subjectCode = matchedSubj.code;
      } else {
        e.subjectId = null;
        if (e.subjectCodeRaw) unmappedSubjects.add(e.subjectCodeRaw);
      }

      // Match faculty
      const matchedFac = FacultyMapper.matchFaculty(e.facultyInitial, facultyCache);
      if (matchedFac) {
        e.facultyId = matchedFac.facultyId;
        e.facultyName = matchedFac.name;
      } else {
        e.facultyId = null;
        if (e.facultyInitial) unmappedFaculty.add(e.facultyInitial);
      }
    }

    // Check conflicts
    const internalConflicts = TimetableValidator.checkInternalConflicts(normalizedEntries);
    const databaseCollisions = await TimetableValidator.checkDatabaseCollisions(normalizedEntries);
    const allConflicts = [...internalConflicts, ...databaseCollisions];

    // Check existing active timetable (duplicate / version bump)
    let existingActive = null;
    if (academicYearId && semesterId) {
      existingActive = await TimetableModel.findActiveByScope({
        academicYearId,
        semesterId,
        divisionId,
      });
    }

    // Calculate weekly analysis
    const analysis = TimetableAnalyzer.analyze(normalizedEntries);

    return {
      fileName: originalname,
      sourceFormat,
      totalSlots: normalizedEntries.length,
      extractedMeta,
      entries: normalizedEntries,
      analysis,
      conflicts: allConflicts,
      duplicateWarning: existingActive ? {
        id: existingActive.id,
        version: existingActive.version,
        uploadedAt: existingActive.uploaded_at,
        fileName: existingActive.file_name,
        message: `An active timetable (v${existingActive.version}) already exists for this Semester & Division. Importing will create a new version and archive the previous one.`,
      } : null,
      unmappedSubjects: Array.from(unmappedSubjects),
      unmappedFaculty: Array.from(unmappedFaculty),
    };
  }

  /**
   * Finalizes timetable import inside a transactional DB block
   */
  static async commit({
    academicYearId,
    semesterId,
    divisionId = null,
    departmentId = null,
    fileName,
    fileType = 'application/pdf',
    sourceFormat = 'pdf',
    uploadedBy,
    entries = [],
    notes = null,
    archivePrevious = true,
  }) {
    if (!entries.length) {
      throw new Error('Cannot commit an empty timetable. Entries array is required.');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Check current highest version
      const latestVersion = await TimetableModel.getLatestVersion({
        academicYearId,
        semesterId,
        divisionId,
      });
      const newVersion = (latestVersion || 0) + 1;

      // 2. Archive previous active versions if requested
      if (archivePrevious) {
        await TimetableModel.archivePreviousVersions(
          { academicYearId, semesterId, divisionId },
          conn
        );
      }

      // 3. Insert timetable parent record
      const timetableId = await TimetableModel.create({
        academicYearId,
        semesterId,
        divisionId,
        departmentId,
        fileName,
        fileType,
        uploadedBy,
        status: 'active',
        version: newVersion,
        sourceFormat,
        notes,
      }, conn);

      // 4. Attach timetableId to all entries and bulk insert
      const mappedEntries = entries.map(e => ({
        ...e,
        timetableId,
      }));

      await TimetableEntryModel.bulkCreate(mappedEntries, conn);

      // 5. Audit log
      await TimetableModel.logImport({
        timetableId,
        uploadedBy,
        action: 'import',
        result: 'success',
        subjectsCount: new Set(entries.map(e => e.subjectId || e.subjectCodeRaw)).size,
        entriesCount: entries.length,
        conflictsCount: 0,
        message: `Successfully imported timetable v${newVersion} with ${entries.length} slots.`,
      }, conn);

      // 6. Automatically sync timetable subjects & faculty to subject_assignments
      await TimetableSyncService.syncTimetableSubjects(timetableId, conn);

      await conn.commit();

      // Fetch created record and analysis
      const created = await TimetableModel.findById(timetableId);
      const analysis = await TimetableEntryModel.getWeeklyAnalysis(timetableId);

      return {
        timetable: created,
        version: newVersion,
        totalEntries: entries.length,
        analysis,
      };
    } catch (err) {
      await conn.rollback();
      logger.error(`Timetable commit failed: ${err.message}`);
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = TimetableImporter;
