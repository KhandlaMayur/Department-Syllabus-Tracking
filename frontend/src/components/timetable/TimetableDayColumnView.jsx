import React, { useMemo, useState } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Converts a time string like "07:30", "7:30 AM", "11:00 AM", "01:30 PM" to minutes from midnight (0-1440)
 * for accurate chronological sorting.
 */
function timeToMinutes(t) {
  if (!t) return 0;
  let str = String(t).trim().toUpperCase();
  const isPM = str.includes('PM');
  const isAM = str.includes('AM');
  str = str.replace(/(AM|PM)/gi, '').trim().replace('.', ':');
  const [hStr, mStr] = str.split(':');
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr || '0', 10) || 0;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Formats a 24h or AM/PM string to nice readable "hh:mm A"
 */
function formatDisplayTime(t) {
  if (!t) return '';
  const totalMin = timeToMinutes(t);
  let h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function TimetableDayColumnView({
  entries = [],
  onAddSlot,
  onEditSlot,
  onDeleteSlot,
  canEdit = true,
}) {
  const [selectedDayMobile, setSelectedDayMobile] = useState('ALL');

  // Group and sort entries strictly chronologically by start time for each day
  const dayGroups = useMemo(() => {
    const groups = {};
    for (const day of DAYS) {
      groups[day] = [];
    }

    for (const e of entries) {
      const d = e.day || 'Monday';
      if (!groups[d]) groups[d] = [];
      groups[d].push(e);
    }

    // Sort each day's entries chronologically
    for (const day of DAYS) {
      groups[day].sort((a, b) => {
        const timeA = timeToMinutes(a.start_time || a.startTime);
        const timeB = timeToMinutes(b.start_time || b.startTime);
        return timeA - timeB;
      });
    }

    return groups;
  }, [entries]);

  const displayedDays = selectedDayMobile === 'ALL' ? DAYS : [selectedDayMobile];

  return (
    <div className="tt-day-columns-wrapper">
      {/* Mobile Day Selector Tabs */}
      <div className="tt-day-pills">
        <button
          type="button"
          className={`tt-day-pill ${selectedDayMobile === 'ALL' ? 'active' : ''}`}
          onClick={() => setSelectedDayMobile('ALL')}
        >
          All Days
        </button>
        {DAYS.map(day => (
          <button
            key={day}
            type="button"
            className={`tt-day-pill ${selectedDayMobile === day ? 'active' : ''}`}
            onClick={() => setSelectedDayMobile(day)}
          >
            {day.slice(0, 3)} ({dayGroups[day]?.length || 0})
          </button>
        ))}
      </div>

      <div className={`tt-day-columns-scroll ${selectedDayMobile !== 'ALL' ? 'single-day-active' : ''}`}>
        {displayedDays.map((day) => {
          const colIdx = DAYS.indexOf(day);
          const slots = dayGroups[day] || [];
          return (
            <div key={day} className="tt-day-col-card">
              {/* Column Header */}
              <div className="tt-day-col-header">
                <div className="tt-day-col-header-left">
                  <span className="tt-day-col-idx">Col {colIdx + 1}</span>
                  <h4 className="tt-day-col-title">{day}</h4>
                </div>
                <span className="tt-day-col-badge">{slots.length} {slots.length === 1 ? 'Class' : 'Classes'}</span>
              </div>

              {/* Slot Cards List */}
              <div className="tt-day-slots-list">
                {slots.length === 0 ? (
                  <div className="tt-day-col-empty">
                    <span>No classes</span>
                    {canEdit && (
                      <button
                        type="button"
                        className="tt-day-empty-add-btn"
                        onClick={() => onAddSlot && onAddSlot(day)}
                      >
                        + Add 1st Class
                      </button>
                    )}
                  </div>
                ) : (
                  slots.map((slot, rowIdx) => {
                    const sTime = formatDisplayTime(slot.start_time || slot.startTime);
                    const eTime = formatDisplayTime(slot.end_time || slot.endTime);
                    const isLab = (slot.entry_type || slot.entryType) === 'lab';
                    const isBatchA = (slot.batch_group || slot.batchGroup) === 'A';
                    const isBatchB = (slot.batch_group || slot.batchGroup) === 'B';

                    return (
                      <div
                        key={slot.id || rowIdx}
                        className={`tt-day-slot-item ${isLab ? 'is-lab' : ''}`}
                      >
                        {/* Row indicator & Time Badge */}
                        <div className="tt-slot-top-bar">
                          <span className="tt-slot-row-tag">Row {rowIdx + 1}</span>
                          <span className="tt-slot-time-pill">
                            ⏰ {sTime} – {eTime}
                          </span>
                        </div>

                        {/* Subject Title */}
                        <div className="tt-slot-subject-info">
                          <div className="tt-slot-subject-code">
                            {slot.subject_code || slot.subjectCode || slot.subject_code_raw || slot.subjectCodeRaw || 'Subject'}
                          </div>
                          <div className="tt-slot-subject-name">
                            {slot.subject_name || slot.subjectName || slot.subject_name_raw || slot.subjectNameRaw || ''}
                          </div>
                        </div>

                        {/* Faculty Info */}
                        <div className="tt-slot-faculty-row">
                          <span className="tt-slot-faculty-icon">👤</span>
                          <span className="tt-slot-faculty-name">
                            {slot.faculty_name || slot.facultyName || slot.faculty_initial || slot.facultyInitial || 'Faculty Unassigned'}
                          </span>
                        </div>

                        {/* Tags (Room, Lab, Batch) */}
                        <div className="tt-slot-meta-tags">
                          {slot.room && (
                            <span className="tt-slot-tag tt-tag-room">
                              📍 {slot.room}
                            </span>
                          )}
                          <span className={`tt-slot-tag ${isLab ? 'tt-tag-lab' : 'tt-tag-lec'}`}>
                            {isLab ? '🔬 Lab' : '📖 Lecture'}
                          </span>
                          {(slot.batch_group || slot.batchGroup) && (slot.batch_group || slot.batchGroup) !== 'ALL' && (
                            <span className="tt-slot-tag tt-tag-batch">
                              Batch {slot.batch_group || slot.batchGroup}
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        {canEdit && (
                          <div className="tt-slot-actions">
                            <button
                              type="button"
                              className="tt-slot-action-btn edit"
                              title="Edit this slot"
                              onClick={() => onEditSlot && onEditSlot(slot)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              className="tt-slot-action-btn delete"
                              title="Delete this slot"
                              onClick={() => onDeleteSlot && onDeleteSlot(slot)}
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Add Class button */}
              {canEdit && slots.length > 0 && (
                <button
                  type="button"
                  className="tt-day-col-footer-btn"
                  onClick={() => onAddSlot && onAddSlot(day)}
                >
                  + Add Class to {day}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
