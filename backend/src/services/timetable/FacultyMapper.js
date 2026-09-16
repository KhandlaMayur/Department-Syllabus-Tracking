const { pool } = require('../../config/db');

class FacultyMapper {
  static async buildCache(departmentId = null) {
    // 1. Fetch from faculty_initials table
    let fiSql = 'SELECT initials, faculty_id, faculty_name, department_id FROM faculty_initials';
    const fiParams = [];
    if (departmentId) {
      fiSql += ' WHERE (department_id = ? OR department_id IS NULL)';
      fiParams.push(departmentId);
    }
    const [fiRows] = await pool.query(fiSql, fiParams);

    // 2. Fetch all faculty with user names & employee IDs
    let fSql = `
      SELECT f.id AS faculty_id, f.employee_id, f.faculty_initial, u.name, u.email, u.department_id
      FROM faculty f
      JOIN users u ON u.id = f.user_id
      WHERE f.is_active = 1
    `;
    const fParams = [];
    if (departmentId) {
      fSql += ' AND (u.department_id = ? OR u.department_id IS NULL)';
      fParams.push(departmentId);
    }
    const [fRows] = await pool.query(fSql, fParams);

    const byInitials = new Map();
    const byEmpId = new Map();
    const byName = new Map();

    // Fill from initials table
    for (const fi of fiRows) {
      if (fi.initials) {
        byInitials.set(fi.initials.toUpperCase().trim(), {
          facultyId: fi.faculty_id,
          name: fi.faculty_name,
        });
      }
    }

    // Fill from faculty records
    for (const f of fRows) {
      if (f.faculty_initial) {
        byInitials.set(f.faculty_initial.toUpperCase().trim(), {
          facultyId: f.faculty_id,
          name: f.name,
        });
      }
      if (f.employee_id) {
        byEmpId.set(f.employee_id.toUpperCase().trim(), {
          facultyId: f.faculty_id,
          name: f.name,
        });
      }
      if (f.name) {
        byName.set(f.name.toUpperCase().trim(), {
          facultyId: f.faculty_id,
          name: f.name,
        });
      }
    }

    return { byInitials, byEmpId, byName, allFaculty: fRows };
  }

  static matchFaculty(rawInitial, cache) {
    if (!rawInitial) return null;

    const clean = rawInitial.toUpperCase().trim();
    const cleanWithoutTitle = clean.replace(/^(DR\.|PROF\.|ER\.|MR\.|MRS\.|MS\.|DR\s+|PROF\s+)\s*/i, '').trim();

    // 1. Check initials
    if (cache.byInitials.has(clean)) {
      return cache.byInitials.get(clean);
    }
    if (cache.byInitials.has(cleanWithoutTitle)) {
      return cache.byInitials.get(cleanWithoutTitle);
    }

    // 2. Check employee ID
    if (cache.byEmpId.has(clean)) {
      return cache.byEmpId.get(clean);
    }

    // 3. Check name
    if (cache.byName.has(clean)) {
      return cache.byName.get(clean);
    }
    if (cache.byName.has(cleanWithoutTitle)) {
      return cache.byName.get(cleanWithoutTitle);
    }

    // 4. Try matching initials generated from names (e.g. "Bimal Patel" -> "BP")
    for (const f of cache.allFaculty) {
      const parts = (f.name || '').trim().split(/\s+/);
      const generatedInitial = parts.map(p => p[0]).join('').toUpperCase();
      if (generatedInitial === clean || generatedInitial === cleanWithoutTitle) {
        return {
          facultyId: f.faculty_id,
          name: f.name,
        };
      }
    }

    // 5. Check if any faculty name contains or matches cleanWithoutTitle
    if (cleanWithoutTitle.length >= 3) {
      for (const f of cache.allFaculty) {
        const fName = (f.name || '').toUpperCase().trim();
        if (fName === cleanWithoutTitle || fName.includes(cleanWithoutTitle) || cleanWithoutTitle.includes(fName)) {
          return {
            facultyId: f.faculty_id,
            name: f.name,
          };
        }
      }
    }

    return null;
  }
}

module.exports = FacultyMapper;
