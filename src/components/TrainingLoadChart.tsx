import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getStudentLoad, getMyLoad } from '../api/coach';
import type { WeeklyLoadEntry } from '../types';
import './TrainingLoadChart.css';

interface TrainingLoadChartProps {
  studentId?: number; // if provided → coach view; if absent → athlete's own view
}

const WEEK_OPTIONS = [4, 8, 12] as const;

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart + 'T00:00:00');
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function TrainingLoadChart({ studentId }: TrainingLoadChartProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<WeeklyLoadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<number>(8);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const res = studentId
          ? await getStudentLoad(studentId, weeks)
          : await getMyLoad(weeks);
        if (!cancelled) setEntries(res.data ?? []);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [studentId, weeks]);

  // API returns DESC (newest first) — reverse to show oldest → newest
  const sorted = [...entries].reverse();
  const maxKm = Math.max(...sorted.map(e => Math.max(e.planned_km, e.actual_km)), 1);

  const totalPlanned = sorted.reduce((s, e) => s + e.planned_km, 0);
  const totalActual = sorted.reduce((s, e) => s + e.actual_km, 0);
  const compliance = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  return (
    <div className="training-load-chart">
      <div className="load-header">
        <h3 className="load-title">{t('load_title')}</h3>
        <div className="load-week-toggle">
          {WEEK_OPTIONS.map(w => (
            <button
              key={w}
              className={`load-week-btn${weeks === w ? ' active' : ''}`}
              onClick={() => setWeeks(w)}
            >
              {t(`load_weeks_${w}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="load-legend">
        <span className="load-legend-item load-legend-planned">{t('load_planned')}</span>
        <span className="load-legend-item load-legend-actual">{t('load_actual')}</span>
      </div>

      {loading ? (
        <div className="load-skeleton">
          {Array.from({ length: weeks }).map((_, i) => (
            <div key={i} className="load-skeleton-bar" style={{ height: `${30 + Math.random() * 60}%` }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="load-empty">{t('load_no_data')}</p>
      ) : (
        <>
          <div className="load-bars-container">
            {sorted.map(entry => {
              const plannedH = (entry.planned_km / maxKm) * 100;
              const actualH = (entry.actual_km / maxKm) * 100;
              return (
                <div key={entry.week_start} className="load-bar-group">
                  <div className="load-bar-pair">
                    <div
                      className="load-bar load-bar-planned"
                      style={{ height: `${plannedH}%` }}
                      title={`${t('load_planned')}: ${entry.planned_km.toFixed(1)} km`}
                    />
                    <div
                      className="load-bar load-bar-actual"
                      style={{ height: `${actualH}%` }}
                      title={`${t('load_actual')}: ${entry.actual_km.toFixed(1)} km`}
                    />
                  </div>
                  {entry.has_personal_workouts && (
                    <span
                      className="load-personal-dot"
                      title={t('load_personal_workouts_tooltip')}
                    />
                  )}
                  <span className="load-week-label">{formatWeekLabel(entry.week_start)}</span>
                </div>
              );
            })}
          </div>

          <div className="load-summary">
            <div className="load-summary-item">
              <span className="load-summary-value load-summary-planned">
                {totalPlanned.toFixed(1)} km
              </span>
              <span className="load-summary-label">{t('load_planned')}</span>
            </div>
            <div className="load-summary-item">
              <span className="load-summary-value load-summary-actual">
                {totalActual.toFixed(1)} km
              </span>
              <span className="load-summary-label">{t('load_actual')}</span>
            </div>
            <div className="load-summary-item">
              <span className="load-summary-value">{compliance}%</span>
              <span className="load-summary-label">{t('load_compliance', { pct: '' }).replace(' %', '')}</span>
            </div>
            <div className="load-summary-item">
              <span className="load-summary-value">
                {formatSeconds(sorted.reduce((s, e) => s + e.actual_seconds, 0))}
              </span>
              <span className="load-summary-label">{t('load_actual')}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
