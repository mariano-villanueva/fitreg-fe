import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { getWorkout, deleteWorkout } from "../api/workouts";
import type { Workout } from "../types";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import SegmentDisplay from "../components/SegmentDisplay";
import ErrorState from "../components/ErrorState";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function WorkoutDetail() {
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const workoutId = Number(id);

  const TYPE_LABELS: Record<string, string> = {
    easy: t('type_easy'),
    tempo: t('type_tempo'),
    intervals: t('type_intervals'),
    long_run: t('type_long_run'),
    race: t('type_race'),
    other: t('type_other'),
  };

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<"not_found" | "generic" | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const feedbackShown = useRef(false);
  useEffect(() => {
    const state = location.state as { feedback?: string } | null;
    if (state?.feedback && !feedbackShown.current) {
      feedbackShown.current = true;
      showSuccess(state.feedback);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    loadData();
  }, [workoutId]);

  async function loadData() {
    try {
      setLoading(true);
      setErrorType(null);
      const w = await getWorkout(workoutId);
      setWorkout(w);
    } catch (err) {
      if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 403)) {
        setErrorType("not_found");
      } else {
        setErrorType("generic");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteWorkout() {
    try {
      await deleteWorkout(workoutId);
      navigate("/");
    } catch {
      showError("Failed to delete run.");
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;
  if (errorType) return <ErrorState type={errorType} backTo="/workouts" />;
  if (!workout) return <ErrorState type="generic" backTo="/workouts" />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/" className="btn btn-link back-link">
            {t('detail_back')}
          </Link>
          <h1>Run - {new Date(workout.date).toLocaleDateString()}</h1>
        </div>
        {!workout.assigned_workout_id && (
          <div className="page-header-actions">
            <Link to={`/workouts/${workout.id}/edit`} className="btn">
              {t('detail_edit')}
            </Link>
            <button className="btn btn-danger" onClick={() => setShowDeleteModal(true)}>
              {t('detail_delete')}
            </button>
          </div>
        )}
      </div>

      <div className="detail-card">
        <div className="detail-header">
          <span className={`type-badge type-${workout.type}`}>
            {TYPE_LABELS[workout.type] || workout.type}
          </span>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">{t('field_distance')}</span>
            <span className="detail-value">{workout.distance_km.toFixed(2)} km</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">{t('field_duration')}</span>
            <span className="detail-value">{formatDuration(workout.duration_seconds)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">{t('field_pace')}</span>
            <span className="detail-value">{workout.avg_pace}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">{t('field_calories')}</span>
            <span className="detail-value">{workout.calories} kcal</span>
          </div>
          {workout.avg_heart_rate > 0 && (
            <div className="detail-item detail-heart-rate">
              <span className="detail-label">{t('field_heart_rate')}</span>
              <span className="detail-value">{workout.avg_heart_rate} {t('field_heart_rate_unit')}</span>
            </div>
          )}
          {workout.feeling != null && (
            <div className="detail-item">
              <span className="detail-label">{t('workout_feeling')}</span>
              <span className="detail-value">{workout.feeling}/10</span>
            </div>
          )}
        </div>

        {workout.segments && workout.segments.length > 0 && (
          <div className="detail-notes">
            <span className="detail-label">{t('segment_structure')}</span>
            <SegmentDisplay segments={workout.segments} />
          </div>
        )}

        {workout.notes && (
          <div className="detail-notes">
            <span className="detail-label">{t('field_notes')}</span>
            <p>{workout.notes}</p>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('workouts_delete_confirm')}</h2>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowDeleteModal(false)}>
                {t('cancel')}
              </button>
              <button className="btn btn-danger" onClick={handleDeleteWorkout}>
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
