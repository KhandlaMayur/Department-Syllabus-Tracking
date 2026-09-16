import { useState, useEffect, useCallback } from 'react';
import AdminPage from '../../../components/common/AdminPage';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import SearchBar from '../../../components/common/SearchBar';
import Dialog from '../../../components/common/Dialog';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import FormField from '../../../components/common/FormField';
import StatusBadge from '../../../components/common/StatusBadge';
import masterApi from '../../../api/masterApi';

const EMPTY = { name: '', startDate: '', endDate: '', isActive: 1 };

export default function AcademicYearsPage() {
  const [data,    setData]    = useState({ rows: [], total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(EMPTY);
  const [formError,  setFormError]  = useState({});
  const [saving,     setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]    = useState(false);
  const [apiError,     setApiError]    = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const r = await masterApi.academicYears.list({ page, limit: 15, search }); setData(r.data.data); }
    catch {} finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormError({}); setApiError(''); setDialogOpen(true); };
  const openEdit   = r => { setEditing(r); setForm({ name: r.name, startDate: r.start_date?.split('T')[0] || '', endDate: r.end_date?.split('T')[0] || '', isActive: r.is_active }); setFormError({}); setApiError(''); setDialogOpen(true); };
  const close      = () => { setDialogOpen(false); setEditing(null); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required (e.g. 2024-25)';
    if (!form.startDate)   e.startDate = 'Start date is required';
    if (!form.endDate)     e.endDate   = 'End date is required';
    setFormError(e); return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true); setApiError('');
    try {
      if (editing) await masterApi.academicYears.update(editing.id, form);
      else          await masterApi.academicYears.create(form);
      close(); fetch();
    } catch (e) { setApiError(e?.response?.data?.error?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const del = async () => {
    setDeleting(true);
    try { await masterApi.academicYears.remove(deleteTarget.id); setDeleteTarget(null); fetch(); }
    catch (e) { setApiError(e?.response?.data?.error?.message || 'Delete failed.'); }
    finally { setDeleting(false); }
  };

  const columns = [
    { key: 'name', label: 'Academic Year', sortable: true },
    { key: 'start_date', label: 'Start', render: r => r.start_date ? new Date(r.start_date).toLocaleDateString() : '—', muted: true },
    { key: 'end_date',   label: 'End',   render: r => r.end_date   ? new Date(r.end_date).toLocaleDateString()   : '—', muted: true },
    { key: 'is_active',  label: 'Status', render: r => <StatusBadge active={r.is_active} /> },
  ];

  return (
    <AdminPage
      title="Academic Years"
      subtitle="Define academic year periods (e.g. 2024-25)"
      action={<button className="btn-primary" onClick={openCreate}>+ Add Year</button>}
      toolbar={<SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search years…" />}
    >
      {apiError && <div style={{ color: '#f87171', fontSize: '0.875rem' }}>{apiError}</div>}
      <DataTable columns={columns} rows={data.rows} loading={loading} sortBy="" sortDir="desc" onSort={() => {}} emptyMessage="No academic years found"
        actions={r => (<><button className="btn-icon" onClick={() => openEdit(r)}>✏️</button><button className="btn-danger" onClick={() => setDeleteTarget(r)}>🗑</button></>)}
      />
      <Pagination {...data} onPageChange={setPage} />

      <Dialog open={dialogOpen} title={editing ? 'Edit Academic Year' : 'Add Academic Year'} onClose={close} size="sm"
        footer={<><button className="btn-secondary" onClick={close} disabled={saving}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button></>}
      >
        {apiError && <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: 0 }}>{apiError}</p>}
        <FormField label="Name" required error={formError.name} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 2024-25" />
        <FormField label="Start Date" required type="input" error={formError.startDate} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} onFocus={e => (e.target.type = 'date')} onBlur={e => (!e.target.value && (e.target.type = 'text'))} placeholder="YYYY-MM-DD" />
        <FormField label="End Date" required type="input" error={formError.endDate} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} onFocus={e => (e.target.type = 'date')} onBlur={e => (!e.target.value && (e.target.type = 'text'))} placeholder="YYYY-MM-DD" />
        {editing && (
          <FormField label="Status" type="select" value={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: Number(e.target.value) }))}>
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </FormField>
        )}
      </Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete Academic Year"
        message={`Delete "${deleteTarget?.name}"? All semesters linked to this year may be affected.`}
        onConfirm={del} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </AdminPage>
  );
}
