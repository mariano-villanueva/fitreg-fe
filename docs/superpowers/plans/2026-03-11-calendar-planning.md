# Calendar Planning View Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace list/card views for assigned workouts with a monthly calendar view where coaches plan and students complete workouts.

**Architecture:** Custom CSS grid calendar component (`MonthCalendar`) shared between coach and student pages with role-based actions. A `DayModal` handles all day-level interactions. The existing `AssignWorkoutForm` is refactored into a reusable `AssignWorkoutFields` component rendered inline in the modal. Backend gets date-range filtering on two endpoints.

**Tech Stack:** React 19 + TypeScript, pure CSS (dark theme), Go backend with MySQL

**Spec:** `docs/superpowers/specs/2026-03-11-calendar-planning-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/MonthCalendar.tsx` | Calendar grid, month navigation, workout display per day |
| Create | `src/components/DayModal.tsx` | Day detail modal: view/create/edit/delete/complete/skip |
| Create | `src/components/AssignWorkoutFields.tsx` | Extracted form fields for creating/editing assigned workouts |
| Modify | `src/pages/AssignWorkoutForm.tsx` | Thin wrapper around AssignWorkoutFields |
| Rewrite | `src/pages/MyAssignedWorkouts.tsx` | Replace cards/table with MonthCalendar (student role) |
| Rewrite | `src/pages/StudentWorkouts.tsx` | Replace cards/table with MonthCalendar (coach role) |
| Modify | `src/api/coach.ts` | Add date range params to list functions |
| Modify | `src/App.css` | Calendar grid + DayModal styles |
| Modify | `src/i18n/es.ts` | Spanish translations |
| Modify | `src/i18n/en.ts` | English translations |
| Modify | `handlers/coach_handler.go` (API repo) | Date range filtering on 2 endpoints |

---

## Chunk 1: Backend + API Layer

### Task 1: Backend — Add date range filtering to ListAssignedWorkouts

**Files:**
- Modify: `~/Desktop/FitReg/FitRegAPI/handlers/coach_handler.go:262-268`

- [ ] **Step 1: Add start_date/end_date query param parsing**

In `ListAssignedWorkouts`, after the `statusFilter` block (line 268), add date range filtering:

```go
// After line 268 (after statusFilter block), before line 270 (ORDER BY)
startDate := r.URL.Query().Get("start_date")
endDate := r.URL.Query().Get("end_date")
if startDate != "" && endDate != "" {
    query += " AND aw.due_date >= ? AND aw.due_date <= ?"
    args = append(args, startDate, endDate)
}
```

Also add the same filter to the count query (after line 300):

```go
if startDate != "" && endDate != "" {
    countQuery += " AND aw.due_date >= ? AND aw.due_date <= ?"
    countArgs = append(countArgs, startDate, endDate)
}
```

- [ ] **Step 2: Test manually**

```bash
cd ~/Desktop/FitReg/FitRegAPI
export $(cat .env | xargs)
go build ./...
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/FitReg/FitRegAPI
git add handlers/coach_handler.go
git commit -m "feat: add date range filtering to ListAssignedWorkouts"
```

### Task 2: Backend — Add date range filtering to GetMyAssignedWorkouts

**Files:**
- Modify: `~/Desktop/FitReg/FitRegAPI/handlers/coach_handler.go:703-761`

- [ ] **Step 1: Refactor query to use dynamic WHERE clause**

Replace the static query with a dynamic one that supports optional date filtering. Change lines 711-721:

```go
query := `
    SELECT aw.id, aw.coach_id, aw.student_id, aw.title, aw.description, aw.type,
        aw.distance_km, aw.duration_seconds, aw.notes, aw.expected_fields,
        aw.result_time_seconds, aw.result_distance_km, aw.result_heart_rate, aw.result_feeling,
        aw.image_file_id, aw.status, aw.due_date,
        aw.created_at, aw.updated_at, u.name as coach_name
    FROM assigned_workouts aw
    JOIN users u ON u.id = aw.coach_id
    WHERE aw.student_id = ?
`
args := []interface{}{userID}

startDate := r.URL.Query().Get("start_date")
endDate := r.URL.Query().Get("end_date")
if startDate != "" && endDate != "" {
    query += " AND aw.due_date >= ? AND aw.due_date <= ?"
    args = append(args, startDate, endDate)
}

query += " ORDER BY aw.due_date ASC"

rows, err := h.DB.Query(query, args...)
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/Desktop/FitReg/FitRegAPI
go build ./...
```

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/FitReg/FitRegAPI
git add handlers/coach_handler.go
git commit -m "feat: add date range filtering to GetMyAssignedWorkouts"
```

### Task 3: Frontend API — Add date range params

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/api/coach.ts:9-17,42`

