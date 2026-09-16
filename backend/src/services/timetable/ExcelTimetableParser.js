const XLSX = require('xlsx');

const DAYS_VALID = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_MAP = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  VED: 'Wednesday'
};
const TIME_RE = /(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/;
const SKIP_CELLS = /^(pbl|free|lunch|break|holiday|nil|-|\s*)$/i;

function parseTimetableCell(rawCell) {
  const cell = String(rawCell || '').trim();
  if (!cell || SKIP_CELLS.test(cell)) return null;

  const parts = cell.split(/\s+/).filter(Boolean);
  if (parts.length < 1) return null;

  let batchGroup = 'ALL';
  let idx = 0;

  if ((parts[0] === 'A' || parts[0] === 'B') && parts.length >= 2) {
    batchGroup = parts[0];
    idx = 1;
  }

  const rest = parts.slice(idx);
  return {
    batchGroup,
    subjectCode: rest[0] || null,
    facultyInitial: rest[1] || null,
    room: rest.slice(2).join(' ') || null,
    rawCell: cell,
  };
}

function buildMergedGrid(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const grid = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    grid[r] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      grid[r][c] = cell ? String(cell.v ?? '').trim() : '';
    }
  }

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

function extractTimetableMeta(grid, maxRow) {
  let semester = null, division = null, classRoom = null;
  for (let r = 0; r < Math.min(10, maxRow + 1); r++) {
    for (const val of (grid[r] || [])) {
      if (!val) continue;
      let m;
      if (!semester) { m = val.match(/semester[:\-\s]+(\d+)/i); if (m) semester = parseInt(m[1], 10); }
      if (!division) { m = val.match(/division[:\-\s]+([\w\d]+)/i); if (m) division = m[1]; }
      if (!classRoom) { m = val.match(/class\s*room[:\-\s]+([\w\d]+)/i); if (m) classRoom = m[1]; }
    }
  }
  return { semester, division, classRoom };
}

function detectDayHeaderRow(grid, maxRow, maxCol) {
  for (let r = 0; r <= Math.min(15, maxRow); r++) {
    const row = grid[r] || [];
    let dayCount = 0;
    let timeColIdx = -1;
    const colToDay = {};

    for (let c = 0; c <= maxCol; c++) {
      const val = (row[c] || '').toUpperCase().trim();
      const matched = DAYS_VALID.find(d => val.includes(d));
      if (matched) {
        colToDay[c] = DAY_MAP[matched];
        dayCount++;
      } else if (TIME_RE.test(val) || val.includes('TIME') || val.includes('PERIOD')) {
        timeColIdx = c;
      }
    }

    if (dayCount >= 3) {
      if (timeColIdx === -1) {
        for (let checkR = 0; checkR <= Math.min(15, maxRow); checkR++) {
          const checkRow = grid[checkR] || [];
          for (let c = 0; c <= Math.min(5, maxCol); c++) {
            if (TIME_RE.test(checkRow[c] || '')) {
              timeColIdx = c;
              break;
            }
          }
          if (timeColIdx !== -1) break;
        }
      }
      return { dayHeaderRowIdx: r, timeColIdx, colToDay };
    }
  }
  return null;
}

class ExcelTimetableParser {
  static parse(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('Excel file has no sheets.');
    const sheet = workbook.Sheets[sheetName];

    // Check if it's standard row-based table (has column headers like Day, Start Time, Subject, etc.)
    const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (jsonRows.length > 0) {
      const firstRowKeys = Object.keys(jsonRows[0]).map(k => k.toLowerCase().replace(/[\s\-_]+/g, ''));
      const hasStandardHeaders = firstRowKeys.some(k => k.includes('day')) &&
                                (firstRowKeys.some(k => k.includes('subject')) || firstRowKeys.some(k => k.includes('course')));
      if (hasStandardHeaders) {
        return this.parseStandardTable(jsonRows);
      }
    }

    // Otherwise use Matrix layout
    return this.parseMatrix(sheet);
  }

