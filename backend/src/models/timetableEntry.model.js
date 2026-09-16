const { pool } = require('../config/db');

const TimetableEntryModel = {
  async bulkCreate(entries, conn = pool) {
    if (!entries || entries.length === 0) return 0;

    const values = entries.map(e => [
      e.timetableId,
      e.day,
      e.startTime,
      e.endTime,
      e.durationMinutes || 55,
      e.subjectId || null,
      e.subjectCodeRaw || null,
      e.subjectNameRaw || null,
      e.facultyId || null,
      e.facultyInitial || null,
      e.room || null,
      e.entryType || 'lecture',
      e.periodNumber || null,
      e.batchGroup || null
    ]);

    const sql = `
      INSERT INTO timetable_entries (
        timetable_id, day, start_time, end_time, duration_minutes,
        subject_id, subject_code_raw, subject_name_raw, faculty_id,
        faculty_initial, room, entry_type, period_number, batch_group
      ) VALUES ?
    `;

    const [result] = await conn.query(sql, [values]);
    return result.affectedRows;
  },

  async getByTimetableId(timetableId) {
    const sql = `
      SELECT te.*,
             COALESCE(s.code, te.subject_code_raw) AS subject_code,
             COALESCE(s.name, te.subject_name_raw) AS subject_name,
             u.name AS faculty_name,
             u.email AS faculty_email,
             f.employee_id AS faculty_employee_id
      FROM timetable_entries te
      LEFT JOIN subjects s ON s.id = te.subject_id
      LEFT JOIN faculty f ON f.id = te.faculty_id
      LEFT JOIN users u ON u.id = f.user_id
      WHERE te.timetable_id = ?
      ORDER BY 
        FIELD(te.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
        te.start_time ASC,
        te.batch_group ASC
    `;
    const [rows] = await pool.query(sql, [timetableId]);
    return rows;
  },

  async getActiveByScope({ academicYearId, semesterId, divisionId, divisionIds, batchIds }) {
    let sql = `
      SELECT te.*,
             t.id AS timetable_id,
             t.version,
             COALESCE(s.code, te.subject_code_raw) AS subject_code,
             COALESCE(s.name, te.subject_name_raw) AS subject_name,
             u.name AS faculty_name,
             u.email AS faculty_email,
             d.name AS division_name,
             d.batch_id,
             sem.number AS semester_number
      FROM timetable_entries te
      JOIN timetables t ON t.id = te.timetable_id
      JOIN semesters sem ON sem.id = t.semester_id
      LEFT JOIN divisions d ON d.id = t.division_id
      LEFT JOIN subjects s ON s.id = te.subject_id
      LEFT JOIN faculty f ON f.id = te.faculty_id
      LEFT JOIN users u ON u.id = f.user_id
      WHERE t.status = 'active'
    `;
    const params = [];

    if (academicYearId) {
      sql += ` AND t.academic_year_id = ?`;
      params.push(academicYearId);
    }
    if (semesterId) {
      sql += ` AND t.semester_id = ?`;
      params.push(semesterId);
    }
    if (divisionId) {
      sql += ` AND t.division_id = ?`;
      params.push(divisionId);
    } else if (divisionIds && divisionIds.length > 0) {
      sql += ` AND t.division_id IN (?)`;
      params.push(divisionIds);
    }
    if (batchIds && batchIds.length > 0) {
      sql += ` AND (d.batch_id IN (?) OR t.division_id IN (SELECT id FROM divisions WHERE batch_id IN (?)))`;
      params.push(batchIds, batchIds);
    }

    sql += `
      ORDER BY 
        FIELD(te.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
        te.start_time ASC
    `;

    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async getByFacultyId(facultyId, { academicYearId, semesterId } = {}) {
    let sql = `
      SELECT te.*,
             t.id AS timetable_id,
             t.version,
             sem.number AS semester_number,
             d.name AS division_name,
             COALESCE(s.code, te.subject_code_raw) AS subject_code,
             COALESCE(s.name, te.subject_name_raw) AS subject_name,
             u.name AS faculty_name,
             u.email AS faculty_email
      FROM timetable_entries te
      JOIN timetables t ON t.id = te.timetable_id
      JOIN semesters sem ON sem.id = t.semester_id
      LEFT JOIN divisions d ON d.id = t.division_id
      LEFT JOIN subjects s ON s.id = te.subject_id
      LEFT JOIN faculty f ON f.id = te.faculty_id
      LEFT JOIN users u ON u.id = f.user_id
      WHERE (
        te.faculty_id = ?
        OR (
          te.faculty_id IS NULL AND (
            te.faculty_initial IN (SELECT initials FROM faculty_initials WHERE faculty_id = ?)
            OR LOWER(TRIM(te.faculty_initial)) = LOWER((SELECT TRIM(u2.name) FROM faculty f2 JOIN users u2 ON u2.id = f2.user_id WHERE f2.id = ?))
            OR LOWER(TRIM(te.faculty_initial)) = LOWER((SELECT CONCAT('dr. ', TRIM(u2.name)) FROM faculty f2 JOIN users u2 ON u2.id = f2.user_id WHERE f2.id = ?))
            OR LOWER(TRIM(te.faculty_initial)) = LOWER((SELECT CONCAT('prof. ', TRIM(u2.name)) FROM faculty f2 JOIN users u2 ON u2.id = f2.user_id WHERE f2.id = ?))
            OR te.subject_id IN (
              SELECT sa.subject_id FROM subject_assignments sa
              WHERE sa.faculty_id = ? AND (sa.division_id = t.division_id OR t.division_id IS NULL)
            )
          )
        )
      ) AND t.status = 'active'
    `;
    const params = [facultyId, facultyId, facultyId, facultyId, facultyId, facultyId];

    if (academicYearId) {
      sql += ` AND t.academic_year_id = ?`;
      params.push(academicYearId);
    }
    if (semesterId) {
      sql += ` AND t.semester_id = ?`;
      params.push(semesterId);
    }

    sql += `
      ORDER BY 
        FIELD(te.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
        te.start_time ASC
    `;

    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async getByStudentScope({ semesterId, divisionId, batchGroup = null }) {
    let sql = `
      SELECT te.*,
             s.code AS subject_code,
             s.name AS subject_name,
             u.name AS faculty_name,
             u.email AS faculty_email,
             d.name AS division_name,
             t.id AS timetable_id,
             t.version,
             t.file_name,
             sem.number AS semester_number
      FROM timetable_entries te
      JOIN timetables t ON t.id = te.timetable_id
      JOIN semesters sem ON sem.id = t.semester_id
      LEFT JOIN divisions d ON d.id = t.division_id
      LEFT JOIN subjects s ON s.id = te.subject_id
      LEFT JOIN faculty f ON f.id = te.faculty_id
      LEFT JOIN users u ON u.id = f.user_id
      WHERE t.status = 'active' AND t.semester_id = ?
    `;
    const params = [semesterId];

    if (divisionId) {
      // Check if there is an active timetable specifically for this division
      const [divTimetables] = await pool.query(
        'SELECT id FROM timetables WHERE status = "active" AND semester_id = ? AND division_id = ? LIMIT 1',
        [semesterId, divisionId]
      );
      if (divTimetables.length > 0) {
        sql += ` AND t.division_id = ?`;
        params.push(divisionId);
      } else {
        // Fall back to department-wide timetable only if no division-specific timetable exists
        sql += ` AND t.division_id IS NULL`;
      }
    } else {
      sql += ` AND t.division_id IS NULL`;
    }

    if (batchGroup) {
      sql += ` AND (te.batch_group = ? OR te.batch_group IS NULL OR te.batch_group = 'ALL')`;
      params.push(batchGroup);
    }

    sql += `
      ORDER BY 
        FIELD(te.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
        te.start_time ASC
    `;

    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async getWeeklyAnalysis(timetableId) {
    // Subject wise
    const [subjectStats] = await pool.query(
      `SELECT 
         COALESCE(s.name, te.subject_name_raw, 'Unknown') AS subject_name,
         COALESCE(s.code, te.subject_code_raw, 'N/A') AS subject_code,
         te.subject_id,
         COUNT(te.id) AS total_lectures,
         SUM(te.duration_minutes) AS total_minutes,
         ROUND(SUM(te.duration_minutes) / 60, 2) AS total_hours,
         SUM(CASE WHEN te.entry_type = 'lecture' THEN 1 ELSE 0 END) AS lecture_count,
         SUM(CASE WHEN te.entry_type = 'lab' THEN 1 ELSE 0 END) AS lab_count
       FROM timetable_entries te
       LEFT JOIN subjects s ON s.id = te.subject_id
       WHERE te.timetable_id = ?
       GROUP BY COALESCE(s.id, te.subject_code_raw, te.subject_name_raw)
       ORDER BY total_lectures DESC`,
      [timetableId]
    );

    // Faculty wise
    const [facultyStats] = await pool.query(
      `SELECT 
         COALESCE(u.name, te.faculty_initial, 'Unassigned') AS faculty_name,
         te.faculty_initial,
         te.faculty_id,
         COUNT(te.id) AS total_lectures,
         SUM(te.duration_minutes) AS total_minutes,
         ROUND(SUM(te.duration_minutes) / 60, 2) AS total_hours
       FROM timetable_entries te
       LEFT JOIN faculty f ON f.id = te.faculty_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE te.timetable_id = ?
       GROUP BY COALESCE(te.faculty_id, te.faculty_initial)
       ORDER BY total_lectures DESC`,
      [timetableId]
    );

    // Day wise
    const [dayStats] = await pool.query(
      `SELECT 
         day,
         COUNT(id) AS slot_count,
         SUM(duration_minutes) AS total_minutes
       FROM timetable_entries
       WHERE timetable_id = ?
       GROUP BY day
       ORDER BY FIELD(day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')`,
      [timetableId]
    );

    return {
      subjectStats,
      facultyStats,
      dayStats
    };
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT te.*,
              s.code AS subject_code,
              s.name AS subject_name,
              u.name AS faculty_name,
              f.employee_id AS faculty_employee_id
       FROM timetable_entries te
       LEFT JOIN subjects s ON s.id = te.subject_id
       LEFT JOIN faculty f ON f.id = te.faculty_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE te.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async createSingle({ timetableId, day, startTime, endTime, subjectId, subjectCodeRaw, subjectNameRaw, facultyId, facultyInitial, room, entryType, batchGroup }) {
    const sTime = normalizeTime(startTime);
    const eTime = normalizeTime(endTime);
    const durationMinutes = calculateDuration(sTime, eTime);

    const [result] = await pool.query(
      `INSERT INTO timetable_entries (
        timetable_id, day, start_time, end_time, duration_minutes,
        subject_id, subject_code_raw, subject_name_raw, faculty_id,
        faculty_initial, room, entry_type, batch_group
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        timetableId,
        day,
        sTime,
        eTime,
        durationMinutes,
        subjectId || null,
        subjectCodeRaw || null,
        subjectNameRaw || null,
        facultyId || null,
        facultyInitial || null,
        room || null,
        entryType || 'lecture',
        batchGroup || 'ALL',
      ]
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const fields = [];
    const params = [];

    if (data.day !== undefined) { fields.push('day = ?'); params.push(data.day); }
    if (data.startTime !== undefined) {
      const sTime = normalizeTime(data.startTime);
      fields.push('start_time = ?'); params.push(sTime);
    }
    if (data.endTime !== undefined) {
      const eTime = normalizeTime(data.endTime);
      fields.push('end_time = ?'); params.push(eTime);
    }
    if (data.startTime && data.endTime) {
      const sTime = normalizeTime(data.startTime);
      const eTime = normalizeTime(data.endTime);
      fields.push('duration_minutes = ?'); params.push(calculateDuration(sTime, eTime));
    }
    if (data.subjectId !== undefined || data.subject_id !== undefined) {
      fields.push('subject_id = ?');
      params.push((data.subjectId !== undefined ? data.subjectId : data.subject_id) || null);
    }
    if (data.subjectCodeRaw !== undefined || data.subject_code_raw !== undefined) {
      fields.push('subject_code_raw = ?');
      params.push((data.subjectCodeRaw !== undefined ? data.subjectCodeRaw : data.subject_code_raw) || null);
    }
    if (data.subjectNameRaw !== undefined || data.subject_name_raw !== undefined) {
      fields.push('subject_name_raw = ?');
      params.push((data.subjectNameRaw !== undefined ? data.subjectNameRaw : data.subject_name_raw) || null);
    }
    if (data.facultyId !== undefined || data.faculty_id !== undefined) {
      fields.push('faculty_id = ?');
      params.push((data.facultyId !== undefined ? data.facultyId : data.faculty_id) || null);
    }
    if (data.facultyInitial !== undefined || data.faculty_initial !== undefined) {
      fields.push('faculty_initial = ?');
      params.push((data.facultyInitial !== undefined ? data.facultyInitial : data.faculty_initial) || null);
    }
    if (data.room !== undefined) { fields.push('room = ?'); params.push(data.room || null); }
    if (data.entryType !== undefined || data.entry_type !== undefined) {
      fields.push('entry_type = ?');
      params.push((data.entryType !== undefined ? data.entryType : data.entry_type) || 'lecture');
    }
    if (data.batchGroup !== undefined || data.batch_group !== undefined) {
      fields.push('batch_group = ?');
      params.push((data.batchGroup !== undefined ? data.batchGroup : data.batch_group) || 'ALL');
    }

    if (!fields.length) return false;
    params.push(id);
    await pool.query(`UPDATE timetable_entries SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query('DELETE FROM timetable_entries WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
};

function normalizeTime(t) {
  if (!t) return '08:00';
  let clean = String(t).trim().toUpperCase();
  const ampm = clean.includes('PM') ? 'PM' : clean.includes('AM') ? 'AM' : null;
  clean = clean.replace(/(AM|PM)/gi, '').trim().replace('.', ':');
  const parts = clean.split(':');
  let h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1] || '00', 10) || 0;
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function calculateDuration(start, end) {
  if (!start || !end) return 55;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  let sTotal = sH * 60 + sM;
  let eTotal = eH * 60 + eM;
  if (eTotal < sTotal) eTotal += 12 * 60;
  const diff = eTotal - sTotal;
  return diff > 0 && diff <= 360 ? diff : 55;
}

module.exports = TimetableEntryModel;