- [ ] **Step 1: Update listAssignedWorkouts**

Replace lines 9-17:

```ts
export const listAssignedWorkouts = (studentId?: number, status?: string, page?: number, limit?: number, startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  if (studentId) params.set('student_id', String(studentId));
  if (status) params.set('status', status);
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  const qs = params.toString();
  return client.get<AssignedWorkout[] | { data: AssignedWorkout[]; total: number }>(`/coach/assigned-workouts${qs ? `?${qs}` : ''}`);
};
```

- [ ] **Step 2: Update getMyAssignedWorkouts**

Replace line 42:

```ts
export const getMyAssignedWorkouts = (startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  const qs = params.toString();
  return client.get<AssignedWorkout[]>(`/my-assigned-workouts${qs ? `?${qs}` : ''}`);
};
```

- [ ] **Step 3: Verify FE compiles**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

Expected: no errors (existing callers are compatible since new params are optional).

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/api/coach.ts
git commit -m "feat: add date range params to assigned workout API functions"
```

---

## Chunk 2: i18n Keys

### Task 4: Add calendar translation keys

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/i18n/es.ts`
- Modify: `~/Desktop/FitReg/FitRegFE/src/i18n/en.ts`

- [ ] **Step 1: Add Spanish keys**

Add these keys to `es.ts` (in the appropriate alphabetical section):

```ts
// Calendar
calendar_title: 'Calendario de Entrenamientos',
calendar_prev_month: 'Anterior',
calendar_next_month: 'Siguiente',
calendar_today: 'HOY',
calendar_no_workout: 'No hay entrenamiento asignado para este día',
calendar_assign: 'Asignar entrenamiento',
calendar_results: 'RESULTADOS',
calendar_structure: 'ESTRUCTURA',
calendar_coach_notes: 'NOTAS DEL COACH',
calendar_edit: 'Editar',
calendar_delete: 'Eliminar',
calendar_confirm_delete: '¿Estás seguro de que querés eliminar este entrenamiento?',
weekday_sun: 'DOM',
weekday_mon: 'LUN',
weekday_tue: 'MAR',
weekday_wed: 'MIÉ',
weekday_thu: 'JUE',
weekday_fri: 'VIE',
weekday_sat: 'SÁB',
```

- [ ] **Step 2: Add English keys**

Add these keys to `en.ts`:

```ts
// Calendar
calendar_title: 'Training Calendar',
calendar_prev_month: 'Previous',
calendar_next_month: 'Next',
calendar_today: 'TODAY',
calendar_no_workout: 'No workout assigned for this day',
calendar_assign: 'Assign workout',
calendar_results: 'RESULTS',
calendar_structure: 'STRUCTURE',
calendar_coach_notes: 'COACH NOTES',
calendar_edit: 'Edit',
calendar_delete: 'Delete',
calendar_confirm_delete: 'Are you sure you want to delete this workout?',
weekday_sun: 'SUN',
weekday_mon: 'MON',
weekday_tue: 'TUE',
weekday_wed: 'WED',
weekday_thu: 'THU',
weekday_fri: 'FRI',
weekday_sat: 'SAT',
```

- [ ] **Step 3: Verify FE compiles**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/i18n/es.ts src/i18n/en.ts
git commit -m "feat: add calendar i18n keys for es and en"
```

---

## Chunk 3: MonthCalendar Component

### Task 5: Create MonthCalendar component

**Files:**
- Create: `~/Desktop/FitReg/FitRegFE/src/components/MonthCalendar.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
        <button className="btn btn-sm" onClick={prevMonth}>{t('calendar_prev_month')}</button>
        <span className="calendar-month-label">{monthNames[month]} {year}</span>
        <button className="btn btn-sm" onClick={nextMonth}>{t('calendar_next_month')}</button>
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
```

- [ ] **Step 2: Verify it compiles** (will fail until DayModal exists — that's expected)

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit 2>&1 | head -5
```

