import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import masterApi from '../../api/masterApi';
import SyllabusViewer from '../../components/common/SyllabusViewer';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Dialog from '../../components/common/Dialog';
import '../../styles/admin.css';
import '../../styles/responsive.css';

/**
 * CC Syllabus Page
 * - If personally assigned to CC: Full faculty marking & completion permissions.
 * - If other class subject: Checkboxes locked. Status shows 'Awaiting Student Feedback'
 *   until students review it. CC can only give feedback AFTER at least one student submits feedback.
 * - If CC changes mid-semester: New CC sees all previous CC feedback and history.
 */
export default function CCSyllabusPage() {
  const { user } = useAuth();
  const { id: subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const divisionId = searchParams.get('divisionId');
  const batchIdParam = searchParams.get('batchId');
  const batchId = divisionId || batchIdParam;
  const semesterNumber = searchParams.get('semesterNumber');

  const [subject,                 setSubject]                 = useState(null);
  const [units,                   setUnits]                   = useState([]);
  const [completions,             setCompletions]             = useState([]);
  const [studentFeedbackStatsMap, setStudentFeedbackStatsMap] = useState({});
  const [ccFeedbackMap,           setCcFeedbackMap]           = useState({});
  const [loading,                 setLoading]                 = useState(true);
  const [successMsg,              setSuccessMsg]              = useState('');
  const [errorMsg,                setErrorMsg]                = useState('');
  const [isMySubject,             setIsMySubject]             = useState(false);
  const [assignedFacultyName,     setAssignedFacultyName]     = useState('');

  // Confirmation dialog state (for marking own subjects)
  const [confirmOpen,    setConfirmOpen]    = useState(false);
  const [confirmTitle,   setConfirmTitle]   = useState('Confirm');
  const [confirmMsg,     setConfirmMsg]     = useState('');
  const [confirmBtnText, setConfirmBtnText] = useState('Yes, Completed');
  const [confirmVariant, setConfirmVariant] = useState('success');
  const [pendingAction,  setPendingAction]  = useState(null);
  const [actionLoading,  setActionLoading]  = useState(false);

  // CC Feedback Modal state
  const [ccModalOpen,     setCcModalOpen]     = useState(false);
  const [selectedCCTopic, setSelectedCCTopic] = useState(null); // { subtopic, completion, studentStats, ccFb }
  const [ccRating,        setCcRating]        = useState(0);
  const [ccComment,       setCcComment]       = useState('');
  const [ccHover,         setCcHover]         = useState(0);
  const [submittingCC,    setSubmittingCC]    = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, sylRes, myAssRes] = await Promise.all([
        masterApi.subjects.get(subjectId),
        masterApi.subjects.getSyllabus(subjectId),
        masterApi.assignments.my(),
      ]);
      setSubject(subRes.data.data);
      setUnits(sylRes.data.data || []);

      const myAss = myAssRes.data?.data || [];
      const isMine = myAss.some(a => String(a.subject_id) === String(subjectId));
      setIsMySubject(isMine);

      if (batchId) {
        // Load completions, student feedback, and CC feedback in parallel
        const queryParams = divisionId ? { divisionId } : undefined;
        const [cRes, sfRes, cfRes] = await Promise.all([
          masterApi.topicCompletions.getBySubjectBatch(subjectId, batchId, queryParams).catch(() => ({ data: { data: { completions: [] } } })),
          masterApi.studentFeedback.getBySubject(subjectId, batchId).catch(() => ({ data: { data: [] } })),
          masterApi.ccFeedback.getBySubject(subjectId, batchId).catch(() => ({ data: { data: [] } })),
        ]);

        setCompletions(cRes.data.data?.completions || []);

        // Process student feedback stats
        const sfRows = sfRes.data?.data || [];
        const sfMap = {};
        for (const sf of sfRows) {
          if (!sfMap[sf.subtopic_id]) {
            sfMap[sf.subtopic_id] = { count: 0, totalRating: 0, list: [] };
          }
          sfMap[sf.subtopic_id].count += 1;
          sfMap[sf.subtopic_id].totalRating += Number(sf.rating || 0);
          sfMap[sf.subtopic_id].list.push(sf);
        }
        for (const k of Object.keys(sfMap)) {
          sfMap[k].avgRating = (sfMap[k].totalRating / sfMap[k].count).toFixed(1);
        }
        setStudentFeedbackStatsMap(sfMap);

        // Process CC feedback (differentiating current user vs previous CCs)
        const cfRows = cfRes.data?.data || [];
        const cfMap = {};
        for (const cf of cfRows) {
          if (!cfMap[cf.subtopic_id]) {
            cfMap[cf.subtopic_id] = { myFeedback: null, previousFeedbacks: [], all: [] };
          }
          cfMap[cf.subtopic_id].all.push(cf);
          if (String(cf.faculty_id) === String(user?.id)) {
            cfMap[cf.subtopic_id].myFeedback = cf;
          } else {
            cfMap[cf.subtopic_id].previousFeedbacks.push(cf);
          }
        }
        setCcFeedbackMap(cfMap);

        // If not my subject, look up who teaches it
        if (!isMine) {
          try {
            const divAssRes = await masterApi.assignments.list({ divisionId: batchId, limit: 100 });
            const rows = divAssRes.data?.data?.rows || [];
            const matched = rows.find(r => String(r.subject_id) === String(subjectId));
            if (matched) setAssignedFacultyName(matched.faculty_name);
          } catch {}
        }
      }
    } catch {
      setErrorMsg('Failed to load syllabus.');
    } finally {
      setLoading(false);
    }
  }, [subjectId, batchId, user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  // Faculty actions for personally taught subjects
  const handleMarkTopic = (subtopic, isCurrentlyCompleted) => {
    if (isCurrentlyCompleted) {
      setConfirmTitle('Unmark Topic');
      setConfirmMsg(`Are you sure you want to mark topic "${subtopic.title}" as pending?`);
      setConfirmBtnText('Yes, Mark Pending');
      setConfirmVariant('primary');
    } else {
      setConfirmTitle('Confirm Topic Completion');
      setConfirmMsg(`Are you sure you want to complete this topic: "${subtopic.title}"?`);
      setConfirmBtnText('Yes, Completed');
      setConfirmVariant('success');
    }
    setPendingAction({ type: 'topic', subtopic, isCurrentlyCompleted });
    setConfirmOpen(true);
  };

  const handleMarkUnit = (unit, isUnitCurrentlyCompleted) => {
    const sem = semesterNumber || subject?.semester_number || 1;
    if (isUnitCurrentlyCompleted) {
      setConfirmTitle('Unmark Unit');
      setConfirmMsg(`Are you sure you want to mark Unit ${unit.unit_number}: "${unit.unit_title}" as pending for Semester ${sem} students?`);
      setConfirmBtnText('Yes, Mark Pending');
      setConfirmVariant('primary');
    } else {
      setConfirmTitle('Start Teaching Unit');
      setConfirmMsg(`Are you sure you want to teach this unit ("Unit ${unit.unit_number}: ${unit.unit_title}") for Semester ${sem} students?`);
      setConfirmBtnText('Yes, I want to teach this Unit');
      setConfirmVariant('success');
    }
    setPendingAction({ type: 'unit', unit, isCurrentlyCompleted: isUnitCurrentlyCompleted });
    setConfirmOpen(true);
  };

  const doConfirm = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      if (pendingAction.type === 'topic') {
        const { subtopic, isCurrentlyCompleted } = pendingAction;
        if (isCurrentlyCompleted) {
          await masterApi.topicCompletions.unmark(subtopic.id, batchId);
          showSuccess(`"${subtopic.title}" marked as pending.`);
        } else {
          await masterApi.topicCompletions.mark({
            subtopicId: subtopic.id,
            subjectId: Number(subjectId),
            batchId: Number(batchId),
            semesterNumber: Number(semesterNumber) || 1,
          });
          showSuccess(`"${subtopic.title}" marked as completed!`);
        }
      } else if (pendingAction.type === 'unit') {
        const { unit, isCurrentlyCompleted } = pendingAction;
        if (isCurrentlyCompleted) {
          await masterApi.topicCompletions.unmarkUnit(unit.id, batchId);
          showSuccess(`Unit ${unit.unit_number} marked as pending.`);
        } else {
          await masterApi.topicCompletions.markUnit({
            unitId: unit.id,
            subjectId: Number(subjectId),
            batchId: Number(batchId),
            semesterNumber: Number(semesterNumber) || 1,
          });
          showSuccess(`Unit ${unit.unit_number} marked as completed!`);
        }
      }
      setConfirmOpen(false);
      setPendingAction(null);
      loadData();
    } catch (e) {
      setErrorMsg(e?.response?.data?.error?.message || 'Operation failed.');
      setConfirmOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  // CC Feedback Handlers
  const handleOpenCCFeedback = (subtopic, completion, studentStats, ccFb) => {
    setSelectedCCTopic({ subtopic, completion, studentStats, ccFb });
    setCcRating(ccFb?.myFeedback?.rating || 0);
    setCcComment(ccFb?.myFeedback?.comment || '');
    setCcHover(0);
    setCcModalOpen(true);
  };

  const handleSubmitCCFeedback = async () => {
    if (!ccRating) {
      setErrorMsg('Please select a rating for your CC review.');
      return;
    }
    setSubmittingCC(true);
    setErrorMsg('');
    try {
      await masterApi.ccFeedback.submit({
        subtopicId: selectedCCTopic.subtopic.id,
        subjectId: Number(subjectId),
        batchId: Number(batchId),
        divisionId: divisionId ? Number(divisionId) : null,
        semesterNumber: Number(semesterNumber || subject?.semester_number || 1),
        rating: ccRating,
        comment: ccComment || null,
      });

      showSuccess('Class Coordinator feedback submitted successfully!');
      setCcModalOpen(false);
      setSelectedCCTopic(null);
      loadData();
    } catch (err) {
      setErrorMsg(err?.response?.data?.error?.message || 'Failed to submit CC feedback.');
    } finally {
      setSubmittingCC(false);
    }
  };

  const totalTopics = units.reduce((sum, u) => sum + (u.subtopics?.length || 0), 0);
  const completedTopics = completions.length;
  const pct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  return (
    <div className="admin-page">
      <button className="back-link" onClick={() => navigate(-1)}>← Back</button>

      <div className="admin-page__header">
        <div className="admin-page__title-group">
          <h1 className="admin-page__title">{subject?.name || 'Subject Syllabus'}</h1>
          <p className="admin-page__subtitle">
            {subject?.code} • Semester {semesterNumber || subject?.semester_number}
          </p>
        </div>
      </div>

      {successMsg && <div className="toast toast--success">{successMsg}</div>}
      {errorMsg && <div className="toast toast--error">{errorMsg}</div>}

      {/* Observation Banner if this subject is taught by another faculty */}
      {!isMySubject && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(0, 169, 180, 0.08) 0%, rgba(0, 131, 140, 0.04) 100%)',
            border: '1px solid rgba(0, 169, 180, 0.28)',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
          }}
        >
          <div style={{ fontSize: '1.8rem', lineHeight: 1, marginTop: 2 }}>👁️</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--color-primary-dark, #00838c)' }}>
                Class Coordinator Monitoring View
              </span>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                background: '#f1f5f9',
                color: '#334155',
                padding: '2px 8px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
              }}>
                🔒 Checkboxes Locked
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.45 }}>
              {assignedFacultyName ? (
                <>
                  This subject is taught by <strong>{assignedFacultyName}</strong>. Topic checkboxes are locked for coordination. Once students submit feedback on covered topics, you can review student feedback and provide your CC feedback.
                </>
              ) : (
                <>
                  As Class Coordinator, you can monitor syllabus progress and student feedback. You can submit CC feedback on covered topics once students have provided feedback.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* If it's my assigned subject */}
      {isMySubject && (
        <div
          style={{
            background: 'rgba(22, 163, 74, 0.08)',
            border: '1px solid rgba(22, 163, 74, 0.25)',
            borderRadius: 10,
            padding: '12px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>👨‍🏫</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#15803d' }}>
            My Assigned Subject — You are the primary instructor. You have full permissions to activate units and mark topics.
          </span>
        </div>
      )}

      {!loading && totalTopics > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="progress-bar-wrap">
            <div className="progress-bar-label">
              <span style={{ fontWeight: 600 }}>Overall Syllabus Progress</span>
              <span style={{ fontWeight: 600, color: pct === 100 ? '#16a34a' : 'inherit' }}>
                {completedTopics}/{totalTopics} topics • {pct}%
              </span>
            </div>
            <div className="progress-bar" style={{ height: 12 }}>
              <div
                className={`progress-bar__fill ${pct === 100 ? 'progress-bar__fill--complete' : ''}`}
                style={{ width: `${pct}%`, background: pct === 100 ? '#16a34a' : undefined }}
              />
            </div>
          </div>
        </div>
      )}

      <SyllabusViewer
        units={units}
        completions={completions}
        canMark={isMySubject}
        ccMode={!isMySubject}
        studentFeedbackStatsMap={studentFeedbackStatsMap}
        ccFeedbackMap={ccFeedbackMap}
        onCCFeedback={handleOpenCCFeedback}
        onMark={isMySubject ? handleMarkTopic : undefined}
        onMarkUnit={isMySubject ? handleMarkUnit : undefined}
        loading={loading}
      />

      {/* Confirmation Dialog for marking personal subjects */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMsg}
        confirmText={confirmBtnText}
        confirmVariant={confirmVariant}
        onConfirm={doConfirm}
        onCancel={() => { setConfirmOpen(false); setPendingAction(null); }}
        loading={actionLoading}
      />

      {/* Class Coordinator Topic Review & Feedback Dialog */}
      <Dialog
        open={ccModalOpen}
        title="Class Coordinator Topic Review"
        onClose={() => { setCcModalOpen(false); setSelectedCCTopic(null); }}
        size="md"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setCcModalOpen(false)}
              disabled={submittingCC}
            >
              Close
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmitCCFeedback}
              disabled={submittingCC || ccRating === 0}
            >
              {submittingCC ? 'Saving…' : 'Submit CC Feedback'}
            </button>
          </>
        }
      >
        {selectedCCTopic && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Topic Information Card */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(0, 169, 180, 0.08)',
                border: '1px solid rgba(0, 169, 180, 0.25)',
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary-dark, #00838c)', textTransform: 'uppercase', marginBottom: 2 }}>
                Topic Under Review
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--admin-text)' }}>
                {selectedCCTopic.subtopic.title}
              </div>
              {selectedCCTopic.completion && (
                <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', marginTop: 4 }}>
                  Taught by: <strong>{selectedCCTopic.completion.completed_by_name || assignedFacultyName || 'Assigned Faculty'}</strong> •{' '}
                  Covered on {new Date(selectedCCTopic.completion.completed_at).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Student Feedback Summary Card */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                  🎓 Student Reviews
                </span>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f59e0b' }}>
                  ⭐ {selectedCCTopic.studentStats?.avgRating || '—'} / 5 ({selectedCCTopic.studentStats?.count || 0} reviews)
                </span>
              </div>

              {selectedCCTopic.studentStats?.list && selectedCCTopic.studentStats.list.length > 0 ? (
                <div style={{ maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
                  {selectedCCTopic.studentStats.list.map(sfb => (
                    <div
                      key={sfb.id}
                      style={{
                        fontSize: '0.8rem',
                        padding: '6px 10px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        lineHeight: 1.35,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.74rem', marginBottom: 2 }}>
                        <span>{sfb.student_name}</span>
                        <span>{'★'.repeat(sfb.rating)}{'☆'.repeat(5 - sfb.rating)}</span>
                      </div>
                      {sfb.comment && <div style={{ color: '#1e293b' }}>"{sfb.comment}"</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                  No student reviews submitted yet.
                </div>
              )}
            </div>

            {/* Previous CC Feedback (if semester CC changed mid-way) */}
            {selectedCCTopic.ccFb?.previousFeedbacks && selectedCCTopic.ccFb.previousFeedbacks.length > 0 && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#166534', marginBottom: 6 }}>
                  📋 Previous Class Coordinator Feedback & Status
                </div>
                {selectedCCTopic.ccFb.previousFeedbacks.map(prev => (
                  <div key={prev.id} style={{ fontSize: '0.82rem', color: '#14532d', lineHeight: 1.4 }}>
                    <div>
                      <strong>{prev.cc_faculty_name}</strong> ({prev.designation || 'Previous CC'}):
                      <span style={{ color: '#d97706', marginLeft: 6 }}>
                        {'★'.repeat(prev.rating)} ({prev.rating}/5)
                      </span>
                    </div>
                    {prev.comment && (
                      <div style={{ marginTop: 2, fontStyle: 'italic' }}>
                        "{prev.comment}"
                      </div>
                    )}
                    <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: 2 }}>
                      Submitted on {new Date(prev.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CC Rating & Comments Form */}
            <div>
              <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: 'var(--admin-text)', marginBottom: 6 }}>
                Your CC Topic Rating:
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
                      color: star <= (ccHover || ccRating) ? '#f59e0b' : '#cbd5e1',
                      transition: 'transform 0.15s ease, color 0.15s ease',
                      transform: star <= (ccHover || ccRating) ? 'scale(1.15)' : 'none',
                    }}
                    onMouseEnter={() => setCcHover(star)}
                    onMouseLeave={() => setCcHover(0)}
                    onClick={() => setCcRating(star)}
                    title={`${star} star${star > 1 ? 's' : ''}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: 'var(--admin-text)', marginBottom: 6 }}>
                Class Coordinator Remarks & Feedback:
              </label>
              <textarea
                value={ccComment}
                onChange={e => setCcComment(e.target.value)}
                placeholder="Enter coordination feedback, syllabus depth review, or remarks on student understanding…"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--admin-border, #e2e8f0)',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
