import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listTemplates } from '../api/templates';
import type { WeeklyTemplateDay, WeeklyTemplateSegment, WorkoutTemplate } from '../types';

interface Props {
  dayIndex: number; // 0=Mon … 6=Sun
  initial: WeeklyTemplateDay | null;
  onSave: (day: WeeklyTemplateDay) => void;
  onRemove: () => void;
  onCancel: () => void;
}

const DAY_NAMES_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const emptySegment = (): WeeklyTemplateSegment => ({
  order_index: 0,
  segment_type: 'simple',
  repetitions: 1,
  value: 0,
  unit: '',
  intensity: '',
  work_value: 0,
  work_unit: '',
  work_intensity: '',
  rest_value: 0,
  rest_unit: '',
  rest_intensity: '',
});

export default function WeeklyDayEditor({ dayIndex, initial, onSave, onRemove, onCancel }: Props) {
  const { t, i18n } = useTranslation();
  const dayNames = i18n.language.startsWith('es') ? DAY_NAMES_ES : DAY_NAMES_EN;

  const [dailyTemplates, setDailyTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState(initial?.type ?? '');
  const [distanceKm, setDistanceKm] = useState(initial?.distance_km ?? 0);
  const [durationSeconds, setDurationSeconds] = useState(initial?.duration_seconds ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [fromTemplateId, setFromTemplateId] = useState<number | null>(initial?.from_template_id ?? null);
  const [segments, setSegments] = useState<WeeklyTemplateSegment[]>(initial?.segments ?? []);

  useEffect(() => {
    listTemplates().then((res) => setDailyTemplates(res.data)).catch(() => {});
  }, []);

  function handleTemplateLoad(templateId: number | '') {
    setSelectedTemplateId(templateId);
    if (templateId === '') return;
    const tmpl = dailyTemplates.find((t) => t.id === templateId);
    if (!tmpl) return;
    setTitle(tmpl.title);
    setDescription(tmpl.description ?? '');
    setType(tmpl.type ?? '');
    setNotes(tmpl.notes ?? '');
    setFromTemplateId(tmpl.id);
    setSegments(
      (tmpl.segments ?? []).map((s, i) => ({
        order_index: i,
        segment_type: s.segment_type,
        repetitions: s.repetitions,
        value: s.value,
        unit: s.unit,
        intensity: s.intensity,
        work_value: s.work_value,
        work_unit: s.work_unit,
        work_intensity: s.work_intensity,
        rest_value: s.rest_value,
        rest_unit: s.rest_unit,
        rest_intensity: s.rest_intensity,
      }))
    );
  }

  function addSegment() {
    setSegments((prev) => [...prev, { ...emptySegment(), order_index: prev.length }]);
  }

  function removeSegment(index: number) {
    setSegments((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order_index: i })));
  }

  function updateSegment(index: number, field: keyof WeeklyTemplateSegment, value: string | number) {
    setSegments((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function handleSave() {
    if (!title.trim()) return;
    onSave({
      day_of_week: dayIndex,
      title: title.trim(),
      description,
      type,
      distance_km: distanceKm,
      duration_seconds: durationSeconds,
      notes,
      from_template_id: fromTemplateId,
      segments,
    });
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h3>{dayNames[dayIndex]}</h3>

        {/* Preload from daily template */}
        <div className="form-group">
          <label>{t('weekly_template_load_from')}</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateLoad(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">{t('weekly_template_load_select')}</option>
            {dailyTemplates.map((tmpl) => (
              <option key={tmpl.id} value={tmpl.id}>{tmpl.title}</option>
            ))}
          </select>
        </div>

        {/* Manual fields */}
        <div className="form-group">
          <label>{t('title')} *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label>{t('description')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="form-group">
          <label>{t('type')}</label>
          <input value={type} onChange={(e) => setType(e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>{t('distance_km')}</label>
            <input type="number" min="0" step="0.1" value={distanceKm}
              onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="form-group">
            <label>{t('duration_seconds')}</label>
            <input type="number" min="0" value={durationSeconds}
              onChange={(e) => setDurationSeconds(parseInt(e.target.value) || 0)} />
          </div>
        </div>
        <div className="form-group">
          <label>{t('notes')}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        {/* Segments */}
        <div className="form-group">
          <label>{t('segments')}</label>
          {segments.map((seg, i) => (
            <div key={i} className="segment-row">
              <select
                value={seg.segment_type}
                onChange={(e) => updateSegment(i, 'segment_type', e.target.value as 'simple' | 'interval')}
              >
                <option value="simple">{t('segment_simple')}</option>
                <option value="interval">{t('segment_interval')}</option>
              </select>
              <input
                type="number" placeholder={t('value')} min="0" step="0.01"
                value={seg.value ?? ''} onChange={(e) => updateSegment(i, 'value', parseFloat(e.target.value) || 0)}
              />
              <input
                placeholder={t('unit')} value={seg.unit ?? ''}
                onChange={(e) => updateSegment(i, 'unit', e.target.value)}
              />
              <button type="button" className="btn btn-sm btn-danger" onClick={() => removeSegment(i)}>×</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={addSegment}>
            + {t('add_segment')}
          </button>
        </div>

        <div className="form-actions">
          <button className="btn" onClick={onCancel}>{t('cancel')}</button>
          {initial && (
            <button className="btn btn-danger" onClick={onRemove}>
              {t('weekly_template_remove_day')}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={!title.trim()}>
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
