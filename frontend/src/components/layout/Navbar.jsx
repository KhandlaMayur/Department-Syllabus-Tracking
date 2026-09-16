import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

const ROLE_LABELS = {
  student: 'Student',
  faculty: 'Faculty',
  cc: 'Course Coordinator',
  hod: 'Head of Department',
};

export default function Navbar({ onMenuClick, isMenuOpen }) {
  const { user, role, logout } = useAuth();
  const navigate    = useNavigate();
  const [menuOpen, setMenuOpen]     = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="navbar">
      <button
        className="navbar-menu-btn"
        onClick={onMenuClick}
        aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={Boolean(isMenuOpen)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isMenuOpen ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      <div className="navbar-title">
        <span className="badge">{ROLE_LABELS[role] || 'Dashboard'}</span>
      </div>

      <div className="navbar-user" ref={menuRef}>
        <button className="navbar-user-btn" onClick={() => setMenuOpen((o) => !o)}>
          {user && user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="navbar-avatar" />
          ) : (
            <div className="navbar-avatar navbar-avatar-fallback">
              {user && user.name ? user.name.charAt(0).toUpperCase() : '?'}
            </div>
          )}
          <span className="navbar-user-name">{user && user.name}</span>
        </button>

        {menuOpen && (
          <div className="navbar-dropdown">
            <div className="navbar-dropdown-email text-muted">{user && user.email}</div>
            <button
              className="navbar-dropdown-item"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                await logout({ callServer: true });
                navigate('/login', { replace: true });
              }}
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}