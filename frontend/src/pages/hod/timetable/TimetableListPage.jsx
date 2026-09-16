import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import timetableApi from '../../../api/timetableApi';
import masterApi from '../../../api/masterApi';
import '../../../styles/timetable.css';

export default function TimetableListPage() {
  const navigate = useNavigate();

  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedAy, setSelectedAy] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [selectedDiv, setSelectedDiv] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals
  const [showInitialsModal, setShowInitialsModal] = useState(false);
  const [initialsList, setInitialsList] = useState([]);
  const [initialForm, setInitialForm] = useState({ initials: '', facultyName: '' });

  // Manual Timetable Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    academicYearId: '',
    semesterId: '',
    divisionId: '',
    name: '',
    notes: '',
  });
  const [manualError, setManualError] = useState(null);
  const [creatingManual, setCreatingManual] = useState(false);

  useEffect(() => {
    loadDropdowns();
  }, []);

  useEffect(() => {
    loadTimetables();
  }, [selectedAy, selectedSem, selectedDiv, selectedStatus]);

  async function loadDropdowns() {
    try {
      const [ayRes, semRes, divRes] = await Promise.all([
        masterApi.academicYears.list({ limit: 50 }),
        masterApi.semesters.list({ limit: 50 }),
        masterApi.divisions.list({ limit: 100 }),
      ]);
      setAcademicYears(ayRes.data?.data?.rows || []);
      setSemesters(semRes.data?.data?.rows || []);
      setDivisions(divRes.data?.data?.rows || []);
    } catch (err) {
      console.warn('Failed to load filter dropdowns:', err);
    }
  }

  async function loadTimetables() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedAy) params.academicYearId = selectedAy;
      if (selectedSem) params.semesterId = selectedSem;
      if (selectedDiv) params.divisionId = selectedDiv;
      if (selectedStatus) params.status = selectedStatus;

      const res = await timetableApi.list(params);
      setTimetables(res.data?.data?.rows || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load timetables.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(tt) {
    const newStatus = tt.status === 'active' ? 'archived' : 'active';
    try {
      await timetableApi.update(tt.id, { status: newStatus });
      loadTimetables();
    } catch (err) {
      alert('Failed to update status: ' + (err.response?.data?.error?.message || err.message));
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this timetable and all its slots?')) return;
    try {
      await timetableApi.delete(id);
      loadTimetables();
    } catch (err) {
      alert('Failed to delete timetable: ' + (err.response?.data?.error?.message || err.message));
    }
  }

  async function openInitialsModal() {
    setShowInitialsModal(true);
    try {
      const res = await timetableApi.getInitials();
      setInitialsList(res.data?.data || []);
    } catch (err) {
      console.warn(err);
    }
  }

  async function handleSaveInitial(e) {
    e.preventDefault();
    if (!initialForm.initials.trim()) return;
    try {
      await timetableApi.upsertInitial(initialForm);
      setInitialForm({ initials: '', facultyName: '' });
      const res = await timetableApi.getInitials();
      setInitialsList(res.data?.data || []);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message);
    }
  }

  async function handleDeleteInitial(id) {
    try {
      await timetableApi.deleteInitial(id);
      const res = await timetableApi.getInitials();
      setInitialsList(res.data?.data || []);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message);
    }
  }

  const openCreateManualModal = () => {
    const defaultAy = selectedAy || (academicYears[0]?.id || '');
    const defaultSem = selectedSem || (semesters[0]?.id || '');
    const matchingDivs = defaultSem
      ? divisions.filter(d => String(d.semester_id) === String(defaultSem))
      : [];
    const defaultDiv = matchingDivs[0]?.id || '';
    const semObj = semesters.find(s => String(s.id) === String(defaultSem));
    const divObj = matchingDivs.find(d => String(d.id) === String(defaultDiv));
    const defaultTitle = semObj && divObj
      ? `Semester ${semObj.number} - ${divObj.name}`
      : (semObj ? `Semester ${semObj.number}` : '');

    setManualForm({
      academicYearId: defaultAy,
      semesterId: defaultSem,
      divisionId: defaultDiv,
      name: defaultTitle,
      notes: '',
    });
    setManualError(null);
    setShowManualModal(true);
  };

  const handleManualSemChange = (semId) => {
    const matchingDivs = semId
      ? divisions.filter(d => String(d.semester_id) === String(semId))
      : [];
    const firstDivId = matchingDivs[0]?.id || '';
    const semObj = semesters.find(s => String(s.id) === String(semId));
    const divObj = matchingDivs.find(d => String(d.id) === String(firstDivId));
    const defaultTitle = semObj && divObj
      ? `Semester ${semObj.number} - ${divObj.name}`
      : (semObj ? `Semester ${semObj.number}` : '');

    setManualForm(prev => ({
      ...prev,
      semesterId: semId,
      divisionId: firstDivId,
      name: defaultTitle,
    }));
  };

  const handleManualDivChange = (divId) => {
    const semObj = semesters.find(s => String(s.id) === String(manualForm.semesterId));
    const divObj = divisions.find(d => String(d.id) === String(divId));
    const defaultTitle = semObj && divObj
      ? `Semester ${semObj.number} - ${divObj.name}`
      : (semObj ? `Semester ${semObj.number}` : '');

    setManualForm(prev => ({
      ...prev,
      divisionId: divId,
      name: defaultTitle,
    }));
  };

  async function handleCreateManual(e) {
    e.preventDefault();
    if (!manualForm.academicYearId || !manualForm.semesterId || !manualForm.divisionId) {
      setManualError('Academic Year, Semester, and Division are all required.');
      return;
    }

    setCreatingManual(true);
    setManualError(null);

    try {
      const semObj = semesters.find(s => String(s.id) === String(manualForm.semesterId));
      const divObj = divisions.find(d => String(d.id) === String(manualForm.divisionId));
      const autoTitle = semObj && divObj ? `Semester ${semObj.number} - ${divObj.name}` : undefined;

      const res = await timetableApi.createManual({
        academicYearId: parseInt(manualForm.academicYearId, 10),
        semesterId: parseInt(manualForm.semesterId, 10),
        divisionId: parseInt(manualForm.divisionId, 10),
        name: manualForm.name.trim() || autoTitle,
        notes: manualForm.notes.trim() || undefined,
      });

      setShowManualModal(false);
      const newId = res.data?.data?.id;
      if (newId) {
        navigate(`/hod/admin/timetables/${newId}`);
      } else {
        loadTimetables();
      }
    } catch (err) {
      setManualError(err.response?.data?.error?.message || err.message || 'Failed to create timetable.');
    } finally {
      setCreatingManual(false);
    }
  }

  return (
    <div className="tt-container">
      {/* Header */}
      <div className="tt-header">
        <div className="tt-title-group">
          <h1>⏱️ Timetable Management</h1>
          <p className="tt-subtitle">
            Upload, manage, and analyze university academic timetables across semesters and divisions.
          </p>
        </div>
        <div className="tt-header-actions">
          <button
            type="button"
            className="tt-btn tt-btn-secondary"
            onClick={openInitialsModal}
          >
            🏷️ Faculty Initials Map
          </button>
          <button
            type="button"
            className="tt-btn tt-btn-secondary"
            onClick={openCreateManualModal}
          >
            ➕ Create Timetable Manually
          </button>
          <Link to="/hod/admin/timetables/import" className="tt-btn tt-btn-primary">
            📤 Import Timetable
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="tt-filter-bar">
        <div className="tt-filter-item">
          <label>Academic Year</label>
          <select
            className="tt-filter-select"
            value={selectedAy}
            onChange={e => setSelectedAy(e.target.value)}
          >
            <option value="">All Academic Years</option>
            {academicYears.map(ay => (
              <option key={ay.id} value={ay.id}>{ay.year_name || ay.label}</option>
            ))}
          </select>
        </div>

        <div className="tt-filter-item">
          <label>Semester</label>
          <select
            className="tt-filter-select"
            value={selectedSem}
            onChange={e => setSelectedSem(e.target.value)}
          >
            <option value="">All Semesters</option>
            {semesters.map(s => (
              <option key={s.id} value={s.id}>Semester {s.number}</option>
            ))}
          </select>
        </div>

        <div className="tt-filter-item">
          <label>Division</label>
          <select
            className="tt-filter-select"
            value={selectedDiv}
            onChange={e => setSelectedDiv(e.target.value)}
          >
            <option value="">All Divisions</option>
            {divisions
              .filter(d => !selectedSem || String(d.semester_id) === String(selectedSem))
              .map(d => (
                <option key={d.id} value={d.id}>Div {d.name} {d.semester_number ? `(Sem ${d.semester_number})` : ''}</option>
              ))}
          </select>
        </div>

        <div className="tt-filter-item">
          <label>Status</label>
          <select
            className="tt-filter-select"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="archived">Archived</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {(selectedAy || selectedSem || selectedDiv || selectedStatus) && (
          <button
            type="button"
            className="tt-btn tt-btn-secondary"
            style={{ alignSelf: 'flex-end', height: '40px' }}
            onClick={() => {
              setSelectedAy('');
              setSelectedSem('');
              setSelectedDiv('');
              setSelectedStatus('');
            }}
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="tt-alert tt-alert-danger">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Timetables Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
          Loading timetables...
        </div>
      ) : timetables.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '64px 20px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid var(--color-border)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📅</div>
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-text)' }}>No Timetables Found</h3>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto 20px' }}>
            There are no timetables matching your filter. Click below to import a timetable from PDF, Excel, or Image.
          </p>
          <Link to="/hod/admin/timetables/import" className="tt-btn tt-btn-primary">
            📤 Import First Timetable
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '16px' }}>
          {timetables.map(tt => (
            <div
              key={tt.id}
              style={{
                background: '#fff',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                    {tt.academic_year_name || 'Academic Year'}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span className="tt-badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                      v{tt.version}
                    </span>
                    <span className={`tt-badge tt-badge-${tt.status}`}>
                      {tt.status}
                    </span>
                  </div>
                </div>

                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', color: 'var(--color-text)' }}>
                  {tt.division_name 
                    ? `Semester ${tt.semester_number} - ${tt.division_name}` 
                    : (tt.file_name?.includes('Semester') ? tt.file_name : `Semester ${tt.semester_number}`)}
                </h3>

                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0 0 16px 0' }}>
                  {tt.file_name && tt.file_name !== `Semester ${tt.semester_number} - ${tt.division_name}`
                    ? `File: ${tt.file_name} (${tt.source_format?.toUpperCase() || 'FILE'})`
                    : `Format: ${tt.source_format?.toUpperCase() || 'MANUAL'}`}
                </p>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  background: 'var(--color-surface)',
                  padding: '10px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {tt.total_entries || 0}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Slots
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {tt.distinct_subjects || 0}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Subjects
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {tt.distinct_faculty || 0}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Faculty
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--color-border)', paddingTop: '14px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="tt-btn tt-btn-primary"
                  style={{ flex: 1, padding: '7px 12px', fontSize: '0.82rem', justifyContent: 'center' }}
                  onClick={() => navigate(`/hod/admin/timetables/${tt.id}`)}
                >
                  View Schedule
                </button>
                <button
                  type="button"
                  className="tt-btn tt-btn-secondary"
                  style={{ padding: '7px 12px', fontSize: '0.82rem' }}
                  onClick={() => handleToggleStatus(tt)}
                  title={tt.status === 'active' ? 'Archive Timetable' : 'Set as Active'}
                >
                  {tt.status === 'active' ? 'Archive' : 'Activate'}
                </button>
                <button
                  type="button"
                  className="tt-btn tt-btn-danger"
                  style={{ padding: '7px 10px', fontSize: '0.82rem' }}
                  onClick={() => handleDelete(tt.id)}
                  title="Delete Timetable"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Faculty Initials Modal */}
      {showInitialsModal && (
        <div className="tt-modal-overlay" onClick={() => setShowInitialsModal(false)}>
          <div className="tt-modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text)' }}>
                🏷️ Faculty Initials Mapping
              </h3>
              <button
                onClick={() => setShowInitialsModal(false)}
                style={{ border: 'none', background: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '0 0 16px 0' }}>
              Map timetable abbreviations (e.g. BKP, DG, SK) to faculty members so lectures are automatically assigned.
            </p>

            <form onSubmit={handleSaveInitial} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Initials (e.g. BKP)"
                className="tt-input"
                style={{ width: '130px', textTransform: 'uppercase' }}
                value={initialForm.initials}
                onChange={e => setInitialForm({ ...initialForm, initials: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Faculty Name (e.g. Dr. Bimal Patel)"
                className="tt-input"
                style={{ flex: 1 }}
                value={initialForm.facultyName}
                onChange={e => setInitialForm({ ...initialForm, facultyName: e.target.value })}
              />
              <button type="submit" className="tt-btn tt-btn-primary">
                Add
              </button>
            </form>

            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Initial</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Faculty Name</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {initialsList.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                        No initials mapped yet.
                      </td>
                    </tr>
                  ) : (
                    initialsList.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                          {item.initials}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {item.faculty_name || item.faculty_user_name || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteInitial(item.id)}
                            style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button className="tt-btn tt-btn-secondary" onClick={() => setShowInitialsModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Timetable Creation Modal */}
      {showManualModal && (
        <div className="tt-modal-overlay" onClick={() => setShowManualModal(false)}>
          <div className="tt-modal-box" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text)' }}>
                ➕ Create Timetable Manually
              </h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                style={{ border: 'none', background: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            {manualError && (
              <div className="tt-alert tt-alert-danger" style={{ marginBottom: '14px', padding: '10px' }}>
                <span>⚠️ {manualError}</span>
              </div>
            )}

            <form onSubmit={handleCreateManual}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Academic Year *
                  </label>
                  <select
                    className="tt-input"
                    style={{ width: '100%' }}
                    value={manualForm.academicYearId}
                    onChange={e => setManualForm({ ...manualForm, academicYearId: e.target.value })}
                    required
                  >
                    <option value="">Select Academic Year</option>
                    {academicYears.map(ay => (
                      <option key={ay.id} value={ay.id}>{ay.year_name || ay.label || ay.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Semester *
                  </label>
                  <select
                    className="tt-input"
                    style={{ width: '100%' }}
                    value={manualForm.semesterId}
                    onChange={e => handleManualSemChange(e.target.value)}
                    required
                  >
                    <option value="">Select Semester</option>
                    {semesters.map(s => (
                      <option key={s.id} value={s.id}>Semester {s.number}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Division *
                  </label>
                  <select
                    className="tt-input"
                    style={{ width: '100%' }}
                    value={manualForm.divisionId}
                    onChange={e => handleManualDivChange(e.target.value)}
                    required
                    disabled={!manualForm.semesterId}
                  >
                    <option value="">
                      {!manualForm.semesterId ? 'Select a semester first...' : 'Select Division'}
                    </option>
                    {divisions
                      .filter(d => String(d.semester_id) === String(manualForm.semesterId))
                      .map(d => (
                        <option key={d.id} value={d.id}>Division {d.name}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Timetable Title
                  </label>
                  <input
                    type="text"
                    className="tt-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Semester 5 - EK1"
                    value={manualForm.name}
                    onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Notes / Description (Optional)
                  </label>
                  <textarea
                    className="tt-input"
                    style={{ width: '100%', height: '70px', padding: '8px 12px', resize: 'vertical' }}
                    placeholder="e.g. Regular semester timetable manually constructed"
                    value={manualForm.notes}
                    onChange={e => setManualForm({ ...manualForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="tt-btn tt-btn-secondary"
                  onClick={() => setShowManualModal(false)}
                  disabled={creatingManual}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tt-btn tt-btn-primary"
                  disabled={creatingManual}
                >
                  {creatingManual ? 'Creating...' : 'Create & Open Builder →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
