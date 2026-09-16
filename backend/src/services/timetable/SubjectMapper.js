const { pool } = require('../../config/db');

class SubjectMapper {
  /**
   * Builds an in-memory lookup cache from database subjects
   */
  static async buildCache(departmentId = null) {
    let sql = 'SELECT id, code, name, semester_number, credits, department_id FROM subjects WHERE is_active = 1';
    const params = [];
    if (departmentId) {
      sql += ' AND (department_id = ? OR department_id IS NULL)';
      params.push(departmentId);
    }
    const [rows] = await pool.query(sql, params);

    const byCode = new Map();
    const byName = new Map();

    for (const s of rows) {
      if (s.code) byCode.set(s.code.toUpperCase().trim(), s);
      if (s.name) byName.set(s.name.toUpperCase().trim(), s);
    }

    return { byCode, byName, allSubjects: rows };
  }

  /**
   * Matches a raw subject code or name against database subjects
   */
  static matchSubject(rawCode, rawName, cache) {
    if (!rawCode && !rawName) return null;

    const cleanCode = (rawCode || '').toUpperCase().trim();
    const cleanName = (rawName || '').toUpperCase().trim();

    // 1. Direct code match
    if (cleanCode && cache.byCode.has(cleanCode)) {
      return cache.byCode.get(cleanCode);
    }

    // 2. Direct name match
    if (cleanName && cache.byName.has(cleanName)) {
      return cache.byName.get(cleanName);
    }

    // 3. Substring / alias search
    for (const s of cache.allSubjects) {
      const sCode = s.code.toUpperCase();
      const sName = s.name.toUpperCase();
      if (cleanCode && (sCode.includes(cleanCode) || cleanCode.includes(sCode))) {
        return s;
      }
      if (cleanName && (sName.includes(cleanName) || cleanName.includes(sName))) {
        return s;
      }
    }

    return null;
  }
}

module.exports = SubjectMapper;
