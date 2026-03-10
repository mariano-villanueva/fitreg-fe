import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAdminStats } from "../api/admin";
import { useTranslation } from "react-i18next";
import type { AdminStats } from "../types";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => { getAdminStats().then((res) => setStats(res.data)).catch(() => {}); }, []);

  return (
    <div className="page">
      <h1>{t('admin_title')}</h1>
      {stats && (
        <div className="home-stats">
          <div className="home-stat-card"><span className="stat-number">{stats.total_users}</span><span>{t('admin_total_users')}</span></div>
          <div className="home-stat-card"><span className="stat-number">{stats.total_coaches}</span><span>{t('admin_total_coaches')}</span></div>
          <div className="home-stat-card"><span className="stat-number">{stats.total_ratings}</span><span>{t('admin_total_ratings')}</span></div>
          <div className="home-stat-card"><span className="stat-number">{stats.pending_achievements}</span><span>{t('admin_pending_achievements')}</span></div>
        </div>
      )}
      <div className="admin-links" style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <Link to="/admin/users" className="btn btn-primary">{t('admin_users')}</Link>
        <Link to="/admin/achievements" className="btn btn-primary">{t('admin_achievements')}</Link>
      </div>
    </div>
  );
}
