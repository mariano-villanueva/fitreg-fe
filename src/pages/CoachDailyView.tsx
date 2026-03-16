import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDailySummary } from '../api/coach';
import type { DailySummaryItem, AssignedWorkout } from '../types';
import Avatar from '../components/Avatar';
import DayModal from '../components/DayModal';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getEffortLabel(val: number, t: (key: string) => string): string {
  if (val <= 3) return t('effort_level_easy');
  if (val <= 6) return t('effort_level_moderate');
  if (val <= 8) return t('effort_level_hard');
  return t('effort_level_max');
}

function StatusBadge({ workout }: { workout: AssignedWorkout }) {
  const { t } = useTranslation();
  if (workout.status === 'completed') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="status-badge status-completed">{t('assigned_status_completed')}</span>
        {workout.result_feeling !== null && (
          <span style={{ fontSize: 12, color: '#555' }}>
            💪 {workout.result_feeling}/10
          </span>
        )}
      </div>
    );
  }
  if (workout.status === 'skipped') {
    return <span className="status-badge status-skipped">{t('assigned_status_skipped')}</span>;
  }
  return <span className="status-badge status-pending">{t('assigned_status_pending')}</span>;
}

export default function CoachDailyView() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<string>(today());
  const [items, setItems] = useState<DailySummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [modalWorkout, setModalWorkout] = useState<AssignedWorkout | null>(null);

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
        <label className="checkbox-label">
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
        <button className="btn" onClick={() => goToDate(-1)}>←</button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14 }}
        />
        {selectedDate === currentToday && (
          <span className="status-badge" style={{ background: '#6c63ff', color: '#fff', cursor: 'default' }}>
            {t('daily_today')}
          </span>
        )}
        {selectedDate !== currentToday && (
          <button
            className="btn btn-sm"
            onClick={() => setSelectedDate(currentToday)}
            style={{ fontSize: 12 }}
          >
            {t('daily_today')}
          </button>
        )}
        <button className="btn" onClick={() => goToDate(1)}>→</button>
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
                <th>{t('expected_field_feeling')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr
                  key={item.student_id}
                  style={{
                    cursor: item.assigned_workout ? 'pointer' : 'default',
                    opacity: item.assigned_workout ? 1 : 0.6,
                  }}
                >
                  <td
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'default' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar
                        src={item.student_avatar ?? undefined}
                        name={item.student_name}
                        size={28}
                      />
                      <Link
                        to={`/coach/students/${item.student_id}`}
                        style={{ fontWeight: 500, color: 'inherit', textDecoration: 'none' }}
                        onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {item.student_name}
                      </Link>
                    </div>
                  </td>
                  {item.assigned_workout ? (
                    <>
                      <td onClick={() => setModalWorkout(item.assigned_workout)}>{item.assigned_workout.title}</td>
                      <td onClick={() => setModalWorkout(item.assigned_workout)}>
                        <span className={`type-badge type-${item.assigned_workout.type}`}>
                          {t(`type_${item.assigned_workout.type}`)}
                        </span>
                      </td>
                      <td onClick={() => setModalWorkout(item.assigned_workout)}>
                        <StatusBadge workout={item.assigned_workout} />
                      </td>
                      <td onClick={() => setModalWorkout(item.assigned_workout)} style={{ color: '#aaa', fontSize: 13 }}>
                        {item.assigned_workout.result_feeling !== null
                          ? `💪 ${item.assigned_workout.result_feeling}/10 — ${getEffortLabel(item.assigned_workout.result_feeling, t)}`
                          : '—'}
                      </td>
                    </>
                  ) : (
                    <td colSpan={4} style={{ color: '#aaa', fontStyle: 'italic' }}>
                      {t('daily_no_assignment')}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalWorkout && (
        <DayModal
          date={selectedDate}
          workout={modalWorkout}
          role="coach"
          onClose={() => setModalWorkout(null)}
          onRefresh={() => {}}
          readOnly
        />
      )}
    </div>
  );
}
