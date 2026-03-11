import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleContext";
import { useTranslation } from "react-i18next";
import RoleSwitcher from "./RoleSwitcher";
import NotificationBadge from "./NotificationBadge";

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { isCoachMode } = useRole();
  const { t } = useTranslation();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">{t('app_name')}</Link>
      </div>
      {isAuthenticated ? (
        <div className="navbar-links">
          {user?.is_coach && <RoleSwitcher />}
          {user?.is_admin && <Link to="/admin">{t('admin_title')}</Link>}
          {isCoachMode ? (
            <>
              <Link to="/">{t('coach_dashboard')}</Link>
              <Link to="/coach/profile">{t('coach_profile_title')}</Link>
              <Link to="/coaches">{t('coach_directory')}</Link>
            </>
          ) : (
            <>
              <Link to="/">{t('home_title')}</Link>
              <Link to="/workouts">{t('workouts_title')}</Link>
              <Link to="/workouts/new">{t('workouts_new')}</Link>
              {user?.has_coach && <Link to="/my-assignments">{t('assigned_my')}</Link>}
              <Link to="/coaches">{t('coach_directory')}</Link>
            </>
          )}
          <NotificationBadge />
          <Link to="/profile" className="navbar-user">
            {user?.avatar_url && (
              <img src={user.avatar_url} alt="" className="navbar-avatar" />
            )}
            <span>{user?.name}</span>
          </Link>
          <button className="btn btn-sm" onClick={logout}>
            {t('logout')}
          </button>
        </div>
      ) : (
        <div className="navbar-links">
          <span className="navbar-tagline">{t('app_tagline')}</span>
        </div>
      )}
    </nav>
  );
}
