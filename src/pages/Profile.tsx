import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { updateProfile, requestCoach, getCoachRequestStatus, uploadAvatar, deleteAvatar } from "../api/auth";
import { getMe } from "../api/auth";
import { getNotificationPreferences, updateNotificationPreferences } from "../api/notifications";
import { useTranslation } from "react-i18next";
import Avatar from "../components/Avatar";
import type { NotificationPreferences } from "../types";

export default function Profile() {
  const { user, setUser } = useAuth();
  const { t, i18n } = useTranslation();
  const { showSuccess, showError } = useFeedback();

  const [name, setName] = useState(user?.name ?? "");
  const [sex, setSex] = useState(user?.sex ?? "");
  const [birthDate, setBirthDate] = useState(user?.birth_date ?? "");
  const [weightKg, setWeightKg] = useState(user?.weight_kg ?? 0);
  const [heightCm, setHeightCm] = useState(user?.height_cm ?? 0);
  const [language, setLanguage] = useState(user?.language ?? "es");
  const [saving, setSaving] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [coachRequestStatus, setCoachRequestStatus] = useState<'none' | 'pending' | 'approved'>('none');
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [requestingCoach, setRequestingCoach] = useState(false);
  const [coachLocality, setCoachLocality] = useState("");
  const [coachLevels, setCoachLevels] = useState<string[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        assignment_message: updated.assignment_message,
      });
      showSuccess(t('preferences_saved'));
    } catch {
      showError(t('error'));
      setNotifPrefs(notifPrefs);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await updateProfile({ name, sex, birth_date: birthDate, weight_kg: weightKg, height_cm: heightCm, language, onboarding_completed: user?.onboarding_completed ?? true });
      setUser(res.data);
      i18n.changeLanguage(language);
      showSuccess(t('profile_saved'));
    } catch {
      showError("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  function resizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d')!;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, 200, 200);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError(t('avatar_invalid_type'));
      return;
    }
    setUploadingAvatar(true);
    try {
      const dataUri = await resizeImage(file);
      await uploadAvatar(dataUri);
      const res = await getMe();
      setUser(res.data);
      showSuccess(t('avatar_updated'));
    } catch {
      showError(t('error'));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAvatarRemove() {
    setUploadingAvatar(true);
    try {
      await deleteAvatar();
      const res = await getMe();
      setUser(res.data);
      showSuccess(t('avatar_removed'));
    } catch {
      showError(t('error'));
    } finally {
      setUploadingAvatar(false);
    }
  }

  function toggleLevel(level: string) {
    setCoachLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  async function handleRequestCoach() {
    if (!coachLocality.trim() || coachLevels.length === 0) return;
    setRequestingCoach(true);
    try {
      await requestCoach({ locality: coachLocality.trim(), level: coachLevels });
      showSuccess(t('coach_request_sent'));
      setCoachRequestStatus('pending');
      setShowCoachModal(false);
    } catch {
      showError(t('error'));
    } finally {
      setRequestingCoach(false);
    }
  }

  if (!user) return null;

  return (
    <div className="page">
      <h1>{t('profile_title')}</h1>

      <div className="profile-info">
        <div className="profile-avatar-wrapper">
          <Avatar src={user.custom_avatar} name={user.name} size={64} className="profile-avatar" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
          <div className="profile-avatar-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? t('loading') : t('avatar_change')}
            </button>
            {user.custom_avatar && (
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={handleAvatarRemove}
                disabled={uploadingAvatar}
              >
                {t('avatar_remove')}
              </button>
            )}
          </div>
        </div>
        <div className="profile-details">
          <h2>{user.name}</h2>
          <p className="profile-email">{user.email}</p>
        </div>
      </div>

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

        {/* My Coach / Find a Coach section (only for non-coaches) */}
        {!user.is_coach && (
          <div className="form-group">
            <label><strong>{t('profile_my_coach')}</strong></label>
            {user.has_coach ? (
              <Link to={`/coaches/${user.coach_id}`} className="my-coach-card">
                <Avatar src={user.coach_avatar} name={user.coach_name} size={40} />
                <span className="my-coach-name">{user.coach_name}</span>
                <span className="my-coach-arrow">→</span>
              </Link>
            ) : (
              <div className="my-coach-empty">
                <p>{t('profile_no_coach')}</p>
                <Link to="/coaches" className="btn btn-primary">
                  {t('profile_find_coach')}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Become a coach (only for non-coaches) */}
        {!user.is_coach && (
          <>
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
          </>
        )}

        {notifPrefs && (user.has_coach || user.is_coach) && (
          <div className="form-group">
            <label><strong>{t('notification_preferences')}</strong></label>
            {user.has_coach && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={notifPrefs.workout_assigned}
                  onChange={(e) => handlePrefChange('workout_assigned', e.target.checked)}
                />
                <span>{t('notification_pref_workout_assigned')}</span>
              </label>
            )}
            {user.is_coach && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={notifPrefs.workout_completed_or_skipped}
                  onChange={(e) => handlePrefChange('workout_completed_or_skipped', e.target.checked)}
                />
                <span>{t('notification_pref_workout_status')}</span>
              </label>
            )}
            {(user.has_coach || user.is_coach) && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={notifPrefs.assignment_message}
                  onChange={(e) => handlePrefChange('assignment_message', e.target.checked)}
                />
                <span>{t('notification_pref_assignment_message')}</span>
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
              <div className="level-checkboxes">
                {['beginner', 'intermediate', 'advanced', 'competitive'].map((lvl) => (
                  <label key={lvl} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={coachLevels.includes(lvl)}
                      onChange={() => toggleLevel(lvl)}
                    />
                    <span>{t(`level_${lvl}`)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCoachModal(false)}>
                {t('cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRequestCoach}
                disabled={requestingCoach || !coachLocality.trim() || coachLevels.length === 0}
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
