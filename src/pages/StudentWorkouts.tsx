import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { listAssignedWorkouts, deleteAssignedWorkout } from "../api/coach";
import type { AssignedWorkout } from "../types";
import { useTranslation } from "react-i18next";
import SegmentDisplay from "../components/SegmentDisplay";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function StudentWorkouts() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [pendingAssigned, setPendingAssigned] = useState<AssignedWorkout[]>([]);
  const [finishedAssigned, setFinishedAssigned] = useState<AssignedWorkout[]>([]);
  const [finishedTotal, setFinishedTotal] = useState(0);
  const [finishedPage, setFinishedPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [detailModal, setDetailModal] = useState<AssignedWorkout | null>(null);
  const [showAllPending, setShowAllPending] = useState(false);
  const HISTORY_LIMIT = 10;

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
    loadData();
  }, [studentId]);

  async function loadData() {
    try {
      setLoading(true);
      const [pendingRes, finishedRes] = await Promise.all([
        listAssignedWorkouts(studentId, 'pending'),
        listAssignedWorkouts(studentId, 'finished', 1, HISTORY_LIMIT),
      ]);
      // pending returns array (no pagination)
      setPendingAssigned(pendingRes.data as AssignedWorkout[]);
      // finished returns { data, total }
      const fData = finishedRes.data as { data: AssignedWorkout[]; total: number };
      setFinishedAssigned(fData.data);
      setFinishedTotal(fData.total);
      setFinishedPage(1);
    } catch {
      setError("Failed to load student data.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFinishedPage(page: number) {
    try {
      const res = await listAssignedWorkouts(studentId, 'finished', page, HISTORY_LIMIT);
      const fData = res.data as { data: AssignedWorkout[]; total: number };
      setFinishedAssigned(fData.data);
      setFinishedTotal(fData.total);
      setFinishedPage(page);
    } catch {
      setError("Failed to load history.");
    }
  }

  async function handleDeleteAssigned(assignedId: number) {
    try {
      await deleteAssignedWorkout(assignedId);
      setPendingAssigned((prev) => prev.filter((a) => a.id !== assignedId));
    } catch {
      setError("Failed to delete assigned workout.");
    } finally {
      setDeleteId(null);
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;
  if (error && !pendingAssigned.length && !finishedAssigned.length) return <div className="error">{error}</div>;

  const studentName = pendingAssigned.length > 0 ? pendingAssigned[0].student_name : (finishedAssigned.length > 0 ? finishedAssigned[0].student_name : `Student #${studentId}`);
  const pendingCards = pendingAssigned.slice(0, 4);
  const pendingRest = pendingAssigned.slice(4);
  const totalFinishedPages = Math.ceil(finishedTotal / HISTORY_LIMIT);

  return (
    <div className="page">
      <Link to="/coach" className="back-link">{t('detail_back')}</Link>

      <div className="student-header">
        <h1>{t('coach_student_workouts')}</h1>
        <p className="student-header-name">{studentName}</p>
      </div>

      <div className="coach-section-header" style={{ marginBottom: '1rem' }}>
        <h2>{t('assigned_assignments')}</h2>
        <Link to={`/coach/assign/${studentId}`} className="btn btn-primary btn-sm">
          + {t('assigned_new')}
        </Link>
      </div>

      {/* Pending — first 4 as cards */}
      <h3 className="section-subtitle">{t('assigned_status_pending')} ({pendingAssigned.length})</h3>
      {pendingAssigned.length === 0 ? (
        <p className="empty-hint">{t('assigned_no_pending')}</p>
      ) : (
        <>
          <div className="workout-grid" style={{ marginBottom: '1rem' }}>
            {pendingCards.map((aw) => (
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
                {aw.notes && <p className="assigned-notes">{aw.notes}</p>}
                <div className="workout-card-actions">
                  <button
                    className="btn btn-sm"
                    onClick={() => navigate(`/coach/assigned-workouts/${aw.id}/edit`)}
                  >
                    {t('edit')}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setDeleteId(aw.id)}
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {pendingRest.length > 0 && !showAllPending && (
            <button className="btn btn-sm" style={{ marginBottom: '1.5rem' }} onClick={() => setShowAllPending(true)}>
              {t('assigned_show_more')} ({pendingRest.length})
            </button>
          )}
          {showAllPending && pendingRest.length > 0 && (
            <table className="assignments-table" style={{ marginBottom: '1.5rem' }}>
              <thead>
                <tr>
                  <th>{t('assigned_title')}</th>
                  <th>{t('field_type')}</th>
                  <th>{t('assigned_due_date')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingRest.map((aw) => (
                  <tr key={aw.id}>
                    <td>{aw.title}</td>
                    <td>{aw.type ? (TYPE_LABELS[aw.type] || aw.type) : '—'}</td>
                    <td>{aw.due_date ? new Date(aw.due_date).toLocaleDateString() : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-link" onClick={() => navigate(`/coach/assigned-workouts/${aw.id}/edit`)}>
                          {t('edit')}
                        </button>
                        <button className="btn-link" style={{ color: '#ef4444' }} onClick={() => setDeleteId(aw.id)}>
                          {t('delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Finished — paginated table */}
      <h3 className="section-subtitle" style={{ marginTop: '1.5rem' }}>{t('assigned_history')} ({finishedTotal})</h3>
      {finishedAssigned.length === 0 ? (
        <p className="empty-hint">{t('assigned_no_history')}</p>
      ) : (
        <>
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
              {finishedAssigned.map((aw) => (
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
          {totalFinishedPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-sm"
                disabled={finishedPage <= 1}
                onClick={() => loadFinishedPage(finishedPage - 1)}
              >
                &laquo;
              </button>
              <span className="pagination-info">{finishedPage} / {totalFinishedPages}</span>
              <button
                className="btn btn-sm"
                disabled={finishedPage >= totalFinishedPages}
                onClick={() => loadFinishedPage(finishedPage + 1)}
              >
                &raquo;
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
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
            {detailModal.status === 'completed' && (detailModal.result_feeling || detailModal.result_time_seconds || detailModal.result_distance_km || detailModal.result_heart_rate) && (
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
                </div>
              </>
            )}
            <div className="modal-actions">
              <button className="btn btn-sm" onClick={() => setDetailModal(null)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId !== null && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('assigned_confirm_delete_title')}</h3>
            <p>{t('assigned_confirm_delete_msg')}</p>
            <div className="modal-actions">
              <button className="btn btn-sm" onClick={() => setDeleteId(null)}>
                {t('cancel')}
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleDeleteAssigned(deleteId)}
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
