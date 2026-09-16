import React, { useState, useEffect, useMemo } from 'react';
import timetableApi from '../../api/timetableApi';
import TimetableGrid from '../../components/timetable/TimetableGrid';
import DayWiseScheduleView from '../../components/timetable/DayWiseScheduleView';
import '../../styles/timetable.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function FacultyTimetablePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFacultySchedule();
  }, []);

  async function loadFacultySchedule() {
    setLoading(true);
    setError(null);
    try {
      const res = await timetableApi.getFacultySchedule();
      setData(res.data?.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load teaching schedule.');
    } finally {
      setLoading(false);
    }
  }

  const todayName = useMemo(() => {
    const dayIdx = new Date().getDay();
    return DAYS[dayIdx];
  }, []);

  const todayEntries = useMemo(() => {
    if (!data?.entries) return [];
    return data.entries.filter(e => e.day.toLowerCase() === todayName.toLowerCase());
  }, [data, todayName]);

  const totalHours = useMemo(() => {
    if (!data?.entries) return 0;
    const minutes = data.entries.reduce((acc, e) => acc + (e.duration_minutes || 55), 0);
    return (minutes / 60).toFixed(1);
  }, [data]);

  if (loading) {
    return (
      <div className="tt-container" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading teaching schedule...</p>
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

  const entries = data?.entries || [];

  return (
    <div className="tt-container">
      {/* Header */}
      <div className="tt-header">
        <div className="tt-title-group">
          <h1>📅 My Teaching Schedule</h1>
          <p className="tt-subtitle">
            Your assigned lectures, labs, and tutorials across all active classes.
          </p>
        </div>
      </div>

      {/* Faculty Workload Summary */}
      <div className="tt-stat-grid">
        <div className="tt-stat-card">
          <span className="tt-stat-label">Weekly Slots</span>
          <span className="tt-stat-val">{entries.length}</span>
          <span className="tt-stat-desc">Total scheduled sessions</span>
        </div>
        <div className="tt-stat-card">
          <span className="tt-stat-label">Weekly Teaching Hours</span>
          <span className="tt-stat-val">{totalHours} hrs</span>
          <span className="tt-stat-desc">Calculated load</span>
        </div>
        <div className="tt-stat-card">
          <span className="tt-stat-label">Today's Sessions</span>
          <span className="tt-stat-val">{todayEntries.length}</span>
          <span className="tt-stat-desc">{todayName}</span>
        </div>
      </div>

      {/* Day-wise Teaching Schedule */}
      <DayWiseScheduleView entries={entries} />

      {/* Full Week Grid */}
      <div>
        <h2 style={{ fontSize: '1.15rem', color: 'var(--color-text)', margin: '0 0 14px 0' }}>
          Weekly Teaching Timetable
        </h2>
        <TimetableGrid
          entries={entries.map(e => ({
            ...e,
            startTime: e.start_time,
            endTime: e.end_time,
            subjectCode: e.subject_code || e.subject_code_raw,
            subjectName: e.subject_name || e.subject_name_raw,
            facultyName: `Sem ${e.semester_number}${e.division_name ? ' • Div ' + e.division_name : ''}`,
            facultyInitial: '',
            entryType: e.entry_type,
            batchGroup: e.batch_group,
          }))}
          showControls={false}
        />
      </div>
    </div>
  );
}
