import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { updateProfile, requestCoach, getCoachRequestStatus } from "../api/auth";
import { getNotificationPreferences, updateNotificationPreferences } from "../api/notifications";
import { useTranslation } from "react-i18next";
import type { NotificationPreferences } from "../types";

export default function Profile() {
  const { user, setUser } = useAuth();
  const { t, i18n } = useTranslation();

  const [name, setName] = useState(user?.name ?? "");
  const [sex, setSex] = useState(user?.sex ?? "");
  const [birthDate, setBirthDate] = useState(user?.birth_date ?? "");
  const [weightKg, setWeightKg] = useState(user?.weight_kg ?? 0);
  const [heightCm, setHeightCm] = useState(user?.height_cm ?? 0);
  const [language, setLanguage] = useState(user?.language ?? "es");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [coachRequestStatus, setCoachRequestStatus] = useState<'none' | 'pending' | 'approved'>('none');
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [requestingCoach, setRequestingCoach] = useState(false);
  const [coachLocality, setCoachLocality] = useState("");
  const [coachLevel, setCoachLevel] = useState("");

  useEffect(() => {
    getNotificationPreferences().then((res) => setNotifPrefs(res.data)).catch(() => {});
    if (!user?.is_coach) {
      getCoachRequestStatus().then((res) => setCoachRequestStatus(res.data.status)).catch(() => {});
    } else {
      setCoachRequestStatus('approved');
    }
  }, []);

  async function handlePrefChange(field: string, value: boolean) {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, [field]: value };
    setNotifPrefs(updated);
    try {
      await updateNotificationPreferences({
        workout_assigned: updated.workout_assigned,
        workout_completed_or_skipped: updated.workout_completed_or_skipped,
      });
    } catch {
      setNotifPrefs(notifPrefs);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const res = await updateProfile({ name, sex, birth_date: birthDate, weight_kg: weightKg, height_cm: heightCm, language, onboarding_completed: user?.onboarding_completed ?? true });
      setUser(res.data);
      i18n.changeLanguage(language);
      setSuccess(t('profile_saved'));
    } catch {
      setError("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestCoach() {
    if (!coachLocality.trim() || !coachLevel) return;
    setRequestingCoach(true);
    try {
      await requestCoach({ locality: coachLocality.trim(), level: coachLevel });
      setCoachRequestStatus('pending');
      setShowCoachModal(false);
    } catch {
      setError(t('error'));
    } finally {
      setRequestingCoach(false);
    }
  }

  if (!user) return null;

  return (
    <div className="page">
      <h1>{t('profile_title')}</h1>

      <div className="profile-info">
        <img src={user.avatar_url} alt={user.name} className="profile-avatar" />
        <div className="profile-details">
          <h2>{user.name}</h2>
          <p className="profile-email">{user.email}</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <form className="workout-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="profile-name">{t('profile_name')}</label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="profile-sex">{t('profile_sex')}</label>
            <select
              id="profile-sex"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
            >
              <option value="">Select</option>
              <option value="M">{t('profile_sex_m')}</option>
              <option value="F">{t('profile_sex_f')}</option>
              <option value="other">{t('profile_sex_other')}</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="profile-birthdate">{t('profile_birth_date')}</label>
            <input
              id="profile-birthdate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
            {user?.age ? (
              <small className="form-hint">{t('profile_age')}: {user.age}</small>
            ) : null}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="profile-weight">{t('profile_weight')}</label>
            <input
              id="profile-weight"
              type="number"
              min={0}
              step={0.1}
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="profile-height">{t('profile_height')}</label>
            <input
              id="profile-height"
              type="number"
              min={0}
              max={250}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="profile-language">{t('language')}</label>
          <select
            id="profile-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="es">{t('lang_es')}</option>
            <option value="en">{t('lang_en')}</option>
          </select>
        </div>

        {coachRequestStatus === 'approved' && (
          <div className="coach-status-badge coach-status-approved">
            {t('coach_request_approved_badge')}
          </div>
        )}
        {coachRequestStatus === 'pending' && (
          <div className="coach-status-badge coach-status-pending">
            {t('coach_request_pending_badge')}
          </div>
        )}
        {coachRequestStatus === 'none' && (
          <button type="button" className="btn btn-coach-request" onClick={() => setShowCoachModal(true)}>
            {t('coach_request_btn')}
          </button>
        )}

        {notifPrefs && (
          <div className="form-group">
            <label><strong>{t('notification_preferences')}</strong></label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={notifPrefs.workout_assigned}
                onChange={(e) => handlePrefChange('workout_assigned', e.target.checked)}
              />
              <span>{t('notification_pref_workout_assigned')}</span>
            </label>
            {user?.is_coach && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={notifPrefs.workout_completed_or_skipped}
                  onChange={(e) => handlePrefChange('workout_completed_or_skipped', e.target.checked)}
                />
                <span>{t('notification_pref_workout_status')}</span>
              </label>
            )}
          </div>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('profile_saving') : t('profile_save')}
          </button>
        </div>
      </form>

      {showCoachModal && (
        <div className="modal-overlay" onClick={() => setShowCoachModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('coach_request_modal_title')}</h2>
            <p>{t('coach_request_modal_body')}</p>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>{t('coach_request_locality')} *</label>
              <input
                type="text"
                value={coachLocality}
                onChange={(e) => setCoachLocality(e.target.value)}
                placeholder={t('coach_request_locality_placeholder')}
              />
            </div>
            <div className="form-group">
              <label>{t('coach_request_level')} *</label>
              <select value={coachLevel} onChange={(e) => setCoachLevel(e.target.value)}>
                <option value="">{t('coach_request_level_select')}</option>
                <option value="beginner">{t('level_beginner')}</option>
                <option value="intermediate">{t('level_intermediate')}</option>
                <option value="advanced">{t('level_advanced')}</option>
                <option value="competitive">{t('level_competitive')}</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCoachModal(false)}>
                {t('cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRequestCoach}
                disabled={requestingCoach || !coachLocality.trim() || !coachLevel}
              >
                {requestingCoach ? t('loading') : t('coach_request_modal_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
