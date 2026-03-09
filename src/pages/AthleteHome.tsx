import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMyAssignedWorkouts } from "../api/coach";
import { listWorkouts } from "../api/workouts";
import type { AssignedWorkout, Workout } from "../types";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import SegmentDisplay from "../components/SegmentDisplay";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AthleteHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [nextWorkout, setNextWorkout] = useState<AssignedWorkout | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [assignedRes, workouts] = await Promise.all([
        getMyAssignedWorkouts().catch(() => ({ data: [] as AssignedWorkout[] })),
        listWorkouts().catch(() => [] as Workout[]),
      ]);

      const assigned: AssignedWorkout[] = assignedRes.data || [];

      const pending = assigned.filter((w) => w.status === 'pending');
      setPendingCount(pending.length);

      // Find next upcoming workout (due_date >= today, sorted ascending)
      const today = new Date().toISOString().split('T')[0];
      const upcoming = pending
        .filter((w) => w.due_date >= today)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));

      setNextWorkout(upcoming.length > 0 ? upcoming[0] : (pending[0] || null));
      setRecentWorkouts((workouts || []).slice(0, 3));
    } catch {
      // Silent fail, show empty state
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="page athlete-home">
      <h1>{t('home_welcome', { name: user?.name?.split(' ')[0] || '' })}</h1>

      {/* Next planned workout */}
      <section className="home-section">
        <h2>{t('home_next_workout')}</h2>
        {nextWorkout ? (
          <div className="next-workout-card">
            <div className="next-workout-header">
              <div>
                <h3>{nextWorkout.title}</h3>
                <span className={`type-badge type-${nextWorkout.type}`}>
                  {TYPE_LABELS[nextWorkout.type] || nextWorkout.type}
                </span>
              </div>
              <div className="next-workout-date">
                {formatDate(nextWorkout.due_date)}
              </div>
            </div>
            {nextWorkout.description && (
              <p className="next-workout-description">{nextWorkout.description}</p>
            )}
            {nextWorkout.segments && nextWorkout.segments.length > 0 && (
              <SegmentDisplay segments={nextWorkout.segments} />
            )}
            {nextWorkout.notes && (
              <p className="next-workout-notes">{nextWorkout.notes}</p>
            )}
            {nextWorkout.coach_name && (
              <p className="next-workout-coach">{t('assigned_from_coach')}: {nextWorkout.coach_name}</p>
            )}
            <div className="next-workout-actions">
              <Link to="/my-assignments" className="btn btn-primary btn-sm">
                {t('home_see_all_assignments')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p>{t('home_no_planned')}</p>
          </div>
        )}
      </section>

      {/* Quick stats */}
      {pendingCount > 0 && (
        <section className="home-section">
          <div className="home-stats">
            <div className="home-stat-card">
              <span className="home-stat-value">{pendingCount}</span>
              <span className="home-stat-label">{t('home_pending_workouts')}</span>
            </div>
            <div className="home-stat-card">
              <span className="home-stat-value">{recentWorkouts.length}</span>
              <span className="home-stat-label">{t('home_recent_workouts')}</span>
            </div>
          </div>
        </section>
      )}

      {/* Recent workouts */}
      {recentWorkouts.length > 0 && (
        <section className="home-section">
          <div className="coach-section-header">
            <h2>{t('home_recent_activity')}</h2>
            <Link to="/workouts" className="btn btn-sm">{t('home_see_all')}</Link>
          </div>
          <div className="workout-grid">
            {recentWorkouts.map((workout) => (
              <Link key={workout.id} to={`/workouts/${workout.id}`} className="workout-card workout-card-link">
                <div className="workout-card-header">
                  <h2>{new Date(workout.date).toLocaleDateString()}</h2>
                  <span className={`type-badge type-${workout.type}`}>
                    {TYPE_LABELS[workout.type] || workout.type}
                  </span>
                </div>
                <div className="run-stats">
                  <div className="run-stat">
                    <span className="run-stat-value">{workout.distance_km.toFixed(1)}</span>
                    <span className="run-stat-label">km</span>
                  </div>
                  <div className="run-stat">
                    <span className="run-stat-value">{formatDuration(workout.duration_seconds)}</span>
                    <span className="run-stat-label">{t('field_duration').toLowerCase()}</span>
                  </div>
                  {workout.avg_pace && (
                    <div className="run-stat">
                      <span className="run-stat-value">{workout.avg_pace}</span>
                      <span className="run-stat-label">{t('field_pace').toLowerCase()}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
