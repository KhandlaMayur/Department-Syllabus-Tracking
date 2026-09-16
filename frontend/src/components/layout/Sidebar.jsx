import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

const NAV_ITEMS = {
  student: [
    { label: 'Dashboard', path: '/student', icon: '⌂', exact: true },
    { label: 'Syllabus Tracking', path: '/student/syllabus-tracking', icon: '📊' },
    { label: 'My Timetable', path: '/student/timetable', icon: '⏱️' },
  ],
  faculty: [
    { label: 'Dashboard', path: '/faculty', icon: '⌂', exact: true },
    { label: 'My Subjects', path: '/faculty/subjects', icon: '📚' },
    { label: 'Student Feedback', path: '/faculty/feedback', icon: '💬' },
    { label: 'My Timetable', path: '/faculty/timetable', icon: '⏱️' },
  ],
  cc: [
    { label: 'Dashboard', path: '/cc', icon: '⌂', exact: true },
    { label: 'Batches',   path: '/cc/batches',  icon: '👥' },
    { label: 'Subjects',  path: '/cc/subjects',  icon: '📚' },
    { label: 'Student Feedback', path: '/cc/feedback', icon: '💬' },
    { label: 'Class Timetable', path: '/cc/timetable', icon: '⏱️' },
    { label: 'My Schedule', path: '/cc/my-schedule', icon: '📅' },
  ],
  hod: [
    { label: 'Dashboard', path: '/hod', icon: '⌂', exact: true },
    { section: 'Feedback & Tracking' },
    { label: 'Student Feedback', path: '/hod/feedback', icon: '💬' },
    { section: 'Admin' },
    { label: 'Departments',    path: '/hod/admin/departments',    icon: '🏛️' },
    { label: 'Academic Years', path: '/hod/admin/academic-years', icon: '📅' },
    { label: 'Semesters',      path: '/hod/admin/semesters',      icon: '🗓️' },
    { label: 'Batches',        path: '/hod/admin/batches',        icon: '👥' },
    { label: 'Divisions',      path: '/hod/admin/divisions',      icon: '📂' },
    { label: 'Students',       path: '/hod/admin/students',       icon: '🎓' },
    { label: 'Faculty',        path: '/hod/admin/faculty',        icon: '👨‍🏫' },
    { label: 'Subjects',       path: '/hod/admin/subjects',       icon: '📚' },
    { label: 'Assignments',    path: '/hod/admin/assignments',    icon: '📋' },
    { section: 'Timetable' },
    { label: 'Timetables',     path: '/hod/admin/timetables',     icon: '⏱️', exact: true },
    { label: 'Import Timetable', path: '/hod/admin/timetables/import', icon: '📤' },
    { section: 'Import' },
    { label: 'Excel Import',   path: '/hod/admin/import',         icon: '📥' },
  ],
};

export default function Sidebar({ collapsed, onToggle, onItemClick }) {
  const { role, user } = useAuth();
  const location = useLocation();

  let items = NAV_ITEMS[role] || [];
  if (role === 'faculty' && user?.isCC) {
    items = [
      ...items,
      { section: 'Class Coordinator (HOD Assigned)' },
      { label: 'CC Dashboard', path: '/cc', icon: '⭐' },
      { label: 'Student Feedback (CC)', path: '/cc/feedback', icon: '💬' },
      { label: 'Class Timetable', path: '/cc/timetable', icon: '⏱️' },
    ];
  }

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-logo">ST</div>
        {!collapsed && <span className="sidebar-brand-text">Syllabus Tracker</span>}
      </div>

      <nav className="sidebar-nav">
        {items.map((item, i) => {
          // Section header
          if (item.section) {
            if (collapsed) return null;
            return (
              <div key={`section-${i}`} style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-muted)',
                padding: '16px 16px 6px',
              }}>
                {item.section}
              </div>
            );
          }

          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={() => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              onClick={onItemClick}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
        {collapsed ? '»' : '«'}
      </button>
    </aside>
  );
}
