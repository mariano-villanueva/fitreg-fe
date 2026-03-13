import { useState, useEffect } from "react";
import { createAssignedWorkout, updateAssignedWorkout } from "../api/coach";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import SegmentBuilder from "./SegmentBuilder";
import type { WorkoutSegment, ExpectedField, AssignedWorkout, WorkoutTemplate } from "../types";

const EXPECTED_FIELD_OPTIONS: ExpectedField[] = ['time', 'distance', 'heart_rate', 'feeling'];

interface AssignWorkoutFieldsProps {
  studentId?: number;
  dueDate?: string;
  existingWorkout?: AssignedWorkout;
  initialData?: WorkoutTemplate;
  mode?: 'assignment' | 'template';
  onSave: (data?: Record<string, unknown>) => void;
  onCancel: () => void;
}

export default function AssignWorkoutFields({ studentId, dueDate, existingWorkout, initialData, mode, onSave, onCancel }: AssignWorkoutFieldsProps) {
  const { t } = useTranslation();
  const { showError } = useFeedback();
  const isEdit = !!existingWorkout;

  const source = existingWorkout || initialData;
  const [title, setTitle] = useState(source?.title || "");
  const [description, setDescription] = useState(source?.description || "");
  const [type, setType] = useState(source?.type || "easy");
  const [segments, setSegments] = useState<WorkoutSegment[]>(source?.segments || []);
  const [date, setDate] = useState(existingWorkout?.due_date?.slice(0, 10) || dueDate || "");
  const [notes, setNotes] = useState(source?.notes || "");
  const [expectedFields, setExpectedFields] = useState<ExpectedField[]>(source?.expected_fields || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData && !existingWorkout) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setType(initialData.type || "easy");
      setSegments(initialData.segments || []);
      setNotes(initialData.notes || "");
      setExpectedFields(initialData.expected_fields || []);
    }
  }, [initialData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    if (segments.length === 0) {
      showError(t('segment_required'));
      setSaving(false);
      return;
    }

    if (mode === 'template') {
      const templatePayload = {
        title, description, type, notes,
        expected_fields: expectedFields,
        segments,
      };
      onSave(templatePayload as unknown as Record<string, unknown>);
      setSaving(false);
      return;
    }

    if (!studentId) {
      showError("Student ID is required.");
      setSaving(false);
      return;
    }

    const payload = {
      student_id: studentId,
      title,
      description,
      type,
      distance_km: 0,
      duration_seconds: 0,
      notes,
      expected_fields: expectedFields,
      due_date: date,
      segments,
    };

    try {
      if (isEdit && existingWorkout) {
        await updateAssignedWorkout(existingWorkout.id, payload);
      } else {
        await createAssignedWorkout(payload);
      }
      onSave();
    } catch {
      showError(isEdit ? "Failed to update workout." : "Failed to assign workout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="workout-form calendar-inline-form" onSubmit={handleSubmit}>
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
          rows={2}
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

      {mode !== 'template' && (
      <div className="form-group">
        <label htmlFor="assign-due-date">{t('assigned_due_date')}</label>
        <input
          id="assign-due-date"
          type="date"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      )}

      <div className="form-group">
        <label htmlFor="assign-notes">{t('field_notes')}</label>
        <textarea
          id="assign-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
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
          {saving ? t('loading') : mode === 'template'
            ? (initialData ? t('template_update') : t('template_save'))
            : t('form_save')}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t('form_cancel')}
        </button>
      </div>
    </form>
  );
}
