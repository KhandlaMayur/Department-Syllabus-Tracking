import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin.css';
import masterApi from '../../api/masterApi';
import timetableApi from '../../api/timetableApi';

const NAV_ITEMS = [
  { label: 'Departments',       path: '/hod/admin/departments',    icon: '🏛️' },
  { label: 'Academic Years',    path: '/hod/admin/academic-years', icon: '📅' },
  { label: 'Semesters',         path: '/hod/admin/semesters',      icon: '🗓️' },
  { label: 'Batches',           path: '/hod/admin/batches',        icon: '👥' },
  { label: 'Divisions',         path: '/hod/admin/divisions',      icon: '📂' },
  { label: 'Students',          path: '/hod/admin/students',       icon: '🎓' },
  { label: 'Faculty',           path: '/hod/admin/faculty',        icon: '👨‍🏫' },
  { label: 'Subjects',          path: '/hod/admin/subjects',       icon: '📚' },
  { label: 'Assignments',       path: '/hod/admin/assignments',    icon: '📋' },
  { label: 'Timetables',        path: '/hod/admin/timetables',     icon: '⏱️' },
  { label: 'Import Timetable',  path: '/hod/admin/timetables/import', icon: '📤' },
];

export default function HODDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});

  // Fetch summary stats
  useEffect(() => {
    Promise.all([
      masterApi.departments.list({ limit: 1 }),
      masterApi.students.list({ limit: 1 }),
      masterApi.faculty.list({ limit: 1 }),
      masterApi.subjects.list({ limit: 1 }),
      masterApi.batches.list({ limit: 1 }),
      masterApi.divisions.list({ limit: 1 }),
      timetableApi.list({ limit: 1 }),
    ]).then(([depts, stud, fac, subj, batch, div, tt]) => {
      setCounts({
        departments: depts.data.data.total,
        students:    stud.data.data.total,
        faculty:     fac.data.data.total,
        subjects:    subj.data.data.total,
        batches:     batch.data.data.total,
        divisions:   div.data.data.total,
        timetables:  tt.data.data.total,
      });
    }).catch(() => {});
  }, []);

  const STATS = [
    { icon: '🏛️', label: 'Departments', value: counts.departments ?? '…', path: '/hod/admin/departments' },
    { icon: '👥', label: 'Batches',     value: counts.batches     ?? '…', path: '/hod/admin/batches' },
    { icon: '📂', label: 'Divisions',   value: counts.divisions   ?? '…', path: '/hod/admin/divisions' },
    { icon: '🎓', label: 'Students',    value: counts.students    ?? '…', path: '/hod/admin/students' },
    { icon: '👨‍🏫', label: 'Faculty',    value: counts.faculty     ?? '…', path: '/hod/admin/faculty' },
    { icon: '📚', label: 'Subjects',    value: counts.subjects    ?? '…', path: '/hod/admin/subjects' },
    { icon: '⏱️', label: 'Timetables',  value: counts.timetables  ?? '…', path: '/hod/admin/timetables' },
  ];

  return (
    <div className="admin-page">
      {/* Welcome */}
      <div style={{ marginBottom: 8 }}>
        <h1 className="admin-page__title">
          Welcome back, {user?.name?.split(' ')[0] || 'HOD'} 👋
        </h1>
        <p className="admin-page__subtitle">
          Department overview — manage all academic master data from the Admin panel.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="stat-cards">
        {STATS.map(s => (
          <div key={s.label} className="stat-card" onClick={() => navigate(s.path)} style={{ cursor: 'pointer' }}>
            <div className="stat-card__icon">{s.icon}</div>
            <div className="stat-card__label">{s.label}</div>
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__sub">Click to manage →</div>
          </div>
        ))}
      </div>

      {/* Quick Access Nav */}
      <div style={{ marginTop: 8 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Admin Sections
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 16px',
                background: 'var(--admin-surface)',
                border: '1px solid var(--admin-border)',
                borderRadius: 10,
                color: 'var(--admin-text)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--admin-accent)'; e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--admin-border)'; e.currentTarget.style.background = 'var(--admin-surface)'; }}
            >
              <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
