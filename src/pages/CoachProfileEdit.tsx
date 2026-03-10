import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { updateCoachProfile, listMyAchievements, createAchievement, updateAchievement, deleteAchievement } from "../api/coaches";
import { getMe } from "../api/auth";
import type { CoachAchievement } from "../types";

export default function CoachProfileEdit() {
  const { user, setUser } = useAuth();
  const { t } = useTranslation();
  const [description, setDescription] = useState(user?.coach_description || "");
  const [isPublic, setIsPublic] = useState(user?.coach_public || false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [achievements, setAchievements] = useState<CoachAchievement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [distanceKm, setDistanceKm] = useState(0);
  const [resultTime, setResultTime] = useState("");
  const [position, setPosition] = useState(0);

  useEffect(() => { loadAchievements(); }, []);

  async function loadAchievements() {
    try { const res = await listMyAchievements(); setAchievements(res.data); }
    catch { setAchievements([]); }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    try {
      await updateCoachProfile({ coach_description: description, coach_public: isPublic });
      const res = await getMe();
      setUser(res.data);
      setMsg(t('profile_saved'));
    } catch { setMsg(t('error')); }
    finally { setSaving(false); }
  }

  function resetForm() {
    setEditId(null); setEventName(""); setEventDate("");
    setDistanceKm(0); setResultTime(""); setPosition(0); setShowForm(false);
  }

  function startEdit(a: CoachAchievement) {
    if (a.is_verified) return;
    setEditId(a.id); setEventName(a.event_name); setEventDate(a.event_date);
    setDistanceKm(a.distance_km); setResultTime(a.result_time); setPosition(a.position);
    setShowForm(true);
  }

  async function handleSaveAchievement(e: React.FormEvent) {
    e.preventDefault();
    const data = { event_name: eventName, event_date: eventDate, distance_km: distanceKm, result_time: resultTime, position };
    try {
      if (editId) { await updateAchievement(editId, data); }
      else { await createAchievement(data); }
      resetForm(); loadAchievements();
    } catch { setMsg(t('error')); }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('workouts_delete_confirm'))) return;
    try { await deleteAchievement(id); loadAchievements(); }
    catch { setMsg(t('error')); }
  }

  return (
    <div className="page">
      <h1>{t('coach_profile_title')}</h1>
      <form className="workout-form" onSubmit={handleSaveProfile}>
        <div className="form-group">
          <label>{t('coach_profile_description')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder={t('coach_profile_description_placeholder')} />
        </div>
        <div className="form-group">
          <label><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />{' '}{t('coach_profile_public')}</label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('form_saving') : t('form_save')}</button>
        {msg && <p className="success-msg">{msg}</p>}
      </form>

      <hr />

      <div className="coach-profile-section">
        <h2>{t('achievement_title')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>{t('achievement_add')}</button>

        {showForm && (
          <form className="workout-form" onSubmit={handleSaveAchievement} style={{ marginTop: '1rem' }}>
            <div className="form-row">
              <div className="form-group">
                <label>{t('achievement_event_name')}</label>
                <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>{t('achievement_event_date')}</label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{t('achievement_distance')}</label>
                <input type="number" step="0.01" value={distanceKm} onChange={(e) => setDistanceKm(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>{t('achievement_result_time')}</label>
                <input type="text" value={resultTime} onChange={(e) => setResultTime(e.target.value)} placeholder="HH:MM:SS" />
              </div>
              <div className="form-group">
                <label>{t('achievement_position')}</label>
                <input type="number" value={position} onChange={(e) => setPosition(Number(e.target.value))} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">{t('form_save')}</button>
              <button type="button" className="btn" onClick={resetForm}>{t('form_cancel')}</button>
            </div>
          </form>
        )}

        {achievements.length === 0 ? (
          <p>{t('achievement_no_achievements')}</p>
        ) : (
          <div className="achievement-list" style={{ marginTop: '1rem' }}>
            {achievements.map((a) => (
              <div key={a.id} className="achievement-card">
                <div className="achievement-card-header">
                  <strong>{a.event_name}</strong>
                  {a.is_verified ? (
                    <span className="badge badge-verified">{t('achievement_verified')}</span>
                  ) : (
                    <span className="badge badge-pending">{t('achievement_pending')}</span>
                  )}
                </div>
                <p>{a.event_date} — {a.distance_km}km</p>
                {a.result_time && <p>{t('achievement_result_time')}: {a.result_time}</p>}
                {a.position > 0 && <p>{t('achievement_position')}: #{a.position}</p>}
                <div className="form-actions">
                  {!a.is_verified && (
                    <>
                      <button className="btn btn-sm" onClick={() => startEdit(a)}>{t('edit')}</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>{t('delete')}</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
