import { useState } from 'react';
import '../../styles/responsive.css';

/**
 * Reusable syllabus viewer component.
 * Shows syllabus units + subtopics with unit activation, completion badges, and feedback.
 *
 * Props:
 * - units: array of syllabus units with subtopics
 * - completions: array of topic_completions records
 * - activatedUnits: array of unit IDs activated for teaching
 * - canMark: boolean — show checkboxes for marking topics
 * - onMark(subtopic, isCompleted): callback when marking/unmarking topic
 * - onMarkUnit(unit, isUnitFullyCompleted): callback when clicking unit-level checkbox
 * - studentMode: boolean — when true, shows checkboxes locked by default until faculty completes the topic
 * - onTopicClick(subtopic, completion): callback when student clicks an unlocked completed topic for review
 * - onFeedback(subtopic, completion): callback when student opens feedback
 * - showFeedback: boolean — show feedback button for covered topics
 * - myFeedback: array of student's own feedback
 * - ccMode: boolean — Class Coordinator observation mode for other subjects
 * - studentFeedbackStatsMap: object — subtopic_id -> { count, avgRating, list }
 * - ccFeedbackMap: object — subtopic_id -> { myFeedback, previousFeedbacks, all }
 * - onCCFeedback: callback(subtopic, completion, studentStats, ccFb)
 * - loading: boolean
 */
