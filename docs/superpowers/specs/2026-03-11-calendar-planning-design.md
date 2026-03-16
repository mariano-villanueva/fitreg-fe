# Calendar Planning View — Design Spec

## Goal

Replace the list/card views for assigned workouts with a monthly calendar view, enabling coaches to plan training month-by-month and students to visualize their schedule at a glance.

## Users

- **Coach:** views and manages one student's calendar at a time. Can create, edit, and delete assigned workouts from the calendar.
- **Student (athlete):** views their own calendar. Can complete or skip pending workouts directly from the calendar.

## Approach

Custom CSS grid calendar component (no external libraries). Consistent with the project's pure-CSS, dark-theme styling. One reusable `MonthCalendar` component with role-based behavior, and a `DayModal` component for day-level interactions.

---

## Components

### `MonthCalendar`

**File:** `src/components/MonthCalendar.tsx`

**Props:**
- `role: 'coach' | 'student'` — determines available actions
- `studentId?: number` — required for coach role (which student's calendar)
- `studentName?: string` — displayed in header for coach role

**Responsibilities:**
- Renders a 7-column CSS grid for the current month
- Navigation arrows to move between months
- Fetches assigned workouts for the visible month range (`start_date` / `end_date`)
- Maps workouts to days via `due_date` → dictionary lookup
- Each day cell shows: workout title + status badge (color-coded)
- Clicking a day opens `DayModal`
- Days outside current month shown in muted style
- Today highlighted with indigo border

**Visual design:**
- Dark background (`#1a1a2e`), grid lines via gap + background color (`#2a2a4a`)
- Workout chips: border-left color by status
  - Pending: blue (`#4a9eff` border, `#1e3a5f` bg)
  - Completed: green (`#4ade80` border, `#1a3a2a` bg)
  - Skipped: gray (`#888` border, `#3a2a1a` bg)
- Today: indigo inset box-shadow (`#6366f1`)
- Min-height per cell: ~90px
- Weekday headers: localized via i18n keys
- **Responsive:** On screens < 640px, the calendar grid scrolls horizontally with `min-width: 560px` to keep cells readable

### `AssignWorkoutFields`

**File:** `src/components/AssignWorkoutFields.tsx`

Extracted from the existing `AssignWorkoutForm` page. Contains all the form fields (title, description, type, SegmentBuilder, due_date, notes, expected_fields checkboxes) but is a controlled component that accepts props instead of reading URL params.

**Props:**
- `studentId: number`
- `dueDate: string` — pre-set date (YYYY-MM-DD)
- `existingWorkout?: AssignedWorkout` — if provided, form pre-fills for editing
- `onSave: () => void` — called after successful create/update
- `onCancel: () => void`

The existing `AssignWorkoutForm` page (`/coach/assign/:studentId`) is refactored to be a thin wrapper around `AssignWorkoutFields`, preserving the standalone page route.

### `DayModal`

**File:** `src/components/DayModal.tsx`

**Props:**
- `date: string` — selected date (YYYY-MM-DD)
- `workout: AssignedWorkout | null` — workout for that day, or null
- `role: 'coach' | 'student'`
- `studentId?: number` — for creating new workouts (coach)
- `onClose: () => void`
- `onRefresh: () => void` — callback to reload calendar data after mutations

**States by role and workout presence:**

| Role | Workout | Display |
|------|---------|---------|
| Coach | exists | Workout detail (title, type, segments, notes) + Edit / Delete buttons |
| Coach | null | Empty state + "Asignar entrenamiento" button |
| Student | pending | Workout detail + Completar / Omitir buttons |
| Student | completed | Workout detail + results grid (time, distance, HR, feeling) |
| Student | skipped | Workout detail + skipped badge |
| Student | null | Empty state message (no action) |

**Coach actions:**
- **Asignar:** Renders `<AssignWorkoutFields>` inline within the modal, with `dueDate` pre-set to the selected day. All fields including `expected_fields` checkboxes are available. On save → `onRefresh()` → close modal.
- **Editar:** Renders `<AssignWorkoutFields>` inline within the modal, pre-filled with existing workout data. On save → `onRefresh()` → close modal.
- **Eliminar:** Confirmation dialog → DELETE → `onRefresh()` → close modal.

**Student actions:**
- **Completar:** Expands result fields (time, distance, HR, feeling, image upload) within the modal. On confirm → PUT status → `onRefresh()` → close modal.
- **Omitir:** Confirmation → PUT status → `onRefresh()` → close modal.

---

## Pages Modified

### `MyAssignedWorkouts.tsx` → Student Calendar

**Route:** `/my-assignments`

**Changes:**
- Remove the existing card grid for pending workouts and table for history
- Render `<MonthCalendar role="student" />`
- Keep the page title

### `StudentWorkouts.tsx` → Coach Calendar

**Route:** `/coach/students/:id`

**Changes:**
- Remove the existing card grid for pending workouts, table for finished, and associated modals
- Render `<MonthCalendar role="coach" studentId={id} studentName={name} />`
- Keep the student header info and "back" navigation

### `AthleteHome.tsx` — No Changes

The next-workout cards and stat cards on the home page remain as-is. They serve as a quick preview; the calendar is the full planning view.

---

## API Changes

### Frontend (`src/api/coach.ts`)

**`listAssignedWorkouts`** — add optional `startDate` and `endDate` params. New signature:
```ts
listAssignedWorkouts(studentId?: number, status?: string, page?: number, limit?: number, startDate?: string, endDate?: string)
```
The calendar calls it with only `studentId`, `startDate`, `endDate` (no status/pagination). Existing calls from other pages remain unchanged since the new params are optional.
```
GET /api/coach/assigned-workouts?student_id=X&start_date=2026-03-01&end_date=2026-03-31
```

**`getMyAssignedWorkouts`** — change signature to accept optional date range:
```ts
getMyAssignedWorkouts(startDate?: string, endDate?: string)
```
```
GET /api/my-assigned-workouts?start_date=2026-03-01&end_date=2026-03-31
```

### Backend (`handlers/coach_handler.go`)

**`ListAssignedWorkouts`:**
- Read `start_date` and `end_date` query params
- Add `AND aw.due_date >= ? AND aw.due_date <= ?` to WHERE clause when both are present
- Existing `status` and `page`/`limit` params remain functional

**`GetMyAssignedWorkouts`:**
- Read `start_date` and `end_date` query params
- Add `AND aw.due_date >= ? AND aw.due_date <= ?` to WHERE clause when both are present

No database schema changes required. The `due_date` column already exists on `assigned_workouts`.

---

## Data Flow

1. `MonthCalendar` mounts → computes first/last day of current month
2. Fetches workouts with `start_date`/`end_date` params
3. Builds dictionary: `{ "2026-03-02": workout[], "2026-03-04": workout[], ... }` (array per day to handle edge cases where multiple workouts exist on the same date; UI renders the first one but doesn't silently drop data)
4. Renders grid; each cell checks dictionary for its date
5. User clicks a day → `DayModal` opens with that date's workout (or null)
6. After any mutation (create/edit/delete/complete/skip) → `onRefresh()` re-fetches the month

No caching between months. Each navigation re-fetches. Simple and correct.

---

## i18n Keys

New keys needed (both `es.ts` and `en.ts`):
- `calendar_title` — "Calendario de Entrenamientos" / "Training Calendar"
- `calendar_prev_month` — "Anterior" / "Previous"
- `calendar_next_month` — "Siguiente" / "Next"
- `calendar_today` — "HOY" / "TODAY"
- `calendar_no_workout` — "No hay entrenamiento asignado para este día" / "No workout assigned for this day"
- `calendar_assign` — "Asignar entrenamiento" / "Assign workout"
- `calendar_results` — "RESULTADOS" / "RESULTS"
- `calendar_structure` — "ESTRUCTURA" / "STRUCTURE"
- `calendar_coach_notes` — "NOTAS DEL COACH" / "COACH NOTES"
- `weekday_sun` — "DOM" / "SUN"
- `weekday_mon` — "LUN" / "MON"
- `weekday_tue` — "MAR" / "TUE"
- `weekday_wed` — "MIÉ" / "WED"
- `weekday_thu` — "JUE" / "THU"
- `weekday_fri` — "VIE" / "FRI"
- `weekday_sat` — "SÁB" / "SAT"

---

## Out of Scope (future)

- Drag & drop to move workouts between days
- Duplicate workout to another day
- Week view
- Multi-student calendar view
- Recurring workout templates
- Caching previously loaded months
