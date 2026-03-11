import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getCoachProfile, upsertRating } from "../api/coaches";
import { createInvitation } from "../api/invitations";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import type { CoachPublicProfile as CoachProfileType } from "../types";
import { useFeedback } from "../context/FeedbackContext";

export default function CoachPublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const [profile, setProfile] = useState<CoachProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);

  useEffect(() => { loadProfile(); }, [id]);

  async function loadProfile() {
    try {
      const res = await getCoachProfile(Number(id));
      setProfile(res.data);
      const myRating = res.data.ratings.find((r) => r.student_id === user?.id);
      if (myRating) {
        setRating(myRating.rating);
        setComment(myRating.comment || "");
      }
    } catch { setProfile(null); }
    finally { setLoading(false); }
  }

  async function handleRequestCoach(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setRequesting(true);
    try {
      await createInvitation({ type: 'student_request', receiver_id: profile.id, message: requestMessage.trim() || undefined });
      showSuccess(t('invitation_request_sent'));
      setRequestSent(true);
      setShowRequestModal(false);
      setRequestMessage("");
    } catch {
      // Error handled silently
    } finally {
      setRequesting(false);
    }
  }

  async function handleRating(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await upsertRating(Number(id), { rating, comment });
      showSuccess(t('rating_saved'));
      loadProfile();
    } catch { showError(t('error')); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;
  if (!profile) return <div className="page"><p>{t('error')}</p></div>;

  const verifiedAchievements = profile.achievements.filter((a) => a.is_verified);
  const myRating = profile.ratings.find((r) => r.student_id === user?.id);
  const isEditing = !!myRating;
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api\/?$/, '');
  const token = localStorage.getItem('token');

  return (
    <div className="page coach-public-page">
      {/* Hero section */}
      <div className="coach-hero">
        <img src={profile.avatar_url || ''} alt={profile.name} className="coach-hero-avatar" />
        <div className="coach-hero-info">
          <h1>{profile.name}</h1>
          {profile.avg_rating > 0 && (
            <div className="coach-hero-rating">
              <span className="coach-hero-stars">{'★'.repeat(Math.round(profile.avg_rating / 2))}</span>
              <span className="coach-hero-rating-text">{profile.avg_rating.toFixed(1)}/10 ({profile.rating_count} {t('rating_count')})</span>
            </div>
          )}
          {profile.coach_description && (
            <p className="coach-hero-description">{profile.coach_description}</p>
          )}
          <div className="coach-hero-actions">
            {!requestSent ? (
              <button className="btn btn-primary" onClick={() => setShowRequestModal(true)}>
                {t('invitation_request_coach')}
              </button>
            ) : (
              <span className="badge badge-pending">{t('invitation_status_pending')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats section */}
      <section className="coach-public-section">
        <h2>{t('coach_stats_title')}</h2>
        <div className="coach-stats-grid">
          <div className="coach-stat-card">
            <span className="coach-stat-value">{profile.student_count}</span>
            <span className="coach-stat-label">{t('coach_stats_students')}</span>
          </div>
          <div className="coach-stat-card coach-stat-clickable" onClick={() => verifiedAchievements.length > 0 && setShowAchievementsModal(true)}>
            <span className="coach-stat-value">{profile.verified_achievement_count}</span>
            <span className="coach-stat-label">{t('coach_stats_achievements')}</span>
          </div>
          <div className="coach-stat-card">
            <span className="coach-stat-value">{profile.avg_rating > 0 ? profile.avg_rating.toFixed(1) : '—'}</span>
            <span className="coach-stat-label">{t('coach_stats_avg_rating')}</span>
          </div>
        </div>
      </section>

      {/* Ratings section */}
      <section className="coach-public-section">
        <h2>{t('rating_title')} {profile.ratings.length > 0 && <span className="coach-section-count">({profile.ratings.length})</span>}</h2>

        {/* Leave/edit a rating form - only for active students */}
        {profile.is_my_coach && (
          <div className="coach-rating-form-card">
            <h3>{isEditing ? t('rating_edit_rating') : t('rating_leave_rating')}</h3>
            <form className="coach-rating-form" onSubmit={handleRating}>
              <div className="form-group">
                <label>{t('rating_your_rating')}: <strong>{rating}/10</strong></label>
                <input type="range" min={1} max={10} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>{t('rating_comment')}</label>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? t('form_saving') : (isEditing ? t('rating_update') : t('rating_submit'))}
              </button>
            </form>
          </div>
        )}
        {!profile.is_my_coach && user && (
          <p className="coach-rating-hint">{t('rating_must_be_student')}</p>
        )}

        {/* Reviews list */}
        {profile.ratings.length > 0 && (
          <div className="coach-reviews-list">
            {profile.ratings.map((r) => (
              <div key={r.id} className="coach-review-card">
                <div className="coach-review-header">
                  <strong>{r.student_name}</strong>
                  <span className="coach-review-score">{r.rating}/10</span>
                </div>
                {r.comment && <p className="coach-review-comment">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Achievements modal */}
      {showAchievementsModal && (
        <div className="modal-overlay" onClick={() => setShowAchievementsModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <h3>{t('achievement_title')} ({verifiedAchievements.length})</h3>
            <div className="coach-achievement-modal-list">
              {verifiedAchievements.map((a) => (
                <div key={a.id} className="coach-achievement-modal-item">
                  {a.image_url && (
                    <img
                      src={`${apiBase}${a.image_url}?token=${token}`}
                      alt={a.event_name}
                      className="coach-achievement-modal-img"
                    />
                  )}
                  <div className="coach-achievement-body">
                    <div className="coach-achievement-name">
                      <strong>{a.event_name}</strong>
                      <span className="badge badge-verified">{t('achievement_verified')}</span>
                    </div>
                    <div className="coach-achievement-meta">
                      <span>{a.event_date}</span>
                      {a.distance_km > 0 && <span>{a.distance_km} km</span>}
                      {a.result_time && <span>{a.result_time}</span>}
                      {a.position > 0 && <span>#{a.position}</span>}
                    </div>
                    {a.extra_info && <p className="coach-achievement-extra">{a.extra_info}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setShowAchievementsModal(false)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request coach modal */}
      {showRequestModal && (
        <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('invitation_request_coach')}</h3>
            <form onSubmit={handleRequestCoach}>
              <div className="form-group">
                <label>{t('invitation_message')}</label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder={t('invitation_message_placeholder')}
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowRequestModal(false)}>
                  {t('cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={requesting}>
                  {requesting ? t('form_saving') : t('invitation_request_coach')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
