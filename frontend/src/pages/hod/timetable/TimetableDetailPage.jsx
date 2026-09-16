import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import timetableApi from '../../../api/timetableApi';
import masterApi from '../../../api/masterApi';
import TimetableGrid from '../../../components/timetable/TimetableGrid';
import TimetableDayColumnView from '../../../components/timetable/TimetableDayColumnView';
import '../../../styles/timetable.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetableDetailPage() {
  const { id } = useParams();

  const [timetable, setTimetable] = useState(null);
  const [entries, setEntries] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState('columns'); // 'columns' as primary default
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Master lists for modal dropdowns
  const [subjectsList, setSubjectsList] = useState([]);
  const [facultyList, setFacultyList] = useState([]);

  // Slot modal state
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [slotForm, setSlotForm] = useState({
    day: 'Monday',
    startTime: '07:30',
    endTime: '09:00',
    subjectId: '',
    subjectCodeRaw: '',
    subjectNameRaw: '',
    facultyId: '',
    facultyInitial: '',
    room: '',
    entryType: 'lecture',
    batchGroup: 'ALL',
  });
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotError, setSlotError] = useState(null);

  useEffect(() => {
    loadData();
    loadDropdowns();
  }, [id]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await timetableApi.getById(id);
      setTimetable(res.data?.data?.timetable);
      setEntries(res.data?.data?.entries || []);
      setAnalysis(res.data?.data?.analysis);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load timetable details.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDropdowns() {
    try {
      const [subRes, facRes] = await Promise.all([
        masterApi.subjects.list({ limit: 100 }).catch(() => ({ data: { data: { rows: [] } } })),
        masterApi.faculty.allActive ? masterApi.faculty.allActive().catch(() => ({ data: { data: [] } })) : masterApi.faculty.list({ limit: 100 }).catch(() => ({ data: { data: { rows: [] } } })),
      ]);

      const subs = subRes.data?.data?.rows || subRes.data?.data || [];
      const facs = Array.isArray(facRes.data?.data) ? facRes.data.data : (facRes.data?.data?.rows || []);

      setSubjectsList(subs);
      setFacultyList(facs);
    } catch (err) {
      console.warn('Error fetching dropdowns:', err);
    }
  }

  function openAddModal(day = 'Monday') {
    setEditingSlotId(null);
    setSlotForm({
      day: day || 'Monday',
      startTime: '07:30',
      endTime: '09:00',
      subjectId: '',
      subjectCodeRaw: '',
      subjectNameRaw: '',
      facultyId: '',
      facultyInitial: '',
      room: '',
      entryType: 'lecture',
      batchGroup: 'ALL',
    });
    setSlotError(null);
    setShowSlotModal(true);
  }

  function openEditModal(slot) {
    setEditingSlotId(slot.id);
    setSlotForm({
      day: slot.day || 'Monday',
      startTime: slot.start_time || slot.startTime || '07:30',
      endTime: slot.end_time || slot.endTime || '09:00',
      subjectId: slot.subject_id || slot.subjectId || '',
      subjectCodeRaw: slot.subject_code_raw || slot.subjectCodeRaw || slot.subject_code || '',
      subjectNameRaw: slot.subject_name_raw || slot.subjectNameRaw || slot.subject_name || '',
      facultyId: slot.faculty_id || slot.facultyId || '',
      facultyInitial: slot.faculty_initial || slot.facultyInitial || '',
      room: slot.room || '',
      entryType: slot.entry_type || slot.entryType || 'lecture',
      batchGroup: slot.batch_group || slot.batchGroup || 'ALL',
    });
    setSlotError(null);
    setShowSlotModal(true);
  }

  async function handleSaveSlot(e) {
    e.preventDefault();
    setSavingSlot(true);
    setSlotError(null);

    try {
      // Find subject name/code if an ID was selected
      let finalSubjectCode = slotForm.subjectCodeRaw;
      let finalSubjectName = slotForm.subjectNameRaw;
      if (slotForm.subjectId) {
        const sub = subjectsList.find(s => String(s.id) === String(slotForm.subjectId));
        if (sub) {
          finalSubjectCode = sub.code || sub.name;
          finalSubjectName = sub.name;
        }
      }

      // Find faculty name/initial if an ID was selected
      let finalFacultyInitial = slotForm.facultyInitial;
      if (slotForm.facultyId) {
        const fac = facultyList.find(f => String(f.id) === String(slotForm.facultyId));
        if (fac) {
          finalFacultyInitial = fac.initials || fac.name?.split(' ').map(n => n[0]).join('') || '';
        }
      }

      const payload = {
        day: slotForm.day,
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        subjectId: slotForm.subjectId ? parseInt(slotForm.subjectId, 10) : null,
        subjectCodeRaw: finalSubjectCode,
        subjectNameRaw: finalSubjectName,
        facultyId: slotForm.facultyId ? parseInt(slotForm.facultyId, 10) : null,
        facultyInitial: finalFacultyInitial,
        room: slotForm.room || null,
        entryType: slotForm.entryType,
        batchGroup: slotForm.batchGroup,
      };

      if (editingSlotId) {
        await timetableApi.updateSlot(id, editingSlotId, payload);
      } else {
        await timetableApi.addSlot(id, payload);
      }

      setShowSlotModal(false);
      await loadData();
    } catch (err) {
      setSlotError(err.response?.data?.error?.message || err.message || 'Failed to save slot.');
    } finally {
      setSavingSlot(false);
    }
  }

  async function handleDeleteSlot(slot) {
    const timeLabel = `${slot.start_time || slot.startTime} - ${slot.end_time || slot.endTime}`;
    const subLabel = slot.subject_name || slot.subject_code || slot.subject_code_raw || 'this class';
    if (!window.confirm(`Delete ${slot.day} ${timeLabel} (${subLabel})?`)) return;

    try {
      await timetableApi.deleteSlot(id, slot.id);
      await loadData();
    } catch (err) {
      alert('Failed to delete slot: ' + (err.response?.data?.error?.message || err.message));
    }
  }

  if (loading) {
    return (
      <div className="tt-container" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading timetable details...</p>
      </div>
    );
  }

  if (error || !timetable) {
    return (
      <div className="tt-container">
        <div className="tt-alert tt-alert-danger">
          <span>⚠️ {error || 'Timetable not found.'}</span>
        </div>
        <Link to="/hod/admin/timetables" className="tt-btn tt-btn-secondary">
          ← Back to Timetables
        </Link>
      </div>
    );
  }

  return (
    <div className="tt-container">
      {/* Header */}
      <div className="tt-header">
        <div className="tt-title-group">
          <h1>
            {timetable.division_name 
              ? `Semester ${timetable.semester_number} - ${timetable.division_name}` 
              : (timetable.file_name?.includes('Semester') ? timetable.file_name : `Semester ${timetable.semester_number}`)}
          </h1>
          <p className="tt-subtitle">
            {timetable.academic_year_name} | Version {timetable.version} | Format: {timetable.source_format?.toUpperCase() || 'MANUAL'} | Total: {entries.length} Classes
          </p>
        </div>
        <div className="tt-header-actions">
          <button
            type="button"
            className="tt-btn tt-btn-primary"
            onClick={() => openAddModal('Monday')}
          >
            ➕ Add Class
          </button>
          <span className={`tt-badge tt-badge-${timetable.status}`}>
            {timetable.status.toUpperCase()}
          </span>
          <Link to="/hod/admin/timetables" className="tt-btn tt-btn-secondary">
            ← All Timetables
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="tt-tab-bar">
        <button
          type="button"
          className={`tt-tab-btn ${activeTab === 'columns' ? 'active' : ''}`}
          onClick={() => setActiveTab('columns')}
        >
          📅 Day Columns (Chronological Sort)
        </button>
        <button
          type="button"
          className={`tt-tab-btn ${activeTab === 'grid' ? 'active' : ''}`}
          onClick={() => setActiveTab('grid')}
        >
          🗓️ Schedule Matrix Grid
        </button>
        <button
          type="button"
          className={`tt-tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          📊 Weekly Analysis
        </button>
        <button
          type="button"
          className={`tt-tab-btn ${activeTab === 'slots' ? 'active' : ''}`}
          onClick={() => setActiveTab('slots')}
        >
          📋 Slot List ({entries.length})
        </button>
      </div>

      {/* Tab 1: Day Column View (Chronological Sort by Time) */}
      {activeTab === 'columns' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
              Classes in each day column are automatically arranged <strong>chronologically by start time</strong> (Row 1 is earliest, Row 2 next, etc.).
            </span>
            <button
              type="button"
              className="tt-btn tt-btn-secondary"
              style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              onClick={() => openAddModal('Monday')}
            >
              + Quick Add Class
            </button>
          </div>
          <TimetableDayColumnView
            entries={entries}
            onAddSlot={(day) => openAddModal(day)}
            onEditSlot={(slot) => openEditModal(slot)}
            onDeleteSlot={(slot) => handleDeleteSlot(slot)}
            canEdit={true}
          />
        </div>
      )}

      {/* Tab 2: Matrix Grid */}
      {activeTab === 'grid' && (
        <TimetableGrid entries={entries} />
      )}

      {/* Tab 3: Weekly Analysis */}
      {activeTab === 'analysis' && analysis && (
        <div>
          {/* Summary Stat Grid */}
          <div className="tt-stat-grid">
            <div className="tt-stat-card">
              <span className="tt-stat-label">Total Slots</span>
              <span className="tt-stat-val">{entries.length}</span>
              <span className="tt-stat-desc">Weekly scheduled entries</span>
            </div>
            <div className="tt-stat-card">
              <span className="tt-stat-label">Total Hours</span>
              <span className="tt-stat-val">
                {(entries.reduce((acc, e) => acc + (e.duration_minutes || 55), 0) / 60).toFixed(1)} hrs
              </span>
              <span className="tt-stat-desc">Combined teaching hours</span>
            </div>
            <div className="tt-stat-card">
              <span className="tt-stat-label">Subjects</span>
              <span className="tt-stat-val">{analysis.subjectStats?.length || 0}</span>
              <span className="tt-stat-desc">Distinct subjects taught</span>
            </div>
            <div className="tt-stat-card">
              <span className="tt-stat-label">Faculty</span>
              <span className="tt-stat-val">{analysis.facultyStats?.length || 0}</span>
              <span className="tt-stat-desc">Allocated faculty</span>
            </div>
          </div>

          {/* Subject Wise Table */}
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--color-text)' }}>
              Subject-wise Weekly Lecture & Lab Distribution
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Subject</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Code</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>Lectures</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>Labs</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>Total Slots</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Hours/Week</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.subjectStats?.map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{s.subject_name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)' }}>{s.subject_code}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>{s.lecture_count || 0}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>{s.lab_count || 0}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{s.total_lectures}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                        {s.total_hours} hrs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Faculty Wise Table */}
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--color-text)' }}>
              Faculty Weekly Workload (This Timetable)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Faculty</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Initial</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>Total Slots</th>
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.facultyStats?.map((f, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{f.faculty_name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)' }}>{f.faculty_initial || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{f.total_lectures}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                        {f.total_hours} hrs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Slots Table */}
      {activeTab === 'slots' && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Day</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Time</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Subject</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Faculty</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Room</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Batch</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>Type</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{e.day}</td>
                  <td style={{ padding: '10px 14px' }}>{e.start_time} - {e.end_time}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600 }}>{e.subject_code || e.subject_code_raw}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{e.subject_name || e.subject_name_raw}</div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div>{e.faculty_name || e.faculty_initial || '—'}</div>
                    {e.faculty_email && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{e.faculty_email}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>{e.room || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span className="tt-chip-batch" style={{ padding: '2px 8px' }}>
                      {e.batch_group || 'ALL'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>{e.entry_type}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="tt-btn tt-btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.75rem', marginRight: '6px' }}
                      onClick={() => openEditModal(e)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className="tt-btn tt-btn-danger"
                      style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                      onClick={() => handleDeleteSlot(e)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Slot Modal */}
      {showSlotModal && (
        <div className="tt-modal-overlay" onClick={() => setShowSlotModal(false)}>
          <div className="tt-modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text)' }}>
                {editingSlotId ? '✏️ Edit Class Slot' : '➕ Add Class to Timetable'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSlotModal(false)}
                style={{ border: 'none', background: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            {slotError && (
              <div className="tt-alert tt-alert-danger" style={{ marginBottom: '14px', padding: '10px' }}>
                <span>⚠️ {slotError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSlot}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Day Selection */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Day of the Week *
                  </label>
                  <select
                    className="tt-input"
                    style={{ width: '100%' }}
                    value={slotForm.day}
                    onChange={e => setSlotForm({ ...slotForm, day: e.target.value })}
                    required
                  >
                    {DAYS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Start & End Time */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Start Time * (e.g. 07:30 or 7:30 AM)
                  </label>
                  <input
                    type="text"
                    className="tt-input"
                    style={{ width: '100%' }}
                    placeholder="07:30 AM"
                    value={slotForm.startTime}
                    onChange={e => setSlotForm({ ...slotForm, startTime: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    End Time * (e.g. 09:00 or 9:00 AM)
                  </label>
                  <input
                    type="text"
                    className="tt-input"
                    style={{ width: '100%' }}
                    placeholder="09:00 AM"
                    value={slotForm.endTime}
                    onChange={e => setSlotForm({ ...slotForm, endTime: e.target.value })}
                    required
                  />
                </div>

                {/* Subject Selection / Manual Input */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Subject *
                  </label>
                  {subjectsList.length > 0 ? (
                    <select
                      className="tt-input"
                      style={{ width: '100%', marginBottom: '8px' }}
                      value={slotForm.subjectId}
                      onChange={e => {
                        const sId = e.target.value;
                        const sub = subjectsList.find(s => String(s.id) === String(sId));
                        setSlotForm({
                          ...slotForm,
                          subjectId: sId,
                          subjectCodeRaw: sub ? (sub.code || sub.name) : '',
                          subjectNameRaw: sub ? sub.name : '',
                        });
                      }}
                    >
                      <option value="">-- Choose from Master Subjects or Type Below --</option>
                      {subjectsList.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.code ? `[${s.code}] ` : ''}{s.name}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                    <input
                      type="text"
                      className="tt-input"
                      placeholder="Subject Code (e.g. ICT701)"
                      value={slotForm.subjectCodeRaw}
                      onChange={e => setSlotForm({ ...slotForm, subjectCodeRaw: e.target.value })}
                    />
                    <input
                      type="text"
                      className="tt-input"
                      placeholder="Subject Name (e.g. Distributed Systems)"
                      value={slotForm.subjectNameRaw}
                      onChange={e => setSlotForm({ ...slotForm, subjectNameRaw: e.target.value })}
                    />
                  </div>
                </div>

                {/* Faculty Selection / Manual Input */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Faculty
                  </label>
                  {facultyList.length > 0 ? (
                    <select
                      className="tt-input"
                      style={{ width: '100%', marginBottom: '8px' }}
                      value={slotForm.facultyId}
                      onChange={e => {
                        const fId = e.target.value;
                        const fac = facultyList.find(f => String(f.id) === String(fId));
                        setSlotForm({
                          ...slotForm,
                          facultyId: fId,
                          facultyInitial: fac ? (fac.initials || fac.name) : '',
                        });
                      }}
                    >
                      <option value="">-- Choose from Master Faculty or Type Below --</option>
                      {facultyList.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} {f.initials ? `(${f.initials})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <input
                    type="text"
                    className="tt-input"
                    style={{ width: '100%' }}
                    placeholder="Faculty Name or Initial (e.g. Dr. A. Sharma or AS)"
                    value={slotForm.facultyInitial}
                    onChange={e => setSlotForm({ ...slotForm, facultyInitial: e.target.value })}
                  />
                </div>

                {/* Room / Location */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Room / Lab Location
                  </label>
                  <input
                    type="text"
                    className="tt-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Lab 4 / Room 302"
                    value={slotForm.room}
                    onChange={e => setSlotForm({ ...slotForm, room: e.target.value })}
                  />
                </div>

                {/* Class Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Class Type
                  </label>
                  <select
                    className="tt-input"
                    style={{ width: '100%' }}
                    value={slotForm.entryType}
                    onChange={e => setSlotForm({ ...slotForm, entryType: e.target.value })}
                  >
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab / Practical</option>
                    <option value="tutorial">Tutorial</option>
                  </select>
                </div>

                {/* Batch Group */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    Batch Scope
                  </label>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    {['ALL', 'A', 'B'].map(b => (
                      <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="slotBatch"
                          value={b}
                          checked={slotForm.batchGroup === b}
                          onChange={() => setSlotForm({ ...slotForm, batchGroup: b })}
                        />
                        {b === 'ALL' ? 'Entire Division (All Batches)' : `Batch ${b} Only`}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="tt-btn tt-btn-secondary"
                  onClick={() => setShowSlotModal(false)}
                  disabled={savingSlot}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tt-btn tt-btn-primary"
                  disabled={savingSlot}
                >
                  {savingSlot ? 'Saving...' : editingSlotId ? 'Update Slot' : 'Save & Add Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
