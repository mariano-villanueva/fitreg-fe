import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleContext";
import { useTranslation } from "react-i18next";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { activeRole, setActiveRole, isCoachMode } = useRole();
  const { t } = useTranslation();
  const location = useLocation();

  function handleNav() {
    onClose();
  }

  function handleLogout() {
    onClose();
    logout();
  }

  function switchRole(role: 'athlete' | 'coach') {
    if (role !== activeRole) {
      setActiveRole(role);
    }
  }

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        {/* User info */}
        <div className="sidebar-user">
          {user?.avatar_url && (
            <img src={user.avatar_url} alt="" className="sidebar-avatar" />
          )}
          <div className="sidebar-user-info">
            <strong>{user?.name}</strong>
            <span className="sidebar-user-email">{user?.email}</span>
          </div>
        </div>

        {/* Role switcher */}
        {user?.is_coach && (
          <div className="sidebar-role-switcher">
            <button
              className={`sidebar-role-btn ${activeRole === 'athlete' ? 'active' : ''}`}
              onClick={() => switchRole('athlete')}
            >
              {t('role_athlete')}
            </button>
            <button
              className={`sidebar-role-btn ${activeRole === 'coach' ? 'active' : ''}`}
              onClick={() => switchRole('coach')}
            >
              {t('role_coach')}
            </button>
          </div>
        )}

        <div className="sidebar-nav">
          {/* Athlete section */}
          {!isCoachMode && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">{t('role_athlete')}</div>
              <Link to="/" className={`sidebar-link ${isActive('/') && !isActive('/workouts') && !isActive('/my-assignments') && !isActive('/coaches') ? 'active' : ''}`} onClick={handleNav}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                {t('home_title')}
              </Link>
              <Link to="/workouts" className={`sidebar-link ${isActive('/workouts') ? 'active' : ''}`} onClick={handleNav}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {t('workouts_title')}
              </Link>
              <Link to="/workouts/new" className={`sidebar-link ${location.pathname === '/workouts/new' ? 'active' : ''}`} onClick={handleNav}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                {t('workouts_new')}
              </Link>
              <Link to="/my-assignments" className={`sidebar-link ${isActive('/my-assignments') ? 'active' : ''}`} onClick={handleNav}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                {t('assigned_my')}
              </Link>
              <Link to="/coaches" className={`sidebar-link ${isActive('/coaches') ? 'active' : ''}`} onClick={handleNav}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                {t('coach_directory')}
              </Link>
            </div>
          )}

          {/* Coach section */}
          {isCoachMode && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">{t('role_coach')}</div>
              <Link to="/" className={`sidebar-link ${isActive('/') && !isActive('/coach/profile') && !isActive('/coaches') ? 'active' : ''}`} onClick={handleNav}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                {t('coach_dashboard')}
              </Link>
              <Link to="/coach/profile" className={`sidebar-link ${isActive('/coach/profile') ? 'active' : ''}`} onClick={handleNav}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {t('coach_profile_title')}
              </Link>
              <Link to="/coach/templates" className={`sidebar-link ${isActive('/coach/templates') ? 'active' : ''}`} onClick={handleNav}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>
                {t('template_title')}
              </Link>
              <Link to="/coaches" className={`sidebar-link ${isActive('/coaches') ? 'active' : ''}`} onClick={handleNav}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                {t('coach_directory')}
              </Link>
            </div>
          )}

          {/* Admin section */}
          {user?.is_admin && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">Admin</div>
              <Link to="/admin" className={`sidebar-link ${location.pathname === '/admin' ? 'active' : ''}`} onClick={handleNav}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                {t('admin_stats')}
              </Link>
              <Link to="/admin/users" className={`sidebar-link ${isActive('/admin/users') ? 'active' : ''}`} onClick={handleNav}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                {t('admin_users')}
              </Link>
              <Link to="/admin/achievements" className={`sidebar-link ${isActive('/admin/achievements') ? 'active' : ''}`} onClick={handleNav}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                {t('admin_achievements')}
              </Link>
            </div>
          )}
        </div>

        {/* Bottom section */}
        <div className="sidebar-bottom">
          <Link to="/profile" className="sidebar-link" onClick={handleNav}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            {t('profile')}
          </Link>
          <Link to="/notifications" className="sidebar-link" onClick={handleNav}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {t('notification_title')}
          </Link>
          <button className="sidebar-link sidebar-logout" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            {t('logout')}
          </button>
        </div>
      </aside>
    </>
  );
}
