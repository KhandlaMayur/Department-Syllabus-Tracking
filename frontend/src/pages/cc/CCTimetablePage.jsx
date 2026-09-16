import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import timetableApi from '../../api/timetableApi';
import masterApi from '../../api/masterApi';
import TimetableGrid from '../../components/timetable/TimetableGrid';
import DayWiseScheduleView from '../../components/timetable/DayWiseScheduleView';
import '../../styles/timetable.css';
import '../../styles/admin.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function CCTimetablePage({ initialTab = 'class' }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab from prop or query param
  const queryTab = new URLSearchParams(location.search).get('tab');
  const [activeTab, setActiveTab] = useState(queryTab || initialTab || 'class');

  useEffect(() => {
    if (queryTab) {
      setActiveTab(queryTab);
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [queryTab, initialTab, location.pathname]);

  // ── Class Timetable State ──
  const [myAssignments, setMyAssignments] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loadingClass, setLoadingClass] = useState(true);
  const [classError, setClassError] = useState(null);

  // Filters for class timetable
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedAy, setSelectedAy] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [selectedDiv, setSelectedDiv] = useState('');
  const [activeCoordination, setActiveCoordination] = useState(null);

  // ── My Personal Schedule State ──
  const [mySchedule, setMySchedule] = useState(null);
  const [loadingMy, setLoadingMy] = useState(false);
  const [myError, setMyError] = useState(null);

  // Load CC's own assignments & dropdown options on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // When class filter selections change, reload class timetable
  useEffect(() => {
    if (selectedDiv || selectedSem || selectedAy) {
      loadClassSchedule();
    }
  }, [selectedAy, selectedSem, selectedDiv]);

  // When tab switches to "my", load personal teaching schedule if not loaded
  useEffect(() => {
    if (activeTab === 'my') {
      loadMySchedule();
    }
  }, [activeTab]);

  async function loadInitialData() {
    setLoadingClass(true);
    try {
      const [ccRes, ayRes, semRes, divRes] = await Promise.allSettled([
        masterApi.ccAssignments.my(),
        masterApi.academicYears.list({ limit: 50 }),
        masterApi.semesters.list({ limit: 50 }),
        masterApi.divisions.list({ limit: 100 }),
      ]);

      const ccData = ccRes.status === 'fulfilled' ? ccRes.value.data?.data || [] : [];
      const ays = ayRes.status === 'fulfilled' ? ayRes.value.data?.data?.rows || [] : [];
      const sems = semRes.status === 'fulfilled' ? semRes.value.data?.data?.rows || [] : [];
      const divs = divRes.status === 'fulfilled' ? divRes.value.data?.data?.rows || [] : [];

      setMyAssignments(ccData);
      setAcademicYears(ays);
      setSemesters(sems);
      setDivisions(divs);

      // Auto-configure filters based strictly on CC's assigned batch and division
      if (ccData.length > 0) {
        const primary = ccData[0];
        setActiveCoordination(primary);

        const ayId = primary.academic_year_id || (ays[0] ? ays[0].id : '');
        setSelectedAy(ayId);

        // If specific division assigned, select its semester and division
        if (primary.division_id) {
          setSelectedDiv(primary.division_id);
          const matchedDiv = divs.find(d => d.id === primary.division_id);
          if (matchedDiv && matchedDiv.semester_id) {
            setSelectedSem(matchedDiv.semester_id);
          } else if (primary.semester_id) {
            setSelectedSem(primary.semester_id);
          } else if (sems[0]) {
            setSelectedSem(sems[0].id);
          }
        } else {
          // Assigned to Entire Batch: find divisions belonging to this batch
          const batchDivs = divs.filter(d => d.batch_id === primary.batch_id);
          if (batchDivs.length > 0) {
            setSelectedDiv(batchDivs[0].id);
            if (batchDivs[0].semester_id) setSelectedSem(batchDivs[0].semester_id);
            else if (sems[0]) setSelectedSem(sems[0].id);
          } else {
            if (primary.semester_id) setSelectedSem(primary.semester_id);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load initial timetable data:', err);
    } finally {
      setLoadingClass(false);
    }
  }

  // Filter divisions to ONLY those coordinated by this CC
  const allowedDivisions = useMemo(() => {
    if (!myAssignments.length) return [];
    const divList = [];
    for (const a of myAssignments) {
      if (a.division_id) {
        const found = divisions.find(d => d.id === a.division_id);
        if (found && !divList.some(d => d.id === found.id)) {
          divList.push(found);
        } else if (!divList.some(d => d.id === a.division_id)) {
          divList.push({
            id: a.division_id,
            name: a.division_name || `Div ${a.division_id}`,
            semester_id: a.semester_id,
            semester_number: a.semester_number,
            batch_id: a.batch_id,
            batch_name: a.batch_name,
          });
        }
      } else {
        // Entire batch: all divisions of this batch
        const batchDivs = divisions.filter(d => d.batch_id === a.batch_id);
        for (const bd of batchDivs) {
          if (!divList.some(d => d.id === bd.id)) {
            divList.push(bd);
          }
        }
      }
    }
    return divList;
  }, [myAssignments, divisions]);

  // Filter semesters to ONLY those tied to the CC's coordinated divisions/batch
  const allowedSemesters = useMemo(() => {
    if (!myAssignments.length) return [];
    const semIdSet = new Set();
    const semNumSet = new Set();

    for (const a of myAssignments) {
      if (a.semester_id) semIdSet.add(a.semester_id);
      if (a.semester_number) semNumSet.add(Number(a.semester_number));
    }
    for (const d of allowedDivisions) {
      if (d.semester_id) semIdSet.add(d.semester_id);
      if (d.semester_number) semNumSet.add(Number(d.semester_number));
    }

    return semesters.filter(s => semIdSet.has(s.id) || semNumSet.has(Number(s.number)));
  }, [myAssignments, allowedDivisions, semesters]);

  async function loadClassSchedule() {
    if (myAssignments.length === 0) {
      setEntries([]);
      setLoadingClass(false);
      return;
    }

    setLoadingClass(true);
    setClassError(null);
    try {
      const params = {};
      if (selectedAy) params.academicYearId = selectedAy;
      if (selectedSem) params.semesterId = selectedSem;
      if (selectedDiv) params.divisionId = selectedDiv;

      const res = await timetableApi.getCCSchedule(params);
      setEntries(res.data?.data?.entries || []);
    } catch (err) {
      setClassError(err.response?.data?.error?.message || 'Failed to load class timetable.');
    } finally {
      setLoadingClass(false);
    }
  }

  async function loadMySchedule() {
    setLoadingMy(true);
    setMyError(null);
    try {
      const res = await timetableApi.getFacultySchedule();
      setMySchedule(res.data?.data || null);
    } catch (err) {
      setMyError(err.response?.data?.error?.message || 'Failed to load personal teaching schedule.');
    } finally {
      setLoadingMy(false);
    }
  }

  // Helper to switch coordinated batch / division quickly
  const handleSelectAssignment = (assign) => {
    setActiveCoordination(assign);
    if (assign.academic_year_id) setSelectedAy(assign.academic_year_id);
    if (assign.division_id) {
      setSelectedDiv(assign.division_id);
      const matchedDiv = divisions.find(d => d.id === assign.division_id);
      if (matchedDiv && matchedDiv.semester_id) setSelectedSem(matchedDiv.semester_id);
    } else {
      const batchDivs = divisions.filter(d => d.batch_id === assign.batch_id);
      if (batchDivs.length > 0) {
        setSelectedDiv(batchDivs[0].id);
        if (batchDivs[0].semester_id) setSelectedSem(batchDivs[0].semester_id);
      }
    }
  };

  // Personal schedule stats
  const todayName = useMemo(() => {
    const dayIdx = new Date().getDay();
    return DAYS[dayIdx];
  }, []);

  const todayEntries = useMemo(() => {
    if (!mySchedule?.entries) return [];
    return mySchedule.entries.filter(e => (e.day || '').toLowerCase() === todayName.toLowerCase());
  }, [mySchedule, todayName]);

  const totalTeachingHours = useMemo(() => {
    if (!mySchedule?.entries) return 0;
    const minutes = mySchedule.entries.reduce((acc, e) => acc + (e.duration_minutes || 55), 0);
    return (minutes / 60).toFixed(1);
  }, [mySchedule]);

  const classTodayEntries = useMemo(() => {
    if (!entries.length) return [];
    return entries.filter(e => (e.day || '').toLowerCase() === todayName.toLowerCase());
  }, [entries, todayName]);

  const classTotalHours = useMemo(() => {
    if (!entries.length) return '0.0';
    const minutes = entries.reduce((acc, e) => acc + (e.duration_minutes || 55), 0);
    return (minutes / 60).toFixed(1);
  }, [entries]);

  const myEntries = mySchedule?.entries || [];

  return (
    <div className="tt-container" style={{ paddingBottom: 80 }}>
      {/* Page Header */}
      <div className="tt-header" style={{ marginBottom: 16 }}>
        <div className="tt-title-group">
          <h1>⏱️ Timetable & Schedule</h1>
          <p className="tt-subtitle">
            View coordinated batch/division timetables and your personal teaching schedule.
          </p>
        </div>
      </div>

      {/* Top Dual View Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          borderBottom: '2px solid var(--color-border, #e2e8f0)',
          marginBottom: 20,
          paddingBottom: 2,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('class');
            navigate('/cc/timetable');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'class' ? 700 : 500,
            color: activeTab === 'class' ? 'var(--color-primary-dark, #00838c)' : 'var(--color-text-muted, #64748b)',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'class' ? '3px solid var(--color-primary, #00a9b4)' : '3px solid transparent',
            cursor: 'pointer',
            marginBottom: -2,
            transition: 'all 0.2s ease',
          }}
        >
          👥 Class Timetable (Batch & Division)
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('my');
            navigate('/cc/my-schedule');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'my' ? 700 : 500,
            color: activeTab === 'my' ? 'var(--color-primary-dark, #00838c)' : 'var(--color-text-muted, #64748b)',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'my' ? '3px solid var(--color-primary, #00a9b4)' : '3px solid transparent',
            cursor: 'pointer',
            marginBottom: -2,
            transition: 'all 0.2s ease',
          }}
        >
          📅 My Teaching Schedule
        </button>
      </div>

      {/* ========================================================
          TAB 1: CLASS TIMETABLE (BATCH & DIVISION)
          ======================================================== */}
      {activeTab === 'class' && (
        <div>
          {/* Batch & Division Selector Cards */}
          {myAssignments.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                ⭐ Coordinated Batches & Divisions (Assigned by HOD)
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {myAssignments.map(a => {
                  const isSelected = activeCoordination?.id === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleSelectAssignment(a)}
                      className={`tt-batch-card ${isSelected ? 'tt-batch-card--active' : ''}`}
                      style={{
                        flex: '1 1 260px',
                        maxWidth: 380,
                        padding: '14px 18px',
                        borderRadius: 12,
                        border: isSelected ? '2px solid var(--color-primary, #00a9b4)' : '1px solid var(--color-border, #e2e8f0)',
                        background: isSelected ? 'linear-gradient(135deg, rgba(0, 169, 180, 0.08) 0%, rgba(255, 255, 255, 1) 100%)' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: isSelected ? '0 4px 14px rgba(0, 169, 180, 0.15)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: isSelected ? 'var(--color-primary-dark, #00838c)' : 'var(--color-text-muted)',
                        }}>
                          {isSelected ? '✓ Viewing Class Timetable' : 'Click to View'}
                        </span>
                        {a.semester_number && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'rgba(0,169,180,0.1)', color: 'var(--color-primary-dark)', padding: '2px 8px', borderRadius: 10 }}>
                            Semester {a.semester_number}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text, #1e293b)' }}>
                        Batch: {a.batch_name}
                      </div>
                      <div style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Division: <strong style={{ color: 'var(--color-primary-dark, #00838c)' }}>{a.division_name || 'Entire Batch'}</strong>
                        {a.department_name ? ` • ${a.department_name}` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* If CC has no coordination assigned */}
          {myAssignments.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '56px 24px', margin: '20px 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👥</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>
                No Class Coordination Assigned Yet
              </div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 6, maxWidth: 500, margin: '6px auto 0' }}>
                You have not been assigned as Class Coordinator (CC) to any batch or division by the HOD yet.
                Once assigned, your coordinated batch & division timetable will appear here automatically.
              </p>
            </div>
          )}

          {/* Class Workload Summary Cards */}
          {myAssignments.length > 0 && !loadingClass && (
            <div className="tt-stat-grid" style={{ marginBottom: 20 }}>
              <div className="tt-stat-card">
                <span className="tt-stat-label">Weekly Class Sessions</span>
                <span className="tt-stat-val">{entries.length}</span>
                <span className="tt-stat-desc">
                  Division {activeCoordination?.division_name || ''} total scheduled slots
                </span>
              </div>
              <div className="tt-stat-card">
                <span className="tt-stat-label">Weekly Instructional Load</span>
                <span className="tt-stat-val">{classTotalHours} hrs</span>
                <span className="tt-stat-desc">Calculated instructional hours</span>
              </div>
              <div className="tt-stat-card">
                <span className="tt-stat-label">Today's Class Sessions</span>
                <span className="tt-stat-val">{classTodayEntries.length}</span>
                <span className="tt-stat-desc">{todayName} schedule</span>
              </div>
            </div>
          )}

          {classError && (
            <div className="tt-alert tt-alert-danger" style={{ marginBottom: 16 }}>
              <span>⚠️ {classError}</span>
            </div>
          )}

          {loadingClass ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
              Loading class timetable...
            </div>
          ) : (
            <div>
              {/* Day-wise Schedule Section */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                      📅 Day-wise Class Schedule ({todayName})
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                      Filter by day to view specific lectures, labs, room numbers, and faculty assignments.
                    </p>
                  </div>
                </div>
                <DayWiseScheduleView entries={entries} showFacultyInfo={true} />
              </div>

              {/* Division Weekly Timetable Matrix Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                      🗓️ Division Weekly Timetable Matrix
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                      Full weekly matrix for Batch: {activeCoordination?.batch_name || ''} • Division {activeCoordination?.division_name || ''}
                      {activeCoordination?.semester_number ? ` (Semester ${activeCoordination.semester_number})` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {entries.length} scheduled sessions
                  </span>
                </div>

                <TimetableGrid
                  entries={entries.map(e => ({
                    ...e,
                    startTime: e.start_time,
                    endTime: e.end_time,
                    subjectCode: e.subject_code || e.subject_code_raw,
                    subjectName: e.subject_name || e.subject_name_raw,
                    facultyName: e.faculty_name,
                    facultyInitial: e.faculty_initial,
                    entryType: e.entry_type,
                    batchGroup: e.batch_group,
                  }))}
                  showControls={true}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: MY TEACHING SCHEDULE
          ======================================================== */}
      {activeTab === 'my' && (
        <div>
          {myError && (
            <div className="tt-alert tt-alert-danger" style={{ marginBottom: 16 }}>
              <span>⚠️ {myError}</span>
            </div>
          )}

          {loadingMy ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
              Loading personal teaching schedule...
            </div>
          ) : (
            <div>
              {/* Teaching Workload Summary Cards */}
              <div className="tt-stat-grid" style={{ marginBottom: 20 }}>
                <div className="tt-stat-card">
                  <span className="tt-stat-label">Weekly Sessions</span>
                  <span className="tt-stat-val">{myEntries.length}</span>
                  <span className="tt-stat-desc">Your total assigned lectures & labs</span>
                </div>
                <div className="tt-stat-card">
                  <span className="tt-stat-label">Weekly Teaching Load</span>
                  <span className="tt-stat-val">{totalTeachingHours} hrs</span>
                  <span className="tt-stat-desc">Calculated instructional hours</span>
                </div>
                <div className="tt-stat-card">
                  <span className="tt-stat-label">Today's Sessions</span>
                  <span className="tt-stat-val">{todayEntries.length}</span>
                  <span className="tt-stat-desc">{todayName} schedule</span>
                </div>
              </div>

              {/* Day-wise Teaching Schedule */}
              <DayWiseScheduleView entries={myEntries} />

              {/* Full Weekly Teaching Grid */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--color-text)' }}>
                    My Weekly Teaching Timetable
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {myEntries.length} total sessions
                  </span>
                </div>

                <TimetableGrid
                  entries={myEntries.map(e => ({
                    ...e,
                    startTime: e.start_time,
                    endTime: e.end_time,
                    subjectCode: e.subject_code || e.subject_code_raw,
                    subjectName: e.subject_name || e.subject_name_raw,
                    facultyName: e.faculty_name,
                    facultyInitial: e.faculty_initial,
                    entryType: e.entry_type,
                    batchGroup: e.batch_group,
                  }))}
                  showControls={true}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
