const DAY_ALIASES = {
  MON: 'Monday',
  MONDAY: 'Monday',
  TUE: 'Tuesday',
  TUESDAY: 'Tuesday',
  WED: 'Wednesday',
  WEDNESDAY: 'Wednesday',
  VED: 'Wednesday',
  THU: 'Thursday',
  THURSDAY: 'Thursday',
  FRI: 'Friday',
  FRIDAY: 'Friday',
  SAT: 'Saturday',
  SATURDAY: 'Saturday',
};

const TIME_REGEX = /(\d{1,2})[:.](\d{2})\s*(?:AM|PM)?\s*(?:[-–]|TO)\s*(\d{1,2})[:.](\d{2})\s*(?:AM|PM)?/i;
const SKIP_PATTERN = /^(pbl|free|lunch|break|holiday|nil|recess|tea\s*break|-|\s*)$/i;

function calculateDuration(start, end) {
  if (!start || !end) return 55;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  let sTotal = sH * 60 + sM;
  let eTotal = eH * 60 + eM;
  if (eTotal < sTotal) eTotal += 12 * 60; // handle 12-hour wrap around
  const diff = eTotal - sTotal;
  return diff > 0 && diff <= 300 ? diff : 55;
}

function normalizeTime(t) {
  if (!t) return '08:00';
  const parts = t.replace('.', ':').split(':');
  const h = parts[0].padStart(2, '0');
  const m = (parts[1] || '00').padStart(2, '0');
  return `${h}:${m}`;
}

class TimetableNormalizer {
  /**
   * Normalizes raw slots (e.g. from Excel or parsed text) into canonical database-ready objects
   */
  static normalizeSlots(rawSlots) {
    const normalized = [];

    for (const slot of rawSlots) {
      if (!slot.subjectCode && !slot.rawCell) continue;

      const dayKey = (slot.day || '').trim().toUpperCase();
      const matchedDay = Object.keys(DAY_ALIASES).find(d => dayKey.includes(d));
      const day = matchedDay ? DAY_ALIASES[matchedDay] : 'Monday';

      const startTime = normalizeTime(slot.startTime);
      const endTime = normalizeTime(slot.endTime);
      const durationMinutes = calculateDuration(startTime, endTime);

      const codeRaw = (slot.subjectCode || '').trim();
      const initial = (slot.facultyInitial || '').trim().toUpperCase();
      const room = (slot.room || '').trim();
      const batch = (slot.batchGroup || 'ALL').trim().toUpperCase();

      // Determine entry type
      let entryType = 'lecture';
      const codeUpper = codeRaw.toUpperCase();
      const rawUpper = (slot.rawCell || '').toUpperCase();
      if (
        rawUpper.includes('LAB') ||
        codeUpper.includes('LAB') ||
        codeUpper.includes('PRACTICAL') ||
        batch === 'A' ||
        batch === 'B' ||
        durationMinutes >= 90
      ) {
        entryType = 'lab';
      } else if (rawUpper.includes('TUT') || codeUpper.includes('TUT')) {
        entryType = 'tutorial';
      }

      normalized.push({
        day,
        startTime,
        endTime,
        durationMinutes,
        subjectCodeRaw: codeRaw,
        subjectNameRaw: slot.subjectName || null,
        facultyInitial: initial || null,
        room: room || null,
        entryType,
        batchGroup: batch === 'A' || batch === 'B' ? batch : 'ALL',
        periodNumber: slot.periodNumber || null,
      });
    }

    return normalized;
  }

  /**
   * Parses arbitrary unstructured text lines (from PDF or OCR) into timetable slots
   */
  static parseFromTextLines(lines) {
    const slots = [];
    let currentDay = null;
    let currentTime = { start: '08:00', end: '08:55' };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || SKIP_PATTERN.test(line)) continue;

      // 1. Check if line contains a day
      const lineUpper = line.toUpperCase();
      const foundDayKey = Object.keys(DAY_ALIASES).find(d => {
        const regex = new RegExp(`\\b${d}\\b`, 'i');
        return regex.test(lineUpper);
      });
      if (foundDayKey) {
        currentDay = DAY_ALIASES[foundDayKey];
      }

      // 2. Check if line contains a time interval
      const timeMatch = line.match(TIME_REGEX);
      if (timeMatch) {
        const start = `${timeMatch[1]}:${timeMatch[2]}`;
        const end = `${timeMatch[3]}:${timeMatch[4]}`;
        currentTime = { start, end };
      }

      // 3. Check for slot entries: e.g. "A ICP DG MA112", "DBMS SK L-2", "01CT0501 Prof. Sharma"
      // Split by whitespace or commas
      const tokens = line.split(/\s+/).filter(t => t.length > 0 && !SKIP_PATTERN.test(t));
      if (tokens.length >= 2 && currentDay) {
        // Test if tokens contain a subject/faculty/room
        let batchGroup = 'ALL';
        let tokenIdx = 0;
        if (tokens[0] === 'A' || tokens[0] === 'B') {
          batchGroup = tokens[0];
          tokenIdx = 1;
        }

        const remaining = tokens.slice(tokenIdx);
        // If the remaining line isn't just day or time
        if (remaining.length >= 2 && !TIME_REGEX.test(line)) {
          const subjectCode = remaining[0];
          const facultyInitial = remaining[1] || '';
          const room = remaining.slice(2).join(' ') || '';

          // Avoid adding header labels as slots
          if (!/^(day|time|period|subject|faculty|room|monday|tuesday|wednesday|thursday|friday|saturday)$/i.test(subjectCode)) {
            slots.push({
              day: currentDay,
              startTime: currentTime.start,
              endTime: currentTime.end,
              batchGroup,
              subjectCode,
              facultyInitial,
              room,
              rawCell: line,
            });
          }
        }
      }
    }

    return this.normalizeSlots(slots);
  }
}

module.exports = TimetableNormalizer;
