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

const EMPTY = { name: '', departmentId: '', academicYearId: '', ccFacultyId: '', isActive: 1 };

export default function BatchesPage() {
  const [data, setData] = useState({ rows: [], total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [depts, setDepts] = useState([]);
  const [years, setYears] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [page, setPage] = useState(1);

  // Main Add / Edit Batch modal
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [del, setDel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Quick CC Assignment modal
  const [ccModalBatch, setCcModalBatch] = useState(null);
  const [selectedCcDivId, setSelectedCcDivId] = useState('');
  const [selectedCcId, setSelectedCcId] = useState('');
  const [savingCc, setSavingCc] = useState(false);

  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    masterApi.departments.list({ limit: 100 }).then(r => setDepts(r.data?.data?.rows || []));
    masterApi.academicYears.list({ limit: 100 }).then(r => setYears(r.data?.data?.rows || []));
    masterApi.faculty.allActive().then(r => setFaculty(r.data?.data || []));
    masterApi.divisions.list({ limit: 100 }).then(r => setDivisions(r.data?.data?.rows || []));
  }, []);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await masterApi.batches.list({ page, limit: 15, search, departmentId: filterDept });
      setData(r.data?.data || { rows: [], total: 0, page: 1, limit: 15, totalPages: 1 });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, search, filterDept]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError({});
    setApiError('');
    setDialogOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      name: r.name,
      departmentId: r.department_id,
      academicYearId: r.academic_year_id,
      ccFacultyId: r.cc_faculty_id ? String(r.cc_faculty_id) : '',
      isActive: r.is_active,
    });
    setFormError({});
    setApiError('');
    setDialogOpen(true);
  };

  const close = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const openQuickCC = (batch, specificAssignment = null) => {
    setCcModalBatch(batch);
    if (specificAssignment) {
      setSelectedCcDivId(specificAssignment.division_id ? String(specificAssignment.division_id) : '');
      setSelectedCcId(specificAssignment.faculty_id ? String(specificAssignment.faculty_id) : '');
    } else {
      setSelectedCcDivId('');
      setSelectedCcId(batch.cc_faculty_id ? String(batch.cc_faculty_id) : '');
    }
    setApiError('');
  };

  const closeQuickCC = () => {
    setCcModalBatch(null);
    setSelectedCcDivId('');
    setSelectedCcId('');
    setApiError('');
  };

  const saveQuickCC = async () => {
    if (!ccModalBatch) return;
    setSavingCc(true);
    setApiError('');
    try {
      if (selectedCcId) {
        await masterApi.ccAssignments.assign({
          batchId: ccModalBatch.id,
          divisionId: selectedCcDivId ? Number(selectedCcDivId) : null,
          facultyId: Number(selectedCcId),
        });
        showSuccess(`CC assigned successfully.`);
      } else {
        const existing = (ccModalBatch.cc_assignments || []).find(a =>
          selectedCcDivId ? String(a.division_id) === String(selectedCcDivId) : !a.division_id
        );
        if (existing) {
          await masterApi.ccAssignments.remove(existing.id);
          showSuccess(`CC assignment removed.`);
        }
      }
      closeQuickCC();
      fetch();
    } catch (e) {
      setApiError(e?.response?.data?.error?.message || 'Failed to update CC assignment.');
    } finally {
      setSavingCc(false);
    }
  };

  const removeSpecificCC = async (assignmentId) => {
    setSavingCc(true);
    setApiError('');
    try {
      await masterApi.ccAssignments.remove(assignmentId);
      showSuccess('CC assignment removed.');
      closeQuickCC();
      fetch();
    } catch (e) {
      setApiError(e?.response?.data?.error?.message || 'Failed to remove CC assignment.');
    } finally {
      setSavingCc(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Batch name is required';
    if (!form.departmentId) e.departmentId = 'Department is required';
    if (!form.academicYearId) e.academicYearId = 'Academic year is required';
    setFormError(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError('');
    try {
      const payload = {
        name: form.name.trim(),
        departmentId: Number(form.departmentId),
        academicYearId: Number(form.academicYearId),
        ccFacultyId: form.ccFacultyId ? Number(form.ccFacultyId) : null,
        isActive: form.isActive !== undefined ? form.isActive : 1,
      };

      if (editing) {
        await masterApi.batches.update(editing.id, payload);
        showSuccess('Batch updated successfully.');
      } else {
        await masterApi.batches.create(payload);
        showSuccess('Batch created successfully.');
      }
      close();
      fetch();
    } catch (e) {
      setApiError(e?.response?.data?.error?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await masterApi.batches.remove(del.id);
      setDel(null);
      showSuccess('Batch deleted.');
      fetch();
    } catch (e) {
      setApiError(e?.response?.data?.error?.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  // Filter faculty for main modal dropdown based on selected department
  const filteredFaculty = form.departmentId
    ? faculty.filter(f => !f.department_id || String(f.department_id) === String(form.departmentId))
    : faculty;

  const columns = [
    { key: 'name', label: 'Batch', sortable: true },
    { key: 'department_name', label: 'Department', muted: true },
    { key: 'academic_year_name', label: 'Academic Year', muted: true },
    {
      key: 'cc_faculty_name',
      label: 'Class Coordinators (CC)',
      render: r => {
        const assignments = r.cc_assignments || (r.cc_faculty_name ? [{
          id: r.cc_assignment_id,
          batch_id: r.id,
          division_id: null,
          faculty_name: r.cc_faculty_name,
        }] : []);

        if (assignments.length > 0) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              {assignments.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openQuickCC(r, a)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  title={`Click to edit CC for ${r.name} - ${a.division_name ? `Div ${a.division_name}` : 'Entire Batch'}`}
                >
                  <span className="status-badge status-badge--active" style={{
                    fontSize: '0.82rem',
                    padding: '5px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: 8,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}>
                    <span className="status-badge__dot" />
                    <strong>👨‍🏫 {a.faculty_name}</strong>
                    <span style={{
                      fontSize: '0.73rem',
                      background: a.division_name ? 'var(--color-primary-light, #e0f5f6)' : '#f1f5f9',
                      color: a.division_name ? 'var(--color-primary-dark, #00838c)' : '#334155',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 700,
                      border: '1px solid ' + (a.division_name ? 'rgba(0,169,180,0.3)' : '#cbd5e1'),
                    }}>
                      {a.division_name ? `${r.name} • Div ${a.division_name}` : `${r.name} (Entire Batch)`}
                    </span>
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '2px 8px', fontSize: '0.72rem', borderRadius: 4, marginTop: 2 }}
                onClick={() => openQuickCC(r)}
                title="Assign another CC to this batch or division"
              >
                + Add / Manage CC
              </button>
            </div>
          );
        }

        return (
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
            onClick={() => openQuickCC(r)}
            title={`Assign CC to batch ${r.name}`}
          >
            + Assign CC
          </button>
        );
      },
    },
    { key: 'is_active', label: 'Status', render: r => <StatusBadge active={r.is_active} /> },
  ];

  return (
    <AdminPage
      title="Batches"
      subtitle="Manage student cohort batches per department and assign Class Coordinators (CC)"
      action={<button className="btn-primary" onClick={openCreate}>+ Add Batch</button>}
      toolbar={
        <>
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search batches…" />
          <select className="filter-select" value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1); }}>
            <option value="">All Departments</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </>
      }
    >
      {apiError && <div style={{ color: 'var(--admin-danger)', fontSize: '0.875rem', padding: '8px 0' }}>⚠️ {apiError}</div>}
      {successMsg && (
        <div style={{
          color: 'var(--admin-success)',
          fontSize: '0.875rem',
          padding: '8px 16px',
          background: 'rgba(34,197,94,0.08)',
          borderRadius: 8,
          border: '1px solid rgba(34,197,94,0.2)',
          marginBottom: 12
        }}>
          ✓ {successMsg}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data.rows}
        loading={loading}
        sortBy="name"
        sortDir="asc"
        onSort={() => {}}
        emptyMessage="No batches found"
        actions={r => (
          <>
            <button className="btn-icon" onClick={() => openQuickCC(r)} title="Assign / Reassign CC">👨‍🏫</button>
            <button className="btn-icon" onClick={() => openEdit(r)} title="Edit Batch">✏️</button>
            <button className="btn-danger" onClick={() => setDel(r)} title="Delete Batch">🗑</button>
          </>
        )}
      />
      <Pagination {...data} onPageChange={setPage} />

      {/* Main Add / Edit Batch Dialog */}
      <Dialog
        open={dialogOpen}
        title={editing ? 'Edit Batch' : 'Add Batch'}
        onClose={close}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={close} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        {apiError && <p style={{ color: 'var(--admin-danger)', fontSize: '0.8125rem', margin: '0 0 12px 0' }}>{apiError}</p>}
        <FormField
          label="Batch Name"
          required
          error={formError.name}
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. 2021-25"
        />
        <FormField
          label="Department"
          required
          type="select"
          error={formError.departmentId}
          value={form.departmentId}
          onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
        >
          <option value="">Select department</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </FormField>
        <FormField
          label="Academic Year"
          required
          type="select"
          error={formError.academicYearId}
          value={form.academicYearId}
          onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))}
        >
          <option value="">Select academic year</option>
          {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
        </FormField>

        {/* CC Assignment dropdown from existing department & faculty */}
        <FormField
          label="Assign Class Coordinator (CC)"
          type="select"
          value={form.ccFacultyId || ''}
          onChange={e => setForm(f => ({ ...f, ccFacultyId: e.target.value }))}
        >
          <option value="">— No CC Assigned (Optional) —</option>
          {filteredFaculty.map(f => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.designation || 'Faculty'}{f.employee_id ? ` • ID: ${f.employee_id}` : ''})
            </option>
          ))}
        </FormField>
        <p style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '-8px', marginBottom: '14px' }}>
          {form.departmentId
            ? 'Faculty list is filtered to the selected department.'
            : 'Select a department above to filter faculty.'}
        </p>

        {editing && (
          <FormField
            label="Status"
            type="select"
            value={form.isActive}
            onChange={e => setForm(f => ({ ...f, isActive: Number(e.target.value) }))}
          >
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </FormField>
        )}
      </Dialog>

      {/* Quick CC Assignment Dialog */}
      <Dialog
        open={Boolean(ccModalBatch)}
        title={`Class Coordinator (CC) — Batch ${ccModalBatch?.name || ''}`}
        onClose={closeQuickCC}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={closeQuickCC} disabled={savingCc}>
              Cancel
            </button>
            {ccModalBatch?.cc_faculty_id && (
              <button
                type="button"
                className="btn-danger"
                style={{ marginRight: 'auto' }}
                disabled={savingCc}
                onClick={async () => {
                  setSavingCc(true);
                  try {
                    await masterApi.ccAssignments.remove(ccModalBatch.cc_assignment_id);
                    showSuccess(`Removed CC for batch ${ccModalBatch.name}.`);
                    closeQuickCC();
                    fetch();
                  } catch (e) {
                    setApiError(e?.response?.data?.error?.message || 'Failed to remove CC.');
                  } finally {
                    setSavingCc(false);
                  }
                }}
              >
                Remove CC
              </button>
            )}
            <button className="btn-primary" onClick={saveQuickCC} disabled={savingCc}>
              {savingCc ? 'Saving…' : 'Save Assignment'}
            </button>
          </>
        }
      >
        {apiError && <p style={{ color: 'var(--admin-danger)', fontSize: '0.8125rem', margin: '0 0 12px 0' }}>{apiError}</p>}
        <div style={{ marginBottom: '14px', fontSize: '0.85rem', color: 'var(--admin-text-muted)', lineHeight: '1.6' }}>
          <div>Batch: <strong style={{ color: 'var(--admin-text)' }}>{ccModalBatch?.name}</strong></div>
          <div>Department: <strong style={{ color: 'var(--admin-text)' }}>{ccModalBatch?.department_name}</strong></div>
          <div>Academic Year: <strong style={{ color: 'var(--admin-text)' }}>{ccModalBatch?.academic_year_name}</strong></div>
        </div>

        {/* Currently assigned CCs list */}
        {ccModalBatch?.cc_assignments && ccModalBatch.cc_assignments.length > 0 && (
          <div style={{
            marginBottom: '16px',
            background: 'var(--admin-surface, #f8fafc)',
            border: '1px solid var(--admin-border, #e2e8f0)',
            borderRadius: 8,
            padding: '12px',
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--admin-text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Current Coordinators ({ccModalBatch.cc_assignments.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ccModalBatch.cc_assignments.map(a => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: '#fff',
                    borderRadius: 6,
                    border: '1px solid var(--admin-border, #e2e8f0)',
                    fontSize: '0.825rem',
                  }}
                >
                  <div>
                    <strong>👨‍🏫 {a.faculty_name}</strong>
                    <span style={{
                      marginLeft: 8,
                      fontSize: '0.72rem',
                      background: a.division_name ? 'var(--color-primary-light, #e0f5f6)' : '#f1f5f9',
                      color: a.division_name ? 'var(--color-primary-dark, #00838c)' : '#475569',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 600,
                    }}>
                      {a.division_name ? `Div ${a.division_name}` : 'Entire Batch'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn-icon"
                      style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                      onClick={() => {
                        setSelectedCcDivId(a.division_id ? String(a.division_id) : '');
                        setSelectedCcId(String(a.faculty_id));
                      }}
                      title="Edit this assignment"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                      onClick={() => removeSpecificCC(a.id)}
                      title="Remove this coordinator"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <FormField
          label="Target Scope (Batch / Division)"
          type="select"
          value={selectedCcDivId}
          onChange={e => {
            const divId = e.target.value;
            setSelectedCcDivId(divId);
            if (!divId) {
              setSelectedCcId(ccModalBatch?.cc_faculty_id ? String(ccModalBatch.cc_faculty_id) : '');
            } else {
              const dObj = divisions.find(d => String(d.id) === String(divId));
              setSelectedCcId(dObj?.cc_faculty_id ? String(dObj.cc_faculty_id) : '');
            }
          }}
        >
          <option value="">Entire Batch (All Divisions)</option>
          {divisions
            .filter(d => d.batch_id === ccModalBatch?.id)
            .map(d => (
              <option key={d.id} value={d.id}>
                Division {d.name} {d.semester_number ? `(Sem ${d.semester_number})` : ''}
              </option>
            ))}
        </FormField>

        <FormField
          label="Select Faculty Member as CC"
          type="select"
          value={selectedCcId}
          onChange={e => setSelectedCcId(e.target.value)}
        >
          <option value="">— Unassign CC / None —</option>
          {faculty
            .filter(f => !ccModalBatch?.department_id || !f.department_id || String(f.department_id) === String(ccModalBatch.department_id))
            .map(f => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.designation || 'Faculty'}{f.employee_id ? ` • ID: ${f.employee_id}` : ''})
              </option>
            ))}
        </FormField>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(del)}
        title="Delete Batch"
        message={`Delete batch "${del?.name}"? Students linked to this batch may be affected.`}
        onConfirm={doDelete}
        onCancel={() => setDel(null)}
        loading={deleting}
      />
    </AdminPage>
  );
}
