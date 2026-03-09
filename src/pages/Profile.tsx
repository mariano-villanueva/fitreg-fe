import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { updateProfile } from "../api/auth";
import { useTranslation } from "react-i18next";

export default function Profile() {
  const { user, setUser } = useAuth();
  const { t, i18n } = useTranslation();

  const [name, setName] = useState(user?.name ?? "");
  const [sex, setSex] = useState(user?.sex ?? "");
  const [age, setAge] = useState(user?.age ?? 0);
  const [weightKg, setWeightKg] = useState(user?.weight_kg ?? 0);
  const [language, setLanguage] = useState(user?.language ?? "es");
  const [isCoach, setIsCoach] = useState(user?.is_coach ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const res = await updateProfile({ name, sex, age, weight_kg: weightKg, language, is_coach: isCoach });
      setUser(res.data);
      i18n.changeLanguage(language);
      setSuccess(t('profile_saved'));
    } catch {
      setError("Failed to update profile.");
    } finally {
      setSaving(false);
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
            <label htmlFor="profile-age">{t('profile_age')}</label>
            <input
              id="profile-age"
              type="number"
              min={0}
              max={120}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
            />
          </div>
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
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isCoach}
              onChange={(e) => setIsCoach(e.target.checked)}
            />
            <span>{t('profile_is_coach')}</span>
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('profile_saving') : t('profile_save')}
          </button>
        </div>
      </form>
    </div>
  );
}
