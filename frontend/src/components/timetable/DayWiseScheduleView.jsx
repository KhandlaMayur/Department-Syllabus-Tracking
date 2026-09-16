import React, { useState, useMemo } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

export default function DayWiseScheduleView({
  entries = [],
  title = "Day-wise Schedule",
  showFacultyInfo = false,
}) {
  const todayName = useMemo(() => {
    const dayIdx = new Date().getDay();
    const map = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return map[dayIdx] || 'Wednesday';
  }, []);

  const [selectedDay, setSelectedDay] = useState(todayName);

  // Group entries by day
  const dayGroups = useMemo(() => {
    const groups = {};
    for (const d of DAYS) {
      groups[d] = [];
    }
    for (const e of entries) {
      const d = e.day || 'Monday';
      const normDay = DAYS.find(x => x.toLowerCase() === d.toLowerCase()) || d;
      if (!groups[normDay]) groups[normDay] = [];
      groups[normDay].push(e);
    }
    // Sort each day chronologically
    for (const d of Object.keys(groups)) {
      groups[d].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    }
    return groups;
  }, [entries]);

  // Determine current active sessions for today (to display live status)
  const currentMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const getSessionStatus = (slot, isToday) => {
    if (!isToday) return null;
    const start = timeToMinutes(slot.start_time);
    const end = timeToMinutes(slot.end_time);
    if (currentMinutes >= start && currentMinutes <= end) {
      return { label: '🟢 Happening Now', bg: '#dcfce7', color: '#15803d', border: '#86efac' };
    }
    if (currentMinutes < start) {
      return { label: '⏳ Upcoming', bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
    }
    return { label: '✓ Finished', bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' };
  };

  // Filtered entries for the active tab
  const displayedEntries = useMemo(() => {
    if (selectedDay === 'ALL') {
      const all = [];
      for (const d of DAYS) {
        for (const e of dayGroups[d] || []) {
          all.push({ ...e, dayName: d });
        }
      }
      return all;
    }
    return (dayGroups[selectedDay] || []).map(e => ({ ...e, dayName: selectedDay }));
  }, [selectedDay, dayGroups]);

  const isTodayActive = selectedDay.toLowerCase() === todayName.toLowerCase();

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: 14,
        padding: '22px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        marginBottom: 26,
      }}
    >
      {/* Header & Quick Filter Info */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--color-text, #1e293b)' }}>
              📍 {selectedDay === 'ALL'
                ? 'All Scheduled Days'
                : isTodayActive
                ? `Today's Schedule (${todayName})`
                : `${selectedDay}'s Schedule`}
            </h2>
            {isTodayActive && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'var(--color-primary, #00a9b4)',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: 20,
                }}
              >
                Today
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted, #64748b)' }}>
            Switch between days of the week to view your scheduled lectures, labs, and tutorials.
          </p>
        </div>

        {/* Quick jump to Today if viewing another day */}
        {!isTodayActive && selectedDay !== 'ALL' && (
          <button
            type="button"
            onClick={() => setSelectedDay(todayName)}
            style={{
              padding: '6px 12px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--color-primary-dark, #00838c)',
              background: 'var(--color-primary-light, #e0f5f6)',
              border: '1px solid var(--color-primary, #00a9b4)',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ⚡ Jump to Today ({todayName})
          </button>
        )}
      </div>

      {/* Day Selector Pills Bar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 8,
          marginBottom: 20,
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        {DAYS.map(day => {
          const isToday = day.toLowerCase() === todayName.toLowerCase();
          const isSelected = selectedDay === day;
          const count = (dayGroups[day] || []).length;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                fontSize: '0.85rem',
                fontWeight: isSelected ? 700 : 500,
                color: isSelected ? '#ffffff' : isToday ? 'var(--color-primary-dark, #00838c)' : '#475569',
                background: isSelected
                  ? 'var(--color-primary, #00a9b4)'
                  : isToday
                  ? 'var(--color-primary-light, #e0f5f6)'
                  : '#f8fafc',
                border: isSelected
                  ? '1px solid var(--color-primary, #00a9b4)'
                  : isToday
                  ? '1px solid rgba(0, 169, 180, 0.3)'
                  : '1px solid #e2e8f0',
                borderRadius: 24,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{day}</span>
              {isToday && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 5px',
                    borderRadius: 10,
                    background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--color-primary, #00a9b4)',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  Today
                </span>
              )}
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isSelected
                    ? 'rgba(255, 255, 255, 0.28)'
                    : count > 0
                    ? '#e2e8f0'
                    : '#f1f5f9',
                  color: isSelected ? '#ffffff' : count > 0 ? '#1e293b' : '#94a3b8',
                  fontWeight: 700,
                  minWidth: 18,
                  textAlign: 'center',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelectedDay('ALL')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: '0.85rem',
            fontWeight: selectedDay === 'ALL' ? 700 : 500,
            color: selectedDay === 'ALL' ? '#ffffff' : '#475569',
            background: selectedDay === 'ALL' ? '#1e293b' : '#f8fafc',
            border: '1px solid ' + (selectedDay === 'ALL' ? '#1e293b' : '#e2e8f0'),
            borderRadius: 24,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <span>All Days</span>
          <span
            style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: 10,
              background: selectedDay === 'ALL' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              color: selectedDay === 'ALL' ? '#ffffff' : '#1e293b',
              fontWeight: 700,
            }}
          >
            {entries.length}
          </span>
        </button>
      </div>

      {/* Slots List or Empty State */}
      {displayedEntries.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 20px',
            background: '#f8fafc',
            borderRadius: 10,
            border: '1px dashed #cbd5e1',
          }}
        >
          <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text, #1e293b)' }}>
            No sessions scheduled for {selectedDay === 'ALL' ? 'this week' : selectedDay}
            {isTodayActive ? ' (Today)' : ''}
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted, #64748b)', margin: '6px 0 0 0' }}>
            {selectedDay !== 'ALL'
              ? `There are no lectures, labs, or tutorials on ${selectedDay}. Click another day above to view its timetable.`
              : 'No timetable slots found for your profile.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          {displayedEntries.map((slot, idx) => {
            const isEntryToday = (slot.day || slot.dayName || '').toLowerCase() === todayName.toLowerCase();
            const status = getSessionStatus(slot, isEntryToday);

            return (
              <div
                key={slot.id || idx}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: '4px solid var(--color-primary, #00a9b4)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  position: 'relative',
                }}
              >
                {/* Header: Subject name & Code */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: '0.96rem',
                        fontWeight: 700,
                        color: 'var(--color-text, #1e293b)',
                        lineHeight: 1.3,
                        marginBottom: 4,
                      }}
                    >
                      {slot.subject_name || slot.subject_name_raw || slot.subject_code || slot.subject_code_raw}
                    </div>
                    {(slot.subject_code || slot.subject_code_raw) && (
                      <span
                        style={{
                          display: 'inline-block',
                          fontFamily: 'monospace',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          background: 'rgba(0,169,180,0.12)',
                          color: 'var(--color-primary-dark, #00838c)',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {slot.subject_code || slot.subject_code_raw}
                      </span>
                    )}
                  </div>

                  {/* Time Badge */}
                  <span
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--color-primary-dark, #00838c)',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      background: 'var(--color-primary-light, #e0f5f6)',
                      padding: '3px 8px',
                      borderRadius: 6,
                    }}
                  >
                    ⏰ {slot.start_time} - {slot.end_time}
                  </span>
                </div>

                {/* Status Indicator for Today */}
                {status && (
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: status.bg,
                        color: status.color,
                        border: `1px solid ${status.border}`,
                        padding: '2px 8px',
                        borderRadius: 12,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>
                )}

                {/* Day indicator if in ALL view */}
                {selectedDay === 'ALL' && (
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-primary-dark, #00838c)' }}>
                    📅 {slot.day || slot.dayName}
                  </div>
                )}

                {/* Class / Division metadata */}
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted, #64748b)' }}>
                  Sem {slot.semester_number || slot.semester}
                  {slot.division_name ? ` • Div ${slot.division_name}` : ''}
                  {slot.batch_group && slot.batch_group !== 'ALL' ? ` (Batch ${slot.batch_group})` : ''}
                </div>

                {/* Faculty Info (if student viewing) */}
                {showFacultyInfo && (slot.faculty_name || slot.faculty_initial) && (
                  <div style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 500 }}>
                    👨‍🏫 {slot.faculty_name || slot.faculty_initial}
                  </div>
                )}

                {/* Footer: Entry Type & Room */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.78rem',
                    color: 'var(--color-text-muted, #64748b)',
                    marginTop: 'auto',
                    paddingTop: 6,
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <span
                    style={{
                      textTransform: 'capitalize',
                      fontWeight: 600,
                      background: slot.entry_type === 'lab' ? '#fef3c7' : '#f1f5f9',
                      color: slot.entry_type === 'lab' ? '#92400e' : '#475569',
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}
                  >
                    🏷️ {slot.entry_type || 'Lecture'}
                  </span>
                  {slot.room && (
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      🏢 {slot.room}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
