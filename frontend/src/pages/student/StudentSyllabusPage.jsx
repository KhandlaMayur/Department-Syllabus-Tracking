import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import masterApi from '../../api/masterApi';
import SyllabusViewer from '../../components/common/SyllabusViewer';
import Dialog from '../../components/common/Dialog';
import '../../styles/admin.css';
import '../../styles/responsive.css';

export default function StudentSyllabusPage() {
  const { id: subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const batchId = searchParams.get('batchId');
  const semesterNumber = searchParams.get('semesterNumber');

  const [subject,     setSubject]     = useState(null);
  const [units,       setUnits]       = useState([]);
  const [completions, setCompletions] = useState([]);
  const [myFeedback,  setMyFeedback]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [successMsg,  setSuccessMsg]  = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');

  // Feedback dialog
  const [fbDialogOpen, setFbDialogOpen] = useState(false);
  const [fbTarget,     setFbTarget]     = useState(null); // { subtopic, completion }
  const [fbRating,     setFbRating]     = useState(0);
  const [fbComment,    setFbComment]    = useState('');
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbHover,      setFbHover]      = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, sylRes] = await Promise.all([
        masterApi.subjects.get(subjectId),
        masterApi.subjects.getSyllabus(subjectId),
      ]);
      setSubject(subRes.data.data);
      setUnits(sylRes.data.data || []);

      if (batchId) {
        try {
          const cRes = await masterApi.topicCompletions.getBySubjectBatch(subjectId, batchId);
          setCompletions(cRes.data.data?.completions || []);
        } catch { setCompletions([]); }

        try {
          const fRes = await masterApi.studentFeedback.getMy(subjectId, batchId);
          setMyFeedback(fRes.data.data || []);
        } catch { setMyFeedback([]); }
      }
    } catch {
      setErrorMsg('Failed to load syllabus.');
    } finally {
      setLoading(false);
    }
  }, [subjectId, batchId]);

  useEffect(() => { loadData(); }, [loadData]);

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  // Open feedback dialog
  const handleFeedback = (subtopic, completion) => {
    const existing = myFeedback.find(f => f.subtopic_id === subtopic.id);
    setFbTarget({ subtopic, completion });
    setFbRating(existing?.rating || 0);
    setFbComment(existing?.comment || '');
    setFbHover(0);
    setFbDialogOpen(true);
  };

  // Submit feedback
  const submitFeedback = async () => {
    if (fbRating === 0) { setErrorMsg('Please select a rating.'); return; }
    setFbSubmitting(true);
    setErrorMsg('');
    try {
      await masterApi.studentFeedback.submit({
        subtopicId: fbTarget.subtopic.id,
        subjectId: Number(subjectId),
        batchId: Number(batchId),
        semesterNumber: Number(semesterNumber) || 1,
        rating: fbRating,
        comment: fbComment || null,
      });
      showSuccess('Feedback submitted successfully!');
      setFbDialogOpen(false);
      setFbTarget(null);
      loadData();
    } catch (e) {
      setErrorMsg(e?.response?.data?.error?.message || 'Failed to submit feedback.');
    } finally {
      setFbSubmitting(false);
    }
  };

  const totalTopics = units.reduce((sum, u) => sum + (u.subtopics?.length || 0), 0);
  const completedTopics = completions.length;
  const pct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  return (
    <div className="admin-page">
      <button className="back-link" onClick={() => navigate(-1)}>← Back to My Subjects</button>

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

      {/* Overall progress */}
      {!loading && totalTopics > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="progress-bar-wrap">
            <div className="progress-bar-label">
              <span style={{ fontWeight: 600 }}>Syllabus Progress</span>
              <span>{completedTopics}/{totalTopics} topics • {pct}%</span>
            </div>
            <div className="progress-bar" style={{ height: 12 }}>
              <div className={`progress-bar__fill ${pct === 100 ? 'progress-bar__fill--complete' : ''}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      )}

      <SyllabusViewer
        units={units}
        completions={completions}
        canMark={false}
        studentMode={true}
        onTopicClick={handleFeedback}
        showFeedback={true}
        onFeedback={handleFeedback}
        myFeedback={myFeedback}
        loading={loading}
      />

      {/* Feedback Dialog */}
      <Dialog
        open={fbDialogOpen}
        title="Give Feedback"
        onClose={() => { setFbDialogOpen(false); setFbTarget(null); }}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setFbDialogOpen(false)} disabled={fbSubmitting}>Cancel</button>
            <button className="btn-primary" onClick={submitFeedback} disabled={fbSubmitting || fbRating === 0}>
              {fbSubmitting ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </>
        }
      >
        {fbTarget && (
          <>
            <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginBottom: 4 }}>
              Topic: <strong style={{ color: 'var(--admin-text)' }}>{fbTarget.subtopic.title}</strong>
            </div>
            {fbTarget.completion && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                Covered by {fbTarget.completion.completed_by_name}
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--admin-text-muted)', display: 'block', marginBottom: 8 }}>
                How was this topic taught? <span style={{ color: 'var(--admin-danger)' }}>*</span>
              </label>
              <div className="feedback-stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    className={`feedback-star ${(fbHover || fbRating) >= star ? 'feedback-star--active' : ''}`}
                    onClick={() => setFbRating(star)}
                    onMouseEnter={() => setFbHover(star)}
                    onMouseLeave={() => setFbHover(0)}
                  >
                    ★
                  </button>
                ))}
                {fbRating > 0 && (
                  <span style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginLeft: 8, alignSelf: 'center' }}>
                    {fbRating}/5
                  </span>
                )}
              </div>
            </div>

            <div className="form-field" style={{ marginTop: 4 }}>
              <label className="form-field__label">Comment (optional)</label>
              <textarea
                className="form-field__textarea"
                rows={3}
                value={fbComment}
                onChange={e => setFbComment(e.target.value)}
                placeholder="Share your thoughts about this topic…"
              />
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
