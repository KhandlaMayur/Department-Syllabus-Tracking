/**
 * excelImport.service.js
 * Handles parsing, validation, and transactional DB insertion
 * for all 6 Excel import types.
 *
 * Design principles:
 *  - Parse first, validate every row, then insert in a transaction.
 *  - Never partially corrupt data: roll back on unexpected failure.
 *  - Duplicate rows are skipped + counted (not errors).
 *  - Invalid rows are logged to excel_import_rows, never inserted.
 *  - Returns a rich result object for the API response.
 */

const XLSX = require('xlsx');
const { pool } = require('../config/db');
const ExcelImportModel = require('../models/excelImport.model');
const logger = require('../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────────

const UNIVERSITY_EMAIL_DOMAIN = '@marwadiuniversity.ac.in';
const FACULTY_EMAIL_DOMAINS   = ['@marwadieducation.edu.in', '@marwadieducation.ed'];
const MAX_ROWS = 5000; // safety cap per file

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '_');
}

/** Parse xlsx/xls buffer → array of plain objects (using first sheet) */
function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel file has no sheets.');
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!raw.length) throw new Error('Excel file is empty or has no data rows.');
  if (raw.length > MAX_ROWS) throw new Error(`File contains ${raw.length} rows. Maximum allowed is ${MAX_ROWS}.`);

  // Normalise headers
  return raw.map(row => {
    const normalised = {};
    for (const [k, v] of Object.entries(row)) {
      normalised[normalizeHeader(k)] = typeof v === 'string' ? v.trim() : v;
    }
    return normalised;
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isUniversityEmail(email) {
  return String(email || '').toLowerCase().endsWith(UNIVERSITY_EMAIL_DOMAIN);
}

function isFacultyEmail(email) {
  const lower = String(email || '').toLowerCase().trim();
  return FACULTY_EMAIL_DOMAINS.some(d => lower.endsWith(d));
}

function toStr(v) { return v !== null && v !== undefined ? String(v).trim() : ''; }
function toInt(v) { const n = parseInt(v, 10); return isNaN(n) ? null : n; }
function toFloat(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

/** Lookup helpers that hit the DB once and cache */
async function buildLookupMaps(conn) {
  const [depts]         = await conn.query('SELECT id, name, code FROM departments');
  const [batches]       = await conn.query('SELECT id, name FROM batches WHERE is_active=1');
  const [academicYears] = await conn.query('SELECT id, name, is_active FROM academic_years');
  const [roles]         = await conn.query('SELECT id, name FROM roles');

  const deptByName = {};
  const deptByCode = {};
  const batchByName = {};
  const ayByLabel = {};

  for (const d of depts) {
    if (d.name) deptByName[d.name.toLowerCase().trim()] = d.id;
    if (d.code) deptByCode[d.code.toLowerCase().trim()] = d.id;
  }
  for (const b of batches) {
    if (b.name) batchByName[b.name.toLowerCase().trim()] = b.id;
  }
  for (const a of academicYears) {
    if (a.name) ayByLabel[a.name.toLowerCase().trim()] = a.id;
  }

  const studentRoleId = roles.find(r => r.name === 'student')?.id;
  const facultyRoleId = roles.find(r => r.name === 'faculty')?.id;
  const defaultDeptId = depts[0]?.id || 1;
  const defaultAyId   = academicYears.find(a => a.is_active)?.id || academicYears[0]?.id || 1;

  return { deptByName, deptByCode, batchByName, ayByLabel, studentRoleId, facultyRoleId, defaultDeptId, defaultAyId };
}

function resolveDept(name, maps) {
  if (!name) return null;
  const key = toStr(name).toLowerCase().trim();
  return maps.deptByName[key] || maps.deptByCode[key] || null;
}

// ─── Per-type validators ───────────────────────────────────────────────────────

function validateStudentRow(row, rowNum, maps) {
  const errors = [];

  const enrollment = toStr(row.enrollment_no || row.enrollment_number || row.enrollment || row.enroll_no || row.enroll);
  const name       = toStr(row.student_name || row.name || row.full_name);
  const rollNumber = toStr(row.roll_no || row.roll_number || row.rollno || row.roll);
  let email        = toStr(row.email || row.student_email).toLowerCase().trim();
  const dept       = toStr(row.department || row.dept);
  const semester   = row.semester || row.sem;
  const batch      = toStr(row.batch || row.batch_name);
  const division   = toStr(row.division || row.div || row.division_name || '').toUpperCase().trim();
  const statusRaw  = toStr(row.status).toLowerCase().trim();
  const ayLabel    = toStr(row.academic_year || row.ay || '');

  if (!enrollment) errors.push({ field: 'enrollment_number', message: 'Enrollment number is required.' });
  if (!name || name.length < 2) errors.push({ field: 'name', message: 'Name is required (min 2 chars).' });

  // If email is omitted in the Excel, auto-generate official student email from enrollment
  if (!email && enrollment) {
    email = `${enrollment.toLowerCase().replace(/[^a-z0-9]/g, '')}@marwadiuniversity.ac.in`;
  }

  if (!email) {
    errors.push({ field: 'email', message: 'Email is required.' });
  } else if (!isValidEmail(email)) {
    errors.push({ field: 'email', message: 'Invalid email format.' });
  }

  const deptId = resolveDept(dept, maps) || maps.defaultDeptId;

  const batchClean = batch.trim();
  const batchId = batchClean ? (maps.batchByName[batchClean.toLowerCase()] || null) : null;

  const semNum = toInt(semester);
  if (semester !== '' && semester !== null && semester !== undefined && (semNum === null || semNum < 1 || semNum > 8)) {
    errors.push({ field: 'semester', message: 'Semester must be 1–8.' });
  }

  // If status is 'inactive' or '0', treat as 0; 'null', '', 'active' etc. treat as 1
  const isActive = (statusRaw === 'inactive' || statusRaw === '0') ? 0 : 1;
  const ayId = ayLabel ? (maps.ayByLabel[ayLabel.toLowerCase().trim()] || null) : maps.defaultAyId;

  return {
    valid: errors.length === 0,
    errors,
    parsed: { enrollment, name, rollNumber, email, deptId, semNum, batchId, batch: batchClean, division, isActive, ayId },
  };
}

function validateFacultyRow(row, rowNum, maps) {
  const errors = [];

  const employeeId  = toStr(row.employee_id || row.emp_id || row.faculty_id || row.id);
  const name        = toStr(row.name || row.faculty_name || row.full_name);
  const email       = toStr(row.email).toLowerCase();
  const dept        = toStr(row.department || row.dept);
  const designation = toStr(row.designation || row.post || '');

  if (!employeeId)              errors.push({ field: 'employee_id', message: 'Employee ID is required.' });
  if (!name || name.length < 2) errors.push({ field: 'name', message: 'Name is required.' });
  if (!email)                   errors.push({ field: 'email', message: 'Email is required.' });
  else if (!isValidEmail(email)) errors.push({ field: 'email', message: 'Invalid email format.' });
  else if (!isFacultyEmail(email)) {
    errors.push({
      field: 'email',
      message: 'Email must end with @marwadieducation.edu.in or @marwadieducation.ed.',
    });
  }

  const deptId = resolveDept(dept, maps);
  if (!dept)        errors.push({ field: 'department', message: 'Department is required.' });
  else if (!deptId) errors.push({ field: 'department', message: `Department "${dept}" not found.` });

  return {
    valid: errors.length === 0,
    errors,
    parsed: { employeeId, name, email, deptId, designation },
  };
}

function validateSubjectRow(row, rowNum, maps) {
  const errors = [];

  const code    = toStr(row.code || row.subject_code).toUpperCase();
  const name    = toStr(row.name || row.subject_name);
  const dept    = toStr(row.department || row.dept);
  const semNum  = toInt(row.semester_number || row.semester || row.sem);
  const credits = toFloat(row.credits);

  if (!code)             errors.push({ field: 'code', message: 'Subject code is required.' });
  if (!name)             errors.push({ field: 'name', message: 'Subject name is required.' });

  const deptId = resolveDept(dept, maps);
  if (!dept)        errors.push({ field: 'department', message: 'Department is required.' });
  else if (!deptId) errors.push({ field: 'department', message: `Department "${dept}" not found.` });

  if (semNum === null || semNum < 1 || semNum > 8) {
    errors.push({ field: 'semester_number', message: 'Semester must be 1–8.' });
  }
  if (credits !== null && (credits < 0 || credits > 10)) {
    errors.push({ field: 'credits', message: 'Credits must be between 0 and 10.' });
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed: { code, name, deptId, semNum, credits: credits ?? 4.0 },
  };
}

function validateBatchRow(row, rowNum, maps) {
  const errors = [];

  const name       = toStr(row.name || row.batch_name);
  const dept       = toStr(row.department || row.dept);
  const ayLabel    = toStr(row.academic_year || row.ay || '');
  const startYear  = toInt(row.start_year || row.from_year);
  const endYear    = toInt(row.end_year || row.to_year);

  if (!name)             errors.push({ field: 'name', message: 'Batch name is required.' });

  const deptId = resolveDept(dept, maps);
  if (!dept)        errors.push({ field: 'department', message: 'Department is required.' });
  else if (!deptId) errors.push({ field: 'department', message: `Department "${dept}" not found.` });

  const ayId = ayLabel ? (maps.ayByLabel[ayLabel.toLowerCase()] || null) : null;
  if (ayLabel && !ayId) errors.push({ field: 'academic_year', message: `Academic year "${ayLabel}" not found.` });

  return {
    valid: errors.length === 0,
    errors,
    parsed: { name, deptId, ayId, startYear, endYear },
  };
}

function validateSyllabusRow(row, rowNum, maps) {
  const errors = [];

  const subjectCode = toStr(row.subject_code || row.code).toUpperCase();
  const unitNumber  = toInt(row.unit_number || row.unit);
  const unitTitle   = toStr(row.unit_title || row.title);
  const topics      = toStr(row.topics || row.content || '');
  const totalHours  = toInt(row.total_hours || row.hours);

  if (!subjectCode)  errors.push({ field: 'subject_code', message: 'Subject code is required.' });
  if (unitNumber === null || unitNumber < 1) {
    errors.push({ field: 'unit_number', message: 'Unit number must be a positive integer.' });
  }
  if (!unitTitle)    errors.push({ field: 'unit_title', message: 'Unit title is required.' });

  return {
    valid: errors.length === 0,
    errors,
    parsed: { subjectCode, unitNumber, unitTitle, topics, totalHours },
  };
}

// ─── Timetable Matrix Parser (replaces row-by-row validator) ─────────────────

const DAYS_VALID   = ['MON','TUE','WED','THU','FRI','SAT'];
const DAY_ALIASES  = { VED:'WED', WEDNESDAY:'WED', TUESDAY:'TUE', MONDAY:'MON',
                       THURSDAY:'THU', FRIDAY:'FRI', SATURDAY:'SAT' };
const TIME_RE      = /(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/;
const SKIP_CELLS   = /^(pbl|free|lunch|break|holiday|nil|-|\s*)$/i;

/**
 * Parse a single timetable cell text.
 * Formats:
 *   "A ICP DG MA112"    → batchGroup=A, subject=ICP, faculty=DG, room=MA112
 *   "B FSSI MS MA115"   → batchGroup=B, subject=FSSI, faculty=MS, room=MA115
 *   "AC BKP MA001"      → batchGroup=ALL, subject=AC, faculty=BKP, room=MA001
 *   "BES AG MA001"      → batchGroup=ALL, subject=BES, faculty=AG, room=MA001
 *   "VA-1 DT MA001"     → batchGroup=ALL, subject=VA-1, faculty=DT, room=MA001
 */
function parseTimetableCell(rawCell) {
  const cell = String(rawCell || '').trim();
  if (!cell || SKIP_CELLS.test(cell)) return null;

  const parts = cell.split(/\s+/).filter(Boolean);
  if (parts.length < 1) return null;

  let batchGroup = 'ALL';
  let idx = 0;

  // Check if the very first token is a single-letter batch indicator
  // It must be exactly 'A' or 'B' AND there are more parts after it
  if ((parts[0] === 'A' || parts[0] === 'B') && parts.length >= 2) {
    batchGroup = parts[0];
    idx = 1;
  }

  const rest = parts.slice(idx);
  return {
    batchGroup,
    subjectCode:    rest[0]  || null,
    facultyInitial: rest[1]  || null,
    room:           rest.slice(2).join(' ') || null,
    rawCell: cell,
  };
}

/**
 * Build a full 2-D grid from the sheet, expanding all merged cells.
 */
function buildMergedGrid(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const grid  = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    grid[r] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      grid[r][c] = cell ? String(cell.v ?? '').trim() : '';
    }
  }

  // Expand merged cells so every cell in a merged range carries the same value
  for (const merge of (sheet['!merges'] || [])) {
    const val = (grid[merge.s.r] || [])[merge.s.c] || '';
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      if (!grid[r]) grid[r] = [];
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        grid[r][c] = val;
      }
    }
  }

  return { grid, maxRow: range.e.r, maxCol: range.e.c };
}

