import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getDailySummary } from '../api/coach';
import type { DailySummaryItem, AssignedWorkout } from '../types';
import Avatar from '../components/Avatar';
import SegmentDisplay from '../components/SegmentDisplay';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

// addDays only receives dates from today() or prior addDays calls — always YYYY-MM-DD format
function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function StatusBadge({ workout }: { workout: AssignedWorkout }) {
  const { t } = useTranslation();
  if (workout.status === 'completed') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="status-badge status-completed">{t('assigned_completed')}</span>
        {workout.result_feeling !== null && (
          <span style={{ fontSize: 12, color: '#555' }}>
            😊 {workout.result_feeling}/10
          </span>
        )}
      </div>
    );
  }
  if (workout.status === 'skipped') {
    return <span className="status-badge status-skipped">{t('assigned_skipped')}</span>;
  }
  return <span className="status-badge status-pending">{t('assigned_pending')}</span>;
}

interface DetailModalProps {
  item: DailySummaryItem;
  onClose: () => void;
}

function DetailModal({ item, onClose }: DetailModalProps) {
  const { t } = useTranslation();
  const wo = item.assigned_workout!;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{wo.title}</h2>
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
              {item.student_name} · {wo.due_date}
            </div>
          </div>
          <button className="btn btn-sm" onClick={onClose} aria-label={t('close')}>✕</button>
        </div>

        <div style={{ marginTop: 12, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`type-badge type-${wo.type}`}>{t(`type_${wo.type}`)}</span>
          <StatusBadge workout={wo} />
        </div>

        {wo.description && wo.description.trim() !== '' && (
          <div style={{ marginBottom: 12 }}>
            <div className="label">{t('daily_modal_description')}</div>
            <p style={{ margin: '4px 0 0', fontSize: 14 }}>{wo.description}</p>
          </div>
        )}

        {wo.notes && wo.notes.trim() !== '' && (
          <div style={{ marginBottom: 12 }}>
            <div className="label">{t('daily_modal_notes')}</div>
            <p style={{ margin: '4px 0 0', fontSize: 14 }}>{wo.notes}</p>
          </div>
        )}

        {wo.status === 'completed' && (
          <div style={{ marginBottom: 12 }}>
            <div className="label" style={{ marginBottom: 8 }}>{t('daily_modal_results')}</div>
            <div className="detail-grid">
              {wo.result_time_seconds !== null && (
                <div className="detail-item">
                  <span className="detail-label">{t('field_time')}</span>
                  <span>{formatSeconds(wo.result_time_seconds)}</span>
                </div>
              )}
              {wo.result_distance_km !== null && (
                <div className="detail-item">
                  <span className="detail-label">{t('field_distance')}</span>
                  <span>{wo.result_distance_km} km</span>
                </div>
              )}
              {wo.result_heart_rate !== null && (
                <div className="detail-item">
                  <span className="detail-label">{t('field_heart_rate')}</span>
                  <span>{wo.result_heart_rate} bpm</span>
                </div>
              )}
              {wo.result_feeling !== null && (
                <div className="detail-item">
                  <span className="detail-label">{t('field_feeling')}</span>
                  <span>{wo.result_feeling}/10</span>
                </div>
              )}
            </div>
          </div>
        )}

        {wo.segments && wo.segments.length > 0 && (
          <div>
            <div className="label" style={{ marginBottom: 8 }}>{t('daily_modal_segments')}</div>
            <SegmentDisplay segments={wo.segments} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CoachDailyView() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<string>(today());
  const [items, setItems] = useState<DailySummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DailySummaryItem | null>(null);

  // Computed each render (not memoized) so it stays current if the clock passes midnight
  const currentToday = today();

  const load = useCallback(async (date: string) => {
    setLoading(true);
    setError(false);
    try {
      const res = await getDailySummary(date);
      setItems(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedDate);
  }, [selectedDate, load]);

  function goToDate(delta: number) {
    setSelectedDate((d) => addDays(d, delta));
  }

  const visibleItems = hideEmpty
    ? items.filter((i) => i.assigned_workout !== null)
    : items;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{t('daily_title')}</h1>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
          />
          {t('daily_hide_empty')}
        </label>
      </div>

      {/* Date navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button className="btn" onClick={() => goToDate(-1)}>
          ← {t('daily_prev')}
        </button>
        <input
          type="date"
          value={selectedDate}
          max={currentToday}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14 }}
        />
        {selectedDate === currentToday && (
          <span className="status-badge" style={{ background: '#6c63ff', color: '#fff', cursor: 'default' }}>
            {t('daily_today')}
          </span>
        )}
        {selectedDate < currentToday && (
          <button
            className="btn btn-sm"
            onClick={() => setSelectedDate(currentToday)}
            style={{ fontSize: 12 }}
          >
            {t('daily_today')}
          </button>
        )}
        <button
          className="btn"
          onClick={() => goToDate(1)}
          disabled={selectedDate >= currentToday}
        >
          {t('daily_next')} →
        </button>
      </div>

      {loading && <div className="loading">{t('loading')}</div>}

      {!loading && error && (
        <div className="error" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <span>{t('error')}</span>
          <button className="btn btn-sm" onClick={() => load(selectedDate)}>
            {t('daily_retry')}
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p style={{ color: '#666' }}>{t('daily_no_students')}</p>
      )}

      {!loading && !error && items.length > 0 && visibleItems.length === 0 && (
        <p style={{ color: '#666' }}>{t('daily_all_hidden')}</p>
      )}

      {!loading && !error && visibleItems.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('daily_col_student')}</th>
                <th>{t('daily_col_workout')}</th>
                <th>{t('daily_col_type')}</th>
                <th>{t('daily_col_status')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr
                  key={item.student_id}
                  onClick={() => item.assigned_workout && setSelectedItem(item)}
                  onKeyDown={(e) => {
                    if (item.assigned_workout && (e.key === 'Enter' || e.key === ' ')) {
                      setSelectedItem(item);
                    }
                  }}
                  tabIndex={item.assigned_workout ? 0 : undefined}
                  style={{
                    cursor: item.assigned_workout ? 'pointer' : 'default',
                    opacity: item.assigned_workout ? 1 : 0.6,
                  }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar
                        src={item.student_avatar ?? undefined}
                        name={item.student_name}
                        size={28}
                      />
                      <span>{item.student_name}</span>
                    </div>
                  </td>
                  {item.assigned_workout ? (
                    <>
                      <td>{item.assigned_workout.title}</td>
                      <td>
                        <span className={`type-badge type-${item.assigned_workout.type}`}>
                          {t(`type_${item.assigned_workout.type}`)}
                        </span>
                      </td>
                      <td>
                        <StatusBadge workout={item.assigned_workout} />
                      </td>
                    </>
                  ) : (
                    <td colSpan={3} style={{ color: '#aaa', fontStyle: 'italic' }}>
                      {t('daily_no_assignment')}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedItem && (
        <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
