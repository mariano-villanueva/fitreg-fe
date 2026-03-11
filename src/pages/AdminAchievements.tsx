import { useState, useEffect } from "react";
import { getPendingAchievements, verifyAchievement, rejectAchievement } from "../api/admin";
import { useTranslation } from "react-i18next";
import type { PendingAchievement } from "../types";

export default function AdminAchievements() {
  const { t } = useTranslation();
  const [achievements, setAchievements] = useState<PendingAchievement[]>([]);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => { loadAchievements(); }, []);

  async function loadAchievements() {
    try { const res = await getPendingAchievements(); setAchievements(res.data); }
    catch { setAchievements([]); }
  }

  async function handleVerify(id: number) {
    await verifyAchievement(id);
    loadAchievements();
  }

  async function handleRejectConfirm() {
    if (rejectId === null) return;
    await rejectAchievement(rejectId, rejectReason);
    setRejectId(null);
    setRejectReason("");
    loadAchievements();
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
              <th>{t('achievement_position')}</th>
              <th>{t('achievement_extra_info')}</th>
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
                <td>{a.position > 0 ? `#${a.position}` : '—'}</td>
                <td className="achievement-extra-info-cell">{a.extra_info || '—'}</td>
                <td>
                  <div className="achievement-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleVerify(a.id)}>{t('admin_verify')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => { setRejectId(a.id); setRejectReason(""); }}>{t('admin_reject')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rejectId !== null && (
        <div className="modal-overlay" onClick={() => setRejectId(null)}>
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
              <button className="btn" onClick={() => setRejectId(null)}>{t('form_cancel')}</button>
              <button className="btn btn-danger" onClick={handleRejectConfirm}>{t('admin_reject_confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
