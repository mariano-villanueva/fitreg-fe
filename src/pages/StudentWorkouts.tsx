import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getStudentWorkouts, listAssignedWorkouts, deleteAssignedWorkout } from "../api/coach";
import type { Workout, AssignedWorkout } from "../types";
import { useTranslation } from "react-i18next";
import SegmentDisplay from "../components/SegmentDisplay";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function StudentWorkouts() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [assigned, setAssigned] = useState<AssignedWorkout[]>([]);
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
    loadData();
  }, [studentId]);

  async function loadData() {
    try {
      setLoading(true);
      const [workoutsRes, assignedRes] = await Promise.all([
        getStudentWorkouts(studentId),
        listAssignedWorkouts(studentId),
      ]);
      setWorkouts(workoutsRes.data);
      setAssigned(assignedRes.data);
    } catch {
      setError("Failed to load student data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAssigned(assignedId: number) {
    if (!confirm(t('workouts_delete_confirm'))) return;
    try {
      await deleteAssignedWorkout(assignedId);
      setAssigned((prev) => prev.filter((a) => a.id !== assignedId));
    } catch {
      setError("Failed to delete assigned workout.");
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;
  if (error) return <div className="error">{error}</div>;

  const studentName = assigned.length > 0 ? assigned[0].student_name : `Student #${studentId}`;

  return (
    <div className="page">
      <Link to="/coach" className="back-link">{t('detail_back')}</Link>

      <div className="student-header">
        <h1>{t('coach_student_workouts')}</h1>
        <p className="student-header-name">{studentName}</p>
      </div>

      <div className="coach-section-header" style={{ marginBottom: '1rem' }}>
        <h2>{t('assigned_my')}</h2>
        <Link to={`/coach/assign/${studentId}`} className="btn btn-primary btn-sm">
          + {t('assigned_new')}
        </Link>
      </div>

      {assigned.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: '2rem' }}>
          <p>{t('assigned_no_workouts')}</p>
        </div>
      ) : (
        <div className="workout-grid" style={{ marginBottom: '2rem' }}>
          {assigned.map((aw) => (
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
              {aw.notes && <p className="assigned-notes">{aw.notes}</p>}
              <div className="workout-card-actions">
                {aw.status !== 'completed' && (
                  <button
                    className="btn btn-sm"
                    onClick={() => navigate(`/coach/assigned-workouts/${aw.id}/edit`)}
                  >
                    {t('edit')}
                  </button>
                )}
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteAssigned(aw.id)}
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>{t('workouts_title')}</h2>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
