import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import masterApi from '../../api/masterApi';
import '../../styles/admin.css';
import '../../styles/responsive.css';

export default function CCDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ccBatches,      setCcBatches]      = useState([]);
  const [myAssignments,  setMyAssignments]  = useState([]);
  const [batchSubjects,  setBatchSubjects]  = useState({});
  const [loading,        setLoading]        = useState(true);
  const [ccProgress,     setCcProgress]     = useState({});
  const [ccFaculty,      setCcFaculty]      = useState({});

  useEffect(() => {
    async function load() {
      try {
        // 1. Get CC batch assignments
        const ccRes = await masterApi.ccAssignments.my();
        const batches = ccRes.data.data || [];
        setCcBatches(batches);

        // 2. Get personally assigned subjects
        const myRes = await masterApi.assignments.my();
        setMyAssignments(myRes.data.data || []);

        // 3. For each CC batch, fetch subjects belonging to that department and semester
        const subjectsMap = {};
        const progMap = {};
        const facMap = {};

        for (const batch of batches) {
          try {
            const params = {
              departmentId: batch.department_id,
              limit: 100,
            };
            if (batch.semester_number) {
              params.semesterNumber = batch.semester_number;
            }
            const sRes = await masterApi.subjects.list(params);
            const subjList = sRes.data.data?.rows || [];
            subjectsMap[batch.id || batch.batch_id] = subjList;

            // Load division assignments to see who teaches each subject
            if (batch.division_id) {
              try {
                const aRes = await masterApi.assignments.list({ divisionId: batch.division_id, limit: 100 });
                const divAssignments = aRes.data?.data?.rows || [];
                for (const da of divAssignments) {
                  facMap[`${batch.id}_${da.subject_id}`] = da.faculty_name;
                }
              } catch {}
            }

            // Load topic completions progress
            for (const s of subjList) {
              const targetDiv = batch.division_id || batch.batch_id;
              try {
                const pRes = await masterApi.topicCompletions.getBySubjectBatch(s.id, targetDiv);
                progMap[`${batch.id}_${s.id}`] = pRes.data.data?.progress || { total: 0, completed: 0, percentage: 0 };
              } catch {
                progMap[`${batch.id}_${s.id}`] = { total: 0, completed: 0, percentage: 0 };
              }
            }
          } catch {
            subjectsMap[batch.id || batch.batch_id] = [];
          }
        }
        setBatchSubjects(subjectsMap);
        setCcProgress(progMap);
        setCcFaculty(facMap);
      } catch (e) {
        console.error('Failed to load CC data:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Set of personally assigned subject IDs
  const mySubjectIds = new Set(myAssignments.map(a => a.subject_id));

  return (
    <div className="admin-page">
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="admin-page__title">
            Welcome back, {user?.name?.split(' ')[0] || 'CC'} 👋
          </h1>
          <p className="admin-page__subtitle">
            Class Coordinator — monitor all subjects and syllabus progress for your assigned batches
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => navigate('/cc/timetable')}
            className="btn btn--primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            ⏱️ Class Timetable →
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--admin-text-muted)' }}>Loading…</div>
      ) : ccBatches.length === 0 && myAssignments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--admin-text)' }}>No batches assigned yet</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginTop: 4 }}>
            Once the HOD assigns you as CC for a batch, all subjects will appear here.
          </div>
        </div>
      ) : (
        <div>
          {/* Summary stats */}
          <div className="stat-cards" style={{ marginBottom: 24 }}>
            <div
              className="stat-card"
              style={{
                borderLeft: '4px solid #f59e0b',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.07) 0%, rgba(255, 255, 255, 1) 100%)',
              }}
            >
              <div className="stat-card__icon">⭐</div>
              <div className="stat-card__label">Class Coordinator (CC)</div>
              <div className="stat-card__value">{ccBatches.length} {ccBatches.length === 1 ? 'Batch' : 'Batches'}</div>
              <div className="stat-card__sub" style={{ color: '#b45309', fontWeight: 600 }}>
                Assigned by HOD
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card__icon">📚</div>
              <div className="stat-card__label">My Teaching Subjects</div>
              <div className="stat-card__value">{myAssignments.length}</div>
              <div className="stat-card__sub">Personally taught</div>
            </div>

            <div
              className="stat-card stat-card--clickable"
              onClick={() => navigate('/cc/timetable')}
              style={{ cursor: 'pointer' }}
              title="Click to view Class Timetable"
            >
              <div className="stat-card__icon">⏱️</div>
              <div className="stat-card__label">Class Timetable</div>
              <div className="stat-card__value">Weekly Matrix</div>
              <div className="stat-card__sub" style={{ color: 'var(--color-primary-dark, #00838c)', fontWeight: 600 }}>
                View Day-wise Schedule →
              </div>
            </div>
          </div>

          {/* My Assigned Subjects Section */}
          {myAssignments.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--admin-text-muted)', marginBottom: 12 }}>
                My Assigned Subjects
              </h2>
              <div className="subject-cards">
                {myAssignments.map(a => (
                  <div
                    key={a.id}
                    className="subject-card"
                    onClick={() => navigate(`/cc/subjects/${a.subject_id}/syllabus?divisionId=${a.division_id}&semesterNumber=${a.semester_number}`)}
                  >
                    <div className="subject-card__header">
                      <h4 className="subject-card__name">{a.subject_name}</h4>
                      <span className="subject-card__code">{a.code}</span>
                    </div>
                    <div className="subject-card__meta">
                      <span className="badge-assigned">Assigned to Me</span>
                      {' '}Division {a.division_name} • Semester {a.semester_number}
                      {a.department_name && (
                        <div style={{ marginTop: 6, fontSize: '0.82rem', color: 'var(--color-primary-dark, #00838c)', fontWeight: 600 }}>
                          🏛️ {a.department_name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Batch-wise Subjects */}
          {ccBatches.map(batch => {
            const subjects = batchSubjects[batch.id || batch.batch_id] || [];
            // Group by semester_number
            const grouped = {};
            for (const s of subjects) {
              const sem = s.semester_number || batch.semester_number || 0;
              if (!grouped[sem]) grouped[sem] = [];
              grouped[sem].push(s);
            }
            const sortedSems = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));

            return (
              <div key={batch.id} style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--admin-text)', margin: 0 }}>
                    Batch: {batch.batch_name}
                  </h2>
                  {batch.division_name ? (
                    <span style={{
                      fontWeight: 700,
                      color: 'var(--color-primary-dark, #00838c)',
                      background: 'var(--color-primary-light, #e0f5f6)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                    }}>
                      Division {batch.division_name} {batch.semester_number ? `(Sem ${batch.semester_number})` : ''}
                    </span>
                  ) : (
                    <span style={{
                      color: '#475569',
                      background: '#f1f5f9',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                    }}>
                      Entire Batch
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginBottom: 16, marginTop: 4 }}>
                  {batch.department_name} • {batch.academic_year_name}
                </p>

                {subjects.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--admin-text-muted)' }}>
                    No subjects found for this batch's department.
                  </div>
                ) : (
                  sortedSems.map(sem => (
                    <div key={sem} className="semester-group">
                      <h3 className="semester-group__title">Semester {sem}</h3>
                      <div className="subject-cards">
                        {grouped[sem].map(s => {
                          const isMySubject = mySubjectIds.has(s.id);
                          const prog = ccProgress[`${batch.id}_${s.id}`] || { total: 0, completed: 0, percentage: 0 };
                          const isComplete = prog.total > 0 && prog.completed === prog.total;
                          const teacher = ccFaculty[`${batch.id}_${s.id}`] || s.assigned_faculty_names;

                          return (
                            <div
                              key={s.id}
                              className="subject-card"
                              onClick={() => navigate(`/cc/subjects/${s.id}/syllabus?batchId=${batch.batch_id}&divisionId=${batch.division_id || ''}&semesterNumber=${sem}`)}
                            >
                              <div className="subject-card__header">
                                <h4 className="subject-card__name">{s.name}</h4>
                                <span className="subject-card__code">{s.code}</span>
                              </div>
                              <div className="subject-card__tags" style={{ marginTop: 8 }}>
                                {isMySubject ? (
                                  <span className="subject-card__tag subject-card__tag--highlight">👨‍🏫 Taught by You</span>
                                ) : teacher ? (
                                  <span className="subject-card__tag" style={{ background: '#f1f5f9', color: '#1e293b', fontWeight: 600 }}>👨‍🏫 Faculty: {teacher}</span>
                                ) : (
                                  <span className="subject-card__tag" style={{ background: '#fffbeb', color: '#b45309' }}>⚠️ No Faculty Assigned</span>
                                )}
                                <span className="subject-card__tag">⭐ {s.credits} credits</span>
                                {(batch.department_name || s.department_name) && (
                                  <span className="subject-card__tag" style={{ background: 'rgba(0,169,180,0.08)', color: 'var(--color-primary-dark, #00838c)', fontWeight: 600 }}>
                                    🏛️ {batch.department_name || s.department_name}
                                  </span>
                                )}
                              </div>

                              {/* Syllabus progress bar */}
                              <div className="progress-bar-wrap" style={{ marginTop: 10 }}>
                                <div className="progress-bar-label">
                                  <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>Class Progress</span>
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

                              <div className="subject-card__footer" style={{ marginTop: 12 }}>
                                <span style={{ fontSize: '0.76rem', color: 'var(--admin-text-muted)' }}>
                                  {isComplete ? (
                                    <span style={{ color: '#16a34a', fontWeight: 600 }}>🟢 100% Completed</span>
                                  ) : prog.completed > 0 ? (
                                    <span style={{ color: '#00838c', fontWeight: 600 }}>🔵 In Progress</span>
                                  ) : (
                                    <span>⚪ Not Started</span>
                                  )}
                                </span>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isMySubject ? 'var(--color-primary-dark, #00838c)' : 'var(--color-primary-dark, #00838c)' }}>
                                  {isMySubject ? 'Manage Syllabus & Track →' : '👁️ View Class Syllabus (Read Only) →'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
