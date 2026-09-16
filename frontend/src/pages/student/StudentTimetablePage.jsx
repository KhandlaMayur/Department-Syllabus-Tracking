import React, { useState, useEffect, useMemo } from 'react';
import timetableApi from '../../api/timetableApi';
import TimetableGrid from '../../components/timetable/TimetableGrid';
import DayWiseScheduleView from '../../components/timetable/DayWiseScheduleView';
import '../../styles/timetable.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StudentTimetablePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    setLoading(true);
    setError(null);
    try {
      const res = await timetableApi.getStudentSchedule();
      setData(res.data?.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load your timetable.');
    } finally {
      setLoading(false);
    }
  }

  // Determine today's day of week
  const todayName = useMemo(() => {
    const dayIdx = new Date().getDay();
    return DAYS[dayIdx];
  }, []);

  const todayEntries = useMemo(() => {
    if (!data?.entries) return [];
    return data.entries.filter(e => e.day.toLowerCase() === todayName.toLowerCase());
  }, [data, todayName]);

  if (loading) {
    return (
      <div className="tt-container" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading your timetable...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tt-container">
        <div className="tt-alert tt-alert-danger">
          <span>⚠️ {error}</span>
        </div>
      </div>
    );
  }

  const student = data?.student;
  const entries = data?.entries || [];

  return (
    <div className="tt-container">
      {/* Header */}
      <div className="tt-header">
        <div className="tt-title-group">
          <h1>📅 My Timetable</h1>
          <p className="tt-subtitle">
            {student ? (
              <>
                <strong>{student.name}</strong> • Semester {student.semester || '—'} {student.division ? ` - ${student.division}` : ''} {student.batch ? `• Batch ${student.batch}` : ''}
              </>
            ) : (
              'Your weekly class schedule'
            )}
          </p>
        </div>
      </div>

      {/* Day-wise Schedule */}
      <DayWiseScheduleView entries={entries} showFacultyInfo={true} />

      {/* Full Week Grid */}
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ fontSize: '1.15rem', color: 'var(--color-text)', margin: '0 0 14px 0' }}>
          Weekly Schedule Grid
        </h2>
        {entries.length === 0 ? (
          <div style={{
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '48px 20px',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🗓️</div>
            <h3 style={{ margin: '0 0 6px 0', color: 'var(--color-text)' }}>
              No Timetable Published Yet
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              There is currently no active timetable published for Semester {student?.semester} {student?.division ? ` - ${student.division}` : ''}.
            </p>
          </div>
        ) : (
          <TimetableGrid
            entries={entries.map(e => ({
              ...e,
              startTime: e.start_time,
              endTime: e.end_time,
              subjectCode: e.subject_code || e.subject_code_raw,
              subjectName: e.subject_name || e.subject_name_raw,
              facultyName: e.faculty_name,
              facultyInitial: e.faculty_initial,
              entryType: e.entry_type,
              batchGroup: e.batch_group,
            }))}
            showControls={false}
          />
        )}
      </div>
    </div>
  );
}
