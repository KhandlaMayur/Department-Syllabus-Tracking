import { useState, useEffect, useCallback } from 'react';
import AdminPage from '../../../components/common/AdminPage';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Dialog from '../../../components/common/Dialog';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import FormField from '../../../components/common/FormField';
import StatusBadge from '../../../components/common/StatusBadge';
import masterApi from '../../../api/masterApi';

const EMPTY = { subjectId: '', facultyId: '', divisionId: '', semesterId: '', academicYearId: '' };

export default function AssignmentsPage() {
  const [data,      setData]      = useState({ rows: [], total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loading,   setLoading]   = useState(true);
  const [subjects,  setSubjects]  = useState([]);
  const [faculty,   setFaculty]   = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [years,     setYears]     = useState([]);
  const [filterYear,setFilterYear]= useState('');
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
    masterApi.subjects.list({ limit: 200 }).then(r => setSubjects(r.data.data.rows || []));
    masterApi.faculty.allActive().then(r => setFaculty(r.data.data || []));
    masterApi.divisions.list({ limit: 200 }).then(r => setDivisions(r.data.data.rows || []));
    masterApi.semesters.list({ limit: 100 }).then(r => setSemesters(r.data.data.rows || []));
    masterApi.academicYears.list({ limit: 50 }).then(r => setYears(r.data.data.rows || []));
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const r = await masterApi.assignments.list({ page, limit: 15, academicYearId: filterYear }); setData(r.data.data); }
    catch {} finally { setLoading(false); }
  }, [page, filterYear]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormError({}); setApiError(''); setDialogOpen(true); };
  const openEdit   = r => { setEditing(r); setForm({ subjectId: r.subject_id, facultyId: r.faculty_id, divisionId: r.division_id, semesterId: r.semester_id, academicYearId: r.academic_year_id }); setFormError({}); setApiError(''); setDialogOpen(true); };
  const close      = () => { setDialogOpen(false); setEditing(null); };

  const validate = () => {
    const e = {};
    if (!form.subjectId) e.subjectId = 'Subject is required';
    if (!form.facultyId) e.facultyId = 'Faculty is required';
    if (!form.divisionId) e.divisionId = 'Division is required';
    if (!form.semesterId) e.semesterId = 'Semester is required';
    if (!form.academicYearId) e.academicYearId = 'Academic year is required';
    setFormError(e); return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true); setApiError('');
    try {
      if (editing) await masterApi.assignments.update(editing.id, form);
      else          await masterApi.assignments.create(form);
      close(); fetch();
    } catch (e) { setApiError(e?.response?.data?.error?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try { await masterApi.assignments.remove(del.id); setDel(null); fetch(); }
    catch (e) { setApiError(e?.response?.data?.error?.message || 'Delete failed.'); }
    finally { setDeleting(false); }
  };

  const columns = [
    { key: 'subject_code', label: 'Code', render: r => <code style={{ fontFamily: 'monospace', background: 'rgba(99,102,241,0.12)', padding: '2px 8px', borderRadius: 4, color: '#818cf8' }}>{r.subject_code}</code> },
    { key: 'subject_name', label: 'Subject' },
    { key: 'faculty_name', label: 'Faculty', muted: true },
    { key: 'division_name', label: 'Division', muted: true },
    { key: 'semester_number', label: 'Sem', render: r => `Sem ${r.semester_number}`, muted: true },
    { key: 'academic_year_name', label: 'Year', muted: true },
    { key: 'is_active', label: 'Status', render: r => <StatusBadge active={r.is_active} /> },
  ];

  return (
    <AdminPage
      title="Subject Assignments"
      subtitle="Assign faculty members to subjects for each division and semester"
      action={<button className="btn-primary" onClick={openCreate}>+ Add Assignment</button>}
      toolbar={
        <select className="filter-select" value={filterYear} onChange={e => { setFilterYear(e.target.value); setPage(1); }}>
          <option value="">All Academic Years</option>
          {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
        </select>
      }
    >
      {apiError && <div style={{ color: '#f87171', fontSize: '0.875rem' }}>{apiError}</div>}
      <DataTable columns={columns} rows={data.rows} loading={loading} sortBy="" sortDir="asc" onSort={() => {}} emptyMessage="No assignments found"
        actions={r => (<><button className="btn-icon" onClick={() => openEdit(r)}>✏️</button><button className="btn-danger" onClick={() => setDel(r)}>🗑</button></>)}
      />
      <Pagination {...data} onPageChange={setPage} />

      <Dialog open={dialogOpen} title={editing ? 'Edit Assignment' : 'New Assignment'} onClose={close} size="md"
        footer={<><button className="btn-secondary" onClick={close} disabled={saving}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Assign'}</button></>}
      >
        {apiError && <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: 0 }}>{apiError}</p>}
        <FormField label="Subject" required type="select" error={formError.subjectId} value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}>
          <option value="">Select subject</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </FormField>
        <FormField label="Faculty Member" required type="select" error={formError.facultyId} value={form.facultyId} onChange={e => setForm(f => ({ ...f, facultyId: e.target.value }))}>
          <option value="">Select faculty</option>
          {faculty.map(f => <option key={f.id} value={f.id}>{f.name} ({f.designation || 'Faculty'})</option>)}
        </FormField>
        <div className="form-grid-2">
          <FormField label="Division" required type="select" error={formError.divisionId} value={form.divisionId} onChange={e => setForm(f => ({ ...f, divisionId: e.target.value }))}>
            <option value="">Select division</option>
            {divisions.map(d => <option key={d.id} value={d.id}>Div {d.name} — {d.batch_name}</option>)}
          </FormField>
          <FormField label="Semester" required type="select" error={formError.semesterId} value={form.semesterId} onChange={e => setForm(f => ({ ...f, semesterId: e.target.value }))}>
            <option value="">Select semester</option>
            {semesters.map(s => <option key={s.id} value={s.id}>Sem {s.number} ({s.academic_year_name})</option>)}
          </FormField>
        </div>
        <FormField label="Academic Year" required type="select" error={formError.academicYearId} value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))}>
          <option value="">Select academic year</option>
          {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
        </FormField>
      </Dialog>

      <ConfirmDialog open={Boolean(del)} title="Delete Assignment"
        message={`Remove assignment of "${del?.subject_name}" to ${del?.faculty_name} for Division ${del?.division_name}?`}
        onConfirm={doDelete} onCancel={() => setDel(null)} loading={deleting} />
    </AdminPage>
  );
}
