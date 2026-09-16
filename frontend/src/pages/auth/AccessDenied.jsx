import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './AccessDenied.css';

const ROLE_LABELS = {
  student: 'Student',
  faculty: 'Faculty',
  cc: 'Course Coordinator',
  hod: 'Head of Department',
};

export default function AccessDenied() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { logout, role } = useAuth();

  const requiredRoles  = (location.state && location.state.requiredRoles) ? location.state.requiredRoles : [];
  const requiredLabels = requiredRoles.map((r) => ROLE_LABELS[r] || r).join(' or ');
  const currentLabel   = ROLE_LABELS[role] || role || 'Unknown';

  const handleSwitchAccount = async () => {
    await logout({ callServer: true });
    navigate('/login', { replace: true });
  };

  return (
    <div className="ad-page">
      <div className="ad-bg-circle ad-bg-circle--1" />
      <div className="ad-bg-circle ad-bg-circle--2" />
      <div className="ad-card">
        <div className="ad-icon-wrap">
          <svg className="ad-shield-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M12 9v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="ad-title">Access Denied</h1>
        <p className="ad-subtitle">You do not have permission to view this page.</p>
        {requiredLabels && (
          <div className="ad-role-info">
            <div className="ad-role-row">
              <span className="ad-role-label">Required role</span>
              <span className="ad-role-badge ad-role-badge--required">{requiredLabels}</span>
            </div>
            <div className="ad-role-row">
              <span className="ad-role-label">Your role</span>
              <span className="ad-role-badge ad-role-badge--current">{currentLabel}</span>
            </div>
          </div>
        )}
        <p className="ad-hint">If you believe this is an error, contact your department administrator.</p>
        <div className="ad-actions">
          <button id="ad-btn-back" className="ad-btn ad-btn--outline" onClick={() => navigate(-1)}>Go Back</button>
          <button id="ad-btn-switch" className="ad-btn ad-btn--primary" onClick={handleSwitchAccount}>Switch Account</button>
        </div>
      </div>
    </div>
  );
}