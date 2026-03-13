import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import { deleteAssignedWorkout, updateAssignedWorkoutStatus } from "../api/coach";
import type { AssignedWorkout, FileResponse, WorkoutTemplate } from "../types";
import SegmentDisplay from "./SegmentDisplay";
import AssignWorkoutFields from "./AssignWorkoutFields";
import ImageUpload from "./ImageUpload";

interface DayModalProps {
  date: string;
  workout: AssignedWorkout | null;
  role: 'coach' | 'student';
  studentId?: number;
  templates?: WorkoutTemplate[];
  onClose: () => void;
  onRefresh: () => void;
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

export default function DayModal({ date, workout, role, studentId, templates, onClose, onRefresh }: DayModalProps) {
  const { t, i18n } = useTranslation();
  const { showSuccess, showError, showWarning } = useFeedback();
  const [view, setView] = useState<ModalView>('detail');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);

  // Complete workout state
  const [timeH, setTimeH] = useState("");
  const [timeM, setTimeM] = useState("");
  const [timeS, setTimeS] = useState("");
  const [resultDistance, setResultDistance] = useState("");
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'm'>('km');
  const [resultHeartRate, setResultHeartRate] = useState("");
  const [resultFeeling, setResultFeeling] = useState(0);
  const [resultImage, setResultImage] = useState<FileResponse | null>(null);

  const { weekday, full } = formatDateLabel(date, i18n.language);

  function getTimeSeconds(): number | null {
    const h = Number(timeH) || 0;
    const m = Number(timeM) || 0;
    const s = Number(timeS) || 0;
    if (h === 0 && m === 0 && s === 0) return null;
    return h * 3600 + m * 60 + s;
  }

  function getDistanceKm(): number | null {
    const val = Number(resultDistance);
    if (!val) return null;
    return distanceUnit === 'm' ? val / 1000 : val;
  }

  async function handleComplete() {
    if (!workout) return;
    const fields = workout.expected_fields || ['feeling'];

    if (resultFeeling < 1) {
      showWarning(t('assigned_feeling_required'));
      return;
    }

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
                    <div className="time-inputs">
                      <input type="number" min="0" max="99" placeholder="HH" value={timeH} onChange={(e) => setTimeH(e.target.value)} />
                      <span>:</span>
                      <input type="number" min="0" max="59" placeholder="MM" value={timeM} onChange={(e) => setTimeM(e.target.value)} />
                      <span>:</span>
                      <input type="number" min="0" max="59" placeholder="SS" value={timeS} onChange={(e) => setTimeS(e.target.value)} />
                    </div>
                  </div>
                )}
                {fields.includes('distance') && (
                  <div className="form-group">
                    <label>{t('expected_field_distance')}</label>
                    <div className="distance-input">
                      <input type="number" step="0.01" min="0" value={resultDistance} onChange={(e) => setResultDistance(e.target.value)} />
                      <select value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value as 'km' | 'm')}>
                        <option value="km">km</option>
                        <option value="m">m</option>
                      </select>
                    </div>
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
                  <div className="feeling-selector">
                    {[1,2,3,4,5,6,7,8,9,10].map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`feeling-btn ${resultFeeling === v ? 'feeling-btn-active' : ''}`}
                        onClick={() => setResultFeeling(v)}
                      >{v}</button>
                    ))}
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
                            <div className="day-modal-result-value">{workout.result_feeling}/10</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {role === 'coach' && workout.status === 'pending' && (
                  <div className="day-modal-actions">
                    <button className="btn btn-primary" onClick={() => setView('edit')}>✏️ {t('calendar_edit')}</button>
                    <button className="btn btn-danger" onClick={() => setView('confirmDelete')}>🗑 {t('calendar_delete')}</button>
                  </div>
                )}
                {role === 'student' && workout.status === 'pending' && (
                  <div className="day-modal-actions">
                    <button className="btn btn-primary" onClick={() => setView('complete')}>✅ {t('assigned_mark_completed')}</button>
                    <button className="btn" onClick={handleSkip}>⊘ {t('assigned_mark_skipped')}</button>
                  </div>
                )}
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
                    {templates && templates.length > 0 && (
                      <div className="template-select-wrapper">
                        <select className="template-select" value=""
                          onChange={(e) => {
                            const tmpl = templates.find(tpl => tpl.id === Number(e.target.value));
                            if (tmpl) { setSelectedTemplate(tmpl); setView('create'); }
                          }}>
                          <option value="">{t('template_select')}</option>
                          {templates.map(tmpl => (
                            <option key={tmpl.id} value={tmpl.id}>{tmpl.title}</option>
                          ))}
                        </select>
                      </div>
                    )}
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
