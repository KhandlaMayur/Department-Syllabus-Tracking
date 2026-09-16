import React, { useState, useMemo } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetableGrid({ entries = [], showControls = true }) {
  const [selectedBatch, setSelectedBatch] = useState('ALL');
  const [activeSlotModal, setActiveSlotModal] = useState(null);

  // Normalize entries to support both camelCase and snake_case properties
  const normalizedEntries = useMemo(() => {
    return (entries || []).map(e => ({
      ...e,
      id: e.id,
      day: e.day,
      startTime: e.startTime || e.start_time || '',
      endTime: e.endTime || e.end_time || '',
      subjectCode: e.subjectCode || e.subject_code || e.subjectCodeRaw || e.subject_code_raw || '',
      subjectName: e.subjectName || e.subject_name || e.subjectNameRaw || e.subject_name_raw || '',
      facultyName: e.facultyName || e.faculty_name || '',
      facultyInitial: e.facultyInitial || e.faculty_initial || '',
      room: e.room || '',
      entryType: e.entryType || e.entry_type || 'lecture',
      batchGroup: e.batchGroup || e.batch_group || 'ALL',
    }));
  }, [entries]);

  // Extract unique sorted time intervals
  const timeSlots = useMemo(() => {
    const map = new Map();
    for (const e of normalizedEntries) {
      if (!e.startTime) continue;
      const key = `${e.startTime} - ${e.endTime || ''}`;
      if (!map.has(key)) {
        map.set(key, { start: e.startTime, end: e.endTime });
      }
    }
    return Array.from(map.entries())
      .map(([label, t]) => ({ label, ...t }))
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [normalizedEntries]);

  // Filter entries by batch group
  const filteredEntries = useMemo(() => {
    if (selectedBatch === 'ALL') return normalizedEntries;
    return normalizedEntries.filter(e => !e.batchGroup || e.batchGroup === 'ALL' || e.batchGroup === selectedBatch);
  }, [normalizedEntries, selectedBatch]);

  // Map entries to a cell key: `${day}_${timeStart}`
  const cellSlotsMap = useMemo(() => {
    const map = new Map();
    for (const e of filteredEntries) {
      const key = `${e.day}_${e.startTime}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return map;
  }, [filteredEntries]);

  if (!entries.length) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px', background: '#fff', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1.05rem', margin: 0 }}>
          No timetable slots scheduled for this view.
        </p>
      </div>
    );
  }

  return (
    <div className="tt-grid-container">
      {showControls && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Filter Batch:</span>
            {['ALL', 'A', 'B'].map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setSelectedBatch(b)}
                className={`tt-btn ${selectedBatch === b ? 'tt-btn-primary' : 'tt-btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
              >
                {b === 'ALL' ? 'All Batches' : `Batch ${b}`}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            Showing <strong>{filteredEntries.length}</strong> active slots
          </div>
        </div>
      )}

      <div className="tt-grid-wrapper">
        <table className="tt-table">
          <thead>
            <tr>
              <th className="time-col">Time / Day</th>
              {DAYS.map(day => (
                <th key={day}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map(time => (
              <tr key={time.label}>
                <td className="time-cell">
                  <div style={{ fontWeight: 700 }}>{time.start}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>to {time.end}</div>
                </td>
                {DAYS.map(day => {
                  const slots = cellSlotsMap.get(`${day}_${time.start}`) || [];
                  return (
                    <td key={day}>
                      {slots.map((slot, idx) => {
                        const isLab = slot.entryType === 'lab';
                        const isBatchA = slot.batchGroup === 'A';
                        const isBatchB = slot.batchGroup === 'B';
                        let chipClass = 'tt-slot-chip';
                        if (isLab) chipClass += ' lab';
                        else if (isBatchA) chipClass += ' batch-a';
                        else if (isBatchB) chipClass += ' batch-b';

                        return (
                          <div
                            key={idx}
                            className={chipClass}
                            onClick={() => setActiveSlotModal(slot)}
                            title={`${slot.subjectName ? slot.subjectName + ' (' + (slot.subjectCode || '') + ')' : slot.subjectCode || 'Slot'} - Click to view slot details`}
                          >
                            <div className="tt-chip-top" style={{ alignItems: 'flex-start' }}>
                              <div style={{ minWidth: 0, flex: 1, marginRight: 6 }}>
                                {slot.subjectName && (
                                  <div
                                    className="tt-chip-subject"
                                    style={{
                                      fontSize: '0.82rem',
                                      fontWeight: 700,
                                      lineHeight: 1.25,
                                      marginBottom: '2px',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      wordBreak: 'break-word',
                                    }}
                                    title={slot.subjectName}
                                  >
                                    {slot.subjectName}
                                  </div>
                                )}
                                {(slot.subjectCode || !slot.subjectName) && (
                                  <div
                                    style={{
                                      fontSize: '0.74rem',
                                      fontWeight: 600,
                                      color: slot.subjectName ? 'var(--color-primary-dark, #00838c)' : 'var(--color-text)',
                                      fontFamily: slot.subjectName ? 'monospace' : 'inherit',
                                    }}
                                  >
                                    {slot.subjectCode || slot.subjectCodeRaw || 'Subject'}
                                  </div>
                                )}
                              </div>
                              {slot.batchGroup && slot.batchGroup !== 'ALL' && (
                                <span className={`tt-chip-batch ${slot.batchGroup}`} style={{ flexShrink: 0 }}>
                                  Batch {slot.batchGroup}
                                </span>
                              )}
                            </div>
                            <div className="tt-chip-bottom" style={{ marginTop: 4 }}>
                              <span className="tt-chip-fac">
                                {slot.facultyName || slot.facultyInitial || '—'}
                              </span>
                              {slot.room && <span className="tt-chip-room">{slot.room}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Slot Details Modal */}
      {activeSlotModal && (
        <div className="tt-modal-overlay" onClick={() => setActiveSlotModal(null)}>
          <div className="tt-modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text)' }}>Slot Details</h3>
              <button
                onClick={() => setActiveSlotModal(null)}
                style={{ border: 'none', background: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.9rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <strong style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.78rem' }}>SUBJECT NAME</strong>
                <span style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {activeSlotModal.subjectName || activeSlotModal.subjectCode || activeSlotModal.subjectCodeRaw || 'N/A'}
                </span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.78rem' }}>SUBJECT CODE</strong>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary-dark, #00838c)' }}>
                  {activeSlotModal.subjectCode || activeSlotModal.subjectCodeRaw || 'N/A'}
                </span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.78rem' }}>TIME</strong>
                <span style={{ fontWeight: 600 }}>{activeSlotModal.startTime} - {activeSlotModal.endTime}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.78rem' }}>FACULTY / CLASS</strong>
                <span>{activeSlotModal.facultyName || activeSlotModal.facultyInitial || 'Unassigned'}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.78rem' }}>ROOM</strong>
                <span>{activeSlotModal.room || 'Not specified'}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.78rem' }}>DAY</strong>
                <span>{activeSlotModal.day}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.78rem' }}>TYPE & BATCH</strong>
                <span style={{ textTransform: 'capitalize' }}>
                  {activeSlotModal.entryType} ({activeSlotModal.batchGroup || 'ALL'})
                </span>
              </div>
            </div>
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button className="tt-btn tt-btn-secondary" onClick={() => setActiveSlotModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