/**
 * Extract header metadata (semester, division, classRoom) from the first rows.
 */
function extractTimetableMeta(grid, maxRow) {
  let semester = null, division = null, classRoom = null;
  for (let r = 0; r < Math.min(10, maxRow + 1); r++) {
    for (const val of (grid[r] || [])) {
      if (!val) continue;
      let m;
      if (!semester)  { m = val.match(/semester[:\-\s]+(\d+)/i);       if (m) semester = parseInt(m[1]); }
      if (!division)  { m = val.match(/division[:\-\s]+([\w\d]+)/i);   if (m) division = m[1]; }
      if (!classRoom) { m = val.match(/class\s*room[:\-\s]+([\w\d]+)/i); if (m) classRoom = m[1]; }
    }
  }
  return { semester, division, classRoom };
}

/**
 * Detect the row that contains day headers (MON/TUE/WED/THU/FRI)
 * and return the column→day mapping and the time column index.
 */
function detectDayHeaderRow(grid, maxRow, maxCol) {
  for (let r = 0; r <= Math.min(15, maxRow); r++) {
    const row = grid[r] || [];
    let dayCount = 0;
    let timeColIdx = -1;

    for (let c = 0; c <= maxCol; c++) {
      const v = (row[c] || '').toUpperCase();
      if (DAYS_VALID.includes(v) || DAY_ALIASES[v]) dayCount++;
      if (v === 'TIME') timeColIdx = c;
    }

    if (dayCount >= 3) {
      // Build col→day map
      const colToDay = {};
      let currentDay = null;
      for (let c = 0; c <= maxCol; c++) {
        const v = (row[c] || '').toUpperCase();
        const resolved = DAYS_VALID.includes(v) ? v : DAY_ALIASES[v];
        if (resolved) currentDay = resolved;
        if (currentDay && c > (timeColIdx >= 0 ? timeColIdx : 0)) {
          colToDay[c] = currentDay;
        }
      }
      return { dayHeaderRowIdx: r, timeColIdx, colToDay };
    }
  }
  return null;
}

