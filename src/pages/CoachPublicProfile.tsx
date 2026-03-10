import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getCoachProfile, upsertRating } from "../api/coaches";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import type { CoachPublicProfile as CoachProfileType } from "../types";

export default function CoachPublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<CoachProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ratingMsg, setRatingMsg] = useState("");

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

  async function handleRating(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setRatingMsg("");
    try {
      await upsertRating(Number(id), { rating, comment });
      setRatingMsg(t('profile_saved'));
      loadProfile();
    } catch { setRatingMsg(t('error')); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;
  if (!profile) return <div className="page"><p>{t('error')}</p></div>;

  return (
    <div className="page">
      <div className="coach-profile-header">
        <img src={profile.avatar_url || ''} alt={profile.name} className="coach-profile-avatar" />
        <div>
          <h1>{profile.name}</h1>
          <p className="coach-profile-rating">{profile.avg_rating.toFixed(1)} ({profile.rating_count} {t('rating_count')})</p>
        </div>
      </div>

      {profile.coach_description && (
        <div className="coach-profile-section"><p>{profile.coach_description}</p></div>
      )}

      <div className="coach-profile-section">
        <h2>{t('achievement_title')}</h2>
        {profile.achievements.length === 0 ? (
          <p>{t('achievement_no_achievements')}</p>
        ) : (
          <div className="achievement-list">
            {profile.achievements.map((a) => (
              <div key={a.id} className="achievement-card">
                <div className="achievement-card-header">
                  <strong>{a.event_name}</strong>
                  {a.is_verified && <span className="badge badge-verified">{t('achievement_verified')}</span>}
                </div>
                <p>{a.event_date} — {a.distance_km}km</p>
                {a.result_time && <p>{t('achievement_result_time')}: {a.result_time}</p>}
                {a.position > 0 && <p>{t('achievement_position')}: #{a.position}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="coach-profile-section">
        <h2>{t('rating_title')}</h2>
        <form className="rating-form" onSubmit={handleRating}>
          <h3>{t('rating_leave_rating')}</h3>
          <div className="form-group">
            <label>{t('rating_your_rating')}: {rating}/10</label>
            <input type="range" min={1} max={10} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>{t('rating_comment')}</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? t('form_saving') : t('rating_submit')}
          </button>
          {ratingMsg && <p className="success-msg">{ratingMsg}</p>}
        </form>

        {profile.ratings.length > 0 && (
          <div className="rating-list">
            {profile.ratings.map((r) => (
              <div key={r.id} className="rating-card">
                <div className="rating-card-header">
                  <strong>{r.student_name}</strong>
                  <span>{r.rating}/10</span>
                </div>
                {r.comment && <p>{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
