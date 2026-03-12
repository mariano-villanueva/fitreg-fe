import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listAssignedWorkouts, getMyAssignedWorkouts } from "../api/coach";
import type { AssignedWorkout } from "../types";
import DayModal from "./DayModal";

interface MonthCalendarProps {
  role: 'coach' | 'student';
  studentId?: number;
  studentName?: string;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ day: d, month: m, year: y, isCurrentMonth: false });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, isCurrentMonth: true });
  }

  // Next month padding
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      cells.push({ day: d, month: m, year: y, isCurrentMonth: false });
    }
  }

  return cells;
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const WEEKDAY_KEYS = ['weekday_sun', 'weekday_mon', 'weekday_tue', 'weekday_wed', 'weekday_thu', 'weekday_fri', 'weekday_sat'];

const MONTH_NAMES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function MonthCalendar({ role, studentId, studentName }: MonthCalendarProps) {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [workoutMap, setWorkoutMap] = useState<Record<string, AssignedWorkout[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthNames = i18n.language.startsWith('en') ? MONTH_NAMES_EN : MONTH_NAMES_ES;

  const fetchWorkouts = useCallback(async () => {
    setLoading(true);
    const startDate = dateKey(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = dateKey(year, month, lastDay);

    try {
      let workouts: AssignedWorkout[] = [];
      if (role === 'coach' && studentId) {
        const res = await listAssignedWorkouts(studentId, undefined, undefined, undefined, startDate, endDate);
        workouts = Array.isArray(res.data) ? res.data : ((res.data as { data?: AssignedWorkout[] }).data || []);
      } else if (role === 'student') {
        const res = await getMyAssignedWorkouts(startDate, endDate);
        workouts = res.data || [];
      }

      const map: Record<string, AssignedWorkout[]> = {};
      for (const w of workouts) {
        const key = w.due_date?.slice(0, 10);
        if (key) {
          if (!map[key]) map[key] = [];
          map[key].push(w);
        }
      }
      setWorkoutMap(map);
    } catch {
      setWorkoutMap({});
    } finally {
      setLoading(false);
    }
  }, [year, month, role, studentId]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const cells = getMonthDays(year, month);

  const selectedWorkout = selectedDate ? (workoutMap[selectedDate]?.[0] || null) : null;

  return (
    <div className="month-calendar">
      {studentName && role === 'coach' && (
        <div className="calendar-student-name">{studentName}</div>
      )}

      {/* Month navigation */}
      <div className="calendar-nav">
        <button type="button" className="btn btn-sm" onClick={prevMonth}>{t('calendar_prev_month')}</button>
        <span className="calendar-month-label">{monthNames[month]} {year}</span>
        <button type="button" className="btn btn-sm" onClick={nextMonth}>{t('calendar_next_month')}</button>
      </div>

      {loading && <div className="calendar-loading">{t('loading')}</div>}

      {/* Weekday headers */}
      <div className="calendar-grid calendar-header">
        {WEEKDAY_KEYS.map((key) => (
          <div key={key} className="calendar-weekday">{t(key)}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="calendar-grid calendar-body">
        {cells.map((cell, idx) => {
          const key = dateKey(cell.year, cell.month, cell.day);
          const isToday = key === todayKey;
          const workouts = workoutMap[key];
          const workout = workouts?.[0];

          return (
            <div
              key={idx}
              className={`calendar-cell ${!cell.isCurrentMonth ? 'calendar-cell-muted' : ''} ${isToday ? 'calendar-cell-today' : ''}`}
              onClick={() => cell.isCurrentMonth && setSelectedDate(key)}
            >
              <span className="calendar-day-number">
                {cell.day}
                {isToday && <span className="calendar-today-badge">{t('calendar_today')}</span>}
              </span>
              {workout && (
                <div className={`calendar-workout calendar-workout-${workout.status}`}>
                  <div className="calendar-workout-title">{workout.title}</div>
                  <div className="calendar-workout-status">
                    {workout.status === 'pending' && '⏳'}
                    {workout.status === 'completed' && '✅'}
                    {workout.status === 'skipped' && '⊘'}
                    {' '}{t(`assigned_status_${workout.status}`)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day modal */}
      {selectedDate && (
        <DayModal
          date={selectedDate}
          workout={selectedWorkout}
          role={role}
          studentId={studentId}
          onClose={() => setSelectedDate(null)}
          onRefresh={() => { setSelectedDate(null); fetchWorkouts(); }}
        />
      )}
    </div>
  );
}
