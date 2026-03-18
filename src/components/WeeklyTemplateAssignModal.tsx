import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listStudents } from '../api/coach';
import { assignWeeklyTemplate } from '../api/weeklyTemplates';
import type { Student, WeeklyTemplate, AssignConflictResponse } from '../types';

interface Props {
  template: WeeklyTemplate;
  onClose: () => void;
  onSuccess: () => void;
}

function isMonday(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00'); // force local midnight
  return d.getDay() === 1; // 1 = Monday in JS Date
}

export default function WeeklyTemplateAssignModal({ template, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [dateError, setDateError] = useState('');
  const [conflictDates, setConflictDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listStudents().then((res) => setStudents(res.data)).catch(() => {});
  }, []);

  function handleDateChange(val: string) {
    setStartDate(val);
    setConflictDates([]);
    if (val && !isMonday(val)) {
      setDateError(t('weekly_template_must_be_monday'));
    } else {
      setDateError('');
    }
  }

  async function handleConfirm() {
    if (!studentId || !startDate) return;
    if (!isMonday(startDate)) {
      setDateError(t('weekly_template_must_be_monday'));
      return;
    }
    setSaving(true);
    setConflictDates([]);
    try {
      await assignWeeklyTemplate(template.id, Number(studentId), startDate);
      onSuccess();
    } catch (err: unknown) {
      // Check for 409 conflict response
      const axiosErr = err as { response?: { status: number; data: AssignConflictResponse } };
      if (axiosErr.response?.status === 409) {
        setConflictDates(axiosErr.response.data.conflicting_dates ?? []);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('weekly_template_assign')}: {template.name}</h3>

        <div className="form-group">
          <label>{t('student')}</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">{t('select_student')}</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>{t('weekly_template_start_date')}</label>
          <input type="date" value={startDate} onChange={(e) => handleDateChange(e.target.value)} />
          {dateError && <p className="form-error">{dateError}</p>}
        </div>

        {conflictDates.length > 0 && (
          <div className="form-error">
            <p>{t('weekly_template_conflict')}</p>
            <ul>
              {conflictDates.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </div>
        )}

        <div className="form-actions">
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!studentId || !startDate || !!dateError || saving}
          >
            {saving ? t('saving') : t('weekly_template_assign_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
