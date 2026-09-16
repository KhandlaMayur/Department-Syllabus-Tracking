const { pool } = require('../config/db');

/**
 * Shared helper: builds a paginated + searchable + sortable list query.
 * @param {string} table  - table name (trusted, no user input)
 * @param {string[]} searchCols - columns to LIKE-search
 * @param {string[]} allowedSort - whitelisted sortable columns
 * @param {object}  opts  - { page, limit, search, sortBy, sortDir, where, params }
 */
async function paginatedList(table, searchCols, allowedSort, opts = {}) {
  const page    = Math.max(1, parseInt(opts.page)  || 1);
  const limit   = Math.min(100, Math.max(1, parseInt(opts.limit) || 20));
  const offset  = (page - 1) * limit;
  const sortBy  = allowedSort.includes(opts.sortBy) ? opts.sortBy : allowedSort[0];
  const sortDir = opts.sortDir === 'asc' ? 'ASC' : 'DESC';
  const search  = opts.search ? `%${opts.search}%` : null;

  let whereClauses = opts.where ? [opts.where] : [];
  let params       = opts.params ? [...opts.params] : [];

  if (search && searchCols.length) {
    const likeParts = searchCols.map(c => `${c} LIKE ?`).join(' OR ');
    whereClauses.push(`(${likeParts})`);
    searchCols.forEach(() => params.push(search));
  }

  const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${table} ${whereSQL}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT * FROM ${table} ${whereSQL} ORDER BY ${sortBy} ${sortDir} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

module.exports = { paginatedList };
