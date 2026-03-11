import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getWorkout, createWorkout, updateWorkout } from "../api/workouts";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import SegmentBuilder from "../components/SegmentBuilder";
import type { WorkoutSegment } from "../types";

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
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [calories, setCalories] = useState(0);
  const [avgHeartRate, setAvgHeartRate] = useState(0);
  const [feeling, setFeeling] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);

  const durationSeconds = useMemo(
    () => hours * 3600 + minutes * 60 + seconds,
    [hours, minutes, seconds]
  );

  const avgPace = useMemo(() => {
    if (distanceKm <= 0 || durationSeconds <= 0) return "--:--";
    const paceSeconds = durationSeconds / distanceKm;
    const paceMin = Math.floor(paceSeconds / 60);
    const paceSec = Math.round(paceSeconds % 60);
    return `${paceMin}:${String(paceSec).padStart(2, "0")} /km`;
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
      const total = workout.duration_seconds;
      setHours(Math.floor(total / 3600));
      setMinutes(Math.floor((total % 3600) / 60));
      setSeconds(total % 60);
      setCalories(workout.calories);
      setAvgHeartRate(workout.avg_heart_rate || 0);
      setFeeling(workout.feeling);
      setNotes(workout.notes);
    } catch {
      showError("Failed to load workout.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      date,
      type,
      distance_km: distanceKm,
      duration_seconds: durationSeconds,
      calories,
      avg_heart_rate: avgHeartRate,
      feeling: feeling,
      notes,
    };

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
          <label htmlFor="workout-distance">{t('field_distance')}</label>
          <input
            id="workout-distance"
            type="number"
            min={0}
            step={0.01}
            value={distanceKm}
            onChange={(e) => setDistanceKm(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>{t('field_duration')}</label>
          <div className="duration-inputs">
            <div className="duration-field">
              <input
                type="number"
                min={0}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              />
              <span>h</span>
            </div>
            <div className="duration-field">
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
              <span>m</span>
            </div>
            <div className="duration-field">
              <input
                type="number"
                min={0}
                max={59}
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
              />
              <span>s</span>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>{t('field_pace')}</label>
          <div className="pace-display">{avgPace}</div>
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
          <label>{t('workout_feeling')}: <strong>{feeling != null ? `${feeling}/10` : '—'}</strong></label>
          <input
            type="range"
            min={1}
            max={10}
            value={feeling ?? 5}
            onChange={(e) => setFeeling(Number(e.target.value))}
          />
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