export default function SyllabusViewer({
  units = [],
  completions = [],
  activatedUnits = [],
  canMark = false,
  onMark,
  onMarkUnit,
  studentMode = false,
  onTopicClick,
  showFeedback = false,
  onFeedback,
  myFeedback = [],
  ccMode = false,
  studentFeedbackStatsMap = {},
  ccFeedbackMap = {},
  onCCFeedback,
  loading = false,
}) {
  const [expanded, setExpanded] = useState({});

  const toggleUnit = (unitId) => {
    setExpanded(prev => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  // Build a set of completed subtopic IDs for quick lookup
  const completedMap = {};
  for (const c of completions) {
    completedMap[c.subtopic_id] = c;
  }

  // Set of activated unit IDs
  const actSet = new Set(activatedUnits);

  // Also consider unit active if it has at least one completed topic
  for (const c of completions) {
    if (c.unit_id) actSet.add(c.unit_id);
  }

  // Build feedback map
  const feedbackMap = {};
  for (const f of myFeedback) {
    feedbackMap[f.subtopic_id] = f;
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--admin-text-muted)' }}>Loading syllabus…</div>;
  }

  if (units.length === 0) {
    return (
      <div className="empty-inline">
        <div className="empty-inline__icon">📋</div>
        <div className="empty-inline__title">No syllabus available</div>
        <div className="empty-inline__sub">Syllabus topics have not been added for this subject yet.</div>
      </div>
    );
  }

  // Calculate per-unit progress
  const getUnitProgress = (unit) => {
    const total = (unit.subtopics || []).length;
    const completed = (unit.subtopics || []).filter(st => completedMap[st.id]).length;
    return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  return (
    <div>
      {units.map(unit => {
        const isOpen = expanded[unit.id] !== false; // default open
        const progress = getUnitProgress(unit);
        const isUnitFullyCompleted = progress.total > 0 && progress.completed === progress.total;
        const isUnitActive = actSet.has(unit.id) || progress.completed > 0;

        return (
          <div key={unit.id} className="syllabus-unit">
            <div className="syllabus-unit__header" onClick={() => toggleUnit(unit.id)}>
              <div className="syllabus-unit__header-left">
                {/* Checkbox for Faculty */}
                {canMark && onMarkUnit && (
                  <input
                    type="checkbox"
                    className="syllabus-unit__checkbox"
                    checked={isUnitFullyCompleted || isUnitActive}
                    ref={el => {
                      if (el) {
                        el.indeterminate = !isUnitFullyCompleted && isUnitActive && progress.completed > 0;
                      }
                    }}
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      e.stopPropagation();
                      onMarkUnit(unit, isUnitFullyCompleted);
                    }}
                    title={
                      isUnitFullyCompleted
                        ? 'Unmark entire unit'
                        : isUnitActive
                        ? 'Unit is active: Click to complete all topics'
                        : 'Click to start teaching this unit'
                    }
                  />
                )}

                {/* Checkbox for Student or CC Observation */}
                {!canMark && (studentMode || ccMode) && (
                  <input
                    type="checkbox"
                    className="syllabus-unit__checkbox"
                    checked={isUnitFullyCompleted}
                    disabled={true}
                    ref={el => {
                      if (el) {
                        el.indeterminate = !isUnitFullyCompleted && isUnitActive && progress.completed > 0;
                      }
                    }}
                    onClick={e => e.stopPropagation()}
                    style={{ cursor: 'default' }}
                    title={
                      ccMode
                        ? 'Checkboxes locked: Class Coordinator observation view'
                        : isUnitFullyCompleted
                        ? 'Chapter covered (100%)'
                        : isUnitActive
                        ? `In Progress: ${progress.completed}/${progress.total} topics covered`
                        : 'Unit not started by faculty yet'
                    }
                  />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="syllabus-unit__title">
                      Unit {unit.unit_number}: {unit.unit_title}
                    </span>

                    {/* Unit Status Badge */}
                    {isUnitFullyCompleted ? (
                      <span className="syllabus-topic__badge syllabus-topic__badge--completed" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                        ✓ Chapter Covered
                      </span>
                    ) : isUnitActive ? (
                      <span
                        className="syllabus-topic__badge"
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          background: 'rgba(0, 169, 180, 0.12)',
                          color: 'var(--admin-accent)',
                          border: '1px solid rgba(0, 169, 180, 0.25)',
                        }}
                      >
                        🔵 In Progress
                      </span>
                    ) : (
                      <span
                        className="syllabus-topic__badge syllabus-topic__badge--pending"
                        style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                      >
                        ⚪ Not Started
                      </span>
                    )}
                  </div>

                  {/* Mini progress */}
                  <div style={{ marginTop: 6 }}>
                    <div className="progress-bar" style={{ height: 5, maxWidth: 220 }}>
                      <div
                        className={`progress-bar__fill ${progress.pct === 100 ? 'progress-bar__fill--complete' : ''}`}
                        style={{ width: `${progress.pct}%`, background: progress.pct === 100 ? '#16a34a' : undefined }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="syllabus-unit__count">
                {progress.completed}/{progress.total} topics • {progress.pct}%
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', marginLeft: 8 }}>
                {isOpen ? '▾' : '▸'}
              </span>
            </div>

            {isOpen && (
              <div>
                {(!unit.subtopics || unit.subtopics.length === 0) ? (
                  <div style={{ padding: '16px 20px', color: 'var(--admin-text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                    No topics added yet.
                  </div>
                ) : (
                  unit.subtopics.map(st => {
                    const isCompleted = Boolean(completedMap[st.id]);
                    const completion = completedMap[st.id];
                    const hasFeedback = Boolean(feedbackMap[st.id]);
                    const studentStats = studentFeedbackStatsMap[st.id];
                    const ccFb = ccFeedbackMap[st.id];
                    const hasStudentReviews = studentStats && studentStats.count > 0;

                    // Determine row interactivity
                    let rowClass = 'syllabus-topic';
                    if (isCompleted) rowClass += ' syllabus-topic--completed';

                    let rowOnClick = undefined;
                    let rowTitle = undefined;

                    if (canMark) {
                      rowClass += ' syllabus-topic--clickable';
                      rowOnClick = () => onMark && onMark(st, isCompleted);
                      rowTitle = isCompleted ? 'Click to unmark topic' : 'Click to complete topic';
                    } else if (studentMode) {
                      if (isCompleted) {
                        rowClass += ' syllabus-topic--clickable';
                        rowOnClick = () => {
                          if (onTopicClick) onTopicClick(st, completion);
                          else if (onFeedback) onFeedback(st, completion);
                        };
                        rowTitle = 'Topic unlocked: Click for review';
                      } else {
                        rowClass += ' syllabus-topic--disabled';
                        rowTitle = 'Checkbox locked: Topic pending faculty coverage (not clickable)';
                      }
                    } else if (ccMode) {
                      if (isCompleted && hasStudentReviews) {
                        rowClass += ' syllabus-topic--clickable';
                        rowOnClick = () => {
                          onCCFeedback && onCCFeedback(st, completion, studentStats, ccFb);
                        };
                        rowTitle = 'Student feedback available: Click to review or provide CC feedback';
                      } else if (isCompleted) {
                        rowClass += ' syllabus-topic--disabled';
                        rowTitle = 'Waiting for student feedback before CC can provide feedback';
                      } else {
                        rowClass += ' syllabus-topic--disabled';
                        rowTitle = 'Topic pending faculty coverage';
                      }
                    }

                    return (
                      <div
                        key={st.id}
                        className={rowClass}
                        onClick={rowOnClick}
                        title={rowTitle}
                      >
                        {/* Checkbox for Faculty */}
                        {canMark ? (
                          <input
                            type="checkbox"
                            className="syllabus-topic__checkbox"
                            checked={isCompleted}
                            onClick={e => e.stopPropagation()}
                            onChange={() => onMark && onMark(st, isCompleted)}
                            title={isCompleted ? 'Unmark as covered' : 'Mark as covered'}
                          />
                        ) : studentMode ? (
                          /* Checkbox for Student (reflects marked as done by student) */
                          <input
                            type="checkbox"
                            className={`syllabus-topic__checkbox ${isCompleted ? 'syllabus-topic__checkbox--unlocked' : 'syllabus-topic__checkbox--locked'}`}
                            checked={Boolean(hasFeedback && feedbackMap[st.id]?.is_completed !== 0)}
                            disabled={!isCompleted}
                            readOnly={true}
                            onClick={e => {
                              if (isCompleted) {
                                e.stopPropagation();
                                if (onTopicClick) onTopicClick(st, completion);
                                else if (onFeedback) onFeedback(st, completion);
                              }
                            }}
                            title={
                              !isCompleted
                                ? 'Checkbox locked: Topic pending faculty coverage'
                                : (hasFeedback && feedbackMap[st.id]?.is_completed !== 0)
                                ? 'Marked as Done by you (Click to view/edit review)'
                                : 'Topic covered by faculty: Click to mark as done and give feedback'
                            }
                          />
                        ) : ccMode ? (
                          /* Checkbox for CC Observation Mode: strictly locked */
                          <input
                            type="checkbox"
                            className={`syllabus-topic__checkbox ${isCompleted ? 'syllabus-topic__checkbox--unlocked' : 'syllabus-topic__checkbox--locked'}`}
                            checked={isCompleted}
                            disabled={true}
                            readOnly={true}
                            style={{ cursor: 'default' }}
                            title="Checkbox locked: Only assigned subject teacher can mark topics"
                          />
                        ) : (
                          <span
                            style={{
                              flexShrink: 0,
                              width: 22,
                              height: 22,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.875rem',
                              fontWeight: 700,
                              color: isCompleted ? '#16a34a' : 'var(--admin-text-muted)',
                            }}
                          >
                            {isCompleted ? '✓' : '○'}
                          </span>
                        )}

                        <div className="syllabus-topic__content">
                          <div className={`syllabus-topic__title ${isCompleted ? 'syllabus-topic__title--covered' : ''}`}>
                            {st.title}
                          </div>

                          {isCompleted && completion && (
                            <div className="syllabus-topic__meta">
                              <span>✓ Covered by {completion.completed_by_name || 'Faculty'}</span>
                              <span>•</span>
                              <span>{new Date(completion.completed_at).toLocaleDateString()}</span>
                            </div>
                          )}

                          {/* Review / Feedback button for students when unlocked */}
                          {showFeedback && isCompleted && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onFeedback && onFeedback(st, completion); }}
                              style={{
                                marginTop: 8,
                                padding: '6px 14px',
                                minHeight: 32,
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                border: '1px solid',
                                borderRadius: 100,
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                background: hasFeedback ? 'rgba(34,197,94,0.08)' : 'rgba(0,169,180,0.08)',
                                color: hasFeedback ? '#16a34a' : 'var(--admin-accent)',
                                borderColor: hasFeedback ? 'rgba(34,197,94,0.2)' : 'rgba(0,169,180,0.2)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {hasFeedback
                                ? `✓ Marked as Done (⭐ ${feedbackMap[st.id]?.rating || 5})`
                                : '★ Click for Review / Mark Done'}
                            </button>
                          )}

                          {/* CC Feedback button for Class Coordinator */}
                          {ccMode && isCompleted && (
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              {hasStudentReviews ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCCFeedback && onCCFeedback(st, completion, studentStats, ccFb);
                                    }}
                                    style={{
                                      padding: '5px 14px',
                                      minHeight: 30,
                                      fontSize: '0.78rem',
                                      fontWeight: 600,
                                      borderRadius: 100,
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      border: '1px solid',
                                      background: ccFb?.myFeedback ? 'rgba(34, 197, 94, 0.08)' : 'rgba(0, 169, 180, 0.08)',
                                      color: ccFb?.myFeedback ? '#16a34a' : 'var(--admin-accent, #00a9b4)',
                                      borderColor: ccFb?.myFeedback ? 'rgba(34, 197, 94, 0.25)' : 'rgba(0, 169, 180, 0.25)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    {ccFb?.myFeedback ? (
                                      <>✓ CC Feedback Submitted (⭐ {ccFb.myFeedback.rating})</>
                                    ) : (
                                      <>💬 Give CC Feedback</>
                                    )}
                                  </button>

                                  {ccFb?.previousFeedbacks?.length > 0 && (
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        background: '#e0f2fe',
                                        color: '#0369a1',
                                        border: '1px solid #bae6fd',
                                        borderRadius: 12,
                                        padding: '2px 8px',
                                      }}
                                      title={`Includes feedback from previous CC (${ccFb.previousFeedbacks[0].cc_faculty_name})`}
                                    >
                                      👁️ Previous CC Reviewed
                                    </span>
                                  )}
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={true}
                                  style={{
                                    padding: '5px 12px',
                                    minHeight: 30,
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    borderRadius: 100,
                                    border: '1px solid #cbd5e1',
                                    background: '#f8fafc',
                                    color: '#64748b',
                                    cursor: 'not-allowed',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                  title="CC feedback unlocks once students submit feedback for this topic"
                                >
                                  🔒 Feedback Locked (Waiting for Student Feedback)
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="syllabus-topic__status">
                          {isCompleted ? (
                            <span className="syllabus-topic__badge syllabus-topic__badge--completed">
                              ✓ Completed
                            </span>
                          ) : (
                            <span className="syllabus-topic__badge syllabus-topic__badge--pending">
                              ○ Pending
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
