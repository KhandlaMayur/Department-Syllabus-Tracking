import '../../styles/admin.css';

/**
 * Sortable data table.
 *
 * columns: [{ key, label, render?, sortable? }]
 * rows:    array of row objects
 * sortBy/sortDir/onSort: controlled sort state
 * loading: show skeleton rows
 * emptyMessage
 * actions: (row) => JSX — renders action buttons in last column
 */
export default function DataTable({
  columns,
  rows = [],
  sortBy,
  sortDir,
  onSort,
  loading = false,
  emptyMessage = 'No records found',
  actions,
}) {
  const handleSort = (col) => {
    if (!col.sortable) return;
    if (sortBy === col.key) {
      onSort(col.key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(col.key, 'asc');
    }
  };

  return (
    <div className="data-table-wrap">
      <table className="data-table" role="table">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={sortBy === col.key ? 'sorted' : ''}
                onClick={() => handleSort(col)}
                style={{ cursor: col.sortable ? 'pointer' : 'default' }}
              >
                {col.label}
                {col.sortable && sortBy === col.key && (
                  <span className="sort-icon">{sortDir === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
            ))}
            {actions && <th style={{ width: 120 }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map(col => (
                    <td key={col.key}>
                      <div style={{
                        height: 16,
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 6,
                        width: `${60 + Math.random() * 30}%`,
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }} />
                    </td>
                  ))}
                  {actions && <td />}
                </tr>
              ))
            : rows.length === 0
            ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)}>
                  <div className="data-table__empty">
                    <div className="data-table__empty-icon">📭</div>
                    <div className="data-table__empty-text">{emptyMessage}</div>
                    <div className="data-table__empty-sub">Try adjusting your search or filters.</div>
                  </div>
                </td>
              </tr>
            )
            : rows.map((row, i) => (
              <tr key={row.id ?? i}>
                {columns.map(col => (
                  <td key={col.key} className={col.muted ? 'muted' : ''}>
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
                {actions && (
                  <td>
                    <div className="data-table__actions">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}
