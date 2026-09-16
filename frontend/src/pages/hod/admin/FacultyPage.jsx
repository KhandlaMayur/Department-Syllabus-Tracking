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

export default function FacultyPage() {
  const [data,    setData]    = useState({ rows: [], total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [depts,   setDepts]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [page,    setPage]    = useState(1);
  const [dialogOpen,setDialogOpen]= useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState({ employeeId: '', designation: '', departmentId: '' });
  const [saving,  setSaving]  = useState(false);
  const [del,     setDel]     = useState(null);
  const [deleting,setDeleting]= useState(false);
  const [apiError,setApiError]= useState('');

  useEffect(() => {
    masterApi.departments.list({ limit: 100 }).then(r => setDepts(r.data.data.rows || []));
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const r = await masterApi.faculty.list({ page, limit: 15, search, departmentId: filterDept }); setData(r.data.data); }
    catch {} finally { setLoading(false); }
  }, [page, search, filterDept]);

  useEffect(() => { fetch(); }, [fetch]);

  const openEdit = r => {
    setEditing(r);
    setForm({
      employeeId: r.employee_id,
      designation: r.designation || '',
      isActive: r.is_active,
      departmentId: r.department_id || '',
    });
    setApiError('');
    setDialogOpen(true);
  };
  const close    = () => { setDialogOpen(false); setEditing(null); };

  const save = async () => {
    setSaving(true); setApiError('');
    try {
      await masterApi.faculty.update(editing.id, form);
      close();
      fetch();
    }
    catch (e) { setApiError(e?.response?.data?.error?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try { await masterApi.faculty.remove(del.id); setDel(null); fetch(); }
    catch (e) { setApiError(e?.response?.data?.error?.message || 'Delete failed.'); }
    finally { setDeleting(false); }
  };

  const ROLE_COLORS = { hod: '#f59e0b', cc: '#8b5cf6', faculty: '#6366f1' };
  const columns = [
    { key: 'name',          label: 'Name' },
    { key: 'email',         label: 'Email', muted: true },
    { key: 'employee_id',   label: 'Employee ID', render: r => <code style={{ fontFamily: 'monospace', background: 'rgba(99,102,241,0.12)', padding: '2px 8px', borderRadius: 4, color: '#818cf8' }}>{r.employee_id}</code> },
    { key: 'role',          label: 'Role', render: r => <span style={{ color: ROLE_COLORS[r.role] || '#fff', fontWeight: 600, fontSize: '0.8125rem' }}>{r.role?.toUpperCase()}</span> },
    { key: 'designation',   label: 'Designation', muted: true },
    { key: 'department_name', label: 'Department', muted: true },
    { key: 'is_active',     label: 'Status', render: r => <StatusBadge active={r.is_active} /> },
  ];

  return (
    <AdminPage
      title="Faculty Members"
      subtitle="View and manage all faculty, CC and HOD accounts"
      toolbar={
        <>
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search name, email or ID…" />
          <select className="filter-select" value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1); }}>
            <option value="">All Departments</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </>
      }
    >
      {apiError && <div style={{ color: '#f87171', fontSize: '0.875rem' }}>{apiError}</div>}
      <DataTable columns={columns} rows={data.rows} loading={loading} sortBy="" sortDir="asc" onSort={() => {}} emptyMessage="No faculty members found"
        actions={r => (
          <>
            <button className="btn-icon" onClick={() => openEdit(r)}>✏️</button>
            <button className="btn-danger" onClick={() => setDel(r)}>🚫</button>
          </>
        )}
      />
      <Pagination {...data} onPageChange={setPage} />

      <Dialog open={dialogOpen} title="Edit Faculty" onClose={close} size="sm"
        footer={<><button className="btn-secondary" onClick={close} disabled={saving}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Update'}</button></>}
      >
        {apiError && <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: 0 }}>{apiError}</p>}
        <FormField label="Employee ID" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} />
        <FormField label="Designation" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Assistant Professor" />
        <FormField label="Department" type="select" value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
          <option value="">— Select Department —</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </FormField>
        <FormField label="Status" type="select" value={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: Number(e.target.value) }))}>
          <option value={1}>Active</option><option value={0}>Inactive</option>
        </FormField>
      </Dialog>

      <ConfirmDialog open={Boolean(del)} title="Deactivate Faculty"
        message={`Deactivate "${del?.name}"? They will lose access to the portal.`}
        onConfirm={doDelete} onCancel={() => setDel(null)} loading={deleting} />
    </AdminPage>
  );
}
