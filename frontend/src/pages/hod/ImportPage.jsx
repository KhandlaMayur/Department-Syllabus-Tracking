import { useState, useRef, useCallback, useEffect } from 'react';
import importApi from '../../api/importApi';
import '../../styles/import.css';
import '../../styles/admin.css';


/* ─── Constants ──────────────────────────────────────────────── */
const IMPORT_TYPES = [
  {
    id: 'students',
    label: 'Students',
    icon: '🎓',
    desc: 'Enrollment, name, email, batch, semester, division…',
    columns: ['enrollment_number','name','email','department','academic_year','semester','batch','division','status'],
  },
  {
    id: 'faculty',
    label: 'Faculty',
    icon: '👨‍🏫',
    desc: 'Employee ID, name, email (@marwadieducation.edu.in / @marwadieducation.ed), department…',
    columns: ['employee_id','name','email','department','designation'],
  },
];

const STEPS = ['Choose Type', 'Upload File', 'Processing', 'Results'];

const STATUS_COLORS = {
  success:   'success',
  updated:   'updated',
  duplicate: 'duplicate',
  invalid:   'invalid',
  failed:    'failed',
};

/* ─── Helpers ────────────────────────────────────────────────── */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function downloadAsCSV(rows, filename) {
  if (!rows || !rows.length) return;
  // Build columns from first row's row_data
  let firstData = {};
  try {
    firstData = typeof rows[0].row_data === 'string'
      ? JSON.parse(rows[0].row_data || '{}')
      : (rows[0].row_data || {});
  } catch {
    firstData = {};
  }
  const dataCols = Object.keys(firstData || {});
  const headers = ['row_number', ...dataCols, 'status', 'errors'];

  const lines = [headers.join(',')];
  for (const r of rows) {
    let data = {};
    try {
      data = typeof r.row_data === 'string' ? JSON.parse(r.row_data || '{}') : (r.row_data || {});
    } catch {
      data = {};
    }
    const errors = r.errors
      ? (typeof r.errors === 'string' ? JSON.parse(r.errors || '[]') : r.errors)
          .map(e => `${e.field || ''}: ${e.message || ''}`).join('; ')
      : '';
    const vals = [
      r.row_number,
      ...dataCols.map(c => `"${String(data[c] ?? '').replace(/"/g, '""')}"`),
      r.status,
      `"${errors}"`,
    ];
    lines.push(vals.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Sub-components ─────────────────────────────────────────── */
function StepIndicator({ currentStep }) {
  return (
    <div className="import-steps">
      {STEPS.map((label, i) => {
        const state = i < currentStep ? 'completed' : i === currentStep ? 'active' : '';
        return (
          <div key={label} className={`import-step ${state}`}>
            <div className="import-step__dot">
              {i < currentStep ? '✓' : i + 1}
            </div>
            <span className="import-step__label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function SummaryCards({ stats }) {
  const cards = [
    { key: 'total',     label: 'Total Rows', icon: '📊', val: stats.total,     cls: 'total'     },
    { key: 'success',   label: 'Inserted',   icon: '✅', val: stats.success,   cls: 'success'   },
    { key: 'updated',   label: 'Updated',    icon: '🔄', val: stats.updated,   cls: 'updated'   },
    { key: 'duplicate', label: 'Duplicate',  icon: '⚠️', val: stats.duplicate, cls: 'duplicate' },
    { key: 'invalid',   label: 'Invalid',    icon: '❌', val: stats.invalid,   cls: 'invalid'   },
    { key: 'failed',    label: 'Failed',     icon: '🚫', val: stats.failed,    cls: 'failed'    },
  ];
  return (
    <div className="import-summary">
      {cards.map(c => (
        <div key={c.key} className={`summary-card summary-card--${c.cls}`}>
          <div className="summary-card__icon">{c.icon}</div>
          <div className="summary-card__value">{c.val}</div>
          <div className="summary-card__label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function PreviewTable({ rows }) {
  if (!rows || !rows.length) return null;

  // Collect all data columns from first row
  let firstData = {};
  try {
    firstData = typeof rows[0].row_data === 'string'
      ? JSON.parse(rows[0].row_data || '{}')
      : (rows[0].row_data || {});
  } catch {
    firstData = {};
  }
  const dataCols = Object.keys(firstData || {}).slice(0, 8); // show up to 8 cols

  return (
    <div className="preview-table-wrap">
      <div className="preview-table-wrap__header">
        <span className="preview-table-wrap__title">
          📋 Preview — first {rows.length} rows
        </span>
      </div>
      <div className="preview-table-scroll">
        <table className="preview-table">
          <thead>
            <tr>
              <th>#</th>
              {dataCols.map(c => <th key={c}>{c}</th>)}
              <th>Status</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const data   = typeof row.row_data === 'string' ? JSON.parse(row.row_data) : (row.row_data || {});
              const errors = row.errors
                ? (typeof row.errors === 'string' ? JSON.parse(row.errors) : row.errors)
                : [];
              return (
                <tr key={i}>
                  <td style={{ color: 'var(--admin-text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {row.row_number}
                  </td>
                  {dataCols.map(c => (
                    <td key={c} title={String(data[c] || '')}>
                      {String(data[c] || '—')}
                    </td>
                  ))}
                  <td>
                    <span className={`row-status row-status--${STATUS_COLORS[row.status] || row.status}`}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ maxWidth: '200px', fontSize: '0.75rem', color: 'var(--admin-danger)' }}>
                    {errors.map(e => `${e.field}: ${e.message}`).join(' | ') || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportHistoryTable() {
  const [history, setHistory]   = useState({ rows: [], total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading]   = useState(false);
  const [page,    setPage]      = useState(1);
  const [filter,  setFilter]    = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const r = await importApi.getHistory({ page, limit: 10, type: filter || undefined });
      setHistory(r.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleDownload = async (row) => {
    try {
      const r = await importApi.getFailedRows(row.id);
      const failedRows = r.data.data.rows;
      if (!failedRows.length) { alert('No failed rows to download.'); return; }
      downloadAsCSV(failedRows, `${row.import_type}_failed_rows_${row.id}.csv`);
    } catch {
      alert('Could not download failed rows.');
    }
  };

  return (
    <div className="data-table-wrap">
      <div className="import-history-header">
        <span className="import-history-title">📜 Import History</span>
        <select
          className="filter-select"
          value={filter}
          onChange={e => { setFilter(e.target.value); setPage(1); }}
          style={{ width: 160 }}
        >
          <option value="">All Types</option>
          {IMPORT_TYPES.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>File</th>
            <th>Date</th>
            <th>Total</th>
            <th>✅ Success</th>
            <th>🔄 Updated</th>
            <th>⚠️ Dup</th>
            <th>❌ Invalid</th>
            <th>🚫 Failed</th>
            <th>Status</th>
            <th>By</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={12} style={{ textAlign: 'center', padding: '32px', color: 'var(--admin-text-muted)' }}>Loading…</td></tr>
          ) : !history.rows.length ? (
            <tr>
              <td colSpan={12}>
                <div className="data-table__empty">
                  <div className="data-table__empty-icon">📂</div>
                  <div className="data-table__empty-text">No imports yet</div>
                  <div className="data-table__empty-sub">Start by uploading an Excel file above</div>
                </div>
              </td>
            </tr>
          ) : history.rows.map(row => (
            <tr key={row.id}>
              <td>
                <span className={`import-type-badge import-type-badge--${row.import_type}`}>
                  {row.import_type}
                </span>
              </td>
              <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {row.file_name}
              </td>
              <td className="muted">
                {new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td style={{ fontWeight: 700 }}>{row.total_rows}</td>
              <td style={{ color: '#16a34a', fontWeight: 600 }}>{row.success_rows}</td>
              <td style={{ color: '#2563eb', fontWeight: 600 }}>{row.updated_rows}</td>
              <td style={{ color: '#d97706', fontWeight: 600 }}>{row.duplicate_rows}</td>
              <td style={{ color: '#dc2626', fontWeight: 600 }}>{row.invalid_rows}</td>
              <td style={{ color: '#dc2626', fontWeight: 600 }}>{row.failed_rows}</td>
              <td>
                <span className={`import-status-badge import-status-badge--${row.status}`}>
                  {row.status === 'completed' ? '✓' : row.status === 'processing' ? '⏳' : '✗'} {row.status}
                </span>
              </td>
              <td className="muted">{row.imported_by_name}</td>
              <td>
                {(row.failed_rows > 0 || row.invalid_rows > 0 || row.duplicate_rows > 0) && (
                  <button className="btn-icon" title="Download failed rows" onClick={() => handleDownload(row)} style={{ fontSize: '0.75rem' }}>
                    ⬇ Failed
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {history.totalPages > 1 && (
        <div className="pagination">
          <span className="pagination__info">
            Showing {((page - 1) * 10) + 1}–{Math.min(page * 10, history.total)} of {history.total}
          </span>
          <div className="pagination__controls">
            <button className="pagination__btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(history.totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`pagination__btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="pagination__btn" disabled={page === history.totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function ImportPage() {
  const [step,         setStep]         = useState(0); // 0=type 1=upload 2=processing 3=result
  const [selectedType, setSelectedType] = useState(null);
  const [file,         setFile]         = useState(null);
  const [dragging,     setDragging]     = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [result,       setResult]       = useState(null);
  const [error,        setError]        = useState('');
  const fileInputRef = useRef(null);

  // ── File handling ──
  const handleFileAccept = (f) => {
    const ext = (f.name || '').split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      setError('Invalid file type. Only .xlsx and .xls files are supported.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File too large. Maximum size is 20 MB.');
      return;
    }
    setError('');
    setFile(f);
    setStep(1);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileAccept(dropped);
  }, [selectedType]); // eslint-disable-line

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleFileInput = (e) => {
    const chosen = e.target.files[0];
    if (chosen) handleFileAccept(chosen);
    e.target.value = '';
  };

  // ── Upload ──
  const startUpload = async () => {
    if (!file || !selectedType) return;
    setStep(2);
    setProgress(0);
    setError('');
    try {
      const r = await importApi.upload(selectedType.id, file, setProgress);
      setResult(r.data.data);
      setStep(3);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err.message || 'Upload failed.';
      setError(msg);
      setStep(1);
    }
  };

  // ── Download failed rows ──
  const handleDownloadFailed = async () => {
    if (!result?.id) return;
    try {
      const r = await importApi.getFailedRows(result.id);
      const rows = r.data.data.rows;
      if (!rows.length) { alert('No failed rows to download.'); return; }
      downloadAsCSV(rows, `${selectedType.id}_failed_rows_${result.id}.csv`);
    } catch {
      alert('Could not download failed rows.');
    }
  };

  // ── Reset ──
  const reset = () => {
    setStep(0);
    setSelectedType(null);
    setFile(null);
    setProgress(0);
    setResult(null);
    setError('');
  };

  const typeInfo = IMPORT_TYPES.find(t => t.id === selectedType?.id);

  return (
    <div className="admin-page import-page">
      {/* Header */}
      <div className="admin-page__header">
        <div className="admin-page__title-group">
          <h1 className="admin-page__title">📥 Excel Import</h1>
          <p className="admin-page__subtitle">
            Bulk-import students, faculty, subjects, batches, syllabus, and timetable data from Excel files
          </p>
        </div>
        {step > 0 && (
          <button className="btn-secondary" onClick={reset}>↩ Start New Import</button>
        )}
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      {/* ── Step 0: Choose type ── */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--admin-text-muted)' }}>
            Choose what you want to import:
          </p>
          <div className="import-type-grid">
            {IMPORT_TYPES.map(t => (
              <div
                key={t.id}
                className={`import-type-card ${selectedType?.id === t.id ? 'selected' : ''}`}
                onClick={() => { setSelectedType(t); setStep(1); }}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && (setSelectedType(t), setStep(1))}
              >
                <div className="import-type-card__icon">{t.icon}</div>
                <div className="import-type-card__label">{t.label}</div>
                <div className="import-type-card__desc">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 1: Upload file ── */}
      {step === 1 && selectedType && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Type indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.5rem' }}>{selectedType.icon}</span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>
                Importing: {selectedType.label}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                {typeInfo?.matrixFormat
                  ? 'Matrix grid format (auto-detects days, times, batches & slots)'
                  : `Required columns: ${typeInfo?.columns?.join(', ') || 'None'}`}
              </div>
            </div>
            <button
              className="btn-icon"
              style={{ marginLeft: 'auto' }}
              onClick={() => { setSelectedType(null); setFile(null); setStep(0); }}
            >
              ← Change type
            </button>
          </div>

          {/* Drop zone */}
          <div
            className={`drop-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="drop-zone__hidden-input"
              onChange={handleFileInput}
            />
            {file ? (
              <>
                <div className="drop-zone__icon">📊</div>
                <div className="drop-zone__file-info">
                  <span className="drop-zone__file-icon">📄</span>
                  <span>{file.name}</span>
                  <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.8125rem' }}>
                    ({formatBytes(file.size)})
                  </span>
                  <button
                    className="drop-zone__remove"
                    title="Remove file"
                    onClick={e => { e.stopPropagation(); setFile(null); }}
                  >✕</button>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                  Click to choose a different file
                </div>
              </>
            ) : (
              <>
                <div className="drop-zone__icon">📤</div>
                <div className="drop-zone__title">Drag & drop your Excel file here</div>
                <div className="drop-zone__sub">or click to browse — supports .xlsx and .xls, max 20 MB</div>
                <button
                  className="btn-primary"
                  style={{ marginTop: 8 }}
                  onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  Browse Files
                </button>
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              color: 'var(--admin-danger)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Column reference / Format guide */}
          {typeInfo?.matrixFormat ? (
            /* ── Timetable matrix format guide ── */
            <div style={{
              padding: '16px 18px',
              background: 'var(--admin-accent-light)',
              border: '1px solid rgba(0,169,180,0.25)',
              borderRadius: 10,
              fontSize: '0.8125rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <div style={{ fontWeight: 700, color: 'var(--admin-accent-dark)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                📅 Timetable Matrix Format Guide
                <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                  — upload your real institutional timetable as-is
                </span>
              </div>

              {/* Structure diagram */}
              <div style={{
                background: 'white',
                border: '1px solid rgba(0,169,180,0.2)',
                borderRadius: 8,
                padding: '10px 14px',
                fontFamily: 'monospace',
                fontSize: '0.72rem',
                lineHeight: 1.7,
                overflowX: 'auto',
                color: 'var(--admin-text)',
              }}>
                <div style={{ color: 'var(--admin-text-muted)', marginBottom: 4 }}>Excel structure expected:</div>
                <div>┌──────────┬──────────┬──────────────────┬──────────────────┬────────────────┐</div>
                <div>│  Sr No   │   TIME   │      <span style={{color:'#00838c'}}>MON</span>          │      <span style={{color:'#00838c'}}>TUE</span>          │    <span style={{color:'#00838c'}}>WED</span>  <span style={{color:'var(--admin-text-muted)'}}>…</span>       │</div>
                <div>│          │          │   <span style={{color:'#2563eb'}}>A</span>    │   <span style={{color:'#2563eb'}}>B</span>    │   <span style={{color:'#2563eb'}}>A</span>    │   <span style={{color:'#2563eb'}}>B</span>    │   <span style={{color:'#2563eb'}}>A</span>  │  <span style={{color:'#2563eb'}}>B</span>  │</div>
                <div>│    1     │09:30-10:30│<span style={{color:'#16a34a'}}>ICP DG MA112</span>│<span style={{color:'#16a34a'}}>FSSI MS MA115</span>│<span style={{color:'#16a34a'}}>AC BKP MA001</span> │  …  │</div>
                <div>│    2     │10:30-11:30│<span style={{color:'#16a34a'}}>BEE AG MA104</span>│<span style={{color:'#d97706'}}>   PBL   </span>    │<span style={{color:'#16a34a'}}>VA-1 DT MA001</span>│  …  │</div>
                <div>│          │  LUNCH BREAK (auto-skipped)                                       │</div>
                <div>└──────────┴──────────┴──────────────────┴──────────────────┴────────────────┘</div>
              </div>

              {/* Cell format */}
              <div>
                <div style={{ fontWeight: 600, color: 'var(--admin-text)', marginBottom: 6 }}>Cell value format:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {typeInfo?.matrixHint?.examples?.map((ex, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <code style={{
                        background: 'white',
                        border: '1px solid rgba(0,169,180,0.25)',
                        padding: '3px 10px',
                        borderRadius: 6,
                        fontSize: '0.72rem',
                        color: 'var(--admin-accent-dark)',
                        whiteSpace: 'pre',
                        fontFamily: 'monospace',
                        minWidth: 170,
                      }}>{ex.split('→')[0].trim()}</code>
                      <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
                        → {ex.split('→')[1]?.trim()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Auto-detect */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--admin-text)', fontSize: '0.8rem' }}>Auto-detected:</span>
                {typeInfo?.matrixHint?.autoDetects?.map(d => (
                  <span key={d} style={{
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    padding: '2px 9px',
                    borderRadius: 999,
                    fontSize: '0.72rem',
                    color: '#16a34a',
                    fontWeight: 600,
                  }}>✓ {d}</span>
                ))}
              </div>
            </div>
          ) : (
            /* ── Standard column reference ── */
            <div style={{
              padding: '14px 18px',
              background: 'var(--admin-accent-light)',
              border: '1px solid rgba(0,169,180,0.2)',
              borderRadius: 10,
              fontSize: '0.8125rem',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--admin-accent-dark)', marginBottom: 8 }}>
                📋 Expected Excel columns for {selectedType.label}:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {typeInfo?.columns?.map(col => (
                  <span key={col} style={{
                    background: 'white',
                    border: '1px solid rgba(0,169,180,0.3)',
                    padding: '3px 10px',
                    borderRadius: 999,
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    color: 'var(--admin-accent-dark)',
                    fontWeight: 600,
                  }}>
                    {col}
                  </span>
                ))}
              </div>
              {selectedType.id === 'students' && (
                <div style={{ marginTop: 8, color: 'var(--admin-accent-dark)', fontSize: '0.75rem' }}>
                  ⚠️ Email must be <strong>@marwadiuniversity.ac.in</strong>
                </div>
              )}
              {selectedType.id === 'faculty' && (
                <div style={{ marginTop: 8, color: 'var(--admin-accent-dark)', fontSize: '0.75rem' }}>
                  ⚠️ Email must end with <strong>@marwadieducation.edu.in</strong> or <strong>@marwadieducation.ed</strong>
                </div>
              )}
            </div>
          )}

          {/* Action bar */}
          <div className="import-actions">
            <button
              className="btn-new-import"
              onClick={startUpload}
              disabled={!file}
            >
              🚀 Start Import
            </button>
            <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
              {file ? `Ready to import ${file.name}` : 'Please select a file first'}
            </span>
          </div>
        </div>
      )}

      {/* ── Step 2: Processing ── */}
      {step === 2 && (
        <div className="upload-progress">
          <div className="upload-progress__spinner" />
          <div className="upload-progress__title">
            {progress < 100 ? `Uploading ${selectedType?.label} data…` : 'Processing rows…'}
          </div>
          <div style={{ width: '100%', maxWidth: 400 }}>
            <div className="progress-bar-wrap">
              <div className="progress-bar-fill" style={{ width: `${progress < 100 ? progress : 100}%` }} />
            </div>
          </div>
          <div className="progress-bar__percent">{progress < 100 ? `${progress}%` : 'Validating & inserting…'}</div>
          <div className="upload-progress__sub">
            {progress < 100
              ? 'Uploading your file to the server…'
              : 'Validating each row and writing to database. Large files may take a moment.'}
          </div>
        </div>
      )}

      {/* ── Step 3: Results ── */}
      {step === 3 && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Success banner */}
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(0,169,180,0.08), rgba(0,131,140,0.04))',
            border: '1px solid rgba(0,169,180,0.2)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <span style={{ fontSize: '2rem' }}>
              {result.stats?.failed === result.stats?.total ? '❌' : result.stats?.success === 0 && result.stats?.updated === 0 ? '⚠️' : '✅'}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--admin-text)' }}>
                {selectedType?.label} import complete
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>
                File: <strong>{result.file_name}</strong> · {result.stats?.total} rows processed
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              {(result.stats?.failed > 0 || result.stats?.invalid > 0) && (
                <button className="btn-download" onClick={handleDownloadFailed}>
                  ⬇ Download Failed Rows CSV
                </button>
              )}
              <button className="btn-new-import" onClick={reset}>
                + New Import
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <SummaryCards stats={result.stats || {}} />

          {/* Duplicate warning */}
          {result.stats?.duplicate > 0 && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 8,
              fontSize: '0.875rem',
              color: '#92400e',
            }}>
              ⚠️ <strong>{result.stats.duplicate} duplicate row(s)</strong> were skipped — records with the same key already exist in the database.
            </div>
          )}

          {/* Invalid warning */}
          {result.stats?.invalid > 0 && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              fontSize: '0.875rem',
              color: '#991b1b',
            }}>
              ❌ <strong>{result.stats.invalid} invalid row(s)</strong> failed validation and were not inserted.
              Download the CSV above to see detailed error messages per row.
            </div>
          )}

          {/* Preview table */}
          <PreviewTable rows={result.previewRows || []} />
        </div>
      )}

      {/* ── Import History (always visible) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: step === 3 ? 8 : 0 }}>
        <ImportHistoryTable key={step === 3 ? result?.id : 'static'} />
      </div>
    </div>
  );
}
