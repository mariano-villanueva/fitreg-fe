import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMyAssignedWorkouts, updateAssignedWorkoutStatus } from "../api/coach";
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
  const [confirmModal, setConfirmModal] = useState<{ status: string; workout: AssignedWorkout } | null>(null);
  const [resultFeeling, setResultFeeling] = useState(0);
  const [timeH, setTimeH] = useState("");
  const [timeM, setTimeM] = useState("");
  const [timeS, setTimeS] = useState("");
  const [resultDistance, setResultDistance] = useState("");
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'm'>('km');
  const [resultHeartRate, setResultHeartRate] = useState("");
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
    setResultFeeling(0);
    setTimeH(""); setTimeM(""); setTimeS("");
    setResultDistance(""); setDistanceUnit('km');
    setResultHeartRate("");
    setError("");
    setConfirmModal({ status, workout });
  }

  function getTimeSeconds(): number | null {
    const h = Number(timeH) || 0;
    const m = Number(timeM) || 0;
    const s = Number(timeS) || 0;
    if (h === 0 && m === 0 && s === 0) return null;
    return h * 3600 + m * 60 + s;
  }

  function getDistanceKm(): number | null {
    const val = Number(resultDistance);
    if (!val) return null;
    return distanceUnit === 'm' ? val / 1000 : val;
  }

  async function handleStatusUpdate() {
    if (!confirmModal) return;
    const { status, workout } = confirmModal;
    const fields = workout.expected_fields || ['feeling'];
    const data: Record<string, unknown> = { status };

    if (status === 'completed') {
      if (resultFeeling < 1) {
        setError(t('assigned_feeling_required'));
        return;
      }
      data.result_feeling = resultFeeling;
      if (fields.includes('time')) data.result_time_seconds = getTimeSeconds();
      if (fields.includes('distance')) data.result_distance_km = getDistanceKm();
      if (fields.includes('heart_rate') && resultHeartRate) data.result_heart_rate = Number(resultHeartRate);
    }

    try {
      await updateAssignedWorkoutStatus(workout.id, data as Parameters<typeof updateAssignedWorkoutStatus>[1]);
      setConfirmModal(null);
      setError("");
      await loadData();
    } catch {
      setError("Failed to update status.");
    }
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
      {/* Complete/Skip modal */}
      {confirmModal && (() => {
        const fields = confirmModal.workout.expected_fields || ['feeling'];
        return (
          <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{confirmModal.status === 'completed' ? t('assigned_confirm_complete_title') : t('assigned_confirm_skip_title')}</h3>
              <p>{confirmModal.status === 'completed' ? t('assigned_confirm_complete_msg') : t('assigned_confirm_skip_msg')}</p>

              {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

              {confirmModal.status === 'completed' && (
                <div className="modal-result-fields">
                  {fields.includes('time') && (
                    <div className="form-group">
                      <label>{t('expected_field_time')}</label>
                      <div className="time-inputs">
                        <input type="number" min="0" max="99" placeholder="HH" value={timeH} onChange={(e) => setTimeH(e.target.value)} />
                        <span>:</span>
                        <input type="number" min="0" max="59" placeholder="MM" value={timeM} onChange={(e) => setTimeM(e.target.value)} />
                        <span>:</span>
                        <input type="number" min="0" max="59" placeholder="SS" value={timeS} onChange={(e) => setTimeS(e.target.value)} />
                      </div>
                    </div>
                  )}
                  {fields.includes('distance') && (
                    <div className="form-group">
                      <label>{t('expected_field_distance')}</label>
                      <div className="distance-input">
                        <input type="number" step="0.01" min="0" value={resultDistance} onChange={(e) => setResultDistance(e.target.value)} />
                        <select value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value as 'km' | 'm')}>
                          <option value="km">km</option>
                          <option value="m">m</option>
                        </select>
                      </div>
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
                    <div className="feeling-selector">
                      {[1,2,3,4,5,6,7,8,9,10].map((v) => (
                        <button
                          key={v}
                          type="button"
                          className={`feeling-btn ${resultFeeling === v ? 'feeling-btn-active' : ''}`}
                          onClick={() => setResultFeeling(v)}
                        >{v}</button>
                      ))}
                    </div>
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
