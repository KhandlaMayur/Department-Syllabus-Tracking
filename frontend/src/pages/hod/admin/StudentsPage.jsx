import { useState, useEffect, useCallback } from 'react';
import AdminPage from '../../../components/common/AdminPage';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import SearchBar from '../../../components/common/SearchBar';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import StatusBadge from '../../../components/common/StatusBadge';
import masterApi from '../../../api/masterApi';

export default function StudentsPage() {
  const [data,    setData]    = useState({ rows: [], total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [search,  setSearch]  = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [page,    setPage]    = useState(1);
  const [del,     setDel]     = useState(null);
  const [deleting,setDeleting]= useState(false);
  const [apiError,setApiError]= useState('');

  useEffect(() => {
    masterApi.batches.list({ limit: 100 }).then(r => setBatches(r.data.data.rows || []));
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const r = await masterApi.students.list({ page, limit: 15, search, batchId: filterBatch }); setData(r.data.data); }
    catch {} finally { setLoading(false); }
  }, [page, search, filterBatch]);

  useEffect(() => { fetch(); }, [fetch]);

  const doDelete = async () => {
    setDeleting(true);
    try { await masterApi.students.remove(del.id); setDel(null); fetch(); }
    catch (e) { setApiError(e?.response?.data?.error?.message || 'Delete failed.'); }
    finally { setDeleting(false); }
  };

  const columns = [
    { key: 'name',              label: 'Name',              sortable: false },
    { key: 'email',             label: 'Email',             muted: true },
    { key: 'enrollment_number', label: 'Enrollment No.',    render: r => <code style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.enrollment_number}</code> },
    { key: 'batch_name',        label: 'Batch',             muted: true },
    { key: 'division_name',     label: 'Division',          muted: true, render: r => r.division_name || r.division || '—' },
    { key: 'semester',          label: 'Semester',          muted: true, render: r => r.semester ? `Sem ${r.semester}` : '—' },
    { key: 'is_active',         label: 'Status',            render: r => <StatusBadge active={r.is_active} /> },
  ];

  return (
    <AdminPage
      title="Students"
      subtitle="View and manage all enrolled students"
      toolbar={
        <>
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search name, email or enrollment no…" />
          <select className="filter-select" value={filterBatch} onChange={e => { setFilterBatch(e.target.value); setPage(1); }}>
            <option value="">All Batches</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name} — {b.department_name}</option>)}
          </select>
        </>
      }
    >
      {apiError && <div style={{ color: '#f87171', fontSize: '0.875rem' }}>{apiError}</div>}
      <DataTable columns={columns} rows={data.rows} loading={loading} sortBy="" sortDir="asc" onSort={() => {}} emptyMessage="No students found"
        actions={r => (
          <button className="btn-danger" title="Deactivate student" onClick={() => setDel(r)}>🚫 Deactivate</button>
        )}
      />
      <Pagination {...data} onPageChange={setPage} />

      <ConfirmDialog open={Boolean(del)} title="Deactivate Student"
        message={`Deactivate "${del?.name}" (${del?.enrollment_number})? They will no longer be able to log in.`}
        onConfirm={doDelete} onCancel={() => setDel(null)} loading={deleting} />
    </AdminPage>
  );
}