/**
 * Parse a matrix-format timetable Excel.
 * Returns an array of flat slot objects ready for DB insertion.
 */
function parseTimetableMatrix(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel file has no sheets.');
  const sheet = workbook.Sheets[sheetName];

  const { grid, maxRow, maxCol } = buildMergedGrid(sheet);
  const meta   = extractTimetableMeta(grid, maxRow);
  const header = detectDayHeaderRow(grid, maxRow, maxCol);

  if (!header) {
    throw new Error(
      'Could not find timetable grid. ' +
      'Ensure the sheet has day headers: MON, TUE, WED, THU, FRI.'
    );
  }

  const { dayHeaderRowIdx, timeColIdx, colToDay } = header;

  // Detect batch sub-header row (immediately after day header row)
  // Look for A / B labels in each day-column
  const batchSubRowIdx = dayHeaderRowIdx + 1;
  const colToBatch = {};
  const batchRow = grid[batchSubRowIdx] || [];

  // Group columns by day, then assign A/B by position within the day
  const dayColGroups = {};
  for (const [col, day] of Object.entries(colToDay)) {
    if (!dayColGroups[day]) dayColGroups[day] = [];
    dayColGroups[day].push(parseInt(col));
  }
  for (const cols of Object.values(dayColGroups)) {
    cols.sort((a, b) => a - b);
    if (cols.length >= 2) {
      // Try explicit A/B labels first
      for (const c of cols) {
        const v = (batchRow[c] || '').toUpperCase();
        if (v === 'A' || v === 'B') colToBatch[c] = v;
      }
      // Fallback: assign positionally
      if (!colToBatch[cols[0]] && !colToBatch[cols[1]]) {
        colToBatch[cols[0]] = 'A';
        colToBatch[cols[1]] = 'B';
      }
    } else {
      colToBatch[cols[0]] = 'ALL';
    }
  }

  // Data rows start after the batch sub-header row
  const dataStartRow = batchSubRowIdx + 1;
  const slots = [];

  for (let r = dataStartRow; r <= maxRow; r++) {
    const row = grid[r] || [];

    // Find the time value for this row (may be in a merged cell spanning multiple rows)
    let timeVal = '';
    if (timeColIdx >= 0) timeVal = row[timeColIdx] || '';
    if (!timeVal) {
      // Search nearby columns for a time pattern
      for (let c = 0; c < Math.min(5, row.length); c++) {
        if (TIME_RE.test(row[c] || '')) { timeVal = row[c]; break; }
      }
    }
    if (!TIME_RE.test(timeVal)) continue; // Skip non-time rows

    const tm = timeVal.match(TIME_RE);
    const startTime = tm ? tm[1].replace('.', ':') : null;
    const endTime   = tm ? tm[2].replace('.', ':') : null;

    // Process each day column
    const seenCells = new Set(); // avoid duplicates from merged cells
    for (let c = 0; c <= maxCol; c++) {
      if (!colToDay[c]) continue;

      const cellRaw = (row[c] || '').trim();
      if (!cellRaw || SKIP_CELLS.test(cellRaw)) continue;

      // Merged cells repeat the same value across columns — deduplicate
      const key = `${colToDay[c]}_${cellRaw}_${startTime}`;
      if (seenCells.has(key)) continue;
      seenCells.add(key);

      const parsed = parseTimetableCell(cellRaw);
      if (!parsed || !parsed.subjectCode) continue;

      // Batch group: from cell content > column header > ALL
      const batchGroup = parsed.batchGroup !== 'ALL'
        ? parsed.batchGroup
        : (colToBatch[c] || 'ALL');

      slots.push({
        day:            colToDay[c].toLowerCase(),
        startTime,
        endTime,
        batchGroup,
        subjectCode:    parsed.subjectCode,
        facultyInitial: parsed.facultyInitial,
        room:           parsed.room,
        semester:       meta.semester,
        division:       meta.division,
        rawCell:        cellRaw,
      });
    }
  }

  if (!slots.length) {
    throw new Error(
      'No timetable slots found. Check that the sheet has the correct format ' +
      '(day headers, time rows, and cell values like "ICP DG MA112").'
    );
  }

  return { slots, meta };
}

