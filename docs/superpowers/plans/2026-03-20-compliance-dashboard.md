# Weekly Compliance Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `WeeklyComplianceDashboard` component to `CoachDashboard` that shows per-student compliance for the current or previous calendar week, with mini stats (al día / con pendientes / sin actividad / total) and a grid of daily status icons.

**Architecture:** The component fetches 7 parallel calls to the existing `getDailySummary(date)` endpoint (one per day, Monday–Sunday) and builds a student × day matrix in the frontend. No backend changes required. Helper functions for week date logic and compliance calculations live in a separate utility file.

**Tech Stack:** React 19, TypeScript, CSS modules pattern (single `.css` file per component), existing `getDailySummary` from `src/api/coach.ts`.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/weekCompliance.ts` | Create | Pure helper functions: week dates, compliance stats, cell status logic |
| `src/components/WeeklyComplianceDashboard.tsx` | Create | Main component: fetches data, renders stats + table |
| `src/components/WeeklyComplianceDashboard.css` | Create | Scoped styles |
| `src/pages/CoachDashboard.tsx` | Modify | Import and render `WeeklyComplianceDashboard` |

---

## Task 1: Week utility helpers

**Files:**
- Create: `src/utils/weekCompliance.ts`

### Context

All logic here is pure (no React, no API calls). This makes it easy to reason about and manually verify in the browser console.

- `getWeekDates(selection)` — returns 7 `YYYY-MM-DD` strings for Mon–Sun of the selected week.
- `getCompliancePercent(items, today)` — given a student's 7 `DailySummaryItem | null` entries, returns the % of completed sessions over assigned sessions (ignoring days with no assignment).
- `getComplianceColor(pct)` — returns a CSS color string based on percentage thresholds.
- `getStudentCategory(items, today)` — returns `'on_track' | 'has_pending' | 'no_activity'` per the spec logic.
- `getCellStatus(item, dateStr, today)` — returns `'completed' | 'skipped' | 'pending' | 'none'` for a single cell.

### "Al día" logic

A student is `on_track` if they have **no** assigned workout with `status === 'pending'` on a past day (date < today) in the week. Days with no assignment are neutral. A student with zero assignments in the week is `no_activity`.

- [ ] **Step 1: Create `src/utils/weekCompliance.ts`**

```ts
import type { DailySummaryItem } from '../types';

export type WeekSelection = 'current' | 'previous';
export type StudentCategory = 'on_track' | 'has_pending' | 'no_activity';
export type CellStatus = 'completed' | 'skipped' | 'pending' | 'none';

/**
 * Returns the Monday of the ISO week containing `date`.
 */
function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns 7 date strings YYYY-MM-DD for Mon–Sun of the selected week.
 */
export function getWeekDates(selection: WeekSelection): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = getMondayOf(today);
  if (selection === 'previous') {
    monday.setDate(monday.getDate() - 7);
  }
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  });
}

/**
 * Returns the status icon to show in a cell.
 * - 'none': no workout assigned that day
 * - 'completed' / 'skipped' / 'pending': based on assigned_workout.status
 */
export function getCellStatus(item: DailySummaryItem | null): CellStatus {
  if (!item || !item.assigned_workout) return 'none';
  const s = item.assigned_workout.status;
  if (s === 'completed') return 'completed';
  if (s === 'skipped') return 'skipped';
  return 'pending';
}

/**
 * Percent of completed sessions out of assigned sessions.
 * Days without an assignment are excluded from the denominator.
 * Returns null if the student has no assignments at all.
 */
export function getCompliancePercent(dayItems: (DailySummaryItem | null)[]): number | null {
  const assigned = dayItems.filter(i => i?.assigned_workout != null);
  if (assigned.length === 0) return null;
  const completed = assigned.filter(i => i?.assigned_workout?.status === 'completed').length;
  return Math.round((completed / assigned.length) * 100);
}

/**
 * Returns the CSS color for a compliance percentage.
 */
export function getComplianceColor(pct: number): string {
  if (pct >= 100) return '#86efac';
  if (pct >= 80)  return '#4ade80';
  if (pct >= 50)  return '#fbbf24';
  return '#f87171';
}

