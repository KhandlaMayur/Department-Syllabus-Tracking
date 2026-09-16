const { pool } = require('../config/db');

/**
 * Data-access layer for excel_imports and excel_import_rows tables.
 */
const ExcelImportModel = {
  /** Create a new import record (status = 'processing') */
  async create({ importType, fileName, importedBy }) {
    const [result] = await pool.query(
      `INSERT INTO excel_imports (import_type, file_name, status, imported_by)
       VALUES (?, ?, 'processing', ?)`,
      [importType, fileName, importedBy]
    );
    return this.findById(result.insertId);
  },

  /** Update counts and status after processing */
  async update(id, { status, totalRows, successRows, updatedRows, duplicateRows, invalidRows, failedRows, errorMessage }) {
    await pool.query(
      `UPDATE excel_imports SET
         status=?, total_rows=?, success_rows=?, updated_rows=?,
         duplicate_rows=?, invalid_rows=?, failed_rows=?, error_message=?
       WHERE id=?`,
      [
        status || 'completed',
        totalRows || 0,
        successRows || 0,
        updatedRows || 0,
        duplicateRows || 0,
        invalidRows || 0,
        failedRows || 0,
        errorMessage || null,
        id,
      ]
    );
    return this.findById(id);
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT ei.*, u.name AS imported_by_name, u.email AS imported_by_email
       FROM excel_imports ei
       JOIN users u ON u.id = ei.imported_by
       WHERE ei.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /** Paginated import history */
  async list(opts = {}) {
    const page   = Math.max(1, parseInt(opts.page) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(opts.limit) || 20));
    const offset = (page - 1) * limit;
    const type   = opts.importType || null;

    const where  = [];
    const params = [];
    if (type) { where.push('ei.import_type = ?'); params.push(type); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM excel_imports ei ${whereSQL}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT ei.*, u.name AS imported_by_name
       FROM excel_imports ei
       JOIN users u ON u.id = ei.imported_by
       ${whereSQL}
       ORDER BY ei.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /** Log a single row result (success/duplicate/invalid/failed) */
  async createRow(importId, { rowNumber, rowData, status, errors }) {
    await pool.query(
      `INSERT INTO excel_import_rows (import_id, row_number, row_data, status, errors)
       VALUES (?, ?, ?, ?, ?)`,
      [importId, rowNumber, JSON.stringify(rowData), status, errors ? JSON.stringify(errors) : null]
    );
  },

  /** Batch-insert many row logs efficiently */
  async bulkCreateRows(importId, rowLogs) {
    if (!rowLogs.length) return;
    const values = rowLogs.map(r => [
      importId,
      r.rowNumber,
      JSON.stringify(r.rowData),
      r.status,
      r.errors ? JSON.stringify(r.errors) : null,
    ]);
    await pool.query(
      `INSERT INTO excel_import_rows (import_id, row_number, row_data, status, errors) VALUES ?`,
      [values]
    );
  },

  /** Get all rows for download (non-success rows only by default) */
  async getFailedRows(importId, statuses = ['invalid', 'failed', 'duplicate']) {
    const placeholders = statuses.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT row_number, row_data, status, errors
       FROM excel_import_rows
       WHERE import_id = ? AND status IN (${placeholders})
       ORDER BY row_number ASC`,
      [importId, ...statuses]
    );
    return rows;
  },

  /** Preview rows — first N rows of any status */
  async getPreviewRows(importId, limit = 20) {
    const [rows] = await pool.query(
      `SELECT row_number, row_data, status, errors
       FROM excel_import_rows
       WHERE import_id = ?
       ORDER BY row_number ASC
       LIMIT ?`,
      [importId, limit]
    );
    return rows;
  },
};

module.exports = ExcelImportModel;
