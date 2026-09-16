import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import masterApi from '../../api/masterApi';
import '../../styles/admin.css';
import '../../styles/responsive.css';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);

  // View & filter states
  // 'all' = flat list of all assigned subjects, 'semesters' = grouped by semester
  const [activeView, setActiveView] = useState('all');
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [search, setSearch] = useState('');

  const [ccBatches, setCcBatches] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await masterApi.assignments.my();
        const data = res.data.data || [];
        setAssignments(data);

        // Fetch syllabus progress for each assigned subject
        if (data.length > 0) {
          const progMap = {};
          for (const a of data) {
            try {
              const pRes = await masterApi.topicCompletions.getBySubjectBatch(a.subject_id, a.division_id);
              progMap[a.subject_id] = pRes.data.data?.progress || { total: 0, completed: 0, percentage: 0 };
            } catch {
              progMap[a.subject_id] = { total: 0, completed: 0, percentage: 0 };
            }
          }
          setProgress(progMap);
        }

        // Check if this faculty is assigned as Class Coordinator (CC) by HOD
        try {
          const ccRes = await masterApi.ccAssignments.my();
          setCcBatches(ccRes.data?.data || []);
        } catch (err) {
          console.warn('Failed to load CC assignments:', err);
        }
      } catch (e) {
        console.error('Failed to load assignments:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filter assignments by search query
  const filteredAssignments = useMemo(() => {
    if (!search.trim()) return assignments;
    const q = search.toLowerCase();
    return assignments.filter(a =>
      (a.subject_name && a.subject_name.toLowerCase().includes(q)) ||
      (a.code && a.code.toLowerCase().includes(q)) ||
      (a.division_name && a.division_name.toLowerCase().includes(q)) ||
      (a.batch_name && a.batch_name.toLowerCase().includes(q))
    );
  }, [assignments, search]);

  // Group filtered assignments by semester
  const grouped = useMemo(() => {
    const groups = {};
    for (const a of filteredAssignments) {
      const sem = a.semester_number || 0;
      if (!groups[sem]) groups[sem] = [];
      groups[sem].push(a);
    }
    return groups;
  }, [filteredAssignments]);

  const sortedSemesters = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
  }, [grouped]);

  // Handle stat card clicks
  const handleAllSubjectsClick = () => {
    setActiveView('all');
    setSelectedSemester(null);
  };

  const handleSemestersClick = () => {
    setActiveView('semesters');
  };

  const renderSubjectCard = (a) => {
    const prog = progress[a.subject_id] || { total: 0, completed: 0, percentage: 0 };
    const isComplete = prog.total > 0 && prog.completed === prog.total;
    const isInProgress = prog.completed > 0 && !isComplete;

    return (
      <div
        key={`${a.id}-${a.division_id}`}
        className="subject-card"
        onClick={() =>
          navigate(
            `/faculty/subjects/${a.subject_id}/syllabus?divisionId=${a.division_id}&semesterNumber=${a.semester_number}`
          )
        }
        title="Click to view syllabus topics & track completion"
      >
        <div className="subject-card__header">
          <h4 className="subject-card__name">{a.subject_name}</h4>
          <span className="subject-card__code">{a.code || a.subject_code}</span>
        </div>

        {/* Metadata badges: Division, Semester, Batch */}
        <div className="subject-card__tags">
          <span className="subject-card__tag subject-card__tag--highlight">
            🏢 Division {a.division_name}
          </span>
          <span className="subject-card__tag">
            🗓️ Semester {a.semester_number}
          </span>
          {a.batch_name && (
            <span className="subject-card__tag">
              👥 Batch {a.batch_name}
            </span>
          )}
          {a.subject_type && (
            <span className="subject-card__tag">
              📝 {a.subject_type}
            </span>
          )}
          {a.academic_year_name && (
            <span className="subject-card__tag">
              📅 {a.academic_year_name}
            </span>
          )}
          {a.department_name && (
            <span className="subject-card__tag" style={{ background: 'rgba(0, 169, 180, 0.08)', color: 'var(--color-primary-dark, #00838c)', fontWeight: 600 }}>
              🏛️ {a.department_name}
            </span>
          )}
        </div>

        {/* Syllabus progress bar */}
        <div className="progress-bar-wrap">
          <div className="progress-bar-label">
            <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>Syllabus Progress</span>
            <span style={{ fontWeight: 600 }}>
              {prog.completed}/{prog.total} topics • {prog.percentage}%
            </span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-bar__fill ${isComplete ? 'progress-bar__fill--complete' : ''}`}
              style={{ width: `${Math.min(100, prog.percentage)}%` }}
            />
          </div>
        </div>

        {/* Card Footer action */}
        <div className="subject-card__footer">
          <span style={{ fontSize: '0.76rem', color: 'var(--admin-text-muted)' }}>
            {isComplete ? (
              <span style={{ color: '#16a34a', fontWeight: 600 }}>🟢 100% Completed</span>
            ) : isInProgress ? (
              <span style={{ color: '#00838c', fontWeight: 600 }}>🔵 In Progress</span>
            ) : (
              <span>⚪ Not Started</span>
            )}
          </span>
          <span className="subject-card__action-btn">
            View Syllabus & Track →
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-page" style={{ paddingBottom: 90 }}>
      <div style={{ marginBottom: 4 }}>
        <h1 className="admin-page__title">
          Welcome back, {user?.name?.split(' ')[0] || 'Faculty'} 👋
        </h1>
        <p className="admin-page__subtitle">
          View and manage your assigned subjects, syllabus completion, and class schedules.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--admin-text-muted)' }}>
          Loading your assigned subjects…
        </div>
      ) : assignments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--admin-text)' }}>
            No subjects assigned yet
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginTop: 6 }}>
            Once subjects are assigned to you by the HOD, they will appear here automatically.
          </div>
        </div>
      ) : (
        <div>
          {/* Interactive Stat Cards */}
          <div className="stat-cards" style={{ marginBottom: 20 }}>
            <div
              className={`stat-card stat-card--clickable ${activeView === 'all' ? 'stat-card--active' : ''}`}
              onClick={handleAllSubjectsClick}
              role="button"
              tabIndex={0}
              title="Click to view all assigned subjects"
            >
              <div className="stat-card__icon">📚</div>
              <div className="stat-card__label">Assigned Subjects</div>
              <div className="stat-card__value">{assignments.length}</div>
              <div className="stat-card__sub">
                {activeView === 'all' ? (
                  <span className="stat-card__indicator">✓ Showing All Subjects</span>
                ) : (
                  'Click to view all subjects →'
                )}
              </div>
            </div>

            <div
              className={`stat-card stat-card--clickable ${activeView === 'semesters' ? 'stat-card--active' : ''}`}
              onClick={handleSemestersClick}
              role="button"
              tabIndex={0}
              title="Click to view subjects grouped by semester"
            >
              <div className="stat-card__icon">📅</div>
              <div className="stat-card__label">Semesters</div>
              <div className="stat-card__value">{sortedSemesters.length}</div>
              <div className="stat-card__sub">
                {activeView === 'semesters' ? (
                  <span className="stat-card__indicator">✓ Showing Semester Breakdown</span>
                ) : (
                  'Click for semester-wise view →'
                )}
              </div>
            </div>
            {ccBatches.length > 0 && (
              <div
                className="stat-card stat-card--clickable"
                onClick={() => navigate('/cc')}
                role="button"
                tabIndex={0}
                style={{
                  borderLeft: '4px solid #f59e0b',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.07) 0%, rgba(255, 255, 255, 1) 100%)',
                  cursor: 'pointer',
                }}
                title="Click to open Class Coordinator Dashboard"
              >
                <div className="stat-card__icon">⭐</div>
                <div className="stat-card__label">Class Coordinator (CC)</div>
                <div className="stat-card__value">{ccBatches.length} {ccBatches.length === 1 ? 'Batch' : 'Batches'}</div>
                <div className="stat-card__sub" style={{ color: '#b45309', fontWeight: 600 }}>
                  Assigned by HOD →
                </div>
              </div>
            )}
          </div>

          {/* Filter & Toolbar Area */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 24,
              padding: '12px 16px',
              background: 'var(--admin-surface, #f8fafc)',
              borderRadius: 10,
              border: '1px solid var(--admin-border, #e2e8f0)',
            }}
          >
            {/* View Mode Toggle Pills */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={activeView === 'all' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: 20 }}
                onClick={handleAllSubjectsClick}
              >
                📚 All Assigned Subjects ({assignments.length})
              </button>
              <button
                type="button"
                className={activeView === 'semesters' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: 20 }}
                onClick={handleSemestersClick}
              >
                📅 Semester-wise ({sortedSemesters.length})
              </button>

              {/* If semester view active, show individual semester pills */}
              {activeView === 'semesters' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Filter:</span>
                  <button
                    type="button"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.78rem',
                      borderRadius: 14,
                      border: '1px solid var(--admin-border, #cbd5e1)',
                      background: selectedSemester === null ? 'var(--admin-accent, #00a9b4)' : '#fff',
                      color: selectedSemester === null ? '#fff' : 'var(--admin-text, #334155)',
                      cursor: 'pointer',
                      fontWeight: selectedSemester === null ? 700 : 500,
                    }}
                    onClick={() => setSelectedSemester(null)}
                  >
                    All
                  </button>
                  {sortedSemesters.map(sem => (
                    <button
                      key={sem}
                      type="button"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.78rem',
                        borderRadius: 14,
                        border: '1px solid var(--admin-border, #cbd5e1)',
                        background: selectedSemester === sem ? 'var(--admin-accent, #00a9b4)' : '#fff',
                        color: selectedSemester === sem ? '#fff' : 'var(--admin-text, #334155)',
                        cursor: 'pointer',
                        fontWeight: selectedSemester === sem ? 700 : 500,
                      }}
                      onClick={() => setSelectedSemester(sem)}
                    >
                      Sem {sem} ({grouped[sem].length})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Instant Search Bar */}
            <div style={{ minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}>
              <input
                type="text"
                className="search-bar__input"
                style={{ width: '100%', padding: '7px 12px', fontSize: '0.82rem', borderRadius: 8 }}
                placeholder="Search subject, code, or division…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Subjects Content Area */}
          {filteredAssignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>
              No subjects found matching "{search}".
            </div>
          ) : (
            <>
              {/* Sub-view: ALL SUBJECTS (flat grid) */}
              {activeView === 'all' && (
                <div>
                  {search && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', marginBottom: 12 }}>
                      Showing results for "{search}" ({filteredAssignments.length} found):
                    </div>
                  )}
                  {!search && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', marginBottom: 12 }}>
                      Showing all {filteredAssignments.length} assigned {filteredAssignments.length === 1 ? 'subject' : 'subjects'}:
                    </div>
                  )}
                  <div className="subject-cards">
                    {filteredAssignments.map(renderSubjectCard)}
                  </div>
                </div>
              )}

              {/* Sub-view: SEMESTER-WISE (grouped by semester) */}
              {activeView === 'semesters' && (
                <div>
                  {sortedSemesters.map(sem => (
                    <div key={sem} className="semester-group" style={{ marginBottom: 36 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: '2px solid var(--admin-border, #e2e8f0)',
                          paddingBottom: 10,
                          marginBottom: 16,
                        }}
                      >
                        <h3
                          className="semester-group__title"
                          style={{ margin: 0, border: 'none', padding: 0, fontSize: '1.05rem', color: 'var(--admin-text)' }}
                        >
                          🗓️ Semester {sem}
                        </h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                          {grouped[sem]?.length || 0} {grouped[sem]?.length === 1 ? 'subject' : 'subjects'}
                        </span>
                      </div>

                      <div className="subject-cards">
                        {(grouped[sem] || []).map(renderSubjectCard)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
