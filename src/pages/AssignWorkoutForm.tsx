import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createAssignedWorkout, getAssignedWorkout, updateAssignedWorkout } from "../api/coach";
import { useTranslation } from "react-i18next";
import SegmentBuilder from "../components/SegmentBuilder";
import type { WorkoutSegment, ExpectedField } from "../types";
import { useFeedback } from "../context/FeedbackContext";

const EXPECTED_FIELD_OPTIONS: ExpectedField[] = ['time', 'distance', 'heart_rate', 'feeling'];

export default function AssignWorkoutForm() {
  const { studentId, id } = useParams<{ studentId?: string; id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showError } = useFeedback();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("easy");
  const [segments, setSegments] = useState<WorkoutSegment[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [expectedFields, setExpectedFields] = useState<ExpectedField[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolvedStudentId, setResolvedStudentId] = useState<number>(Number(studentId) || 0);

  useEffect(() => {
    if (isEdit) {
      loadWorkout();
    }
  }, [id]);

  async function loadWorkout() {
    setLoading(true);
    try {
      const res = await getAssignedWorkout(Number(id));
      const aw = res.data;
      setTitle(aw.title);
      setDescription(aw.description || "");
      setType(aw.type || "easy");
      setDueDate(aw.due_date || "");
      setNotes(aw.notes || "");
      setResolvedStudentId(aw.student_id);
      if (aw.segments && aw.segments.length > 0) {
        setSegments(aw.segments);
      }
      if (aw.expected_fields) {
        setExpectedFields(aw.expected_fields);
      }
    } catch {
      showError("Failed to load workout.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      student_id: resolvedStudentId,
      title,
      description,
      type,
      distance_km: 0,
      duration_seconds: 0,
      notes,
      expected_fields: expectedFields,
      due_date: dueDate,
      segments,
    };

    try {
      if (isEdit) {
        await updateAssignedWorkout(Number(id), payload);
      } else {
        await createAssignedWorkout(payload);
      }
      navigate(`/coach/students/${resolvedStudentId}`, { state: { feedback: isEdit ? t('assigned_workout_updated') : t('assigned_workout_created') } });
    } catch {
      showError(isEdit ? "Failed to update workout." : "Failed to assign workout.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="page">
      <h1>{isEdit ? t('assigned_edit') : t('assigned_new')}</h1>

      <form className="workout-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="assign-title">{t('assigned_title')}</label>
          <input
            id="assign-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="assign-description">{t('assigned_description')}</label>
          <textarea
            id="assign-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="assign-type">{t('field_type')}</label>
          <select
            id="assign-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="easy">{t('type_easy')}</option>
            <option value="tempo">{t('type_tempo')}</option>
            <option value="intervals">{t('type_intervals')}</option>
            <option value="long_run">{t('type_long_run')}</option>
            <option value="race">{t('type_race')}</option>
            <option value="fartlek">{t('type_fartlek')}</option>
            <option value="other">{t('type_other')}</option>
          </select>
        </div>

        <SegmentBuilder segments={segments} onChange={setSegments} />

        <div className="form-group">
          <label htmlFor="assign-due-date">{t('assigned_due_date')}</label>
          <input
            id="assign-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="assign-notes">{t('field_notes')}</label>
          <textarea
            id="assign-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label><strong>{t('expected_fields_label')}</strong></label>
          <p className="form-hint">{t('expected_fields_hint')}</p>
          {EXPECTED_FIELD_OPTIONS.map((field) => (
            <label key={field} className="checkbox-label">
              <input
                type="checkbox"
                checked={expectedFields.includes(field)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setExpectedFields([...expectedFields, field]);
                  } else {
                    setExpectedFields(expectedFields.filter((f) => f !== field));
                  }
                }}
              />
              <span>{t(`expected_field_${field}`)}</span>
            </label>
          ))}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('form_saving') : t('form_save')}
          </button>
          <button type="button" className="btn" onClick={() => navigate(-1)}>
            {t('form_cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