Expected: error about `DayModal` not found. This is correct — we create it next.

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/components/MonthCalendar.tsx
git commit -m "feat: create MonthCalendar component"
```

---

## Chunk 4: AssignWorkoutFields + DayModal

### Task 6: Extract AssignWorkoutFields from AssignWorkoutForm

**Files:**
- Create: `~/Desktop/FitReg/FitRegFE/src/components/AssignWorkoutFields.tsx`
- Modify: `~/Desktop/FitReg/FitRegFE/src/pages/AssignWorkoutForm.tsx`

- [ ] **Step 1: Create AssignWorkoutFields**

```tsx
import { useState, useEffect } from "react";
import { createAssignedWorkout, getAssignedWorkout, updateAssignedWorkout } from "../api/coach";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import SegmentBuilder from "./SegmentBuilder";
import type { WorkoutSegment, ExpectedField, AssignedWorkout } from "../types";

const EXPECTED_FIELD_OPTIONS: ExpectedField[] = ['time', 'distance', 'heart_rate', 'feeling'];

interface AssignWorkoutFieldsProps {
  studentId: number;
  dueDate: string;
  existingWorkout?: AssignedWorkout;
  onSave: () => void;
  onCancel: () => void;
}

export default function AssignWorkoutFields({ studentId, dueDate, existingWorkout, onSave, onCancel }: AssignWorkoutFieldsProps) {
  const { t } = useTranslation();
  const { showError } = useFeedback();
  const isEdit = !!existingWorkout;

  const [title, setTitle] = useState(existingWorkout?.title || "");
  const [description, setDescription] = useState(existingWorkout?.description || "");
  const [type, setType] = useState(existingWorkout?.type || "easy");
  const [segments, setSegments] = useState<WorkoutSegment[]>(existingWorkout?.segments || []);
  const [date, setDate] = useState(existingWorkout?.due_date?.slice(0, 10) || dueDate);
  const [notes, setNotes] = useState(existingWorkout?.notes || "");
  const [expectedFields, setExpectedFields] = useState<ExpectedField[]>(existingWorkout?.expected_fields || []);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      student_id: studentId,
      title,
      description,
      type,
      distance_km: 0,
      duration_seconds: 0,
      notes,
      expected_fields: expectedFields,
      due_date: date,
      segments,
    };

    try {
      if (isEdit && existingWorkout) {
        await updateAssignedWorkout(existingWorkout.id, payload);
      } else {
        await createAssignedWorkout(payload);
      }
      onSave();
    } catch {
      showError(isEdit ? "Failed to update workout." : "Failed to assign workout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="workout-form calendar-inline-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="assign-title">{t('assigned_title')}</label>
        <input
          id="assign-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="assign-description">{t('assigned_description')}</label>
        <textarea
          id="assign-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div className="form-group">
        <label htmlFor="assign-type">{t('field_type')}</label>
        <select
          id="assign-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="easy">{t('type_easy')}</option>
          <option value="tempo">{t('type_tempo')}</option>
          <option value="intervals">{t('type_intervals')}</option>
          <option value="long_run">{t('type_long_run')}</option>
          <option value="race">{t('type_race')}</option>
          <option value="fartlek">{t('type_fartlek')}</option>
          <option value="other">{t('type_other')}</option>
        </select>
      </div>

      <SegmentBuilder segments={segments} onChange={setSegments} />

      <div className="form-group">
        <label htmlFor="assign-due-date">{t('assigned_due_date')}</label>
        <input
          id="assign-due-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="assign-notes">{t('field_notes')}</label>
        <textarea
          id="assign-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      <div className="form-group">
        <label><strong>{t('expected_fields_label')}</strong></label>
        <p className="form-hint">{t('expected_fields_hint')}</p>
        {EXPECTED_FIELD_OPTIONS.map((field) => (
          <label key={field} className="checkbox-label">
            <input
              type="checkbox"
              checked={expectedFields.includes(field)}
              onChange={(e) => {
                if (e.target.checked) {
                  setExpectedFields([...expectedFields, field]);
                } else {
                  setExpectedFields(expectedFields.filter((f) => f !== field));
                }
              }}
            />
            <span>{t(`expected_field_${field}`)}</span>
          </label>
        ))}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('form_saving') : t('form_save')}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t('form_cancel')}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Refactor AssignWorkoutForm to use AssignWorkoutFields**

