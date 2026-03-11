import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPendingAchievements, verifyAchievement, rejectAchievement } from "../api/admin";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import type { PendingAchievement } from "../types";

export default function AdminAchievementDetail() {
  const { t } = useTranslation();
  const { showError } = useFeedback();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [achievement, setAchievement] = useState<PendingAchievement | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    loadAchievement();
  }, [id]);

  async function loadAchievement() {
    try {
      setLoading(true);
      const res = await getPendingAchievements();
      const found = res.data.find((a: PendingAchievement) => a.id === Number(id));
      setAchievement(found || null);
    } catch {
      setAchievement(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!achievement) return;
    try {
      await verifyAchievement(achievement.id);
      navigate('/admin/achievements', { state: { feedback: t('admin_achievement_verified') } });
    } catch { showError(t('error')); }
  }

  async function handleRejectConfirm() {
    if (!achievement) return;
    try {
      await rejectAchievement(achievement.id, rejectReason);
      navigate('/admin/achievements', { state: { feedback: t('admin_achievement_rejected') } });
    } catch { showError(t('error')); }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;
  if (!achievement) return <div className="page"><p>{t('admin_achievement_not_found')}</p></div>;

  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api\/?$/, '');
  const token = localStorage.getItem('token');

  return (
    <div className="page">
      <button className="btn btn-sm" onClick={() => navigate('/admin/achievements')} style={{ marginBottom: '1rem' }}>
        ← {t('admin_achievements')}
      </button>

      <div className="achievement-detail-card">
        <h1>{achievement.event_name}</h1>
        <p className="achievement-detail-coach">{t('admin_role_coach')}: <strong>{achievement.coach_name}</strong></p>

        <div className="detail-readonly">
          <div className="detail-row">
            <span className="detail-label">{t('achievement_event_date')}</span>
            <span>{achievement.event_date}</span>
          </div>
          {achievement.distance_km > 0 && (
            <div className="detail-row">
              <span className="detail-label">{t('achievement_distance')}</span>
              <span>{achievement.distance_km} km</span>
            </div>
          )}
          {achievement.result_time && (
            <div className="detail-row">
              <span className="detail-label">{t('achievement_result_time')}</span>
              <span>{achievement.result_time}</span>
            </div>
          )}
          {achievement.position > 0 && (
            <div className="detail-row">
              <span className="detail-label">{t('achievement_position')}</span>
              <span>#{achievement.position}</span>
            </div>
          )}
          {achievement.extra_info && (
            <div className="detail-row detail-row-block">
              <span className="detail-label">{t('achievement_extra_info')}</span>
              <span>{achievement.extra_info}</span>
            </div>
          )}
        </div>

        {achievement.image_url && (
          <div className="achievement-detail-image">
            <h3>{t('achievement_image')}</h3>
            <img
              src={`${apiBase}${achievement.image_url}?token=${token}`}
              alt={achievement.event_name}
              className="detail-image"
            />
          </div>
        )}

        <div className="achievement-detail-actions">
          <button className="btn btn-primary" onClick={handleVerify}>
            {t('admin_verify')}
          </button>
          <button className="btn btn-danger" onClick={() => { setShowReject(true); setRejectReason(""); }}>
            {t('admin_reject')}
          </button>
        </div>
      </div>

      {showReject && (
        <div className="modal-overlay" onClick={() => setShowReject(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('admin_reject')}</h3>
            <div className="form-group">
              <label>{t('admin_reject_reason')}</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value.slice(0, 200))}
                rows={3}
                placeholder={t('admin_reject_reason_placeholder')}
                maxLength={200}
              />
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{rejectReason.length}/200</small>
            </div>
            <div className="form-actions">
              <button className="btn" onClick={() => setShowReject(false)}>{t('form_cancel')}</button>
              <button className="btn btn-danger" onClick={handleRejectConfirm}>{t('admin_reject_confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
