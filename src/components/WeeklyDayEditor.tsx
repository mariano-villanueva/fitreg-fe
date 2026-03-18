import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { listTemplates } from '../api/templates';
import type { WeeklyTemplateDay, WeeklyTemplateSegment, WorkoutTemplate, WorkoutSegment } from '../types';
import AssignWorkoutFields from './AssignWorkoutFields';

interface Props {
  dayIndex: number; // 0=Mon … 6=Sun
  initial: WeeklyTemplateDay | null;
  onSave: (day: WeeklyTemplateDay) => void;
  onRemove: () => void;
  onCancel: () => void;
}

const DAY_NAMES_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function weeklyDayToTemplate(day: WeeklyTemplateDay): WorkoutTemplate {
  return {
    id: 0,
    coach_id: 0,
    title: day.title,
    description: day.description,
    type: day.type ?? 'easy',
    notes: day.notes,
    expected_fields: [],
    created_at: '',
    updated_at: '',
    segments: day.segments.map((s) => ({
      order_index: s.order_index,
      segment_type: s.segment_type,
      repetitions: s.repetitions,
      value: s.value ?? 0,
      unit: (s.unit ?? 'km') as WorkoutSegment['unit'],
      intensity: (s.intensity ?? 'easy') as WorkoutSegment['intensity'],
      work_value: s.work_value ?? 0,
      work_unit: (s.work_unit ?? 'km') as WorkoutSegment['work_unit'],
      work_intensity: (s.work_intensity ?? 'easy') as WorkoutSegment['work_intensity'],
      rest_value: s.rest_value ?? 0,
      rest_unit: (s.rest_unit ?? 'km') as WorkoutSegment['rest_unit'],
      rest_intensity: (s.rest_intensity ?? 'easy') as WorkoutSegment['rest_intensity'],
    })),
  };
}

function segmentsToWeekly(segs: WorkoutSegment[]): WeeklyTemplateSegment[] {
  return segs.map((s, i) => ({
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
  }));
}

type View = 'detail' | 'empty' | 'form';

export default function WeeklyDayEditor({ dayIndex, initial, onSave, onRemove, onCancel }: Props) {
  const { t, i18n } = useTranslation();
  const dayNames = i18n.language.startsWith('es') ? DAY_NAMES_ES : DAY_NAMES_EN;

  const [view, setView] = useState<View>(initial ? 'detail' : 'empty');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [dailyTemplates, setDailyTemplates] = useState<WorkoutTemplate[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listTemplates().then((res) => setDailyTemplates(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setTemplateOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleFormSave(data?: Record<string, unknown>) {
    if (!data) return;
    onSave({
      day_of_week: dayIndex,
      title: data.title as string,
      description: (data.description as string) || null,
      type: (data.type as string) || null,
      distance_km: null,
      duration_seconds: null,
      notes: (data.notes as string) || null,
      from_template_id: selectedTemplate?.id ?? initial?.from_template_id ?? null,
      segments: segmentsToWeekly(data.segments as WorkoutSegment[]),
    });
  }

  const formInitialData: WorkoutTemplate | undefined =
    selectedTemplate ?? (initial ? weeklyDayToTemplate(initial) : undefined);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal day-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="day-modal-header">
          <div>
            <div className="day-modal-weekday">{dayNames[dayIndex]}</div>
          </div>
          <button className="day-modal-close" onClick={onCancel}>✕</button>
        </div>

        <div className="day-modal-body">
          {/* Empty state */}
          {view === 'empty' && (
            <div className="day-modal-empty">
              <div className="day-modal-empty-icon">🏃</div>
              <p>{t('weekly_template_day_empty')}</p>
              <div className="day-modal-assign-actions">
                <button className="btn btn-primary" onClick={() => setView('form')}>
                  + {t('weekly_template_create_manual')}
                </button>
                <div className="template-dropdown" ref={templateRef}>
                  <button
                    type="button"
                    className="btn btn-primary btn-template-trigger"
                    onClick={() => setTemplateOpen(!templateOpen)}
                  >
                    + {t('template_from')}
                    <span className="template-chevron">{templateOpen ? '▴' : '▾'}</span>
                  </button>
                  {templateOpen && (
                    <div className="template-dropdown-menu">
                      {dailyTemplates.length > 0 ? dailyTemplates.map((tmpl) => (
                        <button
                          key={tmpl.id}
                          type="button"
                          className="template-dropdown-item"
                          onClick={() => {
                            setSelectedTemplate(tmpl);
                            setView('form');
                            setTemplateOpen(false);
                          }}
                        >
                          {tmpl.title}
                          {tmpl.type && (
                            <span className="template-dropdown-type">{t(`type_${tmpl.type}`)}</span>
                          )}
                        </button>
                      )) : (
                        <div className="template-dropdown-item" style={{ opacity: 0.6, cursor: 'default' }}>
                          {t('template_empty')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Detail view (existing day) */}
          {view === 'detail' && initial && (
            <div className="day-modal-workout">
              <div className="day-modal-card" style={{ borderLeftColor: 'var(--accent)' }}>
                <div className="day-modal-card-top">
                  <div>
                    <div className="day-modal-card-title">{initial.title}</div>
                    <div className="day-modal-card-meta">
                      {initial.type && <span className="day-modal-type-badge">{initial.type}</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="day-modal-actions">
                <button className="btn btn-primary" onClick={() => setView('form')}>
                  ✏️ {t('edit')}
                </button>
                <button className="btn btn-danger" onClick={onRemove}>
                  🗑 {t('weekly_template_remove_day')}
                </button>
              </div>
            </div>
          )}

          {/* Form view */}
          {view === 'form' && (
            <AssignWorkoutFields
              mode="template"
              initialData={formInitialData}
              saveLabel={t('save')}
              onSave={handleFormSave}
              onCancel={() => setView(initial ? 'detail' : 'empty')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
