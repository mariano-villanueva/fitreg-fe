import { useState, useEffect } from "react";
import { getMyAssignedWorkouts, updateAssignedWorkoutStatus } from "../api/coach";
import type { AssignedWorkout } from "../types";
import { useTranslation } from "react-i18next";
import SegmentDisplay from "../components/SegmentDisplay";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function MyAssignedWorkouts() {
  const { t } = useTranslation();
  const [workouts, setWorkouts] = useState<AssignedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const TYPE_LABELS: Record<string, string> = {
    easy: t('type_easy'),
    tempo: t('type_tempo'),
    intervals: t('type_intervals'),
    long_run: t('type_long_run'),
    race: t('type_race'),
    fartlek: t('type_fartlek'),
    other: t('type_other'),
  };

  useEffect(() => {
    loadWorkouts();
  }, []);

  async function loadWorkouts() {
    try {
      setLoading(true);
      const res = await getMyAssignedWorkouts();
      setWorkouts(res.data);
    } catch {
      setError("Failed to load assigned workouts.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(id: number, status: string) {
    try {
      const res = await updateAssignedWorkoutStatus(id, status);
      setWorkouts((prev) =>
        prev.map((w) => (w.id === id ? res.data : w))
      );
    } catch {
      setError("Failed to update status.");
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;

  const sorted = [...workouts].sort((a, b) => {
    const order = { pending: 0, completed: 1, skipped: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="page">
      <h1>{t('assigned_my')}</h1>

      {error && <div className="error">{error}</div>}

      {sorted.length === 0 ? (
        <div className="empty-state">
          <p>{t('assigned_no_workouts')}</p>
        </div>
      ) : (
        <div className="workout-grid">
          {sorted.map((aw) => (
            <div key={aw.id} className="assigned-workout-card">
              <div className="workout-card-header">
                <h2>{aw.title}</h2>
                <span className={`status-badge status-${aw.status}`}>
                  {t(`assigned_status_${aw.status}`)}
                </span>
              </div>
              <div className="assigned-details">
                {aw.type && (
                  <span className={`type-badge type-${aw.type}`}>
                    {TYPE_LABELS[aw.type] || aw.type}
                  </span>
                )}
                {aw.distance_km > 0 && <span>{aw.distance_km} km</span>}
                {aw.duration_seconds > 0 && <span>{formatDuration(aw.duration_seconds)}</span>}
                {aw.due_date && <span>{new Date(aw.due_date).toLocaleDateString()}</span>}
              </div>
              {aw.segments && aw.segments.length > 0 && (
                <SegmentDisplay segments={aw.segments} />
              )}
              {aw.coach_name && (
                <p className="assigned-coach">{t('assigned_from_coach')}: {aw.coach_name}</p>
              )}
              {aw.notes && <p className="assigned-notes">{aw.notes}</p>}
              {aw.status === 'pending' && (
                <div className="workout-card-actions">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleStatusUpdate(aw.id, 'completed')}
                  >
                    {t('assigned_mark_completed')}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleStatusUpdate(aw.id, 'skipped')}
                  >
                    {t('assigned_mark_skipped')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
