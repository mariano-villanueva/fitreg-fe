import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { updateCoachProfile, listMyAchievements, createAchievement, updateAchievement, deleteAchievement, toggleAchievementVisibility } from "../api/coaches";
import { getMe } from "../api/auth";
import type { CoachAchievement, FileResponse } from "../types";
import ImageUpload from "../components/ImageUpload";
import { useFeedback } from "../context/FeedbackContext";

function achievementStatus(a: CoachAchievement): 'verified' | 'rejected' | 'pending' {
  if (a.is_verified) return 'verified';
  if (a.rejection_reason) return 'rejected';
  return 'pending';
}

export default function CoachProfileEdit() {
  const { user, setUser } = useAuth();
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const [description, setDescription] = useState(user?.coach_description || "");
  const [isPublic, setIsPublic] = useState(user?.coach_public || false);
  const [saving, setSaving] = useState(false);
  const [showPublicModal, setShowPublicModal] = useState(false);

  const [achievements, setAchievements] = useState<CoachAchievement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [distanceKm, setDistanceKm] = useState(0);
  const [resultTime, setResultTime] = useState("");
  const [position, setPosition] = useState(0);
  const [extraInfo, setExtraInfo] = useState("");
  const [achievementImage, setAchievementImage] = useState<FileResponse | null>(null);

  useEffect(() => { loadAchievements(); }, []);

  async function loadAchievements() {
    try { const res = await listMyAchievements(); setAchievements(res.data); }
    catch { setAchievements([]); }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateCoachProfile({ coach_description: description, coach_public: isPublic });
      const res = await getMe();
      setUser(res.data);
      showSuccess(t('profile_saved'));
    } catch { showError(t('error')); }
    finally { setSaving(false); }
  }

  function resetForm() {
    setEditId(null); setEventName(""); setEventDate("");
    setDistanceKm(0); setResultTime(""); setPosition(0);
    setExtraInfo(""); setAchievementImage(null); setShowForm(false);
  }

  function startEdit(a: CoachAchievement) {
    if (achievementStatus(a) !== 'rejected') return;
    setEditId(a.id); setEventName(a.event_name); setEventDate(a.event_date);
    setDistanceKm(a.distance_km); setResultTime(a.result_time); setPosition(a.position);
    setExtraInfo(a.extra_info || "");
    setAchievementImage(a.image_file_id ? { id: a.image_file_id, uuid: '', original_name: '', content_type: '', size_bytes: 0, url: a.image_url || '', created_at: '' } : null);
    setShowForm(true);
  }

  async function handleSaveAchievement(e: React.FormEvent) {
    e.preventDefault();
    const data = { event_name: eventName, event_date: eventDate, distance_km: distanceKm, result_time: resultTime, position, extra_info: extraInfo, image_file_id: achievementImage?.id || null };
    try {
      if (editId) { await updateAchievement(editId, data); }
      else { await createAchievement(data); }
      showSuccess(t('achievement_saved'));
      resetForm(); loadAchievements();
    } catch { showError(t('error')); }
  }

  async function handleTogglePublic(a: CoachAchievement) {
    try {
      await toggleAchievementVisibility(a.id, !a.is_public);
      showSuccess(t('achievement_visibility_updated'));
      loadAchievements();
    } catch { showError(t('error')); }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('workouts_delete_confirm'))) return;
    try { await deleteAchievement(id); showSuccess(t('achievement_deleted')); loadAchievements(); }
    catch { showError(t('error')); }
  }

  return (
    <div className="page">
      <h1>{t('coach_profile_title')}</h1>

      <form className="coach-profile-form" onSubmit={handleSaveProfile}>
        <div className="form-group">
          <label>{t('coach_profile_description')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder={t('coach_profile_description_placeholder')} />
        </div>
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => {
                if (e.target.checked) {
                  setShowPublicModal(true);
                } else {
                  setIsPublic(false);
                }
              }}
            />
            {t('coach_profile_public')}
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('form_saving') : t('form_save')}</button>
        </div>
      </form>

      <div className="coach-profile-section">
        <div className="coach-section-header">
          <h2>{t('achievement_title')}</h2>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>{t('achievement_add')}</button>
        </div>

        {showForm && (
          <div className="modal-overlay" onClick={() => resetForm()}>
            <div className="modal coach-achievement-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{editId ? t('edit') : t('achievement_add')}</h3>
              <form onSubmit={handleSaveAchievement}>
                <div className="form-group">
                  <label>{t('achievement_event_name')}</label>
                  <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('achievement_event_date')}</label>
                    <input type="date" value={eventDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setEventDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('achievement_distance')}</label>
                    <input type="number" step="0.01" value={distanceKm} onChange={(e) => setDistanceKm(Number(e.target.value))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('achievement_result_time')}</label>
                    <input type="text" value={resultTime} onChange={(e) => setResultTime(e.target.value)} placeholder="HH:MM:SS" />
                  </div>
                  <div className="form-group">
                    <label>{t('achievement_position')}</label>
                    <input type="number" value={position} onChange={(e) => setPosition(Number(e.target.value))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('achievement_extra_info')}</label>
                  <input type="text" value={extraInfo} onChange={(e) => setExtraInfo(e.target.value.slice(0, 500))} placeholder={t('achievement_extra_info_placeholder')} />
                </div>
                <div className="form-group">
                  <label>{t('achievement_image')}</label>
                  <ImageUpload value={achievementImage} onChange={setAchievementImage} />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn" onClick={resetForm}>{t('form_cancel')}</button>
                  <button type="submit" className="btn btn-primary">{t('form_save')}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {achievements.length === 0 ? (
          <p className="empty-hint">{t('achievement_no_achievements')}</p>
        ) : (
          <table className="assignments-table">
            <thead>
              <tr>
                <th>{t('achievement_event_name')}</th>
                <th>{t('achievement_event_date')}</th>
                <th>{t('achievement_distance')}</th>
                <th>{t('achievement_result_time')}</th>
                <th>{t('achievement_position')}</th>
                <th>{t('achievement_extra_info')}</th>
                <th>{t('achievement_public')}</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {achievements.map((a) => {
                const status = achievementStatus(a);
                return (
                  <tr key={a.id} className={status === 'rejected' ? 'achievement-row-rejected' : ''}>
                    <td><strong>{a.event_name}</strong></td>
                    <td>{a.event_date}</td>
                    <td>{a.distance_km > 0 ? `${a.distance_km} km` : '—'}</td>
                    <td>{a.result_time || '—'}</td>
                    <td>{a.position > 0 ? `#${a.position}` : '—'}</td>
                    <td className="achievement-extra-info-cell">{a.extra_info || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={a.is_public}
                        onChange={() => handleTogglePublic(a)}
                      />
                    </td>
                    <td>
                      {status === 'verified' && (
                        <span className="badge badge-verified">{t('achievement_verified')}</span>
                      )}
                      {status === 'pending' && (
                        <span className="badge badge-pending">{t('achievement_pending')}</span>
                      )}
                      {status === 'rejected' && (
                        <div>
                          <span className="badge badge-rejected">{t('achievement_rejected')}</span>
                          {a.rejection_reason && (
                            <p className="achievement-rejection-reason">{a.rejection_reason}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      {status === 'rejected' && (
                        <div className="achievement-actions">
                          <button className="btn btn-sm btn-primary" onClick={() => startEdit(a)}>{t('edit')}</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>{t('delete')}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showPublicModal && (
        <div className="modal-overlay" onClick={() => setShowPublicModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('coach_public_modal_title')}</h3>
            <p>{t('coach_public_modal_body')}</p>
            <div className="form-actions">
              <button
                className="btn"
                onClick={() => setShowPublicModal(false)}
              >
                {t('cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => { setIsPublic(true); setShowPublicModal(false); }}
              >
                {t('coach_public_modal_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
