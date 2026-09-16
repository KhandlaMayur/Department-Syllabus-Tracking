import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AdminPage from '../../../components/common/AdminPage';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Dialog from '../../../components/common/Dialog';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import FormField from '../../../components/common/FormField';
import StatusBadge from '../../../components/common/StatusBadge';
import masterApi from '../../../api/masterApi';
import importApi from '../../../api/importApi';

const EMPTY = { name: '', batchId: '', semesterId: '' };

export default function DivisionsPage() {
  const [data,     setData]     = useState({ rows: [], total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading,  setLoading]  = useState(true);
  const [batches,  setBatches]  = useState([]);
  const [semesters,setSemesters]= useState([]);
  const [filterBatch, setFilterBatch] = useState('');
  const [page,     setPage]     = useState(1);
  const [dialogOpen,setDialogOpen]= useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [formError,setFormError]= useState({});
  const [saving,   setSaving]   = useState(false);
  const [del,      setDel]      = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [apiError, setApiError] = useState('');

  // View Students in Division Modal state
  const [viewDivision, setViewDivision] = useState(null);
  const [divisionStudents, setDivisionStudents] = useState([]);
  const [viewLoading, setViewLoading]   = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Import Student Excel Modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile]           = useState(null);
  const [uploading, setUploading]             = useState(false);
  const [uploadProgress, setUploadProgress]   = useState(0);
  const [importResult, setImportResult]       = useState(null);
  const [importError, setImportError]         = useState('');
  const fileInputRef                          = useRef(null);

  useEffect(() => {
    masterApi.batches.list({ limit: 100 }).then(r => setBatches(r.data?.data?.rows || []));
    masterApi.semesters.list({ limit: 100 }).then(r => setSemesters(r.data?.data?.rows || []));
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await masterApi.divisions.list({ page, limit: 20, batchId: filterBatch });
      setData(r.data.data);
    } catch {} finally {
      setLoading(false);
    }
  }, [page, filterBatch]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormError({}); setApiError(''); setDialogOpen(true); };
  const openEdit   = r => {
    setEditing(r);
    setForm({
      name: r.name,
      batchId: r.batch_id,
      semesterId: r.semester_id,
    });
    setFormError({});
    setApiError('');
    setDialogOpen(true);
  };
  const close      = () => { setDialogOpen(false); setEditing(null); };

  const openViewStudents = async (div) => {
    setViewDivision(div);
    setDivisionStudents([]);
    setViewLoading(true);
    setStudentSearch('');
    try {
      const res = await masterApi.divisions.getStudents(div.id);
      setDivisionStudents(res.data?.data?.students || []);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to load students');
    } finally {
      setViewLoading(false);
    }
  };

  const closeViewStudents = () => {
    setViewDivision(null);
    setDivisionStudents([]);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Division name is required (e.g. A or EK1)';
    if (!form.batchId)    e.batchId = 'Batch is required';
    if (!form.semesterId) e.semesterId = 'Semester is required';
    setFormError(e); return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true); setApiError('');
    try {
      const payload = {
        name: form.name.trim(),
        batchId: Number(form.batchId),
        semesterId: Number(form.semesterId),
      };
      if (editing) await masterApi.divisions.update(editing.id, payload);
      else          await masterApi.divisions.create(payload);
      close(); fetch();
    } catch (e) { setApiError(e?.response?.data?.error?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try { await masterApi.divisions.remove(del.id); setDel(null); fetch(); }
    catch (e) { setApiError(e?.response?.data?.error?.message || 'Delete failed.'); }
    finally { setDeleting(false); }
  };

  // Excel import handler
  const handleStartImport = async (e) => {
    e.preventDefault();
    if (!importFile) return;
    setUploading(true);
    setImportError('');
    setImportResult(null);
    setUploadProgress(0);
    try {
      const res = await importApi.upload('students', importFile, p => setUploadProgress(p));
      setImportResult(res.data?.data);
      // Refresh divisions and filter options
      fetch();
      masterApi.batches.list({ limit: 100 }).then(r => setBatches(r.data?.data?.rows || []));
      masterApi.semesters.list({ limit: 100 }).then(r => setSemesters(r.data?.data?.rows || []));
    } catch (err) {
      setImportError(err.response?.data?.error?.message || 'Failed to import Excel file.');
    } finally {
      setUploading(false);
    }
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    setImportFile(null);
    setImportResult(null);
    setImportError('');
    setUploadProgress(0);
  };

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return divisionStudents;
    const q = studentSearch.toLowerCase();
    return divisionStudents.filter(s =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.enrollment_number && s.enrollment_number.toLowerCase().includes(q)) ||
      (s.roll_number && String(s.roll_number).toLowerCase().includes(q))
    );
  }, [divisionStudents, studentSearch]);

  const columns = [
    {
      key: 'name',
      label: 'Division',
      sortable: true,
      render: r => (
        <span style={{
          fontWeight: 700,
          color: 'var(--color-primary-dark, #00838c)',
          background: 'var(--color-primary-light, #e0f5f6)',
          padding: '3px 10px',
          borderRadius: 6,
          fontSize: '0.85rem',
        }}>
          {r.name}
        </span>
      ),
    },
    { key: 'batch_name', label: 'Batch', muted: true },
    { key: 'semester_number', label: 'Semester', render: r => `Sem ${r.semester_number}`, muted: true },
    { key: 'academic_year_name', label: 'Year', muted: true },
    {
      key: 'students',
      label: 'Students',
      render: r => (
        <span style={{
          fontWeight: 600,
          color: r.student_count > 0 ? '#15803d' : '#64748b',
          background: r.student_count > 0 ? '#dcfce7' : '#f1f5f9',
          padding: '3px 10px',
          borderRadius: 12,
          fontSize: '0.8rem',
          display: 'inline-block',
        }}>
          {r.student_count || 0} {Number(r.student_count) === 1 ? 'Student' : 'Students'}
        </span>
      ),
    },
    { key: 'is_active', label: 'Status', render: r => <StatusBadge active={r.is_active} /> },
  ];

  return (
    <AdminPage
      title="Divisions"
      subtitle="Manage class divisions and division-wise students automatically extracted from student Excel"
      action={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setImportModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            📥 Import Student Excel
          </button>
          <button className="btn-primary" onClick={openCreate}>
            + Add Division
          </button>
        </div>
      }
      toolbar={
        <select className="filter-select" value={filterBatch} onChange={e => { setFilterBatch(e.target.value); setPage(1); }}>
          <option value="">All Batches</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name} — {b.department_name}</option>)}
        </select>
      }
    >
      {apiError && <div style={{ color: '#f87171', fontSize: '0.875rem' }}>{apiError}</div>}
      <DataTable
        columns={columns}
        rows={data.rows}
        loading={loading}
        sortBy=""
        sortDir="asc"
        onSort={() => {}}
        emptyMessage="No divisions found. Import a student Excel file to automatically detect divisions."
        actions={r => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{
                padding: '4px 10px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
              }}
              onClick={() => openViewStudents(r)}
              title={`View ${r.name} Students`}
            >
              👁️ View
            </button>
            <button className="btn-icon" onClick={() => openEdit(r)} title="Edit Division">✏️</button>
            <button className="btn-danger" onClick={() => setDel(r)} title="Delete Division">🗑</button>
          </div>
        )}
      />
      <Pagination {...data} onPageChange={setPage} />

      {/* View Division Students Modal */}
      <Dialog
        open={Boolean(viewDivision)}
        title={`👥 ${viewDivision?.name || ''} Students`}
        onClose={closeViewStudents}
        size="md"
        footer={<button className="btn-secondary" onClick={closeViewStudents}>Close</button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Header Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            background: 'var(--color-surface, #f8fafc)',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid var(--color-border, #e2e8f0)',
            fontSize: '0.85rem',
            color: '#475569',
          }}>
            <div>
              <strong>Batch:</strong> {viewDivision?.batch_name || '—'} &nbsp;|&nbsp;
              <strong>Semester:</strong> Sem {viewDivision?.semester_number || '—'} &nbsp;|&nbsp;
              <strong>Year:</strong> {viewDivision?.academic_year_name || '—'}
            </div>
            <span style={{
              fontWeight: 700,
              color: 'var(--color-primary-dark, #00838c)',
              background: 'var(--color-primary-light, #e0f5f6)',
              padding: '3px 10px',
              borderRadius: 12,
            }}>
              {divisionStudents.length} {divisionStudents.length === 1 ? 'Student' : 'Students'}
            </span>
          </div>

          {/* Search input if multiple students */}
          {divisionStudents.length > 5 && (
            <input
              type="text"
              placeholder="Search student by name, roll no, or enrollment..."
              className="filter-select"
              style={{ width: '100%', height: 36 }}
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
            />
          )}

          {/* Student list */}
          {viewLoading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
              Loading students…
            </div>
          ) : filteredStudents.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '28px 16px',
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px dashed #e2e8f0',
              color: 'var(--color-text-muted)',
            }}>
              {studentSearch ? 'No students match your search.' : 'No students enrolled in this division yet.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
              {filteredStudents.map((st, idx) => (
                <div
                  key={st.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '10px 14px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <span style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: 'var(--color-primary-dark, #00838c)',
                    minWidth: 26,
                    paddingTop: 1,
                  }}>
                    {idx + 1}.
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>
                      {st.name}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '0.82rem', color: '#64748b' }}>
                      <span>Enrollment: <strong style={{ color: '#1e293b' }}>{st.enrollment_number}</strong></span>
                      <span>Roll No: <strong style={{ color: '#1e293b' }}>{st.roll_number || '—'}</strong></span>
                      {st.email && <span>Email: <span style={{ color: '#64748b' }}>{st.email}</span></span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>

      {/* Import Student Excel Modal */}
      <Dialog
        open={importModalOpen}
        title="📥 Import Student Excel"
        onClose={closeImportModal}
        size="md"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn-secondary" onClick={closeImportModal} disabled={uploading}>
              {importResult ? 'Done' : 'Cancel'}
            </button>
            {!importResult && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleStartImport}
                disabled={!importFile || uploading}
              >
                {uploading ? `Importing… (${uploadProgress}%)` : 'Upload & Process'}
              </button>
            )}
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
            Upload student Excel (.xlsx or .xls). The system will automatically detect the <strong>Division</strong> column,
            auto-create divisions (e.g. <strong>EK1, EK2, EK3</strong>), and link students division-wise.
          </p>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: '0.8rem',
            color: '#334155',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--color-primary-dark, #00838c)' }}>
              📋 Supported / Detected Columns:
            </div>
            <code>Enrollment No</code>, <code>Student Name</code>, <code>Roll No</code>, <code>Semester</code>, <code>Batch</code>, <code>Division</code>
          </div>

          {importError && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.85rem' }}>
              ✕ {importError}
            </div>
          )}

          {importResult ? (
            <div style={{
              padding: 16,
              background: '#f0fdf4',
              borderRadius: 8,
              border: '1px solid #bbf7d0',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.95rem' }}>
                ✅ Students Imported & Divisions Grouped Successfully!
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: '0.85rem', marginTop: 4 }}>
                <div style={{ background: '#ffffff', padding: 8, borderRadius: 6, textAlign: 'center', border: '1px solid #dcfce7' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>{importResult.stats?.total || 0}</div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Total Rows</div>
                </div>
                <div style={{ background: '#ffffff', padding: 8, borderRadius: 6, textAlign: 'center', border: '1px solid #dcfce7' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#15803d' }}>{importResult.stats?.success || 0}</div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>New Students</div>
                </div>
                <div style={{ background: '#ffffff', padding: 8, borderRadius: 6, textAlign: 'center', border: '1px solid #dcfce7' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0284c7' }}>{importResult.stats?.updated || 0}</div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Updated</div>
                </div>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#166534' }}>
                Divisions and student counts have been updated in the table below.
              </p>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setImportFile(f);
                }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--color-primary, #00a9b4)',
                  borderRadius: 10,
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: importFile ? '#f0fdf4' : '#fafafa',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 6 }}>📊</div>
                {importFile ? (
                  <div>
                    <strong style={{ color: '#15803d', fontSize: '0.95rem' }}>{importFile.name}</strong>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>
                      {(importFile.size / 1024).toFixed(1)} KB — Click to change file
                    </div>
                  </div>
                ) : (
                  <div>
                    <strong style={{ color: '#1e293b', fontSize: '0.95rem' }}>Choose an Excel file</strong>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>
                      Click to browse or drop .xlsx / .xls file here
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Dialog>

      {/* Add / Edit Division Modal */}
      <Dialog open={dialogOpen} title={editing ? 'Edit Division' : 'Add Division'} onClose={close} size="sm"
        footer={<><button className="btn-secondary" onClick={close} disabled={saving}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button></>}
      >
        {apiError && <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: 0 }}>{apiError}</p>}
        <FormField label="Division Name" required error={formError.name} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. EK1" />
        <FormField label="Batch" required type="select" error={formError.batchId} value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value }))}>
          <option value="">Select batch</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name} — {b.department_name}</option>)}
        </FormField>
        <FormField label="Semester" required type="select" error={formError.semesterId} value={form.semesterId} onChange={e => setForm(f => ({ ...f, semesterId: e.target.value }))}>
          <option value="">Select semester</option>
          {semesters.map(s => <option key={s.id} value={s.id}>Sem {s.number} ({s.academic_year_name})</option>)}
        </FormField>
      </Dialog>

      <ConfirmDialog open={Boolean(del)} title="Delete Division" message={`Delete Division "${del?.name}" from batch "${del?.batch_name}"? All student division associations will be unlinked.`}
        onConfirm={doDelete} onCancel={() => setDel(null)} loading={deleting} />
    </AdminPage>
  );
}
