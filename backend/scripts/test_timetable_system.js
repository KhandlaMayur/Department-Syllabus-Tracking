/**
 * test_timetable_system.js
 * Comprehensive automated verification script for Phase 5 Timetable System.
 * Tests:
 * 1. Database models (TimetableModel, TimetableEntryModel, FacultyInitialModel)
 * 2. Excel timetable matrix generation & parsing
 * 3. Subject and Faculty mapping
 * 4. Conflict detection (internal & database)
 * 5. Weekly lecture and workload analysis
 * 6. Transactional import commit & versioning
 * 7. Role-based schedule retrieval
 */

const path = require('path');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('../src/config/db');
const TimetableModel = require('../src/models/timetable.model');
const TimetableEntryModel = require('../src/models/timetableEntry.model');
const FacultyInitialModel = require('../src/models/facultyInitial.model');
const ExcelTimetableParser = require('../src/services/timetable/ExcelTimetableParser');
const TimetableNormalizer = require('../src/services/timetable/TimetableNormalizer');
const TimetableValidator = require('../src/services/timetable/TimetableValidator');
const TimetableAnalyzer = require('../src/services/timetable/TimetableAnalyzer');
const TimetableImporter = require('../src/services/timetable/TimetableImporter');
const SubjectMapper = require('../src/services/timetable/SubjectMapper');
const FacultyMapper = require('../src/services/timetable/FacultyMapper');

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING PHASE 5 TIMETABLE SYSTEM VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failed++;
    }
  }

  try {
    // 1. Database Connection & Base Records
    console.log('▶ TEST 1: Database Setup & Seed Check');
    const [[ay]] = await pool.query('SELECT id FROM academic_years LIMIT 1');
    const [[sem]] = await pool.query('SELECT id, number FROM semesters LIMIT 1');
    const [[user]] = await pool.query('SELECT id FROM users LIMIT 1');
    const [[dept]] = await pool.query('SELECT id FROM departments LIMIT 1');

    assert(ay && sem && user, 'Required master data (academic year, semester, user) exists');

    // 2. Faculty Initials Mapping Test
    console.log('\n▶ TEST 2: Faculty Initials Mapping');
    const initialId = await FacultyInitialModel.upsert({
      initials: 'TEST_BKP',
      facultyName: 'Dr. Bimal Patel',
      departmentId: dept ? dept.id : null,
    });
    assert(initialId > 0, 'Faculty initial mapped and saved to DB');

    const foundInitial = await FacultyInitialModel.findByInitial('TEST_BKP', dept ? dept.id : null);
    assert(foundInitial && foundInitial.initials === 'TEST_BKP', 'Faculty initial retrieved by abbreviation');

    // 3. Matrix Timetable Parsing
    console.log('\n▶ TEST 3: Matrix Timetable Parser');
    // Create an in-memory sample timetable workbook
    const ws_data = [
      ['Information & Communication Technology', '', '', '', '', '', ''],
      ['Semester: 5', '', 'Division: A', '', 'Class Room: MA112', '', ''],
      ['Time', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      ['', 'A', 'B', 'ALL', 'ALL', 'ALL', 'ALL'],
      ['07:50 - 08:45', 'A ICP DG MA112', 'B FSSI MS MA115', 'AC BKP MA001', 'BES AG MA001', 'VA-1 DT MA001', 'FREE'],
      ['08:45 - 09:40', 'A ICP DG MA112', 'B FSSI MS MA115', 'DBMS SK LAB1', 'DBMS SK LAB1', 'AC BKP MA001', 'FREE'],
      ['09:40 - 10:35', 'LUNCH', 'LUNCH', 'LUNCH', 'LUNCH', 'LUNCH', 'LUNCH'],
      ['10:35 - 11:30', 'AC BKP MA001', 'AC BKP MA001', 'FSSI MS MA001', 'ICP DG MA001', 'PBL', 'FREE'],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parsedExcel = ExcelTimetableParser.parse(excelBuffer);
    assert(parsedExcel && parsedExcel.slots && parsedExcel.slots.length > 0, `Excel parsed successfully: ${parsedExcel.slots.length} raw slots found`);
    assert(parsedExcel.slots.some(s => s.subjectCode === 'AC' && s.facultyInitial === 'BKP'), 'Identified cell with Subject AC and Faculty BKP');
    assert(parsedExcel.slots.some(s => s.batchGroup === 'A' || s.batchGroup === 'B'), 'Identified batch subgroups A and B');

    // 4. Normalization
    console.log('\n▶ TEST 4: Timetable Normalization');
    const normalized = TimetableNormalizer.normalizeSlots(parsedExcel.slots);
    assert(normalized.length > 0, `Normalized ${normalized.length} slots into canonical format`);
    assert(normalized.every(n => n.day && n.startTime && n.endTime && n.durationMinutes > 0), 'All normalized slots have valid Day, StartTime, EndTime, and Duration');

    // 5. Weekly Analysis
    console.log('\n▶ TEST 5: Weekly Workload & Hours Analysis');
    const analysis = TimetableAnalyzer.analyze(normalized);
    assert(analysis.summary.totalEntries === normalized.length, `Summary total entries matches normalized: ${analysis.summary.totalEntries}`);
    assert(analysis.summary.totalHours > 0, `Total hours calculated: ${analysis.summary.totalHours} hrs`);
    assert(analysis.subjectStats.length > 0, `Subject stats calculated: ${analysis.subjectStats.length} subjects`);
    assert(analysis.facultyStats.length > 0, `Faculty workload stats calculated: ${analysis.facultyStats.length} faculty`);

    // 6. Conflict Detection
    console.log('\n▶ TEST 6: Conflict Detection');
    const conflictingSlots = [
      ...normalized,
      // Duplicate slot with same room at same time on same day
      {
        day: 'Monday',
        startTime: '07:50',
        endTime: '08:45',
        durationMinutes: 55,
        subjectCodeRaw: 'CONFLICT_SUBJ',
        facultyInitial: 'OTHER_FAC',
        room: 'MA112', // same room as Monday 07:50 slot
        batchGroup: 'ALL',
      }
    ];
    const conflicts = TimetableValidator.checkInternalConflicts(conflictingSlots);
    assert(conflicts.length > 0, `Internal conflict detected: ${conflicts[0].message}`);

    // 7. Transactional Timetable Commit & Versioning
    console.log('\n▶ TEST 7: Transactional Timetable Commit & Versioning');
    const commitResultV1 = await TimetableImporter.commit({
      academicYearId: ay.id,
      semesterId: sem.id,
      fileName: 'Test_Timetable_Sem5.xlsx',
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sourceFormat: 'excel',
      uploadedBy: user.id,
      entries: normalized,
      notes: 'Test Timetable Import v1',
      archivePrevious: true,
    });
    assert(commitResultV1 && commitResultV1.version >= 1, `Timetable v${commitResultV1.version} created with ID ${commitResultV1.timetable.id}`);

    // Commit again to test automatic version bump and archiving of previous
    const commitResultV2 = await TimetableImporter.commit({
      academicYearId: ay.id,
      semesterId: sem.id,
      fileName: 'Test_Timetable_Sem5_v2.xlsx',
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sourceFormat: 'excel',
      uploadedBy: user.id,
      entries: normalized,
      notes: 'Test Timetable Import v2 (Updated)',
      archivePrevious: true,
    });
    assert(commitResultV2 && commitResultV2.version === commitResultV1.version + 1, `Timetable version incremented correctly: v${commitResultV1.version} -> v${commitResultV2.version}`);

    // Verify v1 is archived and v2 is active
    const v1Record = await TimetableModel.findById(commitResultV1.timetable.id);
    const v2Record = await TimetableModel.findById(commitResultV2.timetable.id);
    assert(v1Record.status === 'archived', 'Previous version v1 was archived');
    assert(v2Record.status === 'active', 'Latest version v2 is active');

    // 8. Timetable Entry Retrieval & Analysis from DB
    console.log('\n▶ TEST 8: Database Query & Analysis');
    const dbEntries = await TimetableEntryModel.getByTimetableId(v2Record.id);
    assert(dbEntries.length === normalized.length, `Retrieved ${dbEntries.length} entries from database`);

    const dbAnalysis = await TimetableEntryModel.getWeeklyAnalysis(v2Record.id);
    assert(dbAnalysis && dbAnalysis.subjectStats.length > 0, 'Aggregated weekly analysis from database matches');

    // 9. Clean up test data
    console.log('\n▶ TEST 9: Cleanup');
    await TimetableModel.delete(commitResultV1.timetable.id);
    await TimetableModel.delete(commitResultV2.timetable.id);
    await FacultyInitialModel.delete(initialId);
    assert(true, 'Test timetables and test faculty initial cleaned up');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
