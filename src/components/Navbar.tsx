import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleContext";
import { useTranslation } from "react-i18next";
import RoleSwitcher from "./RoleSwitcher";

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
          {isCoachMode ? (
            <>
              <Link to="/">{t('coach_dashboard')}</Link>
            </>
          ) : (
            <>
              <Link to="/">{t('home_title')}</Link>
              <Link to="/workouts">{t('workouts_title')}</Link>
              <Link to="/workouts/new">{t('workouts_new')}</Link>
              <Link to="/my-assignments">{t('assigned_my')}</Link>
            </>
          )}
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
