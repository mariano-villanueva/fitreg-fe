import { useState, useEffect } from "react";
import { getPendingAchievements, verifyAchievement, rejectAchievement } from "../api/admin";
import { useTranslation } from "react-i18next";
import type { PendingAchievement } from "../types";

export default function AdminAchievements() {
  const { t } = useTranslation();
  const [achievements, setAchievements] = useState<PendingAchievement[]>([]);

  useEffect(() => { loadAchievements(); }, []);

  async function loadAchievements() {
    try { const res = await getPendingAchievements(); setAchievements(res.data); }
    catch { setAchievements([]); }
  }

  async function handleVerify(id: number) { await verifyAchievement(id); loadAchievements(); }
  async function handleReject(id: number) { await rejectAchievement(id); loadAchievements(); }

  return (
    <div className="page">
      <h1>{t('admin_achievements')}</h1>
      {achievements.length === 0 ? (
        <p>{t('admin_no_pending')}</p>
      ) : (
        <div className="achievement-list">
          {achievements.map((a) => (
            <div key={a.id} className="achievement-card">
              <div className="achievement-card-header">
                <strong>{a.event_name}</strong>
                <span className="badge">{a.coach_name}</span>
              </div>
              <p>{a.event_date} — {a.distance_km}km</p>
              {a.result_time && <p>{t('achievement_result_time')}: {a.result_time}</p>}
              {a.position > 0 && <p>{t('achievement_position')}: #{a.position}</p>}
              <div className="form-actions">
                <button className="btn btn-primary btn-sm" onClick={() => handleVerify(a.id)}>{t('admin_verify')}</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleReject(a.id)}>{t('admin_reject')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
