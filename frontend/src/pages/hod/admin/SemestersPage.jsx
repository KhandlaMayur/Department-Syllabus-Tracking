import { useState, useEffect, useCallback } from 'react';
import AdminPage from '../../../components/common/AdminPage';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Dialog from '../../../components/common/Dialog';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import FormField from '../../../components/common/FormField';
import StatusBadge from '../../../components/common/StatusBadge';
import masterApi from '../../../api/masterApi';

const EMPTY = { academicYearId: '', number: '', startDate: '', endDate: '' };

export default function SemestersPage() {
  const [data,      setData]      = useState({ rows: [], total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading,   setLoading]   = useState(true);
  const [years,     setYears]     = useState([]);
  const [filterYear, setFilterYear] = useState('');
  const [page,      setPage]      = useState(1);
  const [dialogOpen,setDialogOpen]= useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [formError, setFormError] = useState({});
  const [saving,    setSaving]    = useState(false);
  const [del,       setDel]       = useState(null);
  const [deleting,  setDeleting]  = useState(false);
  const [apiError,  setApiError]  = useState('');

  useEffect(() => {
    masterApi.academicYears.list({ limit: 100 }).then(r => setYears(r.data.data.rows || []));
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const r = await masterApi.semesters.list({ page, limit: 20, academicYearId: filterYear }); setData(r.data.data); }
    catch {} finally { setLoading(false); }
  }, [page, filterYear]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormError({}); setApiError(''); setDialogOpen(true); };
  const openEdit   = r => { setEditing(r); setForm({ academicYearId: r.academic_year_id, number: r.number, startDate: r.start_date?.split('T')[0] || '', endDate: r.end_date?.split('T')[0] || '' }); setFormError({}); setApiError(''); setDialogOpen(true); };
  const close      = () => { setDialogOpen(false); setEditing(null); };

  const validate = () => {
    const e = {};
    if (!form.academicYearId) e.academicYearId = 'Academic year is required';
    if (!form.number || form.number < 1 || form.number > 8) e.number = 'Semester must be 1–8';
    setFormError(e); return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true); setApiError('');
    try {
      const payload = { ...form, number: Number(form.number) };
      if (editing) await masterApi.semesters.update(editing.id, payload);
      else          await masterApi.semesters.create(payload);
      close(); fetch();
    } catch (e) { setApiError(e?.response?.data?.error?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try { await masterApi.semesters.remove(del.id); setDel(null); fetch(); }
    catch (e) { setApiError(e?.response?.data?.error?.message || 'Delete failed.'); }
    finally { setDeleting(false); }
  };

  const columns = [
    { key: 'academic_year_name', label: 'Academic Year', sortable: false },
    { key: 'number', label: 'Semester', render: r => `Semester ${r.number}` },
    { key: 'start_date', label: 'Start', muted: true, render: r => r.start_date ? new Date(r.start_date).toLocaleDateString() : '—' },
    { key: 'end_date',   label: 'End',   muted: true, render: r => r.end_date   ? new Date(r.end_date).toLocaleDateString()   : '—' },
    { key: 'is_active',  label: 'Status', render: r => <StatusBadge active={r.is_active} /> },
  ];

  const yearOptions = years.map(y => ({ value: y.id, label: y.name }));

  return (
    <AdminPage
      title="Semesters"
      subtitle="Define semesters within each academic year"
      action={<button className="btn-primary" onClick={openCreate}>+ Add Semester</button>}
      toolbar={
        <select className="filter-select" value={filterYear} onChange={e => { setFilterYear(e.target.value); setPage(1); }}>
          <option value="">All Academic Years</option>
          {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      }
    >
      {apiError && <div style={{ color: '#f87171', fontSize: '0.875rem' }}>{apiError}</div>}
      <DataTable columns={columns} rows={data.rows} loading={loading} sortBy="" sortDir="asc" onSort={() => {}} emptyMessage="No semesters found"
        actions={r => (<><button className="btn-icon" onClick={() => openEdit(r)}>✏️</button><button className="btn-danger" onClick={() => setDel(r)}>🗑</button></>)}
      />
      <Pagination {...data} onPageChange={setPage} />

      <Dialog open={dialogOpen} title={editing ? 'Edit Semester' : 'Add Semester'} onClose={close} size="sm"
        footer={<><button className="btn-secondary" onClick={close} disabled={saving}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button></>}
      >
        {apiError && <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: 0 }}>{apiError}</p>}
        <FormField label="Academic Year" required type="select" error={formError.academicYearId} value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))}>
          <option value="">Select academic year</option>
          {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </FormField>
        <FormField label="Semester Number (1–8)" required type="number" error={formError.number}
          value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} min={1} max={8} />
        <div className="form-grid-2">
          <FormField label="Start Date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} onFocus={e => (e.target.type = 'date')} onBlur={e => (!e.target.value && (e.target.type = 'text'))} placeholder="Optional" />
          <FormField label="End Date"   value={form.endDate}   onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} onFocus={e => (e.target.type = 'date')} onBlur={e => (!e.target.value && (e.target.type = 'text'))} placeholder="Optional" />
        </div>
      </Dialog>

      <ConfirmDialog open={Boolean(del)} title="Delete Semester" message={`Delete Semester ${del?.number} (${del?.academic_year_name})?`}
        onConfirm={doDelete} onCancel={() => setDel(null)} loading={deleting} />
    </AdminPage>
  );
}
