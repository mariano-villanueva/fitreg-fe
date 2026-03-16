import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { getWorkout, createWorkout, updateWorkout } from "../api/workouts";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import SegmentBuilder from "../components/SegmentBuilder";
import ErrorState from "../components/ErrorState";
import TimeInput, { type TimeValue, toSeconds, fromSeconds } from "../components/TimeInput";
import DistanceInput from "../components/DistanceInput";
import type { Workout, WorkoutSegment } from "../types";

type RunType = 'easy' | 'tempo' | 'intervals' | 'long_run' | 'race' | 'fartlek' | 'other';

export default function WorkoutForm() {
  const { t } = useTranslation();
  const { showError } = useFeedback();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const TYPE_OPTIONS: { value: RunType; label: string }[] = [
    { value: "easy", label: t('type_easy') },
    { value: "tempo", label: t('type_tempo') },
    { value: "intervals", label: t('type_intervals') },
    { value: "long_run", label: t('type_long_run') },
    { value: "race", label: t('type_race') },
    { value: "fartlek", label: t('type_fartlek') },
    { value: "other", label: t('type_other') },
  ];

  // Basic info
  const [type, setType] = useState<RunType>("easy");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [segments, setSegments] = useState<WorkoutSegment[]>([]);

  // Results
  const [distanceKm, setDistanceKm] = useState(0);
  const [duration, setDuration] = useState<TimeValue>({ h: 0, m: 0, s: 0 });
  const [calories, setCalories] = useState(0);
  const [avgHeartRate, setAvgHeartRate] = useState(0);
  const [feeling, setFeeling] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorType, setErrorType] = useState<"not_found" | "generic" | null>(null);

  const durationSeconds = useMemo(() => toSeconds(duration), [duration]);

  const avgPace = useMemo(() => {
    if (distanceKm <= 0 || durationSeconds <= 0) return "--:--";
    const paceSeconds = durationSeconds / distanceKm;
    const paceMin = Math.floor(paceSeconds / 60);
    const paceSec = Math.round(paceSeconds % 60);
    return `${paceMin}:${String(paceSec).padStart(2, "0")}`;
  }, [distanceKm, durationSeconds]);

  useEffect(() => {
    if (isEdit && id) {
      loadWorkout(Number(id));
    }
  }, [id, isEdit]);

  async function loadWorkout(workoutId: number) {
    try {
      setLoading(true);
      const workout = await getWorkout(workoutId);
      setDate(workout.date.slice(0, 10));
      setType(workout.type as RunType);
      setDistanceKm(workout.distance_km);
      setDuration(fromSeconds(workout.duration_seconds));
      setCalories(workout.calories);
      setAvgHeartRate(workout.avg_heart_rate || 0);
      setFeeling(workout.feeling);
      setNotes(workout.notes);
      setSegments(workout.segments || []);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (segments.length === 0) {
      showError(t('segment_required'));
      return;
    }

    const payload = {
      date,
      type,
      distance_km: distanceKm,
      duration_seconds: durationSeconds,
      avg_pace: avgPace !== "--:--" ? avgPace : "",
      calories,
      avg_heart_rate: avgHeartRate,
      feeling: feeling,
      notes,
      segments,
    } as Omit<Workout, "id" | "user_id" | "assigned_workout_id" | "created_at" | "updated_at"> & { segments: WorkoutSegment[] };

    try {
      if (isEdit && id) {
        await updateWorkout(Number(id), payload);
        navigate(`/workouts/${id}`, { state: { feedback: t('workout_saved') } });
      } else {
        const workout = await createWorkout(payload);
        navigate(`/workouts/${workout.id}`, { state: { feedback: t('workout_created') } });
      }
    } catch {
      showError("Failed to save workout.");
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;
  if (errorType) return <ErrorState type={errorType} backTo="/workouts" />;

  return (
    <div className="page">
      <Link to={isEdit && id ? `/workouts/${id}` : "/"} className="btn btn-link back-link">
        {t('detail_back')}
      </Link>
      <h1>{isEdit ? t('form_edit_title') : t('form_new_title')}</h1>

      <form className="workout-form" onSubmit={handleSubmit}>
        {/* Basic info section */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="workout-date">{t('field_date')}</label>
            <input
              id="workout-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="workout-type">{t('field_type')}</label>
            <select
              id="workout-type"
              value={type}
              onChange={(e) => setType(e.target.value as RunType)}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="workout-notes">{t('field_notes')}</label>
          <textarea
            id="workout-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {/* Workout structure */}
        <SegmentBuilder segments={segments} onChange={setSegments} />

        {/* Results section */}
        <h3>{t('workout_results_title')}</h3>

        <div className="form-group">
          <DistanceInput valueKm={distanceKm} onChange={setDistanceKm} label={t('field_distance')} showUnitToggle />
        </div>

        <div className="form-group">
          <label>{t('field_duration')}</label>
          <TimeInput value={duration} onChange={setDuration} />
        </div>

        <div className="form-group">
          <label>{t('field_pace')}</label>
          <div className="pace-display">
            {avgPace !== '--:--' ? <>{avgPace} <span className="pace-unit">{t('field_pace_unit')}</span></> : '--:--'}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="workout-calories">{t('field_calories')}</label>
            <input
              id="workout-calories"
              type="number"
              min={0}
              value={calories}
              onChange={(e) => setCalories(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="workout-heart-rate">{t('field_heart_rate')} ({t('field_heart_rate_unit')})</label>
            <input
              id="workout-heart-rate"
              type="number"
              min={0}
              max={250}
              value={avgHeartRate}
              onChange={(e) => setAvgHeartRate(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="form-group">
          <label>{t('workout_feeling')} *</label>
          <div className="effort-slider-wrap">
            <input
              type="range"
              min={1}
              max={10}
              value={feeling ?? 5}
              onChange={(e) => setFeeling(Number(e.target.value))}
              className="effort-slider"
              style={{ background: `linear-gradient(to right, var(--accent, #00d4aa) ${((feeling ?? 5) - 1) / 9 * 100}%, var(--border-color, #333) ${((feeling ?? 5) - 1) / 9 * 100}%)` }}
            />
            <div className="effort-scale-labels">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
            <div className="effort-value">
              <span className="effort-number">{feeling ?? 5}</span>
              <span className="effort-label">— {
                (feeling ?? 5) <= 3 ? t('effort_level_easy') :
                (feeling ?? 5) <= 6 ? t('effort_level_moderate') :
                (feeling ?? 5) <= 8 ? t('effort_level_hard') :
                t('effort_level_max')
              }</span>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {t('form_save')}
          </button>
          <Link
            to={isEdit && id ? `/workouts/${id}` : "/"}
            className="btn"
          >
            {t('form_cancel')}
          </Link>
        </div>
      </form>
    </div>
  );
}