/**
 * Insert a single parsed timetable slot (from matrix parser) into the DB.
 */
async function insertTimetableSlot(conn, slot, maps) {
  const { day, startTime, endTime, batchGroup, subjectCode, facultyInitial, room, semester, division } = slot;

  // Resolve subject by code (flexible: try uppercase)
  const code = (subjectCode || '').toUpperCase();
  const [[subj]] = await conn.query(
    'SELECT id FROM subjects WHERE UPPER(code) = ? LIMIT 1', [code]
  );
  // If subject not found, still insert with subject_id=null (warning, not failure)
  const subjectId = subj ? subj.id : null;

  // Resolve faculty by initial (try employee_id match or initial field)
  let facultyId = null;
  if (facultyInitial) {
    const [[fac]] = await conn.query(
      'SELECT id FROM faculty WHERE employee_id = ? LIMIT 1', [facultyInitial]
    );
    facultyId = fac ? fac.id : null;
  }

  // Upsert by (division, batch_group, day, start_time)
  const [[exist]] = await conn.query(
    `SELECT id FROM timetable_slots
     WHERE division=? AND batch_group=? AND day=? AND start_time=? LIMIT 1`,
    [division, batchGroup, day, startTime]
  );

  if (exist) {
    await conn.query(
      `UPDATE timetable_slots SET
         subject_id=?, faculty_id=?, faculty_initial=?, room=?, end_time=?, semester=?
       WHERE id=?`,
      [subjectId, facultyId, facultyInitial, room, endTime, semester, exist.id]
    );
    return 'updated';
  }

  await conn.query(
    `INSERT INTO timetable_slots
       (division, batch_group, day, start_time, end_time,
        subject_id, faculty_id, faculty_initial, room, semester)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [division, batchGroup, day, startTime, endTime,
     subjectId, facultyId, facultyInitial, room, semester]
  );
  return 'success';
}

// ─── Per-type inserters (called inside a transaction) ─────────────────────────

async function insertStudent(conn, parsed, maps) {
  let { enrollment, name, rollNumber, email, deptId, semNum, batchId, batch, division, isActive, ayId } = parsed;

  deptId = deptId || maps.defaultDeptId;
  ayId = ayId || maps.defaultAyId;

  // 1. Resolve or create Batch
  if (!batchId && batch && deptId) {
    // Check exact name match first
    const [existB] = await conn.query(
      'SELECT id FROM batches WHERE LOWER(name) = LOWER(?) AND department_id = ? LIMIT 1',
      [batch, deptId]
    );
    if (existB.length > 0) {
      batchId = existB[0].id;
    } else {
      // Check prefix match (e.g. "2026" matches "2026-30")
      const [prefixB] = await conn.query(
        'SELECT id FROM batches WHERE name LIKE ? AND department_id = ? ORDER BY id ASC LIMIT 1',
        [`${batch}%`, deptId]
      );
      if (prefixB.length > 0) {
        batchId = prefixB[0].id;
      } else {
        const [newB] = await conn.query(
          'INSERT INTO batches (name, department_id, academic_year_id, is_active) VALUES (?, ?, ?, 1)',
          [batch, deptId, ayId || 1]
        );
        batchId = newB.insertId;
      }
    }
    maps.batchByName[batch.toLowerCase()] = batchId;
  }

  // 2. Resolve or create Semester
  let semesterId = null;
  if (semNum) {
    const [existSem] = await conn.query(
      'SELECT id FROM semesters WHERE number = ?' + (ayId ? ' AND academic_year_id = ?' : '') + ' LIMIT 1',
      ayId ? [semNum, ayId] : [semNum]
    );
    if (existSem.length > 0) {
      semesterId = existSem[0].id;
    } else {
      const [newSem] = await conn.query(
        'INSERT INTO semesters (academic_year_id, number, is_active) VALUES (?, ?, 1)',
        [ayId || 1, semNum]
      );
      semesterId = newSem.insertId;
    }
  }

  // 3. Resolve or auto-create Division
  let divisionId = null;
  if (division && batchId && semesterId) {
    const divName = division.trim().toUpperCase();
    const [existDiv] = await conn.query(
      'SELECT id FROM divisions WHERE UPPER(name) = ? AND batch_id = ? AND semester_id = ? LIMIT 1',
      [divName, batchId, semesterId]
    );
    if (existDiv.length > 0) {
      divisionId = existDiv[0].id;
    } else {
      const [newDiv] = await conn.query(
        'INSERT INTO divisions (name, batch_id, semester_id, is_active) VALUES (?, ?, ?, 1)',
        [divName, batchId, semesterId]
      );
      divisionId = newDiv.insertId;
    }
  }

  // 4. Check if student already exists by enrollment number
  const [existEnroll] = await conn.query(
    'SELECT st.id, st.user_id FROM students st WHERE st.enrollment_number = ? LIMIT 1',
    [enrollment]
  );

  if (existEnroll.length > 0) {
    const studentId = existEnroll[0].id;
    const userId = existEnroll[0].user_id;

    if (name) {
      await conn.query('UPDATE users SET name = COALESCE(?, name), is_active = 1 WHERE id = ?', [name, userId]);
    }

    await conn.query(
      `UPDATE students SET
         roll_number = COALESCE(?, roll_number),
         semester = COALESCE(?, semester),
         semester_id = COALESCE(?, semester_id),
         division = COALESCE(?, division),
         division_id = COALESCE(?, division_id),
         batch = COALESCE(?, batch),
         batch_id = COALESCE(?, batch_id),
         is_active = 1
       WHERE id = ?`,
      [rollNumber || null, semNum || null, semesterId || null, division || null, divisionId || null, batch || null, batchId || null, studentId]
    );
    return 'updated';
  }

  // 5. Check if user exists by email
  const [existUser] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  let userId;
  if (existUser.length > 0) {
    userId = existUser[0].id;
    if (name) {
      await conn.query('UPDATE users SET name = COALESCE(?, name), is_active = 1 WHERE id = ?', [name, userId]);
    }
  } else {
    const [newUser] = await conn.query(
      'INSERT INTO users (name, email, role_id, department_id, is_active) VALUES (?, ?, ?, ?, 1)',
      [name, email, maps.studentRoleId, deptId || null]
    );
    userId = newUser.insertId;
  }

  // Check if student record exists for this user_id
  const [existUserStudent] = await conn.query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [userId]);
  if (existUserStudent.length > 0) {
    await conn.query(
      `UPDATE students SET
         enrollment_number = ?,
         roll_number = COALESCE(?, roll_number),
         semester = COALESCE(?, semester),
         semester_id = COALESCE(?, semester_id),
         division = COALESCE(?, division),
         division_id = COALESCE(?, division_id),
         batch = COALESCE(?, batch),
         batch_id = COALESCE(?, batch_id),
         is_active = 1
       WHERE id = ?`,
      [enrollment, rollNumber || null, semNum || null, semesterId || null, division || null, divisionId || null, batch || null, batchId || null, existUserStudent[0].id]
    );
    return 'updated';
  }

  // 6. Insert new student
  await conn.query(
    `INSERT INTO students
       (user_id, enrollment_number, roll_number, semester, semester_id, division, division_id, batch, batch_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, enrollment, rollNumber || null, semNum || null, semesterId || null, division || null, divisionId || null, batch || null, batchId || null, isActive]
  );
  return 'success';
}

