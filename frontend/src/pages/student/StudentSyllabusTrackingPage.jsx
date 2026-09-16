import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import masterApi from '../../api/masterApi';
import SyllabusViewer from '../../components/common/SyllabusViewer';
import Dialog from '../../components/common/Dialog';
import '../../styles/admin.css';
import '../../styles/responsive.css';

export default function StudentSyllabusTrackingPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [studentInfo,       setStudentInfo]       = useState(null);
  const [subjects,          setSubjects]          = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [progressMap,       setProgressMap]       = useState({});

  // Active subject syllabus data
  const [units,             setUnits]             = useState([]);
  const [completions,       setCompletions]       = useState([]);
  const [activatedUnits,    setActivatedUnits]    = useState([]);
  const [myFeedback,        setMyFeedback]        = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [syllabusLoading,   setSyllabusLoading]   = useState(false);
  const [searchQuery,       setSearchQuery]       = useState('');
  const [successMsg,        setSuccessMsg]        = useState('');
  const [errorMsg,          setErrorMsg]          = useState('');

  // Topic Details / Feedback Dialog
  const [dialogOpen,        setDialogOpen]        = useState(false);
  const [selectedTopic,     setSelectedTopic]     = useState(null); // { subtopic, completion }
  const [fbRating,          setFbRating]          = useState(0);
  const [fbComment,         setFbComment]         = useState('');
  const [fbHover,           setFbHover]           = useState(0);
  const [fbMarkedDone,      setFbMarkedDone]      = useState(true);
  const [submittingFb,      setSubmittingFb]      = useState(false);

  // Semester filter: 'my' = current semester, 'all' = all semesters
  const [semFilter,         setSemFilter]         = useState('my');

  // Load student profile & subjects
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const meRes = await masterApi.students.me();
        const student = meRes.data.data;
        setStudentInfo(student);

        // Fetch subjects
        const deptId = student?.department_id || user?.department_id || 1;
        let rows = [];
        try {
          const sRes = await masterApi.subjects.list({ departmentId: deptId, limit: 100 });
          rows = sRes.data.data?.rows || [];
        } catch {
          // ignore
        }

        if (rows.length === 0) {
          const fallbackRes = await masterApi.subjects.list({ limit: 100 });
          rows = fallbackRes.data.data?.rows || [];
        }

        const studentSem = student?.semester || student?.semester_number;
        if (studentSem) {
          // Sort to prioritize current semester subjects
          rows.sort((a, b) => {
            const aMatch = Number(a.semester_number) === Number(studentSem) ? -1 : 1;
            const bMatch = Number(b.semester_number) === Number(studentSem) ? -1 : 1;
            if (aMatch !== bMatch) return aMatch - bMatch;
            return a.code.localeCompare(b.code);
          });
        }
        setSubjects(rows);

        // Pick initial subject
        const initialSubjId = searchParams.get('subjectId');
        let matched = rows.find(s => String(s.id) === String(initialSubjId));
        if (!matched && studentSem) {
          matched = rows.find(s => Number(s.semester_number) === Number(studentSem));
        }
        const targetId = matched ? matched.id : (rows[0]?.id || null);
        setSelectedSubjectId(targetId);

        // Fetch progress for subjects
        const batchOrDiv = student?.division_id || student?.batch_id;
        if (batchOrDiv && rows.length > 0) {
          const pMap = {};
          for (const s of rows) {
            try {
              const pRes = await masterApi.topicCompletions.getBySubjectBatch(s.id, batchOrDiv);
              pMap[s.id] = pRes.data.data?.progress || { total: 0, completed: 0, percentage: 0 };
            } catch {
              pMap[s.id] = { total: 0, completed: 0, percentage: 0 };
            }
          }
          setProgressMap(pMap);
        }
      } catch (err) {
        console.error('Failed to initialize student syllabus tracking:', err);
        setErrorMsg('Failed to load subjects. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [user]);

  // Load syllabus and completions when selectedSubjectId changes
  const loadSyllabus = useCallback(async (subjectId) => {
    if (!subjectId) return;
    setSyllabusLoading(true);
    try {
      const batchOrDiv = studentInfo?.division_id || studentInfo?.batch_id;
      const [sylRes, compRes, fbRes] = await Promise.all([
        masterApi.subjects.getSyllabus(subjectId),
        batchOrDiv ? masterApi.topicCompletions.getBySubjectBatch(subjectId, batchOrDiv) : Promise.resolve({ data: { data: { completions: [], activatedUnits: [] } } }),
        batchOrDiv ? masterApi.studentFeedback.getMy(subjectId, batchOrDiv) : Promise.resolve({ data: { data: [] } }),
      ]);

      setUnits(sylRes.data.data || []);
      const compList = compRes.data.data?.completions || [];
      const actList = compRes.data.data?.activatedUnits || [];
      setCompletions(compList);
      setActivatedUnits(actList);
      setMyFeedback(fbRes.data.data || []);

      // Update progress in map
      const prog = compRes.data.data?.progress;
      if (prog) {
        setProgressMap(prev => ({ ...prev, [subjectId]: prog }));
      }
    } catch (err) {
      console.error('Error loading subject syllabus:', err);
    } finally {
      setSyllabusLoading(false);
    }
  }, [studentInfo]);

  useEffect(() => {
    if (selectedSubjectId) {
      loadSyllabus(selectedSubjectId);
    }
  }, [selectedSubjectId, loadSyllabus]);

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const handleSelectSubject = (id) => {
    setSelectedSubjectId(id);
    setSearchParams({ subjectId: id });
  };

  // Open completed topic modal
  const handleTopicClick = (subtopic, completion) => {
    const existing = myFeedback.find(f => f.subtopic_id === subtopic.id);
    setSelectedTopic({ subtopic, completion });
    setFbRating(existing?.rating || 0);
    setFbComment(existing?.comment || '');
    setFbMarkedDone(existing ? Boolean(existing.is_completed !== 0) : true);
    setFbHover(0);
    setDialogOpen(true);
  };

  // Submit student feedback
  const submitFeedback = async () => {
    if (!fbRating) {
      setErrorMsg('Please select a star rating.');
      return;
    }
    setSubmittingFb(true);
    setErrorMsg('');
    try {
      const batchId = studentInfo?.batch_id || 1;
      const divId = studentInfo?.division_id || null;
      const semNum = studentInfo?.semester || currentSubject?.semester_number || 1;

      await masterApi.studentFeedback.submit({
        subtopicId: selectedTopic.subtopic.id,
        subjectId: Number(selectedSubjectId),
        batchId: Number(batchId),
        divisionId: divId ? Number(divId) : null,
        semesterNumber: Number(semNum),
        rating: fbRating,
        comment: fbComment || null,
        isCompleted: fbMarkedDone,
      });

      showSuccess('Feedback submitted successfully!');
      setDialogOpen(false);
      setSelectedTopic(null);
      // Refresh feedback list
      if (selectedSubjectId) {
        loadSyllabus(selectedSubjectId);
      }
    } catch (err) {
      setErrorMsg(err?.response?.data?.error?.message || 'Failed to submit feedback.');
    } finally {
      setSubmittingFb(false);
    }
  };

  const currentSubject = useMemo(() => {
    return subjects.find(s => s.id === selectedSubjectId);
  }, [subjects, selectedSubjectId]);

  const studentSem = studentInfo?.semester || studentInfo?.semester_number;

  const filteredSubjects = useMemo(() => {
    let list = subjects;
    if (semFilter === 'my' && studentSem) {
      const mySemList = list.filter(s => Number(s.semester_number) === Number(studentSem));
      if (mySemList.length > 0) list = mySemList;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [subjects, searchQuery, semFilter, studentSem]);

  const currentProg = progressMap[selectedSubjectId] || {
    total: units.reduce((sum, u) => sum + (u.subtopics?.length || 0), 0),
    completed: completions.length,
    percentage: 0,
  };
  const totalTopics = units.reduce((sum, u) => sum + (u.subtopics?.length || 0), 0);
  const completedTopics = completions.length;
  const currentPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  return (
    <div className="admin-page" style={{ paddingBottom: 80 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="admin-page__title">📊 Syllabus Tracking</h1>
        <p className="admin-page__subtitle">
          Track syllabus progress topic-by-topic for your enrolled subjects.
        </p>
      </div>

      {/* Student Profile Quick Badges */}
      {studentInfo && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            background: 'var(--admin-surface, #f8fafc)',
            padding: '12px 18px',
            borderRadius: 10,
            border: '1px solid var(--admin-border, #e2e8f0)',
            marginBottom: 24,
            fontSize: '0.85rem',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>
            🎓 {studentInfo.enrollment_number}
          </span>
          <span style={{ color: 'var(--admin-border, #cbd5e1)' }}>|</span>
          <span style={{ color: 'var(--admin-text-muted)' }}>
            Batch: <strong style={{ color: 'var(--admin-text)' }}>{studentInfo.batch_name || studentInfo.batch || '—'}</strong>
          </span>
          <span style={{ color: 'var(--admin-border, #cbd5e1)' }}>|</span>
          <span style={{ color: 'var(--admin-text-muted)' }}>
            Division: <strong style={{ color: 'var(--admin-text)' }}>{studentInfo.division_name || studentInfo.division || '—'}</strong>
          </span>
          <span style={{ color: 'var(--admin-border, #cbd5e1)' }}>|</span>
          <span style={{ color: 'var(--admin-text-muted)' }}>
            Semester: <strong style={{ color: 'var(--admin-text)' }}>{studentInfo.semester || '—'}</strong>
          </span>
        </div>
      )}

      {successMsg && <div className="toast toast--success">{successMsg}</div>}
      {errorMsg && <div className="toast toast--error">{errorMsg}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--admin-text-muted)' }}>
          Loading your subjects…
        </div>
      ) : subjects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No subjects found</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginTop: 4 }}>
            No subjects have been assigned to your department yet.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: 24, alignItems: 'start' }}>
          {/* Left Column: Subjects Sidebar List */}
          <div>
            {/* Semester Filter Pills */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {studentSem && (
                <button
                  type="button"
                  className={semFilter === 'my' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '4px 12px', fontSize: '0.78rem', borderRadius: 20 }}
                  onClick={() => setSemFilter('my')}
                >
                  Semester {studentSem} ({subjects.filter(s => Number(s.semester_number) === Number(studentSem)).length})
                </button>
              )}
              <button
                type="button"
                className={semFilter === 'all' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '4px 12px', fontSize: '0.78rem', borderRadius: 20 }}
                onClick={() => setSemFilter('all')}
              >
                All Subjects ({subjects.length})
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                className="search-bar__input"
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', borderRadius: 8 }}
                placeholder="Search subject or code…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredSubjects.map(s => {
                const isSelected = s.id === selectedSubjectId;
                const p = progressMap[s.id] || { total: 0, completed: 0, percentage: 0 };
                const isDone = p.total > 0 && p.completed === p.total;

                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSubject(s.id)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 10,
                      background: isSelected ? 'rgba(0, 169, 180, 0.08)' : 'var(--admin-surface, #ffffff)',
                      border: isSelected ? '2px solid var(--admin-accent, #00a9b4)' : '1px solid var(--admin-border, #e2e8f0)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(0, 169, 180, 0.12)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: isSelected ? 'var(--admin-accent, #00a9b4)' : 'rgba(100, 116, 139, 0.12)',
                          color: isSelected ? '#ffffff' : 'var(--admin-text-muted)',
                        }}
                      >
                        {s.code}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isDone ? '#16a34a' : 'var(--admin-text-muted)' }}>
                        {p.percentage || 0}%
                      </span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--admin-text)', marginBottom: 8 }}>
                      {s.name}
                    </div>

                    {/* Mini Progress */}
                    <div className="progress-bar" style={{ height: 4 }}>
                      <div
                        className={`progress-bar__fill ${isDone ? 'progress-bar__fill--complete' : ''}`}
                        style={{ width: `${p.percentage || 0}%`, background: isDone ? '#16a34a' : undefined }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Subject Syllabus Details */}
          <div style={{ minWidth: 0 }}>
            {currentSubject ? (
              <div>
                {/* Subject Overview Card */}
                <div className="card" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 6,
                          background: 'rgba(0, 169, 180, 0.12)',
                          color: 'var(--admin-accent)',
                          display: 'inline-block',
                          marginBottom: 8,
                        }}
                      >
                        {currentSubject.code} • Semester {currentSubject.semester_number}
                      </span>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--admin-text)', margin: '0 0 6px' }}>
                        {currentSubject.name}
                      </h2>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--admin-text-muted)' }}>
                        {currentSubject.credits} credits • {units.length} units total
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: currentPct === 100 ? '#16a34a' : 'var(--admin-accent)' }}>
                        {currentPct}%
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                        {completedTopics} of {totalTopics} topics covered
                      </div>
                    </div>
                  </div>

                  <div className="progress-bar-wrap" style={{ marginTop: 14 }}>
                    <div className="progress-bar" style={{ height: 10 }}>
                      <div
                        className={`progress-bar__fill ${currentPct === 100 ? 'progress-bar__fill--complete' : ''}`}
                        style={{ width: `${currentPct}%`, background: currentPct === 100 ? '#16a34a' : undefined }}
                      />
                    </div>
                  </div>

                  {/* Interactive Policy Banner */}
                  <div
                    style={{
                      marginTop: 16,
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(0, 169, 180, 0.05)',
                      border: '1px solid rgba(0, 169, 180, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: '0.8rem',
                      color: 'var(--admin-text-muted)',
                    }}
                  >
                    <span>💡</span>
                    <span>
                      <strong style={{ color: '#16a34a' }}>✓ Covered Topics</strong> are clickable to view teacher coverage details and provide your feedback.
                      Topics marked as <strong style={{ color: '#64748b' }}>Pending</strong> cannot be clicked until taught by faculty.
                    </span>
                  </div>
                </div>

                {/* Syllabus Viewer in Student Mode */}
                <SyllabusViewer
                  units={units}
                  completions={completions}
                  activatedUnits={activatedUnits}
                  canMark={false}
                  studentMode={true}
                  onTopicClick={handleTopicClick}
                  showFeedback={true}
                  onFeedback={handleTopicClick}
                  myFeedback={myFeedback}
                  loading={syllabusLoading}
                />
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>
                Please select a subject to view its syllabus tracking.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Topic Details & Feedback Modal */}
      <Dialog
        open={dialogOpen}
        title="Topic Completion & Feedback"
        onClose={() => { setDialogOpen(false); setSelectedTopic(null); }}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDialogOpen(false)} disabled={submittingFb}>
              Close
            </button>
            <button className="btn-primary" onClick={submitFeedback} disabled={submittingFb || fbRating === 0}>
              {submittingFb ? 'Saving…' : 'Submit Feedback'}
            </button>
          </>
        }
      >
        {selectedTopic && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Topic Info */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: 2 }}>
                ✓ Covered by Faculty
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--admin-text)' }}>
                {selectedTopic.subtopic.title}
              </div>
              {selectedTopic.completion && (
                <div style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)', marginTop: 4 }}>
                  Taught by: <strong>{selectedTopic.completion.completed_by_name || 'Assigned Faculty'}</strong> •{' '}
                  {new Date(selectedTopic.completion.completed_at).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Mark as Done Checkbox / Status */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                background: fbMarkedDone ? 'rgba(34, 197, 94, 0.08)' : 'rgba(100, 116, 139, 0.08)',
                border: fbMarkedDone ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(100, 116, 139, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setFbMarkedDone(prev => !prev)}
            >
              <input
                type="checkbox"
                id="mark-topic-done-chk"
                checked={fbMarkedDone}
                onChange={e => setFbMarkedDone(e.target.checked)}
                onClick={e => e.stopPropagation()}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#16a34a' }}
              />
              <label htmlFor="mark-topic-done-chk" style={{ cursor: 'pointer', flex: 1, margin: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: fbMarkedDone ? '#16a34a' : 'var(--admin-text)' }}>
                  {fbMarkedDone ? '✓ Mark Topic as Done' : 'Mark Topic as Done'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>
                  Check this to mark topic completed & confirm you have understood it.
                </div>
              </label>
            </div>

            {/* Rating Stars */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--admin-text)', marginBottom: 6 }}>
                Rate how well you understood this topic:
              </label>
              <div style={{ display: 'flex', gap: 8, fontSize: '1.6rem' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                      color: star <= (fbHover || fbRating) ? '#f59e0b' : '#cbd5e1',
                      transition: 'transform 0.15s ease, color 0.15s ease',
                      transform: star <= (fbHover || fbRating) ? 'scale(1.15)' : 'none',
                    }}
                    onMouseEnter={() => setFbHover(star)}
                    onMouseLeave={() => setFbHover(0)}
                    onClick={() => setFbRating(star)}
                    title={`${star} star${star > 1 ? 's' : ''}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback Comment */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--admin-text)', marginBottom: 6 }}>
                Comments / Doubts (Optional):
              </label>
              <textarea
                rows={3}
                className="form-input"
                style={{ width: '100%', resize: 'vertical', fontSize: '0.85rem' }}
                placeholder="Share your understanding, feedback, or any topics that need more practice…"
                value={fbComment}
                onChange={e => setFbComment(e.target.value)}
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
