import '../../styles/admin.css';

/** Pagination controls — controlled component */
export default function Pagination({ page, totalPages, total, limit, onPageChange }) {
  if (!total) return null;
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  const pages = [];
  const range = 2;
  for (let p = Math.max(1, page - range); p <= Math.min(totalPages, page + range); p++) {
    pages.push(p);
  }

  return (
    <div className="pagination">
      <span className="pagination__info">
        Showing <strong>{from}–{to}</strong> of <strong>{total}</strong>
      </span>
      <div className="pagination__controls">
        <button
          className="pagination__btn"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          title="First page"
        >«</button>
        <button
          className="pagination__btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          title="Previous page"
        >‹</button>
        {pages[0] > 1 && <span style={{ color: 'var(--admin-text-muted)', padding: '0 4px' }}>…</span>}
        {pages.map(p => (
          <button
            key={p}
            className={`pagination__btn ${p === page ? 'active' : ''}`}
            onClick={() => onPageChange(p)}
          >{p}</button>
        ))}
        {pages[pages.length - 1] < totalPages && <span style={{ color: 'var(--admin-text-muted)', padding: '0 4px' }}>…</span>}
        <button
          className="pagination__btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          title="Next page"
        >›</button>
        <button
          className="pagination__btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Last page"
        >»</button>
      </div>
    </div>
  );
}
