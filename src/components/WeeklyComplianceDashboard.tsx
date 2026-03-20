import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDailySummary } from '../api/coach';
import type { Student, DailySummaryItem } from '../types';
import {
  getWeekDates,
  getCellStatus,
  getCompliancePercent,
  getComplianceColor,
  getStudentCategory,
  getKmSummary,
  type WeekSelection,
} from '../utils/weekCompliance';
import './WeeklyComplianceDashboard.css';

const DAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

const CELL_ICON = {
  completed: '✅',
  skipped: '❌',
  pending: '⏳',
  none: '—',
} as const;

interface Props {
  students: Student[];
}

// dayData[dayIndex] = Map<studentId, DailySummaryItem | null>
type DayMatrix = Map<number, DailySummaryItem | null>[];

export default function WeeklyComplianceDashboard({ students }: Props) {
  const { t } = useTranslation();
  const [weekSelection, setWeekSelection] = useState<WeekSelection>('current');
  const [dayMatrix, setDayMatrix] = useState<DayMatrix | null>(null);
  const [weekDates, setWeekDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (students.length === 0) return;
    const dates = getWeekDates(weekSelection);
    setWeekDates(dates);

    let cancelled = false;

    async function loadWeek() {
      setLoading(true);
      setDayMatrix(null); // clear stale data before new fetch
      try {
        const results = await Promise.allSettled(
          dates.map(date => getDailySummary(date))
        );
        if (cancelled) return;

        const matrix: DayMatrix = results.map(result => {
          const map = new Map<number, DailySummaryItem | null>();
          students.forEach(s => map.set(s.id, null));
          if (result.status === 'fulfilled') {
            for (const item of result.value.data) {
              map.set(item.student_id, item);
            }
          }
          return map;
        });

        setDayMatrix(matrix);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWeek();
    return () => { cancelled = true; };
  }, [weekSelection, students.map(s => s.id).join(',')]); // stable derived key to avoid array reference instability while catching roster changes

  if (students.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  const rows = students.map(student => {
    const dayItems = dayMatrix
      ? dayMatrix.map(dayMap => dayMap.get(student.id) ?? null)
      : Array.from({ length: 7 }, (): DailySummaryItem | null => null);

    const pct = dayMatrix ? getCompliancePercent(dayItems) : null;
    const km = dayMatrix ? getKmSummary(dayItems) : null;
    const category = dayMatrix ? getStudentCategory(dayItems, weekDates, today) : null;

    return { student, dayItems, pct, km, category };
  });

  rows.sort((a, b) => {
    if (a.pct === null && b.pct === null) return 0;
    if (a.pct === null) return 1;
    if (b.pct === null) return -1;
    return b.pct - a.pct;
  });

  const stats = {
    on_track:    rows.filter(r => r.category === 'on_track').length,
    has_pending: rows.filter(r => r.category === 'has_pending').length,
    no_activity: rows.filter(r => r.category === 'no_activity').length,
  };

  const weekLabel = weekDates.length === 7
    ? formatWeekLabel(weekDates[0], weekDates[6])
    : '';

  return (
    <div className="coach-section weekly-compliance">
      <div className="coach-section-header">
        <div className="weekly-compliance-title">
          <h2>{t('weekly_compliance_title')}</h2>
          {weekLabel && <span className="weekly-compliance-range">{weekLabel}</span>}
        </div>
        <div className="weekly-compliance-week-toggle">
          <button
            className={`btn btn-sm${weekSelection === 'previous' ? ' btn-primary' : ''}`}
            onClick={() => setWeekSelection('previous')}
          >
            {t('weekly_compliance_prev_week')}
          </button>
          <button
            className={`btn btn-sm${weekSelection === 'current' ? ' btn-primary' : ''}`}
            onClick={() => setWeekSelection('current')}
          >
            {t('weekly_compliance_current_week')}
          </button>
        </div>
      </div>

      {!loading && dayMatrix && (
      <div className="weekly-compliance-stats">
        <div className="weekly-compliance-stat weekly-compliance-stat--green">
          <span className="weekly-compliance-stat-value">{stats.on_track}</span>
          <span className="weekly-compliance-stat-label">{t('weekly_compliance_on_track')}</span>
        </div>
        <div className="weekly-compliance-stat weekly-compliance-stat--yellow">
          <span className="weekly-compliance-stat-value">{stats.has_pending}</span>
          <span className="weekly-compliance-stat-label">{t('weekly_compliance_has_pending')}</span>
        </div>
        <div className="weekly-compliance-stat weekly-compliance-stat--red">
          <span className="weekly-compliance-stat-value">{stats.no_activity}</span>
          <span className="weekly-compliance-stat-label">{t('weekly_compliance_no_activity')}</span>
        </div>
        <div className="weekly-compliance-stat weekly-compliance-stat--neutral">
          <span className="weekly-compliance-stat-value">{students.length}</span>
          <span className="weekly-compliance-stat-label">{t('weekly_compliance_total')}</span>
        </div>
      </div>
      )}

      {loading ? (
        <div className="loading">{t('loading')}</div>
      ) : (
        <div className="weekly-compliance-table-wrapper">
          <table className="weekly-compliance-table">
            <thead>
              <tr>
                <th className="col-student">{t('weekly_compliance_student_col')}</th>
                {DAY_LABELS.map((label, i) => (
                  <th key={label} className="col-day">
                    {label}
                    {weekDates[i] && (
                      <span className="day-number">
                        {weekDates[i].slice(8)}
                      </span>
                    )}
                  </th>
                ))}
                <th className="col-pct">%</th>
                <th className="col-km">km</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ student, dayItems, pct, km }) => (
                <tr key={student.id}>
                  <td className="col-student">
                    <Link to={`/coach/students/${student.id}`} className="student-link">
                      {student.name}
                    </Link>
                  </td>
                  {dayItems.map((item, i) => {
                    const status = getCellStatus(item);
                    return (
                      <td key={weekDates[i] ?? i} className={`col-day cell-${status}`}>
                        {CELL_ICON[status]}
                      </td>
                    );
                  })}
                  <td
                    className="col-pct"
                    style={{ color: pct !== null ? getComplianceColor(pct) : undefined }}
                  >
                    {pct !== null ? `${pct}%` : '—'}
                  </td>
                  <td className="col-km">
                    {km && km.planned !== null
                      ? `${Math.round(km.completed)}/${Math.round(km.planned)}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="weekly-compliance-legend">
            <span>{`✅ ${t('status_completed')}`}</span>
            <span>{`❌ ${t('status_skipped')}`}</span>
            <span>{`⏳ ${t('status_pending')}`}</span>
            <span>{`— ${t('weekly_compliance_no_workout')}`}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatWeekLabel(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const startDay = s.getDate();
  const endDay = e.getDate();
  const month = e.toLocaleDateString('es-AR', { month: 'short' });
  const startMonth = s.toLocaleDateString('es-AR', { month: 'short' });
  if (s.getMonth() === e.getMonth()) {
    return `${startDay}–${endDay} ${month}`;
  }
  return `${startDay} ${startMonth}–${endDay} ${month}`;
}
