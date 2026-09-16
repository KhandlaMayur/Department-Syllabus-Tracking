const { pool } = require('../../config/db');
const SubjectMapper = require('./SubjectMapper');
const FacultyMapper = require('./FacultyMapper');

/**
 * Service to resolve unmapped subjects & faculty on timetable entries
 * and synchronize active timetable slots into subject_assignments.
 */
class TimetableSyncService {
  /**
   * Synchronizes a single timetable's entries:
   * 1. Resolves missing subject_id & faculty_id from raw codes/names
   * 2. Upserts distinct (subject_id, faculty_id, division_id, semester_id, academic_year_id) into subject_assignments
   */
  static async syncTimetableSubjects(timetableId, conn = null) {
    if (!timetableId) return { synced: 0 };
    const db = conn || pool;

    // Fetch timetable scope
    const [tRows] = await db.query(
      `SELECT id, academic_year_id, semester_id, division_id, department_id, status
       FROM timetables WHERE id = ? LIMIT 1`,
      [timetableId]
    );
    if (!tRows.length) return { synced: 0 };
    const timetable = tRows[0];

    // Build subject and faculty lookup caches
    const [subjectCache, facultyCache] = await Promise.all([
      SubjectMapper.buildCache(timetable.department_id),
      FacultyMapper.buildCache(timetable.department_id),
    ]);

    // Fetch entries of this timetable
    const [entries] = await db.query(
      `SELECT id, subject_id, subject_code_raw, subject_name_raw,
              faculty_id, faculty_initial
       FROM timetable_entries
       WHERE timetable_id = ?`,
      [timetableId]
    );

    // 1. Backfill subject_id and faculty_id on entries if missing
    for (const e of entries) {
      let updatedSubjectId = e.subject_id;
      let updatedFacultyId = e.faculty_id;
      let updatedSubjectCode = (e.subject_code_raw || '').trim();
      let updatedSubjectName = (e.subject_name_raw || '').trim();

      // Resolve subject ID
      if (!updatedSubjectId && (updatedSubjectCode || updatedSubjectName)) {
        const matched = SubjectMapper.matchSubject(updatedSubjectCode, updatedSubjectName, subjectCache);
        if (matched) {
          updatedSubjectId = matched.id;
          if (!updatedSubjectName) updatedSubjectName = matched.name;
          if (!updatedSubjectCode) updatedSubjectCode = matched.code;
        } else {
          // Auto-create subject in database if it was added directly in timetable
          const cleanCode = updatedSubjectCode || (updatedSubjectName ? updatedSubjectName.substring(0, 10).toUpperCase() : 'SUBJ');
          const cleanName = updatedSubjectName || cleanCode;

          const [existingSubjs] = await db.query(
            `SELECT id, code, name FROM subjects WHERE (code = ? AND code != '') OR (name = ? AND name != '') LIMIT 1`,
            [cleanCode, cleanName]
          );

          if (existingSubjs.length > 0) {
            updatedSubjectId = existingSubjs[0].id;
            updatedSubjectCode = existingSubjs[0].code;
            updatedSubjectName = existingSubjs[0].name;
          } else {
            let semNum = 1;
            if (timetable.semester_id) {
              const [semRows] = await db.query('SELECT number FROM semesters WHERE id = ?', [timetable.semester_id]);
              if (semRows.length > 0) semNum = semRows[0].number;
            }

            const [createSubRes] = await db.query(
              `INSERT INTO subjects (code, name, department_id, semester_number, credits, is_active)
               VALUES (?, ?, ?, ?, 4.0, 1)`,
              [cleanCode, cleanName, timetable.department_id || 1, semNum]
            );
            updatedSubjectId = createSubRes.insertId;
            updatedSubjectCode = cleanCode;
            updatedSubjectName = cleanName;

            // Update cache
            subjectCache.byCode.set(cleanCode.toUpperCase(), { id: updatedSubjectId, code: cleanCode, name: cleanName });
            subjectCache.byName.set(cleanName.toUpperCase(), { id: updatedSubjectId, code: cleanCode, name: cleanName });
          }
        }
      } else if (updatedSubjectId && (!updatedSubjectName || !updatedSubjectCode)) {
        const [subRow] = await db.query('SELECT code, name FROM subjects WHERE id = ?', [updatedSubjectId]);
        if (subRow.length > 0) {
          if (!updatedSubjectName) updatedSubjectName = subRow[0].name;
          if (!updatedSubjectCode) updatedSubjectCode = subRow[0].code;
        }
      }

      // Resolve faculty ID
      if (!updatedFacultyId && e.faculty_initial) {
        const matched = FacultyMapper.matchFaculty(e.faculty_initial, facultyCache);
        if (matched) updatedFacultyId = matched.facultyId;
      }

      // Update timetable_entry record
      if (
        updatedSubjectId !== e.subject_id ||
        updatedFacultyId !== e.faculty_id ||
        updatedSubjectName !== e.subject_name_raw ||
        updatedSubjectCode !== e.subject_code_raw
      ) {
        await db.query(
          `UPDATE timetable_entries
           SET subject_id = ?, faculty_id = ?,
               subject_code_raw = ?, subject_name_raw = ?
           WHERE id = ?`,
          [
            updatedSubjectId || null,
            updatedFacultyId || null,
            updatedSubjectCode || null,
            updatedSubjectName || null,
            e.id,
          ]
        );
      }
    }

    // 2. Synchronize distinct subject-faculty mappings to subject_assignments
    let targetDivisionIds = [];
    if (timetable.division_id) {
      targetDivisionIds.push(timetable.division_id);
    } else if (timetable.semester_id) {
      const [divRows] = await db.query(
        `SELECT id FROM divisions WHERE semester_id = ? AND is_active = 1`,
        [timetable.semester_id]
      );
      targetDivisionIds = divRows.map(d => d.id);
    }

    let syncedCount = 0;
    if (targetDivisionIds.length > 0 && timetable.semester_id && timetable.academic_year_id) {
      const [distinctMappings] = await db.query(
        `SELECT DISTINCT te.subject_id, te.faculty_id
         FROM timetable_entries te
         WHERE te.timetable_id = ?
           AND te.subject_id IS NOT NULL
           AND te.faculty_id IS NOT NULL`,
        [timetableId]
      );

      for (const m of distinctMappings) {
        for (const divId of targetDivisionIds) {
          await db.query(
            `INSERT INTO subject_assignments (
               subject_id, faculty_id, division_id, semester_id, academic_year_id, is_active
             ) VALUES (?, ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE
               faculty_id = VALUES(faculty_id),
               is_active = 1`,
            [
              m.subject_id,
              m.faculty_id,
              divId,
              timetable.semester_id,
              timetable.academic_year_id,
            ]
          );
          syncedCount++;
        }
      }
    }

    return { synced: syncedCount };
  }

  /**
   * Run sync for all currently active timetables
   */
  static async syncAllActiveTimetables() {
    const [rows] = await pool.query(
      `SELECT id FROM timetables WHERE status = 'active' ORDER BY id ASC`
    );
    let totalSynced = 0;
    for (const r of rows) {
      const res = await this.syncTimetableSubjects(r.id);
      totalSynced += res.synced;
    }
    return { timetablesCount: rows.length, totalSynced };
  }
}

module.exports = TimetableSyncService;
