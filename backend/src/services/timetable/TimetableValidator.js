const { pool } = require('../../config/db');

class TimetableValidator {
  /**
   * Checks internal slot conflicts within the parsed file
   */
  static checkInternalConflicts(entries) {
    const conflicts = [];
    const roomMap = new Map(); // key: day_time_room -> entry
    const facultyMap = new Map(); // key: day_time_faculty -> entry
    const divisionSlotMap = new Map(); // key: day_time_batch -> entry

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const slotTimeKey = `${e.day}_${e.startTime}_${e.endTime}`;

      // 1. Room collision
      if (e.room) {
        const roomKey = `${slotTimeKey}_${e.room.toUpperCase()}`;
        if (roomMap.has(roomKey)) {
          const prev = roomMap.get(roomKey);
          conflicts.push({
            type: 'room_conflict',
            severity: 'warning',
            message: `Room "${e.room}" is double-booked on ${e.day} at ${e.startTime}-${e.endTime} between ${prev.subjectCodeRaw || 'slot'} and ${e.subjectCodeRaw || 'slot'}.`,
            slotA: prev,
            slotB: e,
          });
        } else {
          roomMap.set(roomKey, e);
        }
      }

      // 2. Faculty collision
      if (e.facultyId || e.facultyInitial) {
        const facId = e.facultyId ? `ID_${e.facultyId}` : `INIT_${e.facultyInitial}`;
        const facKey = `${slotTimeKey}_${facId}`;
        if (facultyMap.has(facKey)) {
          const prev = facultyMap.get(facKey);
          conflicts.push({
            type: 'faculty_conflict',
            severity: 'warning',
            message: `Faculty "${e.facultyInitial || e.facultyId}" has multiple sessions scheduled simultaneously on ${e.day} at ${e.startTime}-${e.endTime}.`,
            slotA: prev,
            slotB: e,
          });
        } else {
          facultyMap.set(facKey, e);
        }
      }

      // 3. Batch group slot collision
      const batchKey = `${slotTimeKey}_${e.batchGroup || 'ALL'}`;
      if (divisionSlotMap.has(batchKey)) {
        const prev = divisionSlotMap.get(batchKey);
        conflicts.push({
          type: 'slot_overlap',
          severity: 'error',
          message: `Overlapping slot for Batch ${e.batchGroup || 'ALL'} on ${e.day} at ${e.startTime}-${e.endTime}.`,
          slotA: prev,
          slotB: e,
        });
      } else {
        divisionSlotMap.set(batchKey, e);
      }
    }

    return conflicts;
  }

  /**
   * Checks database collisions against other active timetables
   */
  static async checkDatabaseCollisions(entries, currentTimetableId = null) {
    const collisions = [];

    let sql = `
      SELECT te.*, t.id AS timetable_id, t.file_name, sem.number AS semester_number, d.name AS division_name
      FROM timetable_entries te
      JOIN timetables t ON t.id = te.timetable_id
      JOIN semesters sem ON sem.id = t.semester_id
      LEFT JOIN divisions d ON d.id = t.division_id
      WHERE t.status = 'active'
    `;
    const params = [];
    if (currentTimetableId) {
      sql += ' AND t.id != ?';
      params.push(currentTimetableId);
    }

    const [activeSlots] = await pool.query(sql, params);
    if (!activeSlots.length) return collisions;

    for (const e of entries) {
      for (const a of activeSlots) {
        if (e.day === a.day && e.startTime === a.start_time) {
          // Check room clash
          if (e.room && a.room && e.room.toUpperCase() === a.room.toUpperCase()) {
            collisions.push({
              type: 'external_room_conflict',
              severity: 'warning',
              message: `Room "${e.room}" is already allocated to Sem ${a.semester_number} Div ${a.division_name || ''} on ${e.day} at ${e.startTime}.`,
              slot: e,
              collidingWith: a,
            });
          }
          // Check faculty clash
          if (e.facultyId && a.faculty_id && e.facultyId === a.faculty_id) {
            collisions.push({
              type: 'external_faculty_conflict',
              severity: 'warning',
              message: `Faculty is already teaching Sem ${a.semester_number} Div ${a.division_name || ''} on ${e.day} at ${e.startTime}.`,
              slot: e,
              collidingWith: a,
            });
          }
        }
      }
    }

    return collisions;
  }
}

module.exports = TimetableValidator;
