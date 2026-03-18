import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useFeedback } from '../context/FeedbackContext';
import {
  getWeeklyTemplate,
  createWeeklyTemplate,
  updateWeeklyTemplateMeta,
  putWeeklyTemplateDays,
} from '../api/weeklyTemplates';
import WeeklyTemplateCalendar from '../components/WeeklyTemplateCalendar';
import WeeklyDayEditor from '../components/WeeklyDayEditor';
import type { WeeklyTemplateDay } from '../types';

export default function WeeklyTemplateForm() {
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // days[i] = day with day_of_week === i, or null for rest
  const [days, setDays] = useState<(WeeklyTemplateDay | null)[]>(Array(7).fill(null));
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit || !id) return;
    getWeeklyTemplate(Number(id))
      .then((res) => {
        setName(res.data.name);
        setDescription(res.data.description ?? '');
        const arr: (WeeklyTemplateDay | null)[] = Array(7).fill(null);
        for (const day of res.data.days) {
          arr[day.day_of_week] = day;
        }
        setDays(arr);
      })
      .catch(() => showError(t('error')))
      .finally(() => setLoading(false));
  }, [id]);

  function handleDayChange(dayIndex: number, data: WeeklyTemplateDay) {
    setDays((prev) => {
      const next = [...prev];
      next[dayIndex] = { ...data, day_of_week: dayIndex };
      return next;
    });
    setEditingDayIndex(null);
  }

  function handleRemoveDay(dayIndex: number) {
    setDays((prev) => {
      const next = [...prev];
      next[dayIndex] = null;
      return next;
    });
    setEditingDayIndex(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      showError(t('weekly_template_name_required'));
      return;
    }
    setSaving(true);
    try {
      let templateId = id ? Number(id) : null;

      if (isEdit && templateId) {
        await updateWeeklyTemplateMeta(templateId, { name: name.trim(), description });
      } else {
        const res = await createWeeklyTemplate({ name: name.trim(), description });
        templateId = res.data.id;
      }

      // Save all non-null days.
      const activeDays = days.filter((d): d is WeeklyTemplateDay => d !== null);
      await putWeeklyTemplateDays(templateId!, activeDays);

      showSuccess(isEdit ? t('weekly_template_updated') : t('weekly_template_created'));
      navigate('/coach/weekly-templates');
    } catch {
      showError(t('error'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>{t('loading')}</p>;

  return (
    <div className="page">
      <h1>{isEdit ? t('weekly_template_edit') : t('weekly_template_new')}</h1>

      <div className="form-group">
        <label>{t('name')} *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label>{t('description')}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>

      <WeeklyTemplateCalendar days={days} onDayClick={setEditingDayIndex} />

      <div className="form-actions">
        <button className="btn" onClick={() => navigate('/coach/weekly-templates')}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? t('saving') : t('save')}
        </button>
      </div>

      {editingDayIndex !== null && (
        <WeeklyDayEditor
          dayIndex={editingDayIndex}
          initial={days[editingDayIndex]}
          onSave={(day) => handleDayChange(editingDayIndex, day)}
          onRemove={() => handleRemoveDay(editingDayIndex)}
          onCancel={() => setEditingDayIndex(null)}
        />
      )}
    </div>
  );
}
