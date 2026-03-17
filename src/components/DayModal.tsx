import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import { deleteAssignedWorkout, updateAssignedWorkoutStatus } from "../api/coach";
import type { AssignedWorkout, FileResponse, WorkoutTemplate } from "../types";
import SegmentDisplay from "./SegmentDisplay";
import AssignWorkoutFields from "./AssignWorkoutFields";
import ImageUpload from "./ImageUpload";
import TimeInput, { type TimeValue, toSeconds } from "./TimeInput";
import DistanceInput from "./DistanceInput";

interface DayModalProps {
  date: string;
  workout: AssignedWorkout | null;
  role: 'coach' | 'student';
  studentId?: number;
  templates?: WorkoutTemplate[];
  onClose: () => void;
  onRefresh: () => void;
  readOnly?: boolean;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDateLabel(dateStr: string, lang: string): { weekday: string; full: string } {
  const d = new Date(dateStr + 'T12:00:00');
  const weekday = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { weekday: 'long' });
  const full = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return { weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), full: full.charAt(0).toUpperCase() + full.slice(1) };
}

type ModalView = 'detail' | 'create' | 'edit' | 'complete' | 'confirmDelete';

const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api\/?$/, '');

export default function DayModal({ date, workout, role, studentId, templates, onClose, onRefresh, readOnly = false }: DayModalProps) {
  const { t, i18n } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const [view, setView] = useState<ModalView>('detail');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setTemplateOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Complete workout state
  const [time, setTime] = useState<TimeValue>({ h: 0, m: 0, s: 0 });
  const [resultDistanceKm, setResultDistanceKm] = useState(0);
  const [resultHeartRate, setResultHeartRate] = useState("");
  const [resultFeeling, setResultFeeling] = useState(5);
  const [resultImage, setResultImage] = useState<FileResponse | null>(null);

  const { weekday, full } = formatDateLabel(date, i18n.language);

  function getTimeSeconds(): number | null {
    const total = toSeconds(time);
    return total > 0 ? total : null;
  }

  function getDistanceKm(): number | null {
    return resultDistanceKm > 0 ? resultDistanceKm : null;
  }

  function getEffortLabel(val: number): string {
    if (val <= 3) return t('effort_level_easy');
    if (val <= 6) return t('effort_level_moderate');
    if (val <= 8) return t('effort_level_hard');
    return t('effort_level_max');
  }

  async function handleComplete() {
    if (!workout) return;
    const fields = workout.expected_fields || ['feeling'];

    const data: Record<string, unknown> = { status: 'completed', result_feeling: resultFeeling };
    if (fields.includes('time')) data.result_time_seconds = getTimeSeconds();
    if (fields.includes('distance')) data.result_distance_km = getDistanceKm();
    if (fields.includes('heart_rate') && resultHeartRate) data.result_heart_rate = Number(resultHeartRate);
    if (resultImage) data.image_file_id = resultImage.id;

    try {
      await updateAssignedWorkoutStatus(workout.id, data as Parameters<typeof updateAssignedWorkoutStatus>[1]);
      showSuccess(t('assigned_status_updated'));
      onRefresh();
    } catch {
      showError("Failed to update status.");
    }
  }

  async function handleSkip() {
    if (!workout) return;
    try {
      await updateAssignedWorkoutStatus(workout.id, { status: 'skipped' });
      showSuccess(t('assigned_status_updated'));
      onRefresh();
    } catch {
      showError("Failed to update status.");
    }
  }

  async function handleDelete() {
    if (!workout) return;
    try {
      await deleteAssignedWorkout(workout.id);
      showSuccess(t('assigned_deleted'));
      onRefresh();
    } catch {
      showError("Failed to delete workout.");
    }
  }

  const statusColor = workout?.status === 'completed' ? '#4ade80' : workout?.status === 'skipped' ? '#888' : '#4a9eff';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal day-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="day-modal-header">
          <div>
            <div className="day-modal-weekday">{weekday}</div>
            <div className="day-modal-date">{full}</div>
          </div>
          <button className="day-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="day-modal-body">
        {/* CREATE / EDIT view */}
        {(view === 'create' || view === 'edit') && (
          <AssignWorkoutFields
            studentId={studentId || workout?.student_id || 0}
            dueDate={date}
            existingWorkout={view === 'edit' ? workout || undefined : undefined}
            initialData={view === 'create' ? selectedTemplate || undefined : undefined}
            onSave={() => { setSelectedTemplate(null); showSuccess(view === 'edit' ? t('assigned_workout_updated') : t('assigned_workout_created')); onRefresh(); }}
            onCancel={() => { setSelectedTemplate(null); setView('detail'); }}
          />
        )}

        {/* COMPLETE view */}
        {view === 'complete' && workout && (() => {
          const fields = workout.expected_fields || ['feeling'];
          return (
            <div className="day-modal-complete">
              <h3>{t('assigned_confirm_complete_title')}</h3>
              <div className="modal-result-fields">
                {fields.includes('time') && (
                  <div className="form-group">
                    <label>{t('expected_field_time')}</label>
                    <TimeInput value={time} onChange={setTime} />
                  </div>
                )}
                {fields.includes('distance') && (
                  <div className="form-group">
                    <DistanceInput valueKm={resultDistanceKm} onChange={setResultDistanceKm} label={t('expected_field_distance')} showUnitToggle />
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
                  <div className="effort-slider-wrap">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={resultFeeling}
                      onChange={(e) => setResultFeeling(Number(e.target.value))}
                      className="effort-slider"
                      style={{ background: `linear-gradient(to right, var(--accent, #00d4aa) ${(resultFeeling - 1) / 9 * 100}%, var(--border-color, #333) ${(resultFeeling - 1) / 9 * 100}%)` }}
                    />
                    <div className="effort-scale-labels">
                      <span>1</span>
                      <span>5</span>
                      <span>10</span>
                    </div>
                    <div className="effort-value">
                      <span className="effort-number">{resultFeeling}</span>
                      <span className="effort-label">— {getEffortLabel(resultFeeling)}</span>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('workout_image')}</label>
                  <ImageUpload value={resultImage} onChange={setResultImage} />
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-sm" onClick={() => setView('detail')}>{t('cancel')}</button>
                <button className="btn btn-sm btn-primary" onClick={handleComplete}>{t('assigned_mark_completed')}</button>
              </div>
            </div>
          );
        })()}

        {/* CONFIRM DELETE view */}
        {view === 'confirmDelete' && (
          <div className="day-modal-confirm">
            <h3>{t('assigned_confirm_delete_title')}</h3>
            <p>{t('calendar_confirm_delete')}</p>
            <div className="modal-actions">
              <button className="btn btn-sm" onClick={() => setView('detail')}>{t('cancel')}</button>
              <button className="btn btn-sm btn-danger" onClick={handleDelete}>{t('delete')}</button>
            </div>
          </div>
        )}

        {/* DETAIL view (default) */}
        {view === 'detail' && (
          <>
            {workout ? (
              <div className="day-modal-workout">
                <div className="day-modal-card" style={{ borderLeftColor: statusColor }}>
                  <div className="day-modal-card-top">
                    <div>
                      <div className="day-modal-card-title">{workout.title}</div>
                      <div className="day-modal-card-meta">
                        {workout.type && <span className="day-modal-type-badge">{workout.type}</span>}
                        {workout.distance_km > 0 && <span>📏 {workout.distance_km} km</span>}
                        {workout.duration_seconds > 0 && <span>⏱ {formatDuration(workout.duration_seconds)}</span>}
                      </div>
                    </div>
                    <span className="day-modal-status" style={{ color: statusColor }}>
                      {workout.status === 'pending' && '⏳'}
                      {workout.status === 'completed' && '✅'}
                      {workout.status === 'skipped' && '⊘'}
                      {' '}{t(`assigned_status_${workout.status}`)}
                    </span>
                  </div>

                  {workout.segments && workout.segments.length > 0 && (
                    <div className="day-modal-section">
                      <div className="day-modal-section-label">{t('calendar_structure')}</div>
                      <SegmentDisplay segments={workout.segments} />
                    </div>
                  )}

                  {workout.notes && (
                    <div className="day-modal-section">
                      <div className="day-modal-section-label">
                        {role === 'student' ? t('calendar_coach_notes') : t('field_notes')}
                      </div>
                      <div className="day-modal-notes">{workout.notes}</div>
                    </div>
                  )}

                  {workout.status === 'completed' && (workout.result_feeling || workout.result_time_seconds || workout.result_distance_km || workout.result_heart_rate) && (
                    <div className="day-modal-section">
                      <div className="day-modal-section-label">{t('calendar_results')}</div>
                      <div className="day-modal-results-grid">
                        {workout.result_time_seconds != null && (
                          <div className="day-modal-result">
                            <div className="day-modal-result-label">{t('expected_field_time')}</div>
                            <div className="day-modal-result-value">{formatDuration(workout.result_time_seconds)}</div>
                          </div>
                        )}
                        {workout.result_distance_km != null && (
                          <div className="day-modal-result">
                            <div className="day-modal-result-label">{t('expected_field_distance')}</div>
                            <div className="day-modal-result-value">{workout.result_distance_km} km</div>
                          </div>
                        )}
                        {workout.result_heart_rate != null && (
                          <div className="day-modal-result">
                            <div className="day-modal-result-label">{t('expected_field_heart_rate')}</div>
                            <div className="day-modal-result-value">{workout.result_heart_rate} bpm</div>
                          </div>
                        )}
                        {workout.result_feeling != null && (
                          <div className="day-modal-result">
                            <div className="day-modal-result-label">{t('expected_field_feeling')}</div>
                            <div className="day-modal-result-value">{workout.result_feeling}/10 — {getEffortLabel(workout.result_feeling)}</div>
                          </div>
                        )}
                      </div>
                      {workout.image_url && (
                        <img
                          src={`${apiBase}${workout.image_url}?token=${localStorage.getItem('token')}`}
                          alt={t('workout_image')}
                          className="day-modal-result-image"
                        />
                      )}
                    </div>
                  )}
                </div>

                {!readOnly && role === 'coach' && workout.status === 'pending' && (
                  <div className="day-modal-actions">
                    <button className="btn btn-primary" onClick={() => setView('edit')}>✏️ {t('calendar_edit')}</button>
                    <button className="btn btn-danger" onClick={() => setView('confirmDelete')}>🗑 {t('calendar_delete')}</button>
                  </div>
                )}
                {!readOnly && role === 'student' && workout.status === 'pending' && (
                  <div className="day-modal-actions">
                    <button className="btn btn-primary" onClick={() => setView('complete')}>✅ {t('assigned_mark_completed')}</button>
                    <button className="btn" onClick={handleSkip}>⊘ {t('assigned_mark_skipped')}</button>
                  </div>
                )}
                {/* Messages link */}
                <Link to={`/assignments/${workout.id}`} className="btn btn-link assignment-messages-link" onClick={onClose}>
                  💬 {t('assignment_messages_link')}
                  {(workout.unread_message_count ?? 0) > 0 && (
                    <span className="badge badge-accent">{workout.unread_message_count}</span>
                  )}
                </Link>
              </div>
            ) : (
              <div className="day-modal-empty">
                <div className="day-modal-empty-icon">🏃</div>
                <p>{t('calendar_no_workout')}</p>
                {role === 'coach' && (
                  <div className="day-modal-assign-actions">
                    <button className="btn btn-primary" onClick={() => setView('create')}>
                      + {t('calendar_assign')}
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
                          {templates && templates.length > 0 && templates.map(tmpl => (
                            <button
                              key={tmpl.id}
                              type="button"
                              className="template-dropdown-item"
                              onClick={() => {
                                setSelectedTemplate(tmpl);
                                setView('create');
                                setTemplateOpen(false);
                              }}
                            >
                              {tmpl.title}
                              {tmpl.type && <span className="template-dropdown-type">{t(`type_${tmpl.type}`)}</span>}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="template-dropdown-item template-dropdown-create"
                            onClick={() => { window.location.href = '/coach/templates'; }}
                          >
                            + {t('template_new')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
