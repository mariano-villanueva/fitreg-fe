import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listStudents } from '../api/coach';
import { listWeeklyTemplates, assignWeeklyTemplate } from '../api/weeklyTemplates';
import type { Student, WeeklyTemplate, AssignConflictResponse } from '../types';

interface Props {
  template?: WeeklyTemplate;
  presetStudentId?: number;
  presetStudentName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function isMonday(dateStr: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr + 'T00:00:00').getDay() === 1;
}

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function WeeklyTemplateAssignModal({ template, presetStudentId, presetStudentName, onClose, onSuccess }: Props) {
  const { t } = useTranslation();

  const [templates, setTemplates] = useState<WeeklyTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | ''>(template?.id ?? '');

  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<number | ''>(presetStudentId ?? '');

  const [startDate, setStartDate] = useState('');
  const [dateError, setDateError] = useState('');
  const [conflictDates, setConflictDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!template) listWeeklyTemplates().then((res) => setTemplates(res.data)).catch(() => {});
    if (!presetStudentId) listStudents().then((res) => setStudents(res.data)).catch(() => {});
  }, []);

  function handleDateChange(val: string) {
    setStartDate(val);
    setConflictDates([]);
    setDateError(val && !isMonday(val) ? t('weekly_template_must_be_monday') : '');
  }

  async function doAssign(force: boolean) {
    const resolvedStudentId = presetStudentId ?? (studentId === '' ? null : Number(studentId));
    const resolvedTemplateId = template?.id ?? (templateId === '' ? null : Number(templateId));
    if (!resolvedStudentId || !resolvedTemplateId || !startDate || !isMonday(startDate)) return;

    setSaving(true);
    if (!force) setConflictDates([]);
    try {
      await assignWeeklyTemplate(resolvedTemplateId, resolvedStudentId, startDate, force);
      onSuccess();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number; data: AssignConflictResponse } };
      if (axiosErr.response?.status === 409) {
        setConflictDates(axiosErr.response.data.conflicting_dates ?? []);
      }
    } finally {
      setSaving(false);
    }
  }

  const resolvedStudentId = presetStudentId ?? studentId;
  const resolvedTemplateId = template?.id ?? templateId;
  const canConfirm = resolvedStudentId && resolvedTemplateId && startDate && !dateError && !saving;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{template ? `${t('weekly_template_assign')}: ${template.name}` : t('weekly_template_assign')}</h3>

        {!template && (
          <div className="form-group">
            <label>{t('weekly_template_title')}</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">{t('weekly_template_load_select')}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}{tmpl.day_count ? ` (${tmpl.day_count} días)` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {presetStudentId ? (
          <div className="form-group">
            <label>{t('student')}</label>
            <p style={{ margin: '4px 0 0', fontWeight: 500 }}>{presetStudentName ?? `#${presetStudentId}`}</p>
          </div>
        ) : (
          <div className="form-group">
            <label>{t('student')}</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">{t('select_student')}</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>{t('weekly_template_start_date')}</label>
          <input
            type="date"
            value={startDate}
            min={nextMonday()}
            step={7}
            onChange={(e) => handleDateChange(e.target.value)}
          />
          {dateError && <p className="form-error">{dateError}</p>}
        </div>

        {/* Conflict panel */}
        {conflictDates.length > 0 && (
          <div className="weekly-assign-conflict">
            <div className="weekly-assign-conflict__header">
              ⚠️ {t('weekly_template_conflict_title')}
            </div>
            <ul className="weekly-assign-conflict__list">
              {conflictDates.map((d) => (
                <li key={d}>{formatDate(d)}</li>
              ))}
            </ul>
            <p className="weekly-assign-conflict__hint">{t('weekly_template_overwrite_hint')}</p>
          </div>
        )}

        <div className="form-actions">
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          {conflictDates.length > 0 ? (
            <button className="btn btn-danger" onClick={() => doAssign(true)} disabled={saving}>
              {saving ? t('saving') : t('weekly_template_overwrite')}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => doAssign(false)} disabled={!canConfirm}>
              {saving ? t('saving') : t('weekly_template_assign_confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
