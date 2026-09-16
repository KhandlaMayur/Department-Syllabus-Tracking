import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import masterApi from '../../api/masterApi';
import '../../styles/admin.css';
import '../../styles/responsive.css';

export default function StudentFeedbackListPage({ role: pageRole }) {
  const { user, role: authRole } = useAuth();
  const effectiveRole = pageRole || authRole;

  // Data states
  const [feedbacks,   setFeedbacks]   = useState([]);
  const [stats,       setStats]       = useState({ total: 0, avgRating: '0.0', completedCount: 0, commentCount: 0 });
  const [loading,     setLoading]     = useState(true);
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [totalCount,  setTotalCount]  = useState(0);

  // Dropdown filter options
  const [batches,     setBatches]     = useState([]);
  const [divisions,   setDivisions]   = useState([]);
  const [subjects,    setSubjects]    = useState([]);

  // Active filter states
  const [selectedSem,      setSelectedSem]      = useState('');
  const [selectedBatch,    setSelectedBatch]    = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedSubject,  setSelectedSubject]  = useState('');
  const [searchQuery,      setSearchQuery]      = useState('');
  const [activeSearch,     setActiveSearch]     = useState('');

  // Load filter options based on role
  useEffect(() => {
    async function loadOptions() {
      try {
        if (effectiveRole === 'cc') {
          // For CC: load CC's assigned batches & divisions
          try {
            const ccRes = await masterApi.ccAssignments.my();
            const assignments = ccRes.data.data || [];
            const uniqueBatches = [];
            const batchMap = {};
            const uniqueDivisions = [];
            const divMap = {};

            assignments.forEach(a => {
              if (a.batch_id && !batchMap[a.batch_id]) {
                batchMap[a.batch_id] = true;
                uniqueBatches.push({ id: a.batch_id, name: a.batch_name || `Batch #${a.batch_id}` });
              }
              if (a.division_id && !divMap[a.division_id]) {
                divMap[a.division_id] = true;
                uniqueDivisions.push({ id: a.division_id, name: a.division_name || `Div #${a.division_id}` });
              }
            });
            setBatches(uniqueBatches);
            setDivisions(uniqueDivisions);
          } catch {
            const bRes = await masterApi.batches.list({ limit: 100 });
            setBatches(bRes.data.data?.rows || []);
          }
        } else {
          // HOD & Faculty: load all batches & divisions
          const [bRes, dRes] = await Promise.all([
            masterApi.batches.list({ limit: 100 }).catch(() => ({ data: { data: { rows: [] } } })),
            masterApi.divisions.list({ limit: 100 }).catch(() => ({ data: { data: { rows: [] } } })),
          ]);
          setBatches(bRes.data.data?.rows || []);
          setDivisions(dRes.data.data?.rows || []);
        }

        // Subjects list
        if (effectiveRole === 'faculty') {
          try {
            const myAssRes = await masterApi.assignments.my();
            const myAssignments = myAssRes.data.data || [];
            const subMap = {};
            const subList = [];
            myAssignments.forEach(a => {
              if (a.subject_id && !subMap[a.subject_id]) {
                subMap[a.subject_id] = true;
                subList.push({ id: a.subject_id, code: a.code || a.subject_code, name: a.subject_name || a.name });
              }
            });
            setSubjects(subList.length > 0 ? subList : (await masterApi.subjects.list({ limit: 100 })).data.data?.rows || []);
          } catch {
            const sRes = await masterApi.subjects.list({ limit: 100 });
            setSubjects(sRes.data.data?.rows || []);
          }
        } else {
          const sRes = await masterApi.subjects.list({ limit: 100 });
          setSubjects(sRes.data.data?.rows || []);
        }
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    }
    loadOptions();
  }, [effectiveRole]);

  // Fetch feedback records
  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
        roleScope: effectiveRole,
      };
      if (selectedSem)      params.semesterNumber = selectedSem;
      if (selectedBatch)    params.batchId        = selectedBatch;
      if (selectedDivision) params.divisionId     = selectedDivision;
      if (selectedSubject)  params.subjectId      = selectedSubject;
      if (activeSearch)     params.search         = activeSearch;

      const res = await masterApi.studentFeedback.list(params);
      const data = res.data.data || {};
      setFeedbacks(data.rows || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.totalPages || 1);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Failed to load student feedback:', err);
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  }, [page, effectiveRole, selectedSem, selectedBatch, selectedDivision, selectedSubject, activeSearch]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Debounce / submit search
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchQuery.trim());
  };

  const handleClearFilters = () => {
    setSelectedSem('');
    setSelectedBatch('');
    setSelectedDivision('');
    setSelectedSubject('');
    setSearchQuery('');
    setActiveSearch('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    selectedSem || selectedBatch || selectedDivision || selectedSubject || activeSearch
  );

  // Subtitle per role
  const subtitle = useMemo(() => {
    if (effectiveRole === 'cc') {
      return "View and track syllabus feedback from students in your assigned Class Coordinator batch.";
    }
    if (effectiveRole === 'faculty') {
      return "Review topic-by-topic comprehension ratings and feedback from students for your subjects.";
    }
    return "Department-wide overview of student topic completion feedback, ratings, and doubts.";
  }, [effectiveRole]);

  return (
    <div className="admin-page" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="admin-page__title">💬 Student Feedback</h1>
          <p className="admin-page__subtitle">{subtitle}</p>
        </div>
        <button
          className="btn-secondary"
          onClick={fetchFeedbacks}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--admin-accent, #00a9b4)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Reviews
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--admin-text)', marginTop: 4 }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>
            Across covered syllabus topics
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Average Rating
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f59e0b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⭐ {stats.avgRating}</span>
            <span style={{ fontSize: '1rem', color: 'var(--admin-text-muted)', fontWeight: 500 }}>/ 5.0</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>
            Student topic understanding
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Marked As Done
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
            {stats.completedCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>
            {stats.total > 0 ? `${Math.round((stats.completedCount / stats.total) * 100)}% marked understood` : '0%'}
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Doubts & Comments
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#6366f1', marginTop: 4 }}>
            {stats.commentCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>
            Written feedback questions
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="card" style={{ marginBottom: 24, padding: '18px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {/* Semester Filter */}
          <div style={{ minWidth: 140, flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: 4 }}>
              Semester
            </label>
            <select
              className="form-input"
              style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
              value={selectedSem}
              onChange={e => { setSelectedSem(e.target.value); setPage(1); }}
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>

          {/* Batch Filter */}
          <div style={{ minWidth: 150, flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: 4 }}>
              Batch
            </label>
            <select
              className="form-input"
              style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
              value={selectedBatch}
              onChange={e => { setSelectedBatch(e.target.value); setPage(1); }}
            >
              <option value="">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Division Filter */}
          <div style={{ minWidth: 140, flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: 4 }}>
              Division
            </label>
            <select
              className="form-input"
              style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
              value={selectedDivision}
              onChange={e => { setSelectedDivision(e.target.value); setPage(1); }}
            >
              <option value="">All Divisions</option>
              {divisions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div style={{ minWidth: 180, flex: 1.5 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: 4 }}>
              Subject
            </label>
            <select
              className="form-input"
              style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
              value={selectedSubject}
              onChange={e => { setSelectedSubject(e.target.value); setPage(1); }}
            >
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search by student name or enrollment */}
          <form onSubmit={handleSearchSubmit} style={{ minWidth: 220, flex: 2, display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: 4 }}>
                Search Student / Enrollment
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
                placeholder="Name or Enrollment No…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '7px 14px', fontSize: '0.82rem' }}>
              Search
            </button>
          </form>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <div style={{ alignSelf: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '7px 12px', fontSize: '0.82rem', color: '#dc2626' }}
                onClick={handleClearFilters}
              >
                ✕ Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Feed Table / Card View */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--admin-text-muted)' }}>
          Loading student feedback…
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--admin-text)' }}>
            No student feedback found
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', marginTop: 6, maxWidth: 450, margin: '6px auto 0' }}>
            {hasActiveFilters
              ? 'Try clearing or changing your filters to see more results.'
              : effectiveRole === 'cc'
              ? 'Students in your assigned batch have not submitted any topic feedback yet.'
              : 'Students have not submitted feedback for topics in your subjects yet.'}
          </p>
          {hasActiveFilters && (
            <button className="btn-secondary" onClick={handleClearFilters} style={{ marginTop: 16 }}>
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {feedbacks.map(item => {
            const isDone = item.is_completed !== 0;
            const ratingColor = item.rating >= 4 ? '#16a34a' : item.rating === 3 ? '#f59e0b' : '#ef4444';

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: '18px 20px',
                  borderRadius: 10,
                  transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                  border: '1px solid var(--admin-border, #e2e8f0)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  {/* Student Header Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00a9b4 0%, #0369a1 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1rem',
                        flexShrink: 0,
                      }}
                    >
                      {item.student_name ? item.student_name.charAt(0).toUpperCase() : 'S'}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--admin-text)' }}>
                          {item.student_name || 'Student'}
                        </span>
                        {item.enrollment_number && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'rgba(0, 169, 180, 0.1)',
                              color: 'var(--admin-accent)',
                              border: '1px solid rgba(0, 169, 180, 0.2)',
                            }}
                          >
                            🎓 {item.enrollment_number}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: '#f1f5f9',
                            color: '#475569',
                          }}
                        >
                          Sem {item.semester_number}
                        </span>
                        {item.batch_name && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: '#f1f5f9',
                              color: '#475569',
                            }}
                          >
                            Batch: {item.batch_name}
                          </span>
                        )}
                        {item.division_name && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: '#f1f5f9',
                              color: '#475569',
                            }}
                          >
                            Div: {item.division_name}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 3 }}>
                        Submitted {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Rating & Mark as Done Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {isDone ? (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: 'rgba(34, 197, 94, 0.12)',
                          color: '#16a34a',
                          border: '1px solid rgba(34, 197, 94, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        ✓ Marked as Done
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: '#f1f5f9',
                          color: '#64748b',
                        }}
                      >
                        Reviewed (Pending Done)
                      </span>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 8,
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                      }}
                    >
                      <span style={{ color: '#f59e0b', fontSize: '1rem' }}>
                        {'★'.repeat(item.rating)}
                        <span style={{ color: '#cbd5e1' }}>{'★'.repeat(5 - item.rating)}</span>
                      </span>
                      <strong style={{ fontSize: '0.85rem', color: ratingColor, marginLeft: 2 }}>
                        {item.rating}/5
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Subject & Topic Context Bar */}
                <div
                  style={{
                    marginTop: 14,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'var(--admin-surface, #f8fafc)',
                    border: '1px solid var(--admin-border, #e2e8f0)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.83rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'rgba(0, 169, 180, 0.1)',
                        color: 'var(--admin-accent)',
                      }}
                    >
                      {item.subject_code}
                    </span>
                    <strong style={{ color: 'var(--admin-text)' }}>{item.subject_name}</strong>
                    <span style={{ color: 'var(--admin-text-muted)' }}>•</span>
                    <span style={{ color: 'var(--admin-text-muted)' }}>
                      Unit {item.unit_number || '—'}: {item.unit_title || '—'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)' }}>
                    Taught by: <strong style={{ color: 'var(--admin-text)' }}>{item.faculty_name || 'Assigned Faculty'}</strong>
                  </div>
                </div>

                {/* Subtopic Title */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
                    Topic Covered:
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--admin-text)' }}>
                    📖 {item.subtopic_title}
                  </div>
                </div>

                {/* Student Comment / Doubts */}
                {item.comment ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(99, 102, 241, 0.05)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      fontSize: '0.85rem',
                      color: 'var(--admin-text)',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', marginBottom: 2 }}>
                      💭 Student Comment / Doubt:
                    </div>
                    <div style={{ fontStyle: 'italic', lineHeight: 1.5 }}>
                      "{item.comment}"
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>
                    No specific doubts or comment added.
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--admin-text-muted)' }}>
                Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total reviews)
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  ◀ Previous
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
