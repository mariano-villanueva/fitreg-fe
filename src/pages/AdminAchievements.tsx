import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { getPendingAchievements } from "../api/admin";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import type { PendingAchievement } from "../types";

export default function AdminAchievements() {
  const { t } = useTranslation();
  const { showSuccess } = useFeedback();
  const location = useLocation();
  const [achievements, setAchievements] = useState<PendingAchievement[]>([]);

  const feedbackShown = useRef(false);
  useEffect(() => {
    const state = location.state as { feedback?: string } | null;
    if (state?.feedback && !feedbackShown.current) {
      feedbackShown.current = true;
      showSuccess(state.feedback);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => { loadAchievements(); }, []);

  async function loadAchievements() {
    try { const res = await getPendingAchievements(); setAchievements(res.data); }
    catch { setAchievements([]); }
  }

  return (
    <div className="page">
      <h1>{t('admin_achievements')}</h1>
      {achievements.length === 0 ? (
        <p>{t('admin_no_pending')}</p>
      ) : (
        <table className="assignments-table">
          <thead>
            <tr>
              <th>{t('admin_role_coach')}</th>
              <th>{t('achievement_event_name')}</th>
              <th>{t('achievement_event_date')}</th>
              <th>{t('achievement_distance')}</th>
              <th>{t('achievement_result_time')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {achievements.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.coach_name}</strong></td>
                <td>{a.event_name}</td>
                <td>{a.event_date}</td>
                <td>{a.distance_km > 0 ? `${a.distance_km} km` : '—'}</td>
                <td>{a.result_time || '—'}</td>
                <td>
                  <Link to={`/admin/achievements/${a.id}`} className="btn btn-primary btn-sm">
                    {t('admin_review_achievement')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
