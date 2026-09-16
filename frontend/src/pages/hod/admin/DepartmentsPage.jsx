import { useState, useEffect, useCallback } from 'react';
import AdminPage from '../../../components/common/AdminPage';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import SearchBar from '../../../components/common/SearchBar';
import Dialog from '../../../components/common/Dialog';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import FormField from '../../../components/common/FormField';
import masterApi from '../../../api/masterApi';

const EMPTY_FORM = { name: '', code: '' };

export default function DepartmentsPage() {
  const [data,       setData]       = useState({ rows: [], total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [page,       setPage]       = useState(1);
  const [sortBy,     setSortBy]     = useState('name');
  const [sortDir,    setSortDir]    = useState('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);   // null = create
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [formError,  setFormError]  = useState({});
  const [saving,     setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]    = useState(false);
  const [apiError,     setApiError]    = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await masterApi.departments.list({ page, limit: 15, search, sortBy, sortDir });
      setData(res.data.data);
    } catch { /* handled by interceptor */ }
    finally { setLoading(false); }
  }, [page, search, sortBy, sortDir]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError({}); setApiError(''); setDialogOpen(true); };
  const openEdit   = (row) => { setEditing(row); setForm({ name: row.name, code: row.code }); setFormError({}); setApiError(''); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const validate = () => {
    const err = {};
    if (!form.name.trim()) err.name = 'Department name is required';
    if (!form.code.trim()) err.code = 'Department code is required';
    else if (form.code.trim().length > 20) err.code = 'Code must be ≤ 20 characters';
    setFormError(err);
    return Object.keys(err).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true); setApiError('');
    try {
      if (editing) await masterApi.departments.update(editing.id, form);
      else          await masterApi.departments.create(form);
      closeDialog();
      fetchData();
    } catch (e) {
      setApiError(e?.response?.data?.error?.message || 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await masterApi.departments.remove(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch (e) {
      setApiError(e?.response?.data?.error?.message || 'Delete failed.');
    } finally { setDeleting(false); }
  };

  const columns = [
    { key: 'name', label: 'Department Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true, render: r => <code style={{ fontFamily: 'monospace', background: 'rgba(99,102,241,0.12)', padding: '2px 8px', borderRadius: 4, color: '#818cf8' }}>{r.code}</code> },
    { key: 'created_at', label: 'Created', sortable: true, muted: true, render: r => new Date(r.created_at).toLocaleDateString() },
  ];

  return (
    <AdminPage
      title="Departments"
      subtitle="Manage all university departments"
      action={
        <button className="btn-primary" onClick={openCreate}>
          <span>+</span> Add Department
        </button>
      }
      toolbar={<SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search departments…" />}
    >
      {apiError && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 16px', color: '#f87171', fontSize: '0.875rem' }}>{apiError}</div>}

      <DataTable
        columns={columns}
        rows={data.rows}
        loading={loading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={(k, d) => { setSortBy(k); setSortDir(d); }}
        emptyMessage="No departments found"
        actions={row => (
          <>
            <button className="btn-icon" onClick={() => openEdit(row)}>✏️ Edit</button>
            <button className="btn-danger" onClick={() => setDeleteTarget(row)}>🗑</button>
          </>
        )}
      />
      <Pagination {...data} onPageChange={setPage} />

      {/* Add / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        title={editing ? 'Edit Department' : 'Add Department'}
        onClose={closeDialog}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={closeDialog} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        {apiError && <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: 0 }}>{apiError}</p>}
        <FormField label="Department Name" required error={formError.name}
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Computer Science & Engineering" />
        <FormField label="Short Code" required error={formError.code}
          value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
          placeholder="e.g. CSE" />
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Department"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone and may fail if students or faculty are linked.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </AdminPage>
  );
}
