import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleContext";
import { useTranslation } from "react-i18next";

export default function RoleSwitcher() {
  const { user } = useAuth();
  const { activeRole, setActiveRole } = useRole();
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!user?.is_coach) return null;

  function switchRole(role: 'athlete' | 'coach') {
    if (role !== activeRole) {
      setActiveRole(role);
      navigate('/');
    }
  }

  return (
    <div className="role-switcher">
      <button
        className={`role-switcher-option ${activeRole === 'athlete' ? 'active' : ''}`}
        onClick={() => switchRole('athlete')}
      >
        {t('role_athlete')}
      </button>
      <button
        className={`role-switcher-option ${activeRole === 'coach' ? 'active' : ''}`}
        onClick={() => switchRole('coach')}
      >
        {t('role_coach')}
      </button>
    </div>
  );
}