/**
 * Classifies a student's compliance status for the mini stats.
 * Uses today to determine which days are "past".
 */
export function getStudentCategory(
  dayItems: (DailySummaryItem | null)[],
  dates: string[],
  today: string
): StudentCategory {
  const hasAnyAssignment = dayItems.some(i => i?.assigned_workout != null);
  if (!hasAnyAssignment) return 'no_activity';

  const hasPendingInPast = dayItems.some((item, idx) => {
    if (dates[idx] >= today) return false;
    return item?.assigned_workout?.status === 'pending';
  });

  return hasPendingInPast ? 'has_pending' : 'on_track';
}

/**
 * Aggregates km planned and completed for a student across 7 days.
 * Returns null for planned if no workouts have a distance.
 */
export function getKmSummary(dayItems: (DailySummaryItem | null)[]): {
  planned: number | null;
  completed: number;
} {
  let planned = 0;
  let hasPlanned = false;
  let completed = 0;

  for (const item of dayItems) {
    if (!item?.assigned_workout) continue;
    const aw = item.assigned_workout;
    if (aw.distance_km > 0) {
      planned += aw.distance_km;
      hasPlanned = true;
    }
    if (aw.status === 'completed' && aw.result_distance_km != null) {
      completed += aw.result_distance_km;
    } else if (aw.status === 'completed' && aw.distance_km > 0) {
      completed += aw.distance_km;
    }
  }

  return { planned: hasPlanned ? planned : null, completed };
}
```

- [ ] **Step 2: Verify helpers manually**

Run the dev server and open the browser console. Paste:
```js
// Quick sanity check — today should be in the 'current' week result
import('/src/utils/weekCompliance.ts').then(m => {
  console.log('Current week:', m.getWeekDates('current'));
  console.log('Previous week:', m.getWeekDates('previous'));
});
```
Expected: current week starts on a Monday, previous week starts 7 days earlier.

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/utils/weekCompliance.ts
git commit -m "feat: add week compliance utility helpers"
```

---

## Task 2: WeeklyComplianceDashboard component

**Files:**
- Create: `src/components/WeeklyComplianceDashboard.tsx`
- Create: `src/components/WeeklyComplianceDashboard.css`

### Context

The component:
1. Receives `students: Student[]` as a prop (already loaded in `CoachDashboard`).
2. On mount and when week selection changes, fires 7 parallel `getDailySummary(date)` calls.
3. Combines results into `Map<studentId, DailySummaryItem | null>[]` indexed by day (0=Mon … 6=Sun).
4. Renders: mini stats row + table.

