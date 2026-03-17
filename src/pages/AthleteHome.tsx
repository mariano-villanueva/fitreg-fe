import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { getMyAssignedWorkouts, updateAssignedWorkoutStatus } from "../api/coach";
import { listWorkouts } from "../api/workouts";
import type { AssignedWorkout, Workout, FileResponse } from "../types";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import SegmentDisplay from "../components/SegmentDisplay";
import ImageUpload from "../components/ImageUpload";
import TimeInput, { type TimeValue, toSeconds } from "../components/TimeInput";
import DistanceInput from "../components/DistanceInput";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AthleteHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useFeedback();
  const location = useLocation();
  const [nextWorkout, setNextWorkout] = useState<AssignedWorkout | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{ status: string; workout: AssignedWorkout } | null>(null);
  const [resultFeeling, setResultFeeling] = useState(5);
  const [time, setTime] = useState<TimeValue>({ h: 0, m: 0, s: 0 });
  const [resultDistanceKm, setResultDistanceKm] = useState(0);
  const [resultHeartRate, setResultHeartRate] = useState("");
  const [resultImage, setResultImage] = useState<FileResponse | null>(null);

  const TYPE_LABELS: Record<string, string> = {
    easy: t('type_easy'),
    tempo: t('type_tempo'),
    intervals: t('type_intervals'),
    long_run: t('type_long_run'),
    race: t('type_race'),
    fartlek: t('type_fartlek'),
    other: t('type_other'),
  };

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = new Date(dateStr + 'T12:00:00');
    date.setHours(0, 0, 0, 0);
    if (date.getTime() === today.getTime()) return t('date_today');
    if (date.getTime() === tomorrow.getTime()) return t('date_tomorrow');
    return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function openModal(workout: AssignedWorkout, status: string) {
    setResultFeeling(5);
    setTime({ h: 0, m: 0, s: 0 });
    setResultDistanceKm(0);
    setResultHeartRate("");
    setResultImage(null);
    setConfirmModal({ status, workout });
  }

  function getTimeSeconds(): number | null {
    const total = toSeconds(time);
    return total > 0 ? total : null;
  }

  function getDistanceKm(): number | null {
    return resultDistanceKm > 0 ? resultDistanceKm : null;
  }

  function getEffortLabel(val: number): string {
    if (val <= 3) return t('effort_level_easy');
    if (val <= 6) return t('effort_level_moderate');
    if (val <= 8) return t('effort_level_hard');
    return t('effort_level_max');
  }

  async function handleStatusUpdate() {
    if (!confirmModal) return;
    const { status, workout } = confirmModal;
    const fields = workout.expected_fields || ['feeling'];
    const data: Record<string, unknown> = { status };

    if (status === 'completed') {
      if (resultFeeling < 1) {
        showWarning(t('assigned_feeling_required'));
        return;
      }
      data.result_feeling = resultFeeling;
      if (fields.includes('time')) data.result_time_seconds = getTimeSeconds();
      if (fields.includes('distance')) data.result_distance_km = getDistanceKm();
      if (fields.includes('heart_rate') && resultHeartRate) data.result_heart_rate = Number(resultHeartRate);
      if (resultImage) data.image_file_id = resultImage.id;
    }

    try {
      await updateAssignedWorkoutStatus(workout.id, data as Parameters<typeof updateAssignedWorkoutStatus>[1]);
      showSuccess(t('assigned_status_updated'));
      setConfirmModal(null);
      await loadData();
    } catch {
      showError("Failed to update status.");
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="page athlete-home">
      <div className="home-hero">
        <h1>{t('home_welcome', { name: user?.name?.split(' ')[0] || '' })}</h1>
        <Link to="/workouts/new" className="btn btn-primary home-log-btn">
          + {t('home_log_workout')}
        </Link>
      </div>

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
              <button className="btn btn-sm btn-primary" onClick={() => openModal(nextWorkout!, 'completed')}>
                {t('assigned_mark_completed')}
              </button>
              <button className="btn btn-sm" onClick={() => openModal(nextWorkout!, 'skipped')}>
                {t('assigned_mark_skipped')}
              </button>
              <Link to="/my-assignments" className="btn btn-sm">
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
            <Link to="/my-assignments" className="home-stat-card">
              <span className="home-stat-value">{pendingCount}</span>
              <span className="home-stat-label">{t('home_pending_workouts')}</span>
            </Link>
            <Link to="/workouts" className="home-stat-card">
              <span className="home-stat-value">{recentWorkouts.length}</span>
              <span className="home-stat-label">{t('home_recent_workouts')}</span>
            </Link>
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
                      <span className="run-stat-value">{workout.avg_pace.replace(/\s*\/?km\s*$/i, '')}</span>
                      <span className="run-stat-label">{t('field_pace_unit')}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      {/* Complete/Skip modal */}
      {confirmModal && (() => {
        const fields = confirmModal.workout.expected_fields || ['feeling'];
        return (
          <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{confirmModal.status === 'completed' ? t('assigned_confirm_complete_title') : t('assigned_confirm_skip_title')}</h3>
              <p>{confirmModal.status === 'completed' ? t('assigned_confirm_complete_msg') : t('assigned_confirm_skip_msg')}</p>

              {confirmModal.status === 'completed' && (
                <div className="modal-result-fields">
                  {fields.includes('time') && (
                    <div className="form-group">
                      <label>{t('expected_field_time')}</label>
                      <TimeInput value={time} onChange={setTime} />
                    </div>
                  )}
                  {fields.includes('distance') && (
                    <div className="form-group">
                      <DistanceInput valueKm={resultDistanceKm} onChange={setResultDistanceKm} label={t('expected_field_distance')} showUnitToggle />
                    </div>
                  )}
                  {fields.includes('heart_rate') && (
                    <div className="form-group">
                      <label>{t('expected_field_heart_rate')}</label>
                      <div className="hr-input">
                        <input type="number" min="30" max="250" value={resultHeartRate} onChange={(e) => setResultHeartRate(e.target.value)} />
                        <span className="input-unit">bpm</span>
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label>{t('expected_field_feeling')} *</label>
                    <div className="effort-slider-wrap">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={resultFeeling}
                        onChange={(e) => setResultFeeling(Number(e.target.value))}
                        className="effort-slider"
                        style={{ background: `linear-gradient(to right, var(--accent, #00d4aa) ${(resultFeeling - 1) / 9 * 100}%, var(--border-color, #333) ${(resultFeeling - 1) / 9 * 100}%)` }}
                      />
                      <div className="effort-scale-labels">
                        <span>1</span>
                        <span>5</span>
                        <span>10</span>
                      </div>
                      <div className="effort-value">
                        <span className="effort-number">{resultFeeling}</span>
                        <span className="effort-label">— {getEffortLabel(resultFeeling)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>{t('workout_image')}</label>
                    <ImageUpload value={resultImage} onChange={setResultImage} />
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button className="btn btn-sm" onClick={() => setConfirmModal(null)}>
                  {t('cancel')}
                </button>
                <button
                  className={`btn btn-sm ${confirmModal.status === 'completed' ? 'btn-primary' : 'btn-danger'}`}
                  onClick={handleStatusUpdate}
                >
                  {confirmModal.status === 'completed' ? t('assigned_mark_completed') : t('assigned_mark_skipped')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