Replace the entire content of `src/pages/AssignWorkoutForm.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAssignedWorkout } from "../api/coach";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import AssignWorkoutFields from "../components/AssignWorkoutFields";
import type { AssignedWorkout } from "../types";

export default function AssignWorkoutForm() {
  const { studentId, id } = useParams<{ studentId?: string; id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showError } = useFeedback();
  const [loading, setLoading] = useState(false);
  const [existingWorkout, setExistingWorkout] = useState<AssignedWorkout | undefined>();
  const [resolvedStudentId, setResolvedStudentId] = useState(Number(studentId) || 0);

  useEffect(() => {
    if (isEdit && id) {
      loadWorkout();
    }
  }, [id]);

  async function loadWorkout() {
    setLoading(true);
    try {
      const res = await getAssignedWorkout(Number(id));
      setExistingWorkout(res.data);
      setResolvedStudentId(res.data.student_id);
    } catch {
      showError("Failed to load workout.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="page">
      <h1>{isEdit ? t('assigned_edit') : t('assigned_new')}</h1>
      <AssignWorkoutFields
        studentId={resolvedStudentId}
        dueDate=""
        existingWorkout={existingWorkout}
        onSave={() => {
          navigate(`/coach/students/${resolvedStudentId}`, {
            state: { feedback: isEdit ? t('assigned_workout_updated') : t('assigned_workout_created') }
          });
        }}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit 2>&1 | head -5
```

Expected: only DayModal error remains (from MonthCalendar).

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/components/AssignWorkoutFields.tsx src/pages/AssignWorkoutForm.tsx
git commit -m "refactor: extract AssignWorkoutFields from AssignWorkoutForm"
```

### Task 7: Create DayModal component

**Files:**
- Create: `~/Desktop/FitReg/FitRegFE/src/components/DayModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import { deleteAssignedWorkout, updateAssignedWorkoutStatus } from "../api/coach";
import type { AssignedWorkout, FileResponse } from "../types";
import SegmentDisplay from "./SegmentDisplay";
import AssignWorkoutFields from "./AssignWorkoutFields";
import ImageUpload from "./ImageUpload";

