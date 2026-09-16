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

const EMPTY = { code: '', name: '', departmentId: '', semesterNumber: '', credits: 4 };

export default function SubjectsPage() {
  const [data,    setData]    = useState({ rows: [], total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [depts,   setDepts]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSem,  setFilterSem]  = useState('');
  const [page,    setPage]    = useState(1);
  const [sortBy,  setSortBy]  = useState('code');
  const [sortDir, setSortDir] = useState('asc');
  const [dialogOpen,setDialogOpen]= useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [formError,setFormError]=useState({});
  const [saving,  setSaving]  = useState(false);
  const [del,     setDel]     = useState(null);
  const [deleting,setDeleting]= useState(false);
  const [apiError,setApiError]= useState('');

  // Syllabus state
  const [syllabusSubject, setSyllabusSubject] = useState(null);
  const [syllabusUnits, setSyllabusUnits] = useState([]);
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [unitForm, setUnitForm] = useState({ unitNumber: '', unitTitle: '', totalHours: '' });
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [unitSaving, setUnitSaving] = useState(false);
  const [syllabusMsg, setSyllabusMsg] = useState('');
  const [subtopicInputs, setSubtopicInputs] = useState({});
  const [subtopicSaving, setSubtopicSaving] = useState({});
  const [editingSubtopic, setEditingSubtopic] = useState(null);

  // Faculty assignment lookups & modal state
  const [facultyList, setFacultyList] = useState([]);
  const [divisionsList, setDivisionsList] = useState([]);
  const [semestersList, setSemestersList] = useState([]);
  const [academicYearsList, setAcademicYearsList] = useState([]);

  const [assignSubject, setAssignSubject] = useState(null);
  const [assignList, setAssignList] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignForm, setAssignForm] = useState({
    facultyId: '',
    divisionId: '',
    semesterId: '',
    academicYearId: '',
    allDivisionsInSem: false,
  });
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');
  const [unassigningId, setUnassigningId] = useState(null);

  useEffect(() => {
    masterApi.departments.list({ limit: 100 }).then(r => setDepts(r.data.data.rows || []));
    masterApi.faculty.allActive().then(r => setFacultyList(r.data.data || []));
    masterApi.divisions.list({ limit: 200 }).then(r => setDivisionsList(r.data.data.rows || []));
    masterApi.semesters.list({ limit: 100 }).then(r => setSemestersList(r.data.data.rows || []));
    masterApi.academicYears.list({ limit: 50 }).then(r => setAcademicYearsList(r.data.data.rows || []));
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const r = await masterApi.subjects.list({ page, limit: 15, search, departmentId: filterDept, semesterNumber: filterSem, sortBy, sortDir }); setData(r.data.data); }
    catch {} finally { setLoading(false); }
  }, [page, search, filterDept, filterSem, sortBy, sortDir]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormError({}); setApiError(''); setDialogOpen(true); };
  const openEdit   = r => { setEditing(r); setForm({ code: r.code, name: r.name, departmentId: r.department_id, semesterNumber: r.semester_number, credits: r.credits, isActive: r.is_active }); setFormError({}); setApiError(''); setDialogOpen(true); };
  const close      = () => { setDialogOpen(false); setEditing(null); };

  // Faculty assignment management
  const openAssignFaculty = async (subject) => {
    setAssignSubject(subject);
    setAssignError('');
    setAssignSuccess('');

    // Auto-match semester ID from subject's semester_number
    const matchingSem = semestersList.find(s => Number(s.number) === Number(subject.semester_number));
    const activeYear = academicYearsList.find(y => y.is_active) || academicYearsList[0];

    // Find divisions matching this semester if possible
    const semDivs = matchingSem ? divisionsList.filter(d => Number(d.semester_id) === Number(matchingSem.id)) : [];
    const defaultDivId = semDivs.length === 1 ? semDivs[0].id : '';

    setAssignForm({
      facultyId: '',
      divisionId: defaultDivId,
      semesterId: matchingSem ? matchingSem.id : (semestersList[0]?.id || ''),
      academicYearId: activeYear ? activeYear.id : '',
      allDivisionsInSem: false,
    });

    setAssignLoading(true);
    try {
      const res = await masterApi.assignments.list({ subjectId: subject.id, limit: 100 });
      setAssignList(res.data?.data?.rows || []);
    } catch {
      setAssignList([]);
    } finally {
      setAssignLoading(false);
    }
  };

  const closeAssignFaculty = () => {
    setAssignSubject(null);
    setAssignList([]);
    setAssignError('');
    setAssignSuccess('');
  };

  const handleCreateAssignment = async (e) => {
    if (e) e.preventDefault();
    if (!assignSubject) return;
    if (!assignForm.facultyId) {
      setAssignError('Please select a faculty member.');
      return;
    }
    if (!assignForm.academicYearId) {
      setAssignError('Please select an academic year.');
      return;
    }
    if (!assignForm.semesterId) {
      setAssignError('Please select a semester.');
      return;
    }

    let targetDivisionIds = [];
    if (assignForm.allDivisionsInSem) {
      const matchingDivs = divisionsList.filter(d => Number(d.semester_id) === Number(assignForm.semesterId));
      if (!matchingDivs.length) {
        setAssignError('No divisions found for this semester to assign.');
        return;
      }
      targetDivisionIds = matchingDivs.map(d => d.id);
    } else {
      if (!assignForm.divisionId) {
        setAssignError('Please select a division or check "all divisions".');
        return;
      }
      targetDivisionIds = [assignForm.divisionId];
    }

    setAssignSaving(true);
    setAssignError('');
    setAssignSuccess('');

    try {
      await masterApi.assignments.create({
        subjectId: assignSubject.id,
        facultyId: assignForm.facultyId,
        divisionIds: targetDivisionIds,
        semesterId: assignForm.semesterId,
        academicYearId: assignForm.academicYearId,
      });

      setAssignSuccess('Faculty assigned successfully!');
      const updatedRes = await masterApi.assignments.list({ subjectId: assignSubject.id, limit: 100 });
      setAssignList(updatedRes.data?.data?.rows || []);
      setAssignForm(f => ({ ...f, facultyId: '', divisionId: '', allDivisionsInSem: false }));
      fetch();
    } catch (err) {
      setAssignError(err?.response?.data?.error?.message || err.message || 'Failed to assign faculty.');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to remove this faculty assignment?')) return;
    setUnassigningId(assignmentId);
    setAssignError('');
    setAssignSuccess('');
    try {
      await masterApi.assignments.remove(assignmentId);
      setAssignSuccess('Faculty assignment removed successfully.');
      const updatedRes = await masterApi.assignments.list({ subjectId: assignSubject.id, limit: 100 });
      setAssignList(updatedRes.data?.data?.rows || []);
      fetch();
    } catch (err) {
      setAssignError(err?.response?.data?.error?.message || 'Failed to remove assignment.');
    } finally {
      setUnassigningId(null);
    }
  };

  // Syllabus management
  const openSyllabus = async (subject) => {
    setSyllabusSubject(subject);
    setSyllabusMsg('');
    setUnitForm({ unitNumber: '', unitTitle: '', totalHours: '' });
    setEditingUnitId(null);
    setSubtopicInputs({});
    setEditingSubtopic(null);
    setSyllabusLoading(true);
    try {
      const res = await masterApi.subjects.getSyllabus(subject.id);
      setSyllabusUnits(res.data?.data || []);
    } catch {
      setSyllabusUnits([]);
    } finally {
      setSyllabusLoading(false);
    }
  };

  const closeSyllabus = () => {
    setSyllabusSubject(null);
    setSyllabusUnits([]);
    setEditingSubtopic(null);
    setSubtopicInputs({});
  };

  const handleSaveUnit = async (e) => {
    e.preventDefault();
    if (!unitForm.unitNumber || !unitForm.unitTitle) return;
    setUnitSaving(true);
    setSyllabusMsg('');
    try {
      if (editingUnitId) {
        await masterApi.subjects.updateSyllabusUnit(syllabusSubject.id, editingUnitId, {
          unitNumber: unitForm.unitNumber,
          unitTitle: unitForm.unitTitle,
          totalHours: unitForm.totalHours,
        });
      } else {
        await masterApi.subjects.createSyllabusUnit(syllabusSubject.id, {
          unitNumber: unitForm.unitNumber,
          unitTitle: unitForm.unitTitle,
          totalHours: unitForm.totalHours,
        });
      }
      setUnitForm({ unitNumber: '', unitTitle: '', totalHours: '' });
      setEditingUnitId(null);
      const res = await masterApi.subjects.getSyllabus(syllabusSubject.id);
      setSyllabusUnits(res.data?.data || []);
      setSyllabusMsg('Unit saved successfully!');
    } catch (err) {
      setSyllabusMsg(err.response?.data?.error?.message || 'Failed to save unit');
    } finally {
      setUnitSaving(false);
    }
  };

  const handleEditUnit = (u) => {
    setEditingUnitId(u.id);
    setUnitForm({
      unitNumber: u.unit_number,
      unitTitle: u.unit_title,
      totalHours: u.total_hours || '',
    });
  };

  const handleDeleteUnit = async (unitId) => {
    if (!window.confirm('Delete this syllabus unit? All its subtopics will also be deleted.')) return;
    try {
      await masterApi.subjects.deleteSyllabusUnit(syllabusSubject.id, unitId);
      const res = await masterApi.subjects.getSyllabus(syllabusSubject.id);
      setSyllabusUnits(res.data?.data || []);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete unit');
    }
  };

  const handleAddSubtopic = async (unitId) => {
    const title = (subtopicInputs[unitId] || '').trim();
    if (!title) return;
    setSubtopicSaving(prev => ({ ...prev, [unitId]: true }));
    try {
      await masterApi.subjects.createSubtopic(syllabusSubject.id, unitId, { title });
      setSubtopicInputs(prev => ({ ...prev, [unitId]: '' }));
      const res = await masterApi.subjects.getSyllabus(syllabusSubject.id);
      setSyllabusUnits(res.data?.data || []);
      setTimeout(() => {
        document.getElementById(`subtopic-input-${unitId}`)?.focus();
      }, 50);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to add subtopic');
    } finally {
      setSubtopicSaving(prev => ({ ...prev, [unitId]: false }));
    }
  };

  const handleStartEditSubtopic = (st) => {
    setEditingSubtopic({ id: st.id, unitId: st.unit_id, title: st.title });
  };

  const handleSaveSubtopicEdit = async () => {
    if (!editingSubtopic || !editingSubtopic.title.trim()) return;
    try {
      await masterApi.subjects.updateSubtopic(
        syllabusSubject.id,
        editingSubtopic.unitId,
        editingSubtopic.id,
        { title: editingSubtopic.title.trim() }
      );
      setEditingSubtopic(null);
      const res = await masterApi.subjects.getSyllabus(syllabusSubject.id);
      setSyllabusUnits(res.data?.data || []);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update subtopic');
    }
  };

  const handleDeleteSubtopic = async (unitId, subtopicId) => {
    if (!window.confirm('Delete this subtopic?')) return;
    try {
      await masterApi.subjects.deleteSubtopic(syllabusSubject.id, unitId, subtopicId);
      const res = await masterApi.subjects.getSyllabus(syllabusSubject.id);
      setSyllabusUnits(res.data?.data || []);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete subtopic');
    }
  };

  const validate = () => {
    const e = {};
    if (!form.code.trim()) e.code = 'Subject code is required (e.g. CS501)';
    if (!form.name.trim()) e.name = 'Subject name is required';
    if (!form.departmentId) e.departmentId = 'Department is required';
    if (!form.semesterNumber || form.semesterNumber < 1 || form.semesterNumber > 8) e.semesterNumber = 'Semester must be 1–8';
    setFormError(e); return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true); setApiError('');
    try {
      const payload = { ...form, semesterNumber: Number(form.semesterNumber), credits: Number(form.credits) };
      if (editing) await masterApi.subjects.update(editing.id, payload);
      else          await masterApi.subjects.create(payload);
      close(); fetch();
    } catch (e) { setApiError(e?.response?.data?.error?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try { await masterApi.subjects.remove(del.id); setDel(null); fetch(); }
    catch (e) { setApiError(e?.response?.data?.error?.message || 'Delete failed.'); }
    finally { setDeleting(false); }
  };

  const columns = [
    { key: 'code', label: 'Code', sortable: true, render: r => <code style={{ fontFamily: 'monospace', background: 'rgba(99,102,241,0.12)', padding: '2px 8px', borderRadius: 4, color: '#818cf8', fontWeight: 600 }}>{r.code}</code> },
    { key: 'name', label: 'Subject Name', sortable: true },
    { key: 'department_name', label: 'Department', muted: true },
    { key: 'semester_number', label: 'Sem', render: r => `Sem ${r.semester_number}`, muted: true },
    { key: 'credits', label: 'Credits', muted: true },
    {
      key: 'faculty',
      label: 'Assigned Faculty',
      render: r => {
        const hasFaculty = Boolean(r.assigned_faculty_names && r.assigned_faculty_names.trim());
        const count = r.assignment_count || 0;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            {hasFaculty ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {r.assigned_faculty_names.split(', ').map((name, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'rgba(99,102,241,0.09)',
                      color: '#4338ca',
                      border: '1px solid rgba(99,102,241,0.22)',
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: '0.74rem',
                      fontWeight: 600,
                    }}
                  >
                    👨‍🏫 {name}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '0.76rem', color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>
                Not assigned
              </span>
            )}
            <button
              type="button"
              onClick={() => openAssignFaculty(r)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--admin-accent)',
                padding: '2px 0',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                textDecoration: 'underline',
              }}
            >
              {hasFaculty ? `⚙️ Manage (${count})` : '➕ Assign Faculty'}
            </button>
          </div>
        );
      },
    },
    {
      key: 'syllabus',
      label: 'Syllabus',
      render: r => (
        <button
          type="button"
          onClick={() => openSyllabus(r)}
          style={{
            background: 'var(--color-primary-light, #e0f5f6)',
            color: 'var(--color-primary-dark, #00838c)',
            border: '1px solid var(--color-primary, #00a9b4)',
            borderRadius: '6px',
            padding: '3px 8px',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          📋 Manage Syllabus
        </button>
      ),
    },
    { key: 'is_active', label: 'Status', render: r => <StatusBadge active={r.is_active} /> },
  ];

  const semOptions = Array.from({ length: 8 }, (_, i) => ({ value: i + 1, label: `Semester ${i + 1}` }));

  return (
    <AdminPage
      title="Subjects & Syllabus"
      subtitle="Manage course subjects and their associated syllabus units"
      action={<button className="btn-primary" onClick={openCreate}>+ Add Subject</button>}
      toolbar={
        <>
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by name or code…" />
          <select className="filter-select" value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1); }}>
            <option value="">All Departments</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="filter-select" value={filterSem} onChange={e => { setFilterSem(e.target.value); setPage(1); }}>
            <option value="">All Semesters</option>
            {semOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </>
      }
    >
      {apiError && <div style={{ color: '#f87171', fontSize: '0.875rem' }}>{apiError}</div>}
      <DataTable columns={columns} rows={data.rows} loading={loading} sortBy={sortBy} sortDir={sortDir}
        onSort={(k, d) => { setSortBy(k); setSortDir(d); }} emptyMessage="No subjects found"
        actions={r => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btn-icon"
              title="Assign Faculty"
              onClick={() => openAssignFaculty(r)}
              style={{
                background: 'rgba(99,102,241,0.08)',
                color: '#4f46e5',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              👨‍🏫 Assign
            </button>
            <button className="btn-icon" title="Edit Subject" onClick={() => openEdit(r)}>✏️</button>
            <button className="btn-danger" title="Delete Subject" onClick={() => setDel(r)}>🗑</button>
          </div>
        )}
      />
      <Pagination {...data} onPageChange={setPage} />

      {/* Add / Edit Subject Modal */}
      <Dialog open={dialogOpen} title={editing ? 'Edit Subject' : 'Add Subject'} onClose={close} size="sm"
        footer={<><button className="btn-secondary" onClick={close} disabled={saving}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button></>}
      >
        {apiError && <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: 0 }}>{apiError}</p>}
        <div className="form-grid-1-2">
          <FormField label="Code" required error={formError.code} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="CS501" />
          <FormField label="Subject Name" required error={formError.name} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Data Structures" />
        </div>
        <FormField label="Department" required type="select" error={formError.departmentId} value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
          <option value="">Select department</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </FormField>
        <div className="form-grid-2">
          <FormField label="Semester (1–8)" required type="number" error={formError.semesterNumber}
            value={form.semesterNumber} onChange={e => setForm(f => ({ ...f, semesterNumber: e.target.value }))} min={1} max={8} />
          <FormField label="Credits" type="number" value={form.credits} onChange={e => setForm(f => ({ ...f, credits: e.target.value }))} min={0} max={10} step={0.5} />
        </div>
        {editing && (
          <FormField label="Status" type="select" value={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: Number(e.target.value) }))}>
            <option value={1}>Active</option><option value={0}>Inactive</option>
          </FormField>
        )}
      </Dialog>

      {/* Syllabus Modal (Combined with Subject) */}
      <Dialog
        open={Boolean(syllabusSubject)}
        title={`📋 Syllabus: ${syllabusSubject?.name || ''} (${syllabusSubject?.code || ''})`}
        onClose={closeSyllabus}
        size="lg"
        footer={<button className="btn-secondary" onClick={closeSyllabus}>Close</button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {syllabusMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#f0fdf4',
              color: '#166534',
              fontSize: '0.875rem',
              border: '1px solid #bbf7d0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>✓ {syllabusMsg}</span>
              <button
                type="button"
                onClick={() => setSyllabusMsg('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Add / Edit Unit Form (No Topics textarea) */}
          <form onSubmit={handleSaveUnit} style={{
            background: 'var(--color-surface, #f8fafc)',
            padding: 16,
            borderRadius: 10,
            border: '1px solid var(--color-border, #e2e8f0)',
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)' }}>
              {editingUnitId ? '✏️ Edit Unit' : '➕ Add Syllabus Unit'}
            </h4>
            <div className="unit-form-grid">
              <input
                type="number"
                placeholder="Unit #"
                className="filter-select"
                min={1}
                max={20}
                value={unitForm.unitNumber}
                onChange={e => setUnitForm({ ...unitForm, unitNumber: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Unit Title (e.g. Reading Comprehension & Grammar)"
                className="filter-select"
                value={unitForm.unitTitle}
                onChange={e => setUnitForm({ ...unitForm, unitTitle: e.target.value })}
                required
              />
              <input
                type="number"
                placeholder="Hours"
                className="filter-select"
                min={1}
                max={100}
                value={unitForm.totalHours}
                onChange={e => setUnitForm({ ...unitForm, totalHours: e.target.value })}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                {editingUnitId && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setEditingUnitId(null);
                      setUnitForm({ unitNumber: '', unitTitle: '', totalHours: '' });
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn-primary" disabled={unitSaving}>
                  {unitSaving ? 'Saving…' : editingUnitId ? 'Update Unit' : 'Add Unit'}
                </button>
              </div>
            </div>
          </form>

          {/* Units List with Subtopics */}
          {syllabusLoading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
              <p>Loading syllabus units…</p>
            </div>
          ) : syllabusUnits.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '32px 16px',
              background: 'var(--color-surface, #f8fafc)',
              borderRadius: 10,
              border: '1px dashed var(--color-border, #e2e8f0)',
              color: 'var(--color-text-muted)',
            }}>
              <p style={{ margin: 0, fontWeight: 500 }}>No syllabus units added yet for this subject.</p>
              <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>Use the form above to add your first unit (Unit No, Title, and Hours).</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
              {syllabusUnits.map(u => (
                <div
                  key={u.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: 10,
                    padding: 16,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Unit Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    paddingBottom: 10,
                    borderBottom: '1px solid #f1f5f9',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        background: 'var(--color-primary-light, #e0f5f6)',
                        color: 'var(--color-primary-dark, #00838c)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        padding: '3px 10px',
                        borderRadius: 6,
                      }}>
                        Unit {u.unit_number}
                      </span>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
                        {u.unit_title}
                      </h4>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        fontSize: '0.82rem',
                        color: '#475569',
                        fontWeight: 500,
                        background: '#f8fafc',
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: '1px solid #e2e8f0',
                      }}>
                        Hours: <strong>{u.total_hours || '—'}</strong>
                      </span>
                      <button
                        type="button"
                        className="btn-icon"
                        title="Edit Unit details"
                        onClick={() => handleEditUnit(u)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        style={{ color: '#ef4444' }}
                        title="Delete Unit"
                        onClick={() => handleDeleteUnit(u.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Subtopics Section */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      Subtopics
                    </div>

                    {/* Add Subtopic Input Bar */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <input
                        id={`subtopic-input-${u.id}`}
                        type="text"
                        placeholder="Enter subtopic..."
                        className="filter-select"
                        style={{ flex: 1, height: 36, padding: '0 12px' }}
                        value={subtopicInputs[u.id] || ''}
                        onChange={e => setSubtopicInputs({ ...subtopicInputs, [u.id]: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSubtopic(u.id);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '0 16px', height: 36, fontSize: '0.82rem' }}
                        disabled={subtopicSaving[u.id] || !(subtopicInputs[u.id] || '').trim()}
                        onClick={() => handleAddSubtopic(u.id)}
                      >
                        {subtopicSaving[u.id] ? 'Adding…' : '+ Add'}
                      </button>
                    </div>

                    {/* Subtopics List */}
                    {u.subtopics && u.subtopics.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {u.subtopics.map((st, idx) => {
                          const isEditing = editingSubtopic?.id === st.id;
                          return (
                            <div
                              key={st.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 10px',
                                background: isEditing ? '#eff6ff' : '#f8fafc',
                                border: isEditing ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                                borderRadius: 6,
                              }}
                            >
                              {isEditing ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                                  <span style={{ fontWeight: 600, color: 'var(--color-primary-dark, #00838c)', minWidth: 22, fontSize: '0.85rem' }}>
                                    {idx + 1}.
                                  </span>
                                  <input
                                    type="text"
                                    value={editingSubtopic.title}
                                    onChange={e => setEditingSubtopic({ ...editingSubtopic, title: e.target.value })}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSaveSubtopicEdit();
                                      if (e.key === 'Escape') setEditingSubtopic(null);
                                    }}
                                    style={{
                                      flex: 1,
                                      padding: '4px 8px',
                                      fontSize: '0.85rem',
                                      border: '1px solid var(--color-primary, #00a9b4)',
                                      borderRadius: 4,
                                      outline: 'none',
                                    }}
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    style={{ color: '#16a34a', fontWeight: 'bold' }}
                                    title="Save subtopic"
                                    onClick={handleSaveSubtopicEdit}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    style={{ color: '#6b7280' }}
                                    title="Cancel"
                                    onClick={() => setEditingSubtopic(null)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 600, color: 'var(--color-primary-dark, #00838c)', minWidth: 22, fontSize: '0.85rem' }}>
                                      {idx + 1}.
                                    </span>
                                    <span style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 500 }}>
                                      {st.title}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <button
                                      type="button"
                                      className="btn-icon"
                                      title="Edit subtopic"
                                      onClick={() => handleStartEditSubtopic(st)}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-icon"
                                      style={{ color: '#ef4444' }}
                                      title="Delete subtopic"
                                      onClick={() => handleDeleteSubtopic(u.id, st.id)}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        No subtopics added yet. Type a subtopic name above and click <strong>+ Add</strong>.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>

      {/* ── Assign Faculty Modal ── */}
      <Dialog
        open={Boolean(assignSubject)}
        title={`👨‍🏫 Assign Faculty: ${assignSubject?.code || ''} — ${assignSubject?.name || ''}`}
        onClose={closeAssignFaculty}
        size="lg"
        footer={<button className="btn-secondary" onClick={closeAssignFaculty}>Close</button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Metadata pill bar */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            padding: '10px 16px',
            background: 'rgba(99,102,241,0.05)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 8,
            fontSize: '0.8125rem',
            color: 'var(--admin-text)',
          }}>
            <span><strong>Department:</strong> {assignSubject?.department_name || 'ICT'}</span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span><strong>Semester:</strong> Semester {assignSubject?.semester_number}</span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span><strong>Credits:</strong> {assignSubject?.credits}</span>
            <span style={{ marginLeft: 'auto' }}>
              <StatusBadge active={assignSubject?.is_active} />
            </span>
          </div>

          {/* Feedback messages */}
          {assignSuccess && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>✓ {assignSuccess}</span>
              <button
                type="button"
                onClick={() => setAssignSuccess('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontWeight: 700 }}
              >✕</button>
            </div>
          )}

          {assignError && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>⚠️ {assignError}</span>
              <button
                type="button"
                onClick={() => setAssignError('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 700 }}
              >✕</button>
            </div>
          )}

          {/* Current Assignments List */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--admin-text)' }}>
                Current Faculty Assignments ({assignList.length})
              </span>
            </div>

            {assignLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                Loading assignments…
              </div>
            ) : assignList.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                background: '#fafafa',
                borderRadius: 8,
                border: '1px dashed #cbd5e1',
                color: 'var(--admin-text-muted)',
                fontSize: '0.875rem',
              }}>
                👨‍🏫 No faculty assigned to this subject yet. Select a faculty member and division below to assign.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--admin-border, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Faculty Member</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Division</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Semester</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Academic Year</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignList.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{a.faculty_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{a.faculty_email}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            background: 'rgba(0,169,180,0.1)',
                            color: '#00838c',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                          }}>
                            {a.division_name}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--admin-text-muted)' }}>
                          Sem {a.semester_number}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--admin-text-muted)' }}>
                          {a.academic_year_name}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <StatusBadge active={a.is_active} />
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn-danger"
                            title="Remove assignment"
                            disabled={unassigningId === a.id}
                            onClick={() => handleDeleteAssignment(a.id)}
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          >
                            {unassigningId === a.id ? '…' : '🗑 Unassign'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Form to Assign Faculty */}
          <form
            onSubmit={handleCreateAssignment}
            style={{
              background: 'var(--admin-card-bg, #ffffff)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 10,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{
              fontWeight: 700,
              fontSize: '0.9rem',
              color: '#4338ca',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              ➕ Assign Faculty to Division
            </div>

            <div className="form-grid-2">
              {/* Faculty selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
                  Select Faculty Member <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={assignForm.facultyId}
                  onChange={e => setAssignForm(f => ({ ...f, facultyId: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--admin-border, #cbd5e1)',
                    fontSize: '0.875rem',
                  }}
                  required
                >
                  <option value="">-- Choose Faculty --</option>
                  {facultyList.map(fac => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} ({fac.email}) {fac.designation ? `• ${fac.designation}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Division selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
                  Select Division <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={assignForm.divisionId}
                  disabled={assignForm.allDivisionsInSem}
                  onChange={e => setAssignForm(f => ({ ...f, divisionId: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--admin-border, #cbd5e1)',
                    fontSize: '0.875rem',
                    opacity: assignForm.allDivisionsInSem ? 0.5 : 1,
                  }}
                  required={!assignForm.allDivisionsInSem}
                >
                  <option value="">-- Choose Division --</option>
                  {divisionsList.map(div => (
                    <option key={div.id} value={div.id}>
                      {div.name} {div.batch_name ? `(${div.batch_name})` : ''} • Sem {div.semester_number || div.semester_id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* All divisions checkbox */}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={assignForm.allDivisionsInSem}
                onChange={e => setAssignForm(f => ({ ...f, allDivisionsInSem: e.target.checked }))}
              />
              <span>Assign to <strong>all divisions</strong> for this semester</span>
            </label>

            <div className="form-grid-2">
              {/* Semester selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
                  Semester <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={assignForm.semesterId}
                  onChange={e => setAssignForm(f => ({ ...f, semesterId: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--admin-border, #cbd5e1)',
                    fontSize: '0.875rem',
                  }}
                  required
                >
                  <option value="">-- Select Semester --</option>
                  {semestersList.map(s => (
                    <option key={s.id} value={s.id}>Semester {s.number}</option>
                  ))}
                </select>
              </div>

              {/* Academic Year selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
                  Academic Year <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={assignForm.academicYearId}
                  onChange={e => setAssignForm(f => ({ ...f, academicYearId: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--admin-border, #cbd5e1)',
                    fontSize: '0.875rem',
                  }}
                  required
                >
                  <option value="">-- Select Academic Year --</option>
                  {academicYearsList.map(y => (
                    <option key={y.id} value={y.id}>{y.name} {y.is_active ? '(Active)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={assignSaving}
                style={{
                  background: '#4f46e5',
                  boxShadow: '0 2px 8px rgba(79,70,229,0.3)',
                }}
              >
                {assignSaving ? 'Assigning…' : '➕ Assign Faculty'}
              </button>
            </div>
          </form>
        </div>
      </Dialog>

      <ConfirmDialog open={Boolean(del)} title="Delete Subject" message={`Delete subject "${del?.name} (${del?.code})"? Assignments linked to it will be affected.`}
        onConfirm={doDelete} onCancel={() => setDel(null)} loading={deleting} />
    </AdminPage>
  );
}
