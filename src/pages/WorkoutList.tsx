import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listWorkouts, deleteWorkout } from "../api/workouts";
import type { Workout } from "../types";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";

const RECENT_COUNT = 4;
const PAGE_SIZE = 10;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function WorkoutList() {
  const { t } = useTranslation();
  const { showError } = useFeedback();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const TYPE_LABELS: Record<string, string> = {
    easy: t('type_easy'),
    tempo: t('type_tempo'),
    intervals: t('type_intervals'),
    long_run: t('type_long_run'),
    race: t('type_race'),
    other: t('type_other'),
  };

  useEffect(() => {
    loadWorkouts();
  }, []);

  async function loadWorkouts() {
    try {
      setLoading(true);
      const data = await listWorkouts();
      setWorkouts(data || []);
    } catch {
      showError("Failed to load workouts.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('workouts_delete_confirm'))) return;
    try {
      await deleteWorkout(id);
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
    } catch {
      showError("Failed to delete run.");
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;

  const recent = workouts.slice(0, RECENT_COUNT);
  const totalPages = Math.ceil(workouts.length / PAGE_SIZE);
  const pageWorkouts = workouts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('workouts_title')}</h1>
        <Link to="/workouts/new" className="btn btn-primary">
          + {t('workouts_new')}
        </Link>
      </div>

      {workouts.length === 0 ? (
        <div className="empty-state">
          <p>{t('workouts_empty')}</p>
        </div>
      ) : (
        <>
          {/* Recent workouts cards */}
          <h2 className="section-title">{t('workouts_recent')}</h2>
          <div className="workout-grid">
            {recent.map((workout) => (
              <div key={workout.id} className="workout-card">
                <div className="workout-card-header">
                  <h2>{new Date(workout.date).toLocaleDateString()}</h2>
                  <span className={`type-badge type-${workout.type}`}>
                    {TYPE_LABELS[workout.type] || workout.type}
                  </span>
                </div>
                <div className="run-stats">
                  <div className="run-stat">
                    <span className="run-stat-value">{workout.distance_km.toFixed(2)}</span>
                    <span className="run-stat-label">km</span>
                  </div>
                  <div className="run-stat">
                    <span className="run-stat-value">{formatDuration(workout.duration_seconds)}</span>
                    <span className="run-stat-label">{t('field_duration').toLowerCase()}</span>
                  </div>
                  <div className="run-stat">
                    <span className="run-stat-value">{workout.avg_pace ? workout.avg_pace.replace(/\s*\/?km\s*$/i, '') : '—'}</span>
                    <span className="run-stat-label">{t('field_pace_unit')}</span>
                  </div>
                  {workout.avg_heart_rate > 0 && (
                    <div className="run-stat">
                      <span className="run-stat-value">{workout.avg_heart_rate}</span>
                      <span className="run-stat-label">{t('field_heart_rate_unit')}</span>
                    </div>
                  )}
                </div>
                <div className="workout-card-actions">
                  <Link to={`/workouts/${workout.id}`} className="btn btn-sm">
                    {t('assigned_detail')}
                  </Link>
                  <Link to={`/workouts/${workout.id}/edit`} className="btn btn-sm">
                    {t('edit')}
                  </Link>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(workout.id)}
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Full history table */}
          <h2 className="section-title" style={{ marginTop: '2rem' }}>{t('workouts_all')}</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('field_date')}</th>
                  <th>{t('field_type')}</th>
                  <th>{t('field_distance')}</th>
                  <th>{t('field_duration')}</th>
                  <th>{t('field_pace')} <small className="th-unit">({t('field_pace_unit')})</small></th>
                  <th>{t('field_heart_rate_short')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageWorkouts.map((workout) => (
                  <tr key={workout.id}>
                    <td>{new Date(workout.date).toLocaleDateString()}</td>
                    <td>
                      <span className={`type-badge type-${workout.type}`}>
                        {TYPE_LABELS[workout.type] || workout.type}
                      </span>
                    </td>
                    <td>{workout.distance_km.toFixed(2)} km</td>
                    <td>{formatDuration(workout.duration_seconds)}</td>
                    <td>{workout.avg_pace ? workout.avg_pace.replace(/\s*\/?km\s*$/i, '') : '—'}</td>
                    <td>{workout.avg_heart_rate > 0 ? `${workout.avg_heart_rate} bpm` : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <Link to={`/workouts/${workout.id}`} className="btn btn-sm">
                          {t('assigned_detail')}
                        </Link>
                        <Link to={`/workouts/${workout.id}/edit`} className="btn btn-sm">
                          {t('edit')}
                        </Link>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(workout.id)}
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <span className="pagination-info">
                {t('workouts_showing', {
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, workouts.length),
                  total: workouts.length,
                })}
              </span>
              <div className="pagination-controls">
                <button
                  className="btn btn-sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  {t('workouts_prev')}
                </button>
                <span className="pagination-page">{page} / {totalPages}</span>
                <button
                  className="btn btn-sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === totalPages}
                >
                  {t('workouts_next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
