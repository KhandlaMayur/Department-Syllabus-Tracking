import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import masterApi from '../../api/masterApi';
import SyllabusViewer from '../../components/common/SyllabusViewer';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import '../../styles/admin.css';
import '../../styles/responsive.css';

export default function FacultySyllabusPage() {
  const { id: subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const divisionId = searchParams.get('divisionId');
  const semesterNumber = searchParams.get('semesterNumber');

  const [subject,        setSubject]        = useState(null);
  const [units,          setUnits]          = useState([]);
  const [completions,    setCompletions]    = useState([]);
  const [activatedUnits, setActivatedUnits] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [successMsg,     setSuccessMsg]     = useState('');
  const [errorMsg,       setErrorMsg]       = useState('');

  // Confirmation dialog state
  const [confirmOpen,    setConfirmOpen]    = useState(false);
  const [confirmTitle,   setConfirmTitle]   = useState('Confirm');
  const [confirmMsg,     setConfirmMsg]     = useState('');
  const [confirmBtnText, setConfirmBtnText] = useState('Yes, Completed');
  const [confirmVariant, setConfirmVariant] = useState('success');
  const [pendingAction,  setPendingAction]  = useState(null);
  const [actionLoading,  setActionLoading]  = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, sylRes] = await Promise.all([
        masterApi.subjects.get(subjectId),
        masterApi.subjects.getSyllabus(subjectId),
      ]);
      setSubject(subRes.data.data);
      setUnits(sylRes.data.data || []);

      if (divisionId) {
        try {
          const cRes = await masterApi.topicCompletions.getBySubjectBatch(subjectId, divisionId);
          setCompletions(cRes.data.data?.completions || []);
          setActivatedUnits(cRes.data.data?.activatedUnits || []);
        } catch {
          setCompletions([]);
          setActivatedUnits([]);
        }
      }
    } catch (e) {
      setErrorMsg('Failed to load syllabus.');
    } finally {
      setLoading(false);
    }
  }, [subjectId, divisionId]);

  useEffect(() => { loadData(); }, [loadData]);

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const compSet = useMemo(() => new Set(completions.map(c => c.subtopic_id)), [completions]);
  const actSet  = useMemo(() => new Set(activatedUnits), [activatedUnits]);

  // Prompt when clicking an individual topic
  const handleMarkTopic = (subtopic, isCurrentlyCompleted) => {
    const sem = semesterNumber || subject?.semester_number || 1;

    if (isCurrentlyCompleted) {
      setConfirmTitle('Unmark Topic');
      setConfirmMsg(`Are you sure you want to mark topic "${subtopic.title}" as pending?`);
      setConfirmBtnText('Yes, Mark Pending');
      setConfirmVariant('primary');
      setPendingAction({ type: 'topic', subtopic, isCurrentlyCompleted });
    } else {
      // Find parent unit and check if this is the last pending topic in the unit
      const parentUnit = units.find(u => u.id === subtopic.unit_id);
      const remainingPending = (parentUnit?.subtopics || []).filter(
        st => st.id !== subtopic.id && !compSet.has(st.id)
      );
      const isLastTopic = remainingPending.length === 0;

      if (isLastTopic && parentUnit) {
        // Last topic in unit
        setConfirmTitle('Complete Unit');
        setConfirmMsg(`Are you sure you want to teach this unit ("Unit ${parentUnit.unit_number}: ${parentUnit.unit_title}") for Semester ${sem} students? All topics in this unit will be marked as completed.`);
        setConfirmBtnText('Yes, Completed');
        setConfirmVariant('success');
      } else {
        // Regular topic completion
        setConfirmTitle('Confirm Topic Completion');
        setConfirmMsg(`Are you sure you want to complete this topic: "${subtopic.title}"?`);
        setConfirmBtnText('Yes, Completed');
        setConfirmVariant('success');
      }
      setPendingAction({ type: 'topic', subtopic, isCurrentlyCompleted });
    }
    setConfirmOpen(true);
  };

  // Prompt when clicking the unit-wise checkbox
  const handleMarkUnit = (unit, isUnitFullyCompleted) => {
    const sem = semesterNumber || subject?.semester_number || 1;
    const isUnitActive = actSet.has(unit.id);

    if (isUnitFullyCompleted) {
      // Unmark unit completely
      setConfirmTitle('Unmark Unit');
      setConfirmMsg(`Are you sure you want to mark Unit ${unit.unit_number}: "${unit.unit_title}" as pending for Semester ${sem} students?`);
      setConfirmBtnText('Yes, Mark Pending');
      setConfirmVariant('primary');
      setPendingAction({ type: 'unit_deactivate', unit });
    } else if (!isUnitActive) {
      // Start teaching unit (Unit 1 click)
      setConfirmTitle('Start Teaching Unit');
      setConfirmMsg(`Are you sure you want to teach this unit ("Unit ${unit.unit_number}: ${unit.unit_title}") for Semester ${sem} students?`);
      setConfirmBtnText('Yes, I want to teach this Unit');
      setConfirmVariant('success');
      setPendingAction({ type: 'unit_activate', unit });
    } else {
      // Unit is already active -> complete all topics in unit
      setConfirmTitle('Complete Unit');
      setConfirmMsg(`Are you sure you want to teach this unit ("Unit ${unit.unit_number}: ${unit.unit_title}") for Semester ${sem} students? All topics in this unit will be marked as completed.`);
      setConfirmBtnText('Yes, Completed');
      setConfirmVariant('success');
      setPendingAction({ type: 'unit_complete_all', unit });
    }
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
          await masterApi.topicCompletions.unmark(subtopic.id, divisionId);
          showSuccess(`"${subtopic.title}" marked as pending.`);
        } else {
          await masterApi.topicCompletions.mark({
            subtopicId: subtopic.id,
            subjectId: Number(subjectId),
            batchId: Number(divisionId),
            semesterNumber: Number(semesterNumber) || 1,
          });
          showSuccess(`"${subtopic.title}" marked as completed!`);
        }
      } else if (pendingAction.type === 'unit_activate') {
        const { unit } = pendingAction;
        await masterApi.topicCompletions.activateUnit({
          unitId: unit.id,
          subjectId: Number(subjectId),
          batchId: Number(divisionId),
        });
        showSuccess(`Unit ${unit.unit_number} is now active for Semester ${semesterNumber || subject?.semester_number || 1} students!`);
      } else if (pendingAction.type === 'unit_complete_all') {
        const { unit } = pendingAction;
        await masterApi.topicCompletions.markUnit({
          unitId: unit.id,
          subjectId: Number(subjectId),
          batchId: Number(divisionId),
          semesterNumber: Number(semesterNumber) || 1,
        });
        showSuccess(`Unit ${unit.unit_number} and all topics marked as completed!`);
      } else if (pendingAction.type === 'unit_deactivate') {
        const { unit } = pendingAction;
        await masterApi.topicCompletions.deactivateUnit(unit.id, divisionId);
        showSuccess(`Unit ${unit.unit_number} marked as pending.`);
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

  // Calculate overall progress
  const totalTopics = units.reduce((sum, u) => sum + (u.subtopics?.length || 0), 0);
  const completedTopics = completions.length;
  const pct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  return (
    <div className="admin-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        ← Back to My Subjects
      </button>

      <div className="admin-page__header">
        <div className="admin-page__title-group">
          <h1 className="admin-page__title">
            {subject?.name || 'Subject Syllabus'}
          </h1>
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
        activatedUnits={activatedUnits}
        canMark={true}
        onMark={handleMarkTopic}
        onMarkUnit={handleMarkUnit}
        loading={loading}
      />

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
    </div>
  );
}