The student list in each daily summary response may vary (students added after today won't appear in past days). The canonical student list is the `students` prop — use it to build rows, filling missing days with `null`.

### Day labels

```ts
const DAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
```

### Cell icons

```ts
const CELL_ICON: Record<CellStatus, string> = {
  completed: '✅',
  skipped:   '❌',
  pending:   '⏳',
  none:      '—',
};
```

- [ ] **Step 1: Create `src/components/WeeklyComplianceDashboard.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  const [weekSelection, setWeekSelection] = useState<WeekSelection>('current');
  const [dayMatrix, setDayMatrix] = useState<DayMatrix | null>(null);
  const [weekDates, setWeekDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (students.length === 0) return;
    const dates = getWeekDates(weekSelection);
    setWeekDates(dates);
    loadWeek(dates);
  }, [weekSelection, students]);

  async function loadWeek(dates: string[]) {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        dates.map(date => getDailySummary(date))
      );

      const matrix: DayMatrix = results.map(result => {
        const map = new Map<number, DailySummaryItem | null>();
        // Initialize all students to null
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
      setLoading(false);
    }
  }

  if (students.length === 0) return null;

  // Build per-student row data
  const today = new Date().toISOString().slice(0, 10);

  const rows = students.map(student => {
    const dayItems = dayMatrix
      ? dayMatrix.map(dayMap => dayMap.get(student.id) ?? null)
      : Array(7).fill(null);

    const pct = dayMatrix ? getCompliancePercent(dayItems) : null;
    const km = dayMatrix ? getKmSummary(dayItems) : null;
    const category = dayMatrix ? getStudentCategory(dayItems, weekDates, today) : null;

    return { student, dayItems, pct, km, category };
  });

  // Sort: highest % first; null % (no activity) goes last
  rows.sort((a, b) => {
    if (a.pct === null && b.pct === null) return 0;
    if (a.pct === null) return 1;
    if (b.pct === null) return -1;
    return b.pct - a.pct;
  });

  // Mini stats
  const stats = {
    on_track:    rows.filter(r => r.category === 'on_track').length,
    has_pending: rows.filter(r => r.category === 'has_pending').length,
    no_activity: rows.filter(r => r.category === 'no_activity').length,
  };

  // Week header label  e.g. "17–23 Mar"
  const weekLabel = weekDates.length === 7
    ? formatWeekLabel(weekDates[0], weekDates[6])
    : '';

  return (
    <div className="coach-section weekly-compliance">
      <div className="coach-section-header">
        <div className="weekly-compliance-title">
          <h2>Cumplimiento semanal</h2>
          {weekLabel && <span className="weekly-compliance-range">{weekLabel}</span>}
        </div>
        <div className="weekly-compliance-week-toggle">
          <button
            className={`btn btn-sm${weekSelection === 'previous' ? ' btn-primary' : ''}`}
            onClick={() => setWeekSelection('previous')}
          >
            ← Sem. ant.
          </button>
          <button
            className={`btn btn-sm${weekSelection === 'current' ? ' btn-primary' : ''}`}
            onClick={() => setWeekSelection('current')}
          >
            Esta sem.
          </button>
        </div>
      </div>

      {/* Mini stats */}
      <div className="weekly-compliance-stats">
        <div className="weekly-compliance-stat weekly-compliance-stat--green">
          <span className="weekly-compliance-stat-value">{stats.on_track}</span>
          <span className="weekly-compliance-stat-label">AL DÍA</span>
        </div>
        <div className="weekly-compliance-stat weekly-compliance-stat--yellow">
          <span className="weekly-compliance-stat-value">{stats.has_pending}</span>
          <span className="weekly-compliance-stat-label">CON PENDIENTES</span>
        </div>
        <div className="weekly-compliance-stat weekly-compliance-stat--red">
          <span className="weekly-compliance-stat-value">{stats.no_activity}</span>
          <span className="weekly-compliance-stat-label">SIN ACTIVIDAD</span>
        </div>
        <div className="weekly-compliance-stat weekly-compliance-stat--neutral">
          <span className="weekly-compliance-stat-value">{students.length}</span>
          <span className="weekly-compliance-stat-label">TOTAL</span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading">Cargando...</div>
      ) : (
        <div className="weekly-compliance-table-wrapper">
          <table className="weekly-compliance-table">
            <thead>
              <tr>
                <th className="col-student">Alumno</th>
                {DAY_LABELS.map((label, i) => (
                  <th key={label} className="col-day">
                    {label}
                    {weekDates[i] && (
                      <span className="day-number">
                        {weekDates[i].slice(8)} {/* DD */}
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
                      <td key={i} className={`col-day cell-${status}`}>
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
            <span>✅ completado</span>
            <span>❌ saltado</span>
            <span>⏳ pendiente</span>
            <span>— sin entreno</span>
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
```

- [ ] **Step 2: Create `src/components/WeeklyComplianceDashboard.css`**

```css
/* ---- Weekly Compliance Dashboard ---- */

.weekly-compliance-title {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.weekly-compliance-title h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.weekly-compliance-range {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.weekly-compliance-week-toggle {
  display: flex;
  gap: 0.5rem;
}

/* Mini stats */
.weekly-compliance-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.weekly-compliance-stat {
  border-radius: 10px;
  padding: 0.875rem 1rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border: 1px solid transparent;
}

.weekly-compliance-stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
}

.weekly-compliance-stat-label {
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  opacity: 0.8;
}

.weekly-compliance-stat--green {
  background: rgba(74, 222, 128, 0.08);
  border-color: rgba(74, 222, 128, 0.2);
  color: #4ade80;
}

.weekly-compliance-stat--yellow {
  background: rgba(251, 191, 36, 0.08);
  border-color: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.weekly-compliance-stat--red {
  background: rgba(248, 113, 113, 0.08);
  border-color: rgba(248, 113, 113, 0.2);
  color: #f87171;
}

.weekly-compliance-stat--neutral {
  background: var(--bg-card);
  border-color: var(--border);
  color: var(--text-primary);
}

/* Table */
.weekly-compliance-table-wrapper {
  overflow-x: auto;
}

.weekly-compliance-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.weekly-compliance-table thead tr {
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
}

.weekly-compliance-table th {
  padding: 0.5rem 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.weekly-compliance-table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.weekly-compliance-table tbody tr:last-child td {
  border-bottom: none;
}

.col-student {
  text-align: left;
  min-width: 140px;
}

.col-day {
  text-align: center;
  min-width: 44px;
}

.col-pct {
  text-align: right;
  font-weight: 600;
  min-width: 48px;
}

.col-km {
  text-align: right;
  color: var(--text-secondary);
  font-size: 0.8rem;
  min-width: 64px;
}

.day-number {
  display: block;
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.6;
}

.cell-none {
  color: var(--text-secondary);
  opacity: 0.4;
}

.student-link {
  color: var(--text-primary);
  text-decoration: none;
  font-weight: 500;
}

.student-link:hover {
  color: var(--accent);
  text-decoration: underline;
}

/* Legend */
.weekly-compliance-legend {
  display: flex;
  gap: 1.25rem;
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

/* Responsive */
@media (max-width: 600px) {
  .weekly-compliance-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .weekly-compliance-table th,
  .weekly-compliance-table td {
    padding: 0.5rem 0.4rem;
    font-size: 0.8rem;
  }
}
```

- [ ] **Step 3: Start dev server and verify component builds**

```bash
cd ~/Desktop/FitReg/FitRegFE
npm run dev
```

Expected: no TypeScript errors in terminal.

- [ ] **Step 4: Commit**

```bash
git add src/components/WeeklyComplianceDashboard.tsx src/components/WeeklyComplianceDashboard.css src/utils/weekCompliance.ts
git commit -m "feat: add WeeklyComplianceDashboard component"
```

---

## Task 3: Integration in CoachDashboard

**Files:**
- Modify: `src/pages/CoachDashboard.tsx`

### Context

Add `<WeeklyComplianceDashboard students={students} />` inside `CoachDashboard`, after the existing `.coach-stats` block and before the `.coach-section` with the student list. This places it prominently at the top of the page, below the quick-stats row.

- [ ] **Step 1: Add import to `CoachDashboard.tsx`**

In `src/pages/CoachDashboard.tsx`, add this import after the existing component imports (line ~9):

```tsx
import WeeklyComplianceDashboard from '../components/WeeklyComplianceDashboard';
```

- [ ] **Step 2: Render the component**

In the JSX of `CoachDashboard`, after the closing `</div>` of `.coach-stats` (around line 114) and before the opening `<div className="coach-section">`, add:

```tsx
<WeeklyComplianceDashboard students={students} />
```

The relevant section in the JSX looks like:
```tsx
      {/* ... existing coach-stats block ... */}
      </div>  {/* ← end of .coach-stats */}

      <WeeklyComplianceDashboard students={students} />  {/* ← ADD HERE */}

      <div className="coach-section">
        <div className="coach-section-header">
```

- [ ] **Step 3: Verify in browser**

With the dev server running, navigate to the Coach Dashboard. Check:
- [ ] Section "Cumplimiento semanal" appears below the stats cards
- [ ] Mini stats show correct counts (al día / con pendientes / sin actividad / total)
- [ ] Table shows one row per student with day icons
- [ ] "← Sem. ant." toggle loads previous week data
- [ ] "Esta sem." toggle returns to current week
- [ ] Student name links navigate to `/coach/students/:id`
- [ ] No console errors

- [ ] **Step 4: Check edge cases**

- [ ] If the coach has no students, the section does not render
- [ ] Days with no workout assigned show `—`
- [ ] Students with all assignments completed show green `%`

- [ ] **Step 5: Final commit**

```bash
git add src/pages/CoachDashboard.tsx
git commit -m "feat: integrate WeeklyComplianceDashboard in CoachDashboard"
```

---

## Done

All three tasks complete. The compliance dashboard is live in `CoachDashboard`. No backend changes, no new API endpoints, no new TypeScript types.
