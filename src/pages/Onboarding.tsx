import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { updateProfile } from "../api/auth";
import { useTranslation } from "react-i18next";

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [name, setName] = useState(user?.name ?? "");
  const [sex, setSex] = useState(user?.sex ?? "");
  const [birthDate, setBirthDate] = useState(user?.birth_date ?? "");
  const [weightKg, setWeightKg] = useState(user?.weight_kg ?? 0);
  const [heightCm, setHeightCm] = useState(user?.height_cm ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await updateProfile({
        name,
        sex,
        birth_date: birthDate,
        weight_kg: weightKg,
        height_cm: heightCm,
        language: user?.language ?? "es",
        onboarding_completed: true,
      });
      setUser(res.data);
      navigate("/");
    } catch {
      setError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="page onboarding-page">
      <div className="onboarding-container">
        <h1>{t("onboarding_title")}</h1>
        <p className="onboarding-subtitle">{t("onboarding_subtitle")}</p>

        {error && <div className="error">{error}</div>}

        <form className="workout-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="onboarding-name">{t("profile_name")}</label>
            <input
              id="onboarding-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="onboarding-sex">{t("profile_sex")}</label>
            <select
              id="onboarding-sex"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              required
            >
              <option value="">—</option>
              <option value="M">{t("profile_sex_m")}</option>
              <option value="F">{t("profile_sex_f")}</option>
              <option value="other">{t("profile_sex_other")}</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="onboarding-birthdate">
              {t("onboarding_birth_date")}
            </label>
            <input
              id="onboarding-birthdate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
            <small className="form-hint">{t("onboarding_birth_date_hint")}</small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="onboarding-weight">{t("profile_weight")}</label>
              <input
                id="onboarding-weight"
                type="number"
                min={20}
                max={300}
                step={0.1}
                value={weightKg || ""}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="onboarding-height">{t("onboarding_height")}</label>
              <input
                id="onboarding-height"
                type="number"
                min={100}
                max={250}
                value={heightCm || ""}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t("onboarding_saving") : t("onboarding_continue")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