interface DayModalProps {
  date: string;
  workout: AssignedWorkout | null;
  role: 'coach' | 'student';
  studentId?: number;
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

const TYPE_COLORS: Record<string, string> = {
  easy: '#4a9eff',
  tempo: '#f59e0b',
  intervals: '#ef4444',
  long_run: '#8b5cf6',
  race: '#ec4899',
  fartlek: '#14b8a6',
  other: '#6b7280',
};

export default function DayModal({ date, workout, role, studentId, onClose, onRefresh }: DayModalProps) {
  const { t, i18n } = useTranslation();
  const { showSuccess, showError, showWarning } = useFeedback();
  const [view, setView] = useState<ModalView>('detail');

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

        {/* CREATE / EDIT view */}
        {(view === 'create' || view === 'edit') && (
          <AssignWorkoutFields
            studentId={studentId || workout?.student_id || 0}
            dueDate={date}
            existingWorkout={view === 'edit' ? workout || undefined : undefined}
            onSave={() => { showSuccess(view === 'edit' ? t('assigned_workout_updated') : t('assigned_workout_created')); onRefresh(); }}
            onCancel={() => setView('detail')}
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
                {/* Workout card */}
                <div className="day-modal-card" style={{ borderLeftColor: statusColor }}>
                  <div className="day-modal-card-top">
                    <div>
                      <div className="day-modal-card-title">{workout.title}</div>
                      <div className="day-modal-card-meta">
                        {workout.type && (
                          <span className="day-modal-type-badge" style={{ color: TYPE_COLORS[workout.type] || '#888' }}>
                            {workout.type}
                          </span>
                        )}
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

                  {/* Segments */}
                  {workout.segments && workout.segments.length > 0 && (
                    <div className="day-modal-section">
                      <div className="day-modal-section-label">{t('calendar_structure')}</div>
                      <SegmentDisplay segments={workout.segments} />
                    </div>
                  )}

                  {/* Notes */}
                  {workout.notes && (
                    <div className="day-modal-section">
                      <div className="day-modal-section-label">
                        {role === 'student' ? t('calendar_coach_notes') : t('field_notes')}
                      </div>
                      <div className="day-modal-notes">{workout.notes}</div>
                    </div>
                  )}

                  {/* Results (completed) */}
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

                {/* Action buttons */}
                {role === 'coach' && (
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
                  <button className="btn btn-primary" onClick={() => setView('create')}>
                    + {t('calendar_assign')}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/components/DayModal.tsx
git commit -m "feat: create DayModal component with CRUD and complete/skip"
```

---

## Chunk 5: CSS Styles

### Task 8: Add calendar and modal CSS

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/App.css`

- [ ] **Step 1: Add calendar styles**

Append to the end of `App.css`:

```css
/* =============================================
   MONTH CALENDAR
   ============================================= */
.month-calendar {
  width: 100%;
}

.calendar-student-name {
  color: #e0e0e0;
  font-size: 14px;
  margin-bottom: 8px;
  opacity: 0.7;
}

.calendar-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  margin-bottom: 8px;
}

.calendar-month-label {
  color: #e0e0e0;
  font-size: 18px;
  font-weight: 600;
}

.calendar-loading {
  text-align: center;
  color: #888;
  padding: 8px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.calendar-header {
  text-align: center;
  padding: 8px 0;
  border-bottom: 1px solid #2a2a4a;
}

.calendar-weekday {
  color: #888;
  font-size: 12px;
  font-weight: 600;
}

.calendar-body {
  gap: 1px;
  background: #2a2a4a;
}

.calendar-cell {
  background: #1a1a2e;
  min-height: 90px;
  padding: 6px;
  cursor: pointer;
  position: relative;
  transition: background 0.15s;
}

.calendar-cell:hover {
  background: #1e1e3a;
}

.calendar-cell-muted {
  background: #141428;
  cursor: default;
}

.calendar-cell-muted:hover {
  background: #141428;
}

.calendar-cell-muted .calendar-day-number {
  color: #555;
}

.calendar-cell-today {
  box-shadow: inset 0 0 0 2px #6366f1;
  border-radius: 4px;
}

.calendar-day-number {
  color: #e0e0e0;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.calendar-today-badge {
  font-size: 9px;
  color: #6366f1;
  font-weight: 700;
}

.calendar-workout {
  margin-top: 4px;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 11px;
  border-left: 3px solid;
}

.calendar-workout-pending {
  background: #1e3a5f;
  border-left-color: #4a9eff;
}

.calendar-workout-completed {
  background: #1a3a2a;
  border-left-color: #4ade80;
}

.calendar-workout-skipped {
  background: #3a2a1a;
  border-left-color: #888;
}

.calendar-workout-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.calendar-workout-pending .calendar-workout-title { color: #4a9eff; }
.calendar-workout-completed .calendar-workout-title { color: #4ade80; }
.calendar-workout-skipped .calendar-workout-title { color: #888; }

.calendar-workout-status {
  color: #888;
  font-size: 10px;
}

/* Responsive: horizontal scroll on mobile */
@media (max-width: 640px) {
  .calendar-grid {
    min-width: 560px;
  }
  .month-calendar {
    overflow-x: auto;
  }
}

/* =============================================
   DAY MODAL
   ============================================= */
.day-modal {
  max-width: 520px;
  width: 95vw;
  max-height: 85vh;
  overflow-y: auto;
}

.day-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.day-modal-weekday {
  color: #888;
  font-size: 12px;
}

.day-modal-date {
  color: #e0e0e0;
  font-size: 20px;
  font-weight: 700;
}

.day-modal-close {
  background: #333;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #888;
  font-size: 16px;
  transition: background 0.15s;
}

.day-modal-close:hover {
  background: #444;
}

.day-modal-card {
  background: #1e1e3a;
  border-radius: 10px;
  padding: 16px;
  border-left: 4px solid;
  margin-bottom: 16px;
}

.day-modal-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.day-modal-card-title {
  color: #e0e0e0;
  font-size: 16px;
  font-weight: 600;
}

.day-modal-card-meta {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  flex-wrap: wrap;
  color: #888;
  font-size: 12px;
}

.day-modal-type-badge {
  font-weight: 600;
  font-size: 11px;
}

.day-modal-status {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.day-modal-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #2a2a4a;
}

.day-modal-section-label {
  color: #888;
  font-size: 11px;
  margin-bottom: 6px;
  font-weight: 600;
}

.day-modal-notes {
  color: #aaa;
  font-size: 13px;
}

.day-modal-results-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.day-modal-result-label {
  color: #666;
  font-size: 10px;
  text-transform: uppercase;
}

.day-modal-result-value {
  color: #e0e0e0;
  font-size: 14px;
  font-weight: 500;
}

.day-modal-actions {
  display: flex;
  gap: 10px;
}

.day-modal-actions .btn {
  flex: 1;
}

.day-modal-empty {
  text-align: center;
  padding: 40px 20px;
}

.day-modal-empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.day-modal-empty p {
  color: #888;
  font-size: 14px;
  margin-bottom: 20px;
}

.day-modal-confirm {
  padding: 8px 0;
}

.day-modal-confirm h3 {
  margin-bottom: 8px;
}

.day-modal-confirm p {
  color: #aaa;
  margin-bottom: 16px;
}

.day-modal-complete h3 {
  margin-bottom: 12px;
}

/* Inline form in modal */
.calendar-inline-form {
  max-height: 60vh;
  overflow-y: auto;
}

.calendar-inline-form .form-group {
  margin-bottom: 12px;
}

.calendar-inline-form textarea {
  resize: vertical;
}
```

- [ ] **Step 2: Verify styles compile (dev server)**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/App.css
git commit -m "feat: add calendar and day modal CSS styles"
```

---

## Chunk 6: Page Integration

### Task 9: Rewrite MyAssignedWorkouts (student calendar)

**Files:**
- Rewrite: `~/Desktop/FitReg/FitRegFE/src/pages/MyAssignedWorkouts.tsx`

- [ ] **Step 1: Replace with calendar view**

```tsx
import { useTranslation } from "react-i18next";
import MonthCalendar from "../components/MonthCalendar";

export default function MyAssignedWorkouts() {
  const { t } = useTranslation();

  return (
    <div className="page">
      <h1>{t('assigned_my')}</h1>
      <MonthCalendar role="student" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/pages/MyAssignedWorkouts.tsx
git commit -m "feat: replace MyAssignedWorkouts with calendar view"
```

### Task 10: Rewrite StudentWorkouts (coach calendar)

**Files:**
- Rewrite: `~/Desktop/FitReg/FitRegFE/src/pages/StudentWorkouts.tsx`

- [ ] **Step 1: Replace with calendar view**

```tsx
import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { listStudents } from "../api/coach";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import MonthCalendar from "../components/MonthCalendar";

export default function StudentWorkouts() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const location = useLocation();
  const { t } = useTranslation();
  const { showSuccess } = useFeedback();
  const [studentName, setStudentName] = useState("");

  const feedbackShown = useRef(false);
  useEffect(() => {
    const state = location.state as { feedback?: string } | null;
    if (state?.feedback && !feedbackShown.current) {
      feedbackShown.current = true;
      showSuccess(state.feedback);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    loadStudentName();
  }, [studentId]);

  async function loadStudentName() {
    try {
      const res = await listStudents();
      const student = res.data.find((s) => s.id === studentId);
      if (student) setStudentName(student.name);
    } catch {
      // ignore
    }
  }

  return (
    <div className="page">
      <Link to="/coach" className="back-link">{t('detail_back')}</Link>
      <h1>{t('coach_student_workouts')}</h1>
      <MonthCalendar role="coach" studentId={studentId} studentName={studentName} />
    </div>
  );
}
```

- [ ] **Step 2: Verify everything compiles**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/pages/StudentWorkouts.tsx
git commit -m "feat: replace StudentWorkouts with calendar view"
```

### Task 11: Manual testing

- [ ] **Step 1: Start backend**

```bash
cd ~/Desktop/FitReg/FitRegAPI
export $(cat .env | xargs) && go run main.go &
```

- [ ] **Step 2: Start frontend**

```bash
cd ~/Desktop/FitReg/FitRegFE
npm run dev
```

- [ ] **Step 3: Test coach calendar**

1. Login as coach
2. Go to `/coach` → click a student → should see calendar
3. Navigate months with arrows
4. Click empty day → should see "Asignar entrenamiento" button
5. Create a workout → calendar should refresh with workout on that day
6. Click the workout day → should see detail with Edit/Delete
7. Edit the workout → verify changes
8. Delete the workout → verify it disappears

- [ ] **Step 4: Test student calendar**

1. Login as student
2. Go to `/my-assignments` → should see calendar
3. Click a pending workout day → should see detail with Complete/Skip
4. Complete a workout with results → verify status changes to green
5. Click a completed workout → should see results grid

- [ ] **Step 5: Test the standalone form still works**

1. Navigate to `/coach/assign/{studentId}` directly
2. Verify form works as before (thin wrapper around AssignWorkoutFields)

- [ ] **Step 6: Final commit if any fixes needed**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add -A
git commit -m "fix: calendar integration fixes"
```
