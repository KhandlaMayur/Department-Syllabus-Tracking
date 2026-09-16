import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import './Layout.css';

/**
 * The authenticated app shell: sidebar + navbar + routed page content.
 * Mounted once by ProtectedRoute; individual dashboard pages render
 * into the <Outlet /> via React Router's nested routes.
 */
export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile sidebar automatically whenever the route path changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close on Escape key & lock body scroll when mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="app-shell">
      <div className={`sidebar-wrapper ${mobileOpen ? 'sidebar-wrapper-open' : ''}`}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          onItemClick={() => setMobileOpen(false)}
        />
      </div>

      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <div className="app-main">
        <Navbar onMenuClick={() => setMobileOpen((o) => !o)} isMenuOpen={mobileOpen} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