async function insertFaculty(conn, parsed, maps) {
  const { employeeId, name, email, deptId, designation } = parsed;

  const [existEmp] = await conn.query(
    'SELECT id FROM faculty WHERE employee_id = ? LIMIT 1', [employeeId]
  );
  if (existEmp.length > 0) return 'duplicate';

  const [existUser] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existUser.length > 0) {
    const userId = existUser[0].id;
    const [existFac] = await conn.query('SELECT id FROM faculty WHERE user_id = ? LIMIT 1', [userId]);
    if (existFac.length > 0) {
      await conn.query(
        'UPDATE faculty SET employee_id=?, designation=? WHERE id=?',
        [employeeId, designation, existFac[0].id]
      );
      return 'updated';
    }
    await conn.query(
      'INSERT INTO faculty (user_id, employee_id, designation) VALUES (?, ?, ?)',
      [userId, employeeId, designation]
    );
    return 'success';
  }

  const [userResult] = await conn.query(
    `INSERT INTO users (name, email, role_id, department_id, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [name, email, maps.facultyRoleId, deptId || null]
  );
  await conn.query(
    'INSERT INTO faculty (user_id, employee_id, designation) VALUES (?, ?, ?)',
    [userResult.insertId, employeeId, designation]
  );
  return 'success';
}

async function insertSubject(conn, parsed) {
  const { code, name, deptId, semNum, credits } = parsed;

  const [[exist]] = await conn.query('SELECT id FROM subjects WHERE code = ? LIMIT 1', [code]);
  if (exist) {
    await conn.query(
      'UPDATE subjects SET name=?, department_id=?, semester_number=?, credits=? WHERE code=?',
      [name, deptId, semNum, credits, code]
    );
    return 'updated';
  }
  await conn.query(
    'INSERT INTO subjects (code, name, department_id, semester_number, credits) VALUES (?, ?, ?, ?, ?)',
    [code, name, deptId, semNum, credits]
  );
  return 'success';
}

async function insertBatch(conn, parsed) {
  const { name, deptId, ayId, startYear, endYear } = parsed;

  const [[exist]] = await conn.query(
    'SELECT id FROM batches WHERE name = ? AND department_id = ? LIMIT 1', [name, deptId]
  );
  if (exist) return 'duplicate';

  await conn.query(
    `INSERT INTO batches (name, department_id, academic_year_id, start_year, end_year)
     VALUES (?, ?, ?, ?, ?)`,
    [name, deptId, ayId, startYear, endYear]
  );
  return 'success';
}

async function insertSyllabusRow(conn, parsed) {
  const { subjectCode, unitNumber, unitTitle, topics, totalHours } = parsed;

  // Resolve subject code → id
  const [[subj]] = await conn.query('SELECT id FROM subjects WHERE code = ? LIMIT 1', [subjectCode]);
  if (!subj) return { outcome: 'failed', error: `Subject code "${subjectCode}" not found in database.` };

  // Check for existing unit
  const [[exist]] = await conn.query(
    'SELECT id FROM syllabus_units WHERE subject_id = ? AND unit_number = ? LIMIT 1',
    [subj.id, unitNumber]
  );
  let unitId;
  if (exist) {
    unitId = exist.id;
    await conn.query(
      'UPDATE syllabus_units SET unit_title=?, topics=?, total_hours=? WHERE id=?',
      [unitTitle, topics, totalHours, unitId]
    );
  } else {
    const [ins] = await conn.query(
      `INSERT INTO syllabus_units (subject_id, unit_number, unit_title, topics, total_hours)
       VALUES (?, ?, ?, ?, ?)`,
      [subj.id, unitNumber, unitTitle, topics, totalHours]
    );
    unitId = ins.insertId;
  }

  if (topics && topics.trim()) {
    const rawTopics = topics.split(/[\r\n,]+/).map(t => t.trim()).filter(Boolean);
    if (rawTopics.length > 0) {
      await conn.query('DELETE FROM syllabus_subtopics WHERE unit_id = ?', [unitId]);
      let idx = 1;
      for (const t of rawTopics) {
        await conn.query(
          'INSERT INTO syllabus_subtopics (unit_id, title, order_index) VALUES (?, ?, ?)',
          [unitId, t, idx++]
        );
      }
    }
  }

  return { outcome: exist ? 'updated' : 'success' };
}

// (insertTimetableRow is now replaced by insertTimetableSlot above — see matrix path)

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Process an uploaded Excel file.
 *
 * @param {Object} options
 * @param {Buffer}  options.buffer       - File buffer from multer
 * @param {string}  options.originalname - Original filename
 * @param {string}  options.importType   - One of: students|faculty|subjects|batches|syllabus|timetable
 * @param {number}  options.importedBy   - user.id from JWT
 * @returns {Object} Import record with full stats
 */
async function processImport({ buffer, originalname, importType, importedBy, departmentId }) {
  const importRecord = await ExcelImportModel.create({
    importType,
    fileName: originalname,
    importedBy,
  });
  const importId = importRecord.id;

  // ── Timetable: dedicated matrix parser ──────────────────────────────────────
  if (importType === 'timetable') {
    return processTimetableImport({ buffer, importId, importedBy });
  }

  // ── All other types: row-by-row processing ──────────────────────────────────
  let rows;
  try {
    rows = parseExcelBuffer(buffer);
  } catch (parseErr) {
    await ExcelImportModel.update(importId, {
      status: 'failed',
      totalRows: 0,
      errorMessage: parseErr.message,
    });
    throw parseErr;
  }

  const conn = await pool.getConnection();
  const rowLogs = [];
  const stats = { total: rows.length, success: 0, updated: 0, duplicate: 0, invalid: 0, failed: 0 };

  try {
    await conn.beginTransaction();
    const maps = await buildLookupMaps(conn);
    if (departmentId) {
      maps.defaultDeptId = departmentId;
    }

    for (let i = 0; i < rows.length; i++) {
      const row    = rows[i];
      const rowNum = i + 2;
      let validation;

      try {
        switch (importType) {
          case 'students': validation = validateStudentRow(row, rowNum, maps); break;
          case 'faculty':  validation = validateFacultyRow(row, rowNum, maps); break;
          case 'subjects': validation = validateSubjectRow(row, rowNum, maps); break;
          case 'batches':  validation = validateBatchRow(row, rowNum, maps);   break;
          case 'syllabus': validation = validateSyllabusRow(row, rowNum, maps); break;
          default:         validation = { valid: false, errors: [{ field: 'type', message: 'Unknown import type.' }], parsed: {} };
        }
      } catch (valErr) {
        stats.failed++;
        rowLogs.push({ rowNumber: rowNum, rowData: row, status: 'failed', errors: [{ field: '_', message: valErr.message }] });
        continue;
      }

      if (!validation.valid) {
        stats.invalid++;
        rowLogs.push({ rowNumber: rowNum, rowData: row, status: 'invalid', errors: validation.errors });
        continue;
      }

      try {
        let outcome;
        switch (importType) {
          case 'students': outcome = await insertStudent(conn, validation.parsed, maps); break;
          case 'faculty':  outcome = await insertFaculty(conn, validation.parsed, maps); break;
          case 'subjects': outcome = await insertSubject(conn, validation.parsed);       break;
          case 'batches':  outcome = await insertBatch(conn, validation.parsed);         break;
          case 'syllabus': {
            const r = await insertSyllabusRow(conn, validation.parsed);
            outcome = r.outcome;
            if (r.error) {
              stats.failed++;
              rowLogs.push({ rowNumber: rowNum, rowData: row, status: 'failed', errors: [{ field: '_', message: r.error }] });
              continue;
            }
            break;
          }
        }
        if (outcome === 'success')        stats.success++;
        else if (outcome === 'updated')   stats.updated++;
        else if (outcome === 'duplicate') stats.duplicate++;
        rowLogs.push({ rowNumber: rowNum, rowData: row, status: outcome === 'duplicate' ? 'duplicate' : 'success', errors: null });
      } catch (insertErr) {
        logger.warn(`Import ${importId} row ${rowNum} insert error: ${insertErr.message}`);
        stats.failed++;
        rowLogs.push({ rowNumber: rowNum, rowData: row, status: 'failed', errors: [{ field: '_', message: insertErr.message }] });
      }
    }

    await conn.commit();
  } catch (txErr) {
    await conn.rollback();
    logger.error(`Import ${importId} transaction failed: ${txErr.message}`);
    await ExcelImportModel.update(importId, { status: 'failed', totalRows: stats.total, errorMessage: txErr.message });
    throw txErr;
  } finally {
    conn.release();
  }

  try { await ExcelImportModel.bulkCreateRows(importId, rowLogs); }
  catch (logErr) { logger.warn(`Could not save row logs for import ${importId}: ${logErr.message}`); }

  const updated = await ExcelImportModel.update(importId, {
    status: 'completed',
    totalRows:     stats.total,
    successRows:   stats.success,
    updatedRows:   stats.updated,
    duplicateRows: stats.duplicate,
    invalidRows:   stats.invalid,
    failedRows:    stats.failed,
  });

  const previewRows = await ExcelImportModel.getPreviewRows(importId, 15);
  return { ...updated, stats, previewRows };
}

/**
 * Dedicated timetable processor — uses the matrix parser.
 */
async function processTimetableImport({ buffer, importId, importedBy }) {
  // Parse the matrix-format Excel
  let parsed;
  try {
    parsed = parseTimetableMatrix(buffer);
  } catch (parseErr) {
    await ExcelImportModel.update(importId, {
      status: 'failed',
      totalRows: 0,
      errorMessage: parseErr.message,
    });
    throw parseErr;
  }

  const { slots, meta } = parsed;
  const conn = await pool.getConnection();
  const rowLogs = [];
  const stats = { total: slots.length, success: 0, updated: 0, duplicate: 0, invalid: 0, failed: 0 };

  // Build lookup maps for subject/faculty resolution
  const maps = await buildLookupMaps(conn);

  try {
    await conn.beginTransaction();

    for (let i = 0; i < slots.length; i++) {
      const slot   = slots[i];
      const rowNum = i + 1;
      try {
        const outcome = await insertTimetableSlot(conn, slot, maps);
        if (outcome === 'success')        stats.success++;
        else if (outcome === 'updated')   stats.updated++;
        else if (outcome === 'duplicate') stats.duplicate++;
        rowLogs.push({
          rowNumber: rowNum,
          rowData:   slot,
          status:    outcome === 'duplicate' ? 'duplicate' : 'success',
          errors:    null,
        });
      } catch (insertErr) {
        logger.warn(`Timetable import ${importId} slot ${rowNum}: ${insertErr.message}`);
        stats.failed++;
        rowLogs.push({
          rowNumber: rowNum,
          rowData:   slot,
          status:    'failed',
          errors:    [{ field: '_', message: insertErr.message }],
        });
      }
    }

    await conn.commit();
  } catch (txErr) {
    await conn.rollback();
    logger.error(`Timetable import ${importId} transaction failed: ${txErr.message}`);
    await ExcelImportModel.update(importId, { status: 'failed', totalRows: stats.total, errorMessage: txErr.message });
    throw txErr;
  } finally {
    conn.release();
  }

  try { await ExcelImportModel.bulkCreateRows(importId, rowLogs); }
  catch (logErr) { logger.warn(`Could not save row logs for import ${importId}: ${logErr.message}`); }

  const updated = await ExcelImportModel.update(importId, {
    status:        'completed',
    totalRows:     stats.total,
    successRows:   stats.success,
    updatedRows:   stats.updated,
    duplicateRows: stats.duplicate,
    invalidRows:   stats.invalid,
    failedRows:    stats.failed,
  });

  const previewRows = await ExcelImportModel.getPreviewRows(importId, 20);
  return { ...updated, stats, meta, previewRows };
}

module.exports = { processImport };