  static parseStandardTable(jsonRows) {
    const slots = [];
    const meta = { semester: null, division: null };

    for (const r of jsonRows) {
      const row = {};
      for (const [k, v] of Object.entries(r)) {
        row[k.toLowerCase().replace(/[\s\-_]+/g, '')] = String(v || '').trim();
      }

      const dayRaw = row.day || '';
      const matchedDay = Object.keys(DAY_MAP).find(d => dayRaw.toUpperCase().includes(d));
      if (!matchedDay) continue;

      const startTime = row.starttime || row.start || row.time?.split(/[-–]/)[0]?.trim() || '';
      const endTime = row.endtime || row.end || row.time?.split(/[-–]/)[1]?.trim() || '';
      const subjectCode = row.subjectcode || row.subject || row.code || '';
      const facultyInitial = row.faculty || row.facultyinitial || row.teacher || '';
      const room = row.room || row.classroom || '';
      const batchGroup = row.batch || row.batchgroup || 'ALL';

      if (!subjectCode) continue;

      slots.push({
        day: DAY_MAP[matchedDay],
        startTime: startTime.replace('.', ':'),
        endTime: endTime.replace('.', ':'),
        batchGroup,
        subjectCode,
        facultyInitial,
        room,
        rawCell: `${subjectCode} ${facultyInitial} ${room}`.trim()
      });
    }

    return { slots, meta };
  }

  static parseMatrix(sheet) {
    const { grid, maxRow, maxCol } = buildMergedGrid(sheet);
    const meta = extractTimetableMeta(grid, maxRow);
    const header = detectDayHeaderRow(grid, maxRow, maxCol);

    if (!header) {
      throw new Error(
        'Could not detect timetable layout. Ensure the sheet has Day columns (Monday/Tuesday or MON/TUE) or standard tabular columns.'
      );
    }

    const { dayHeaderRowIdx, timeColIdx, colToDay } = header;
    const batchSubRowIdx = dayHeaderRowIdx + 1;
    const colToBatch = {};
    const batchRow = grid[batchSubRowIdx] || [];

    const dayColGroups = {};
    for (const [col, day] of Object.entries(colToDay)) {
      if (!dayColGroups[day]) dayColGroups[day] = [];
      dayColGroups[day].push(parseInt(col, 10));
    }

    for (const cols of Object.values(dayColGroups)) {
      cols.sort((a, b) => a - b);
      if (cols.length >= 2) {
        for (const c of cols) {
          const v = (batchRow[c] || '').toUpperCase();
          if (v === 'A' || v === 'B') colToBatch[c] = v;
        }
        if (!colToBatch[cols[0]] && !colToBatch[cols[1]]) {
          colToBatch[cols[0]] = 'A';
          colToBatch[cols[1]] = 'B';
        }
      } else {
        colToBatch[cols[0]] = 'ALL';
      }
    }

    const dataStartRow = batchSubRowIdx + 1;
    const slots = [];

    for (let r = dataStartRow; r <= maxRow; r++) {
      const row = grid[r] || [];
      let timeVal = '';
      if (timeColIdx >= 0) timeVal = row[timeColIdx] || '';
      if (!timeVal) {
        for (let c = 0; c < Math.min(5, row.length); c++) {
          if (TIME_RE.test(row[c] || '')) { timeVal = row[c]; break; }
        }
      }
      if (!TIME_RE.test(timeVal)) continue;

      const tm = timeVal.match(TIME_RE);
      const startTime = tm ? tm[1].replace('.', ':') : null;
      const endTime = tm ? tm[2].replace('.', ':') : null;

      const seenCells = new Set();
      for (let c = 0; c <= maxCol; c++) {
        if (!colToDay[c]) continue;

        const cellRaw = (row[c] || '').trim();
        if (!cellRaw || SKIP_CELLS.test(cellRaw)) continue;

        const key = `${colToDay[c]}_${cellRaw}_${startTime}`;
        if (seenCells.has(key)) continue;
        seenCells.add(key);

        const parsed = parseTimetableCell(cellRaw);
        if (!parsed || !parsed.subjectCode) continue;

        const batchGroup = parsed.batchGroup !== 'ALL'
          ? parsed.batchGroup
          : (colToBatch[c] || 'ALL');

        slots.push({
          day: colToDay[c],
          startTime,
          endTime,
          batchGroup,
          subjectCode: parsed.subjectCode,
          facultyInitial: parsed.facultyInitial,
          room: parsed.room,
          semester: meta.semester,
          division: meta.division,
          rawCell: cellRaw,
        });
      }
    }

    if (!slots.length) {
      throw new Error('No valid timetable slots found in sheet.');
    }

    return { slots, meta };
  }
}

module.exports = ExcelTimetableParser;
