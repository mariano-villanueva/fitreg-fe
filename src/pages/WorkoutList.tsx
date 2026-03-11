import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listWorkouts, deleteWorkout } from "../api/workouts";
import type { Workout } from "../types";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";

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
        <div className="workout-grid">
          {workouts.map((workout) => (
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
                  <span className="run-stat-value">{workout.avg_pace}</span>
                  <span className="run-stat-label">{t('field_pace').toLowerCase()}</span>
                </div>
                {workout.avg_heart_rate > 0 && (
                  <div className="run-stat">
                    <span className="run-stat-value">{workout.avg_heart_rate}</span>
                    <span className="run-stat-label">{t('field_heart_rate_unit')}</span>
                  </div>
                )}
              </div>
              <div className="workout-card-actions">
                <Link to={`/workouts/${workout.id}`} className="btn btn-link">
                  View
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
      )}
    </div>
  );
}
