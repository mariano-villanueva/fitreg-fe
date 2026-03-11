import { useState, useEffect } from "react";
import { getMyAssignedWorkouts, updateAssignedWorkoutStatus } from "../api/coach";
import type { AssignedWorkout, FileResponse } from "../types";
import { useTranslation } from "react-i18next";
import SegmentDisplay from "../components/SegmentDisplay";
import ImageUpload from "../components/ImageUpload";
import { useFeedback } from "../context/FeedbackContext";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function MyAssignedWorkouts() {
  const { t } = useTranslation();
  const { showSuccess, showError, showWarning } = useFeedback();
  const [workouts, setWorkouts] = useState<AssignedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{ id: number; status: string; workout: AssignedWorkout } | null>(null);
  const [timeH, setTimeH] = useState("");
  const [timeM, setTimeM] = useState("");
  const [timeS, setTimeS] = useState("");
  const [resultDistance, setResultDistance] = useState("");
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'm'>('km');
  const [resultHeartRate, setResultHeartRate] = useState("");
  const [resultFeeling, setResultFeeling] = useState(0);
  const [resultImage, setResultImage] = useState<FileResponse | null>(null);
  const [detailModal, setDetailModal] = useState<AssignedWorkout | null>(null);

  const TYPE_LABELS: Record<string, string> = {
    easy: t('type_easy'),
    tempo: t('type_tempo'),
    intervals: t('type_intervals'),
    long_run: t('type_long_run'),
    race: t('type_race'),
    fartlek: t('type_fartlek'),
    other: t('type_other'),
  };

  useEffect(() => {
    loadWorkouts();
  }, []);

  async function loadWorkouts() {
    try {
      setLoading(true);
      const res = await getMyAssignedWorkouts();
      setWorkouts(res.data);
    } catch {
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
  }

  function openModal(workout: AssignedWorkout, status: string) {
    setTimeH(""); setTimeM(""); setTimeS("");
    setResultDistance("");
    setDistanceUnit('km');
    setResultHeartRate("");
    setResultFeeling(0);
    setResultImage(null);
    setConfirmModal({ id: workout.id, status, workout });
  }

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

  async function handleStatusUpdate() {
    if (!confirmModal) return;
    const { id, status, workout } = confirmModal;
    const fields = workout.expected_fields || ['feeling'];
    const data: Record<string, unknown> = { status };

    if (status === 'completed') {
      if (resultFeeling < 1) {
        showWarning(t('assigned_feeling_required'));
        return;
      }
      data.result_feeling = resultFeeling;
      if (fields.includes('time')) data.result_time_seconds = getTimeSeconds();
      if (fields.includes('distance')) data.result_distance_km = getDistanceKm();
      if (fields.includes('heart_rate') && resultHeartRate) data.result_heart_rate = Number(resultHeartRate);
      if (resultImage) data.image_file_id = resultImage.id;
    }

    try {
      await updateAssignedWorkoutStatus(id, data as Parameters<typeof updateAssignedWorkoutStatus>[1]);
      showSuccess(t('assigned_status_updated'));
      await loadWorkouts();
    } catch {
      showError("Failed to update status.");
    } finally {
      setConfirmModal(null);
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;

  const pending = workouts.filter((w) => w.status === 'pending');
  const finished = workouts.filter((w) => w.status !== 'pending');

  return (
    <div className="page">
      <h1>{t('assigned_my')}</h1>

      {workouts.length === 0 ? (
        <div className="empty-state">
          <p>{t('assigned_no_workouts')}</p>
        </div>
      ) : (
        <>
          {/* Pending — cards */}
          <h2 className="section-subtitle">{t('assigned_status_pending')} ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="empty-hint">{t('assigned_no_pending')}</p>
          ) : (
            <div className="workout-grid">
              {pending.map((aw) => (
                <div key={aw.id} className="assigned-workout-card">
                  <div className="workout-card-header">
                    <h2>{aw.title}</h2>
                  </div>
                  <div className="assigned-details">
                    {aw.type && (
                      <span className={`type-badge type-${aw.type}`}>
                        {TYPE_LABELS[aw.type] || aw.type}
                      </span>
                    )}
                    {aw.distance_km > 0 && <span>{aw.distance_km} km</span>}
                    {aw.duration_seconds > 0 && <span>{formatDuration(aw.duration_seconds)}</span>}
                    {aw.due_date && <span>{new Date(aw.due_date).toLocaleDateString()}</span>}
                  </div>
                  {aw.segments && aw.segments.length > 0 && (
                    <SegmentDisplay segments={aw.segments} />
                  )}
                  {aw.coach_name && (
                    <p className="assigned-coach">{t('assigned_from_coach')}: {aw.coach_name}</p>
                  )}
                  {aw.notes && <p className="assigned-notes">{aw.notes}</p>}
                  <div className="workout-card-actions">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => openModal(aw, 'completed')}
                    >
                      {t('assigned_mark_completed')}
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => openModal(aw, 'skipped')}
                    >
                      {t('assigned_mark_skipped')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed / Skipped — table */}
          <h2 className="section-subtitle" style={{ marginTop: '2rem' }}>{t('assigned_history')} ({finished.length})</h2>
          {finished.length === 0 ? (
            <p className="empty-hint">{t('assigned_no_history')}</p>
          ) : (
            <table className="assignments-table">
              <thead>
                <tr>
                  <th>{t('assigned_title')}</th>
                  <th>{t('field_type')}</th>
                  <th>{t('assigned_due_date')}</th>
                  <th>{t('assigned_status')}</th>
                  <th>{t('expected_field_feeling')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {finished.map((aw) => (
                  <tr key={aw.id}>
                    <td>{aw.title}</td>
                    <td>{aw.type ? (TYPE_LABELS[aw.type] || aw.type) : '—'}</td>
                    <td>{aw.due_date ? new Date(aw.due_date).toLocaleDateString() : '—'}</td>
                    <td>
                      <span className={`status-badge status-${aw.status}`}>
                        {t(`assigned_status_${aw.status}`)}
                      </span>
                    </td>
                    <td>{aw.result_feeling ? `${aw.result_feeling}/10` : '—'}</td>
                    <td>
                      <button className="btn-link" onClick={() => setDetailModal(aw)}>
                        {t('assigned_detail')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {confirmModal && (() => {
        const fields = confirmModal.workout.expected_fields || ['feeling'];
        return (
          <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{confirmModal.status === 'completed' ? t('assigned_confirm_complete_title') : t('assigned_confirm_skip_title')}</h3>
              <p>{confirmModal.status === 'completed' ? t('assigned_confirm_complete_msg') : t('assigned_confirm_skip_msg')}</p>

              {confirmModal.status === 'completed' && (
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
                  {/* Feeling is always required */}
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
              )}

              <div className="modal-actions">
                <button className="btn btn-sm" onClick={() => setConfirmModal(null)}>
                  {t('cancel')}
                </button>
                <button
                  className={`btn btn-sm ${confirmModal.status === 'completed' ? 'btn-primary' : 'btn-danger'}`}
                  onClick={handleStatusUpdate}
                >
                  {confirmModal.status === 'completed' ? t('assigned_mark_completed') : t('assigned_mark_skipped')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Detail modal (read-only) */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{detailModal.title}</h3>
            <div className="detail-readonly">
              {detailModal.type && (
                <div className="detail-row">
                  <span className="detail-label">{t('field_type')}</span>
                  <span>{TYPE_LABELS[detailModal.type] || detailModal.type}</span>
                </div>
              )}
              {detailModal.due_date && (
                <div className="detail-row">
                  <span className="detail-label">{t('assigned_due_date')}</span>
                  <span>{new Date(detailModal.due_date).toLocaleDateString()}</span>
                </div>
              )}
              {detailModal.distance_km > 0 && (
                <div className="detail-row">
                  <span className="detail-label">{t('field_distance')}</span>
                  <span>{detailModal.distance_km} km</span>
                </div>
              )}
              {detailModal.duration_seconds > 0 && (
                <div className="detail-row">
                  <span className="detail-label">{t('field_duration')}</span>
                  <span>{formatDuration(detailModal.duration_seconds)}</span>
                </div>
              )}
              {detailModal.coach_name && (
                <div className="detail-row">
                  <span className="detail-label">{t('assigned_from_coach')}</span>
                  <span>{detailModal.coach_name}</span>
                </div>
              )}
              {detailModal.notes && (
                <div className="detail-row">
                  <span className="detail-label">{t('field_notes')}</span>
                  <span>{detailModal.notes}</span>
                </div>
              )}
              {detailModal.segments && detailModal.segments.length > 0 && (
                <div className="detail-row detail-row-block">
                  <span className="detail-label">{t('segment_structure')}</span>
                  <SegmentDisplay segments={detailModal.segments} />
                </div>
              )}
            </div>

            {/* Results section */}
            {detailModal.status === 'completed' && (detailModal.result_feeling || detailModal.result_time_seconds || detailModal.result_distance_km || detailModal.result_heart_rate || detailModal.image_url) && (
              <>
                <h4 className="detail-section-title">{t('assigned_results')}</h4>
                <div className="detail-readonly">
                  {detailModal.result_time_seconds != null && (
                    <div className="detail-row">
                      <span className="detail-label">{t('expected_field_time')}</span>
                      <span>{formatDuration(detailModal.result_time_seconds)}</span>
                    </div>
                  )}
                  {detailModal.result_distance_km != null && (
                    <div className="detail-row">
                      <span className="detail-label">{t('expected_field_distance')}</span>
                      <span>{detailModal.result_distance_km} km</span>
                    </div>
                  )}
                  {detailModal.result_heart_rate != null && (
                    <div className="detail-row">
                      <span className="detail-label">{t('expected_field_heart_rate')}</span>
                      <span>{detailModal.result_heart_rate} bpm</span>
                    </div>
                  )}
                  {detailModal.result_feeling != null && (
                    <div className="detail-row">
                      <span className="detail-label">{t('expected_field_feeling')}</span>
                      <span>{detailModal.result_feeling}/10</span>
                    </div>
                  )}
                  {detailModal.image_url && (
                    <div className="detail-row detail-row-block">
                      <span className="detail-label">{t('workout_image')}</span>
                      <img
                        src={`${(import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api\/?$/, '')}${detailModal.image_url}?token=${localStorage.getItem('token')}`}
                        alt={detailModal.title}
                        className="detail-image"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-sm" onClick={() => setDetailModal(null)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
