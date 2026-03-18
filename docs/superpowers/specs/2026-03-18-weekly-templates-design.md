# Weekly Templates — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Scope:** FitReg — Coach Weekly Workout Templates

---

## Overview

Coaches need to plan training across multiple weeks (monthly planning). Weekly templates let a coach define a reusable week-long workout plan — each day optionally containing a workout — and then assign that template starting on any Monday of the calendar.

This feature is analogous to the existing daily workout templates (`workout_templates`), extended to a weekly granularity.

---

## Model Choice: Model A (Simple)

Assignment creates `assigned_workouts` directly. No intermediate `assigned_weeks` entity. Workouts become fully independent after assignment — editing or deleting the template does not affect already-assigned workouts.

---

## Database Schema

### Conventions (matches existing tables)
- All PKs: `BIGINT AUTO_INCREMENT PRIMARY KEY`
- All FKs to `users.id`: `BIGINT NOT NULL`
- Dates: `DATE` for calendar dates, `DATETIME` for timestamps

### `weekly_templates`

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT AUTO_INCREMENT PK | |
| coach_id | BIGINT NOT NULL FK → users.id | |
| name | VARCHAR(255) NOT NULL | |
| description | TEXT NULLABLE | |
| created_at | DATETIME NOT NULL DEFAULT NOW() | |
| updated_at | DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW() | |

### `weekly_template_days`

Stores up to 7 day slots per template. `day_of_week` uses custom encoding: **0=Monday, 1=Tuesday, …, 6=Sunday** (not Go's `time.Weekday` where Sunday=0). Days not present in the table are treated as rest days.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT AUTO_INCREMENT PK | |
| weekly_template_id | BIGINT NOT NULL FK → weekly_templates.id | ON DELETE CASCADE |
| day_of_week | TINYINT NOT NULL | 0=Mon … 6=Sun (custom, not Go time.Weekday) |
| title | VARCHAR(255) NOT NULL | |
| description | TEXT NULLABLE | |
| type | VARCHAR(50) NULLABLE | e.g. cardio, strength |
| distance_km | DECIMAL(10,2) NULLABLE | |
| duration_seconds | INT NULLABLE | |
| notes | TEXT NULLABLE | |
| from_template_id | BIGINT NULLABLE FK → workout_templates.id | ON DELETE SET NULL; audit field set by client when "Load from template" is used |
| created_at | DATETIME NOT NULL DEFAULT NOW() | |
| updated_at | DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW() | |

**Unique constraint:** `UNIQUE (weekly_template_id, day_of_week)`

### `weekly_template_day_segments`

Identical structure to `workout_template_segments` and `assigned_workout_segments`.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT AUTO_INCREMENT PK | |
| weekly_template_day_id | BIGINT NOT NULL FK → weekly_template_days.id | ON DELETE CASCADE |
| order_index | INT NOT NULL DEFAULT 0 | |
| segment_type | ENUM('simple','interval') NOT NULL DEFAULT 'simple' | |
| repetitions | INT DEFAULT 1 | |
| value | DECIMAL(10,2) NULLABLE | used for simple segments |
| unit | VARCHAR(10) NULLABLE | |
| intensity | VARCHAR(20) NULLABLE | |
| work_value | DECIMAL(10,2) NULLABLE | used for interval segments |
| work_unit | VARCHAR(10) NULLABLE | |
| work_intensity | VARCHAR(20) NULLABLE | |
| rest_value | DECIMAL(10,2) NULLABLE | |
| rest_unit | VARCHAR(10) NULLABLE | |
| rest_intensity | VARCHAR(20) NULLABLE | |

---

## API Endpoints

All endpoints require a valid coach JWT. All `:id` lookups verify that `weekly_templates.coach_id = authenticated_user_id`. If the template does not exist or belongs to another coach, return **404** (do not distinguish — avoid information leakage).

### Weekly Template CRUD

#### `GET /api/coach/weekly-templates`

Returns all weekly templates for the authenticated coach (no days or segments).

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Semana de volumen",
    "description": "Descripción",
    "day_count": 5,
    "created_at": "2026-03-18T10:00:00Z",
    "updated_at": "2026-03-18T10:00:00Z"
  }
]
```

Empty array `[]` when no templates exist.

---

#### `POST /api/coach/weekly-templates`

Creates a new weekly template (empty days). Days are set separately via `PUT /days`.

**Request body:**
```json
{
  "name": "Semana de volumen",
  "description": "Descripción opcional"
}
```

**Response 201:**
```json
{
  "id": 1,
  "name": "Semana de volumen",
  "description": "...",
  "days": [],
  "created_at": "2026-03-18T10:00:00Z",
  "updated_at": "2026-03-18T10:00:00Z"
}
```

---

#### `GET /api/coach/weekly-templates/:id`

Returns the full template including all days and their segments.

**Response 200:**
```json
{
  "id": 1,
  "name": "Semana de volumen",
  "description": "...",
  "days": [
    {
      "day_of_week": 0,
      "title": "Cardio matutino",
      "description": "...",
      "type": "cardio",
      "distance_km": 5.0,
      "duration_seconds": 1800,
      "notes": "",
      "from_template_id": null,
      "segments": [
        {
          "order_index": 0,
          "segment_type": "simple",
          "repetitions": 1,
          "value": 5.0,
          "unit": "km",
          "intensity": "moderate",
          "work_value": null,
          "work_unit": null,
          "work_intensity": null,
          "rest_value": null,
          "rest_unit": null,
          "rest_intensity": null
        }
      ]
    }
  ],
  "created_at": "...",
  "updated_at": "..."
}
```

---

#### `PUT /api/coach/weekly-templates/:id`

Updates name and/or description only.

**Request body:**
```json
{
  "name": "Nuevo nombre",
  "description": "Nueva descripción"
}
```

**Response 200:** Same shape as GET /:id.

---

#### `DELETE /api/coach/weekly-templates/:id`

Deletes the template; cascades to `weekly_template_days` and `weekly_template_day_segments`.

**Response 204:** No body.

---

### Days — Full Replace

#### `PUT /api/coach/weekly-templates/:id/days`

Atomically replaces all days (and their segments) for the template. Runs inside a transaction: DELETE all existing rows for this template, then INSERT the new set.

**Request body:**
```json
{
  "days": [
    {
      "day_of_week": 0,
      "title": "Lunes cardio",
      "description": "...",
      "type": "cardio",
      "distance_km": 5.0,
      "duration_seconds": 1800,
      "notes": "",
      "from_template_id": null,
      "segments": [
        {
          "order_index": 0,
          "segment_type": "simple",
          "repetitions": 1,
          "value": 5.0,
          "unit": "km",
          "intensity": null,
          "work_value": null,
          "work_unit": null,
          "work_intensity": null,
          "rest_value": null,
          "rest_unit": null,
          "rest_intensity": null
        }
      ]
    }
  ]
}
```

**Validation:**
- `days` can be 0–7 items. Sending an empty array `[]` clears all days.
- Each `day_of_week` must be an integer 0–6; values outside this range return 400.
- Duplicate `day_of_week` values within the request body return 400.
- `from_template_id` is client-provided (nullable). It is set by the frontend when the coach uses "Load from template" to preload a day; `null` otherwise. It is stored as-is — no server-side validation against `workout_templates`.

**Response 200:** Full template object (same shape as GET /:id).

---

### Assignment

#### `POST /api/coach/weekly-templates/:id/assign`

Assigns the template to a student starting on a specific Monday. The entire conflict-check + INSERT runs in a single database transaction.

**Request body:**
```json
{
  "student_id": 42,
  "start_date": "2026-03-24"
}
```

**Validation (in order):**
1. `start_date` must be a Monday. Parse as `time.DateOnly` (UTC). If `time.Parse(...).Weekday() != time.Monday`, return 400.
2. The coach must have `student_id` in their roster (`coach_students` table). If not, return 403.
3. For each day in the template that has a workout entry, compute:
   `due_date = start_date + (day_of_week * 24h)`
   (day_of_week 0 → start_date itself; day_of_week 6 → start_date + 6 days)
4. Check `assigned_workouts` for any row with `student_id = student_id AND due_date IN (computed dates)`, regardless of status. Collect all conflicting dates.
5. If any conflicts exist, return 409.
6. If no conflicts: INSERT one `assigned_workout` per template day that has content, copying all day fields plus all segments.

**Note on day_of_week vs Go time.Weekday:** The `day_of_week` in the database uses 0=Monday. Go's `time.Monday == 1`. The date computation uses `start_date.AddDate(0, 0, day_of_week)` — adding days directly, not Go weekday constants.

**On conflict, response 409:**
```json
{
  "error": "conflict",
  "conflicting_dates": ["2026-03-24", "2026-03-26"]
}
```

**On success, response 201:**
```json
{
  "assigned_workout_ids": [101, 102, 103]
}
```

---

## Segment Copying on Assignment

Days in `weekly_template_days` have segments in `weekly_template_day_segments`. When assigning:
- Each day that has a workout creates one `assigned_workout` row (copying title, description, type, distance_km, duration_seconds, notes, due_date, coach_id, student_id; status = 'pending').
- All segments for that day are copied into `assigned_workout_segments` (same preload pattern as daily template assignment).
- After assignment, the `assigned_workouts` are fully independent of the template.

---

## Frontend

### Route

`/coach/weekly-templates` — protected, coach only. Added to `App.tsx` routing alongside `/coach/templates`.

### Pages and Components

**`CoachWeeklyTemplates.tsx`** (list page)
- Fetches `GET /api/coach/weekly-templates` on mount
- Lists each template with: name, day count, action buttons (Edit, Assign, Delete)
- "Nueva plantilla semanal" button → navigates to `/coach/weekly-templates/new`

**`WeeklyTemplateForm.tsx`** (create / edit page, route `/coach/weekly-templates/new` and `/coach/weekly-templates/:id/edit`)
- On create mode: no initial fetch; POST on first save, then PUT `/days`
- On edit mode: `GET /api/coach/weekly-templates/:id` on mount → loads days into local state
- Name + description fields
- `WeeklyTemplateCalendar` component showing the 7-day row
- Save / Cancel buttons

**`WeeklyTemplateCalendar.tsx`** (pure display + interaction component)
- Single horizontal row of 7 `WeeklyDayCell` components
- Days labeled Lun / Mar / Mié / Jue / Vie / Sáb / Dom (starting Monday, index 0)
- Receives `days: WeeklyTemplateDay[]` and `onDayChange(day_of_week, data | null)` callback
- Click on any cell → opens `WeeklyDayEditor` modal

**`WeeklyDayCell.tsx`**
- Empty state: dashed border, "Descanso" label
- Filled state: workout title + type badge
- Clickable

**`WeeklyDayEditor.tsx`** (modal, opens from WeeklyDayCell click)
- "Cargar desde plantilla" dropdown: fetches coach's daily templates, on select preloads all fields including segments; sets `from_template_id`
- Manual fields: title, description, type, distance, duration, notes, segments (same segment editor as existing workout forms)
- "Guardar", "Quitar día" (sets day to null/rest), "Cancelar"
- Saves to local state only — no API call until the parent form saves

**`WeeklyTemplateAssignModal.tsx`**
- Student selector (fetches coach's students)
- Date picker restricted to Mondays; client-side day-of-week validation with inline error
- Confirm → `POST /api/coach/weekly-templates/:id/assign`
- Success → close modal, show toast
- Conflict 409 → show list of conflicting dates inside the modal (do not close)

### TypeScript Types (to add to `src/types/index.ts`)

```typescript
export interface WeeklyTemplateSegment {
  order_index: number;
  segment_type: "simple" | "interval";
  repetitions: number;
  value: number | null;
  unit: string | null;
  intensity: string | null;
  work_value: number | null;
  work_unit: string | null;
  work_intensity: string | null;
  rest_value: number | null;
  rest_unit: string | null;
  rest_intensity: string | null;
}

export interface WeeklyTemplateDay {
  day_of_week: number; // 0=Mon … 6=Sun
  title: string;
  description: string | null;
  type: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  notes: string | null;
  from_template_id: number | null;
  segments: WeeklyTemplateSegment[];
}

export interface WeeklyTemplate {
  id: number;
  name: string;
  description: string | null;
  days: WeeklyTemplateDay[];
  day_count?: number; // present in list response
  created_at: string;
  updated_at: string;
}
```

### Navigation

Sidebar entry: "Plantillas Semanales" (`/coach/weekly-templates`), placed below the existing "Plantillas" entry.

---

## Data Flow

```
Coach opens /coach/weekly-templates
  → GET /api/coach/weekly-templates → list

Click "Nueva plantilla semanal"
  → WeeklyTemplateForm (create mode, empty days in local state)
  → click cell → WeeklyDayEditor modal → update local state
  → click Save:
      POST /api/coach/weekly-templates → get new template id
      PUT /api/coach/weekly-templates/:id/days → persist all days

Click "Editar" on existing template
  → GET /api/coach/weekly-templates/:id → full template with days
  → WeeklyTemplateForm (edit mode, days loaded into local state)
  → click cell → WeeklyDayEditor modal → update local state
  → click Save:
      PUT /api/coach/weekly-templates/:id → update name/description (if changed)
      PUT /api/coach/weekly-templates/:id/days → atomic replace of all days

Click "Asignar" on template
  → WeeklyTemplateAssignModal
  → select student + start date (Monday)
  → POST /api/coach/weekly-templates/:id/assign
  → success: close modal + toast
  → 409 conflict: show conflicting dates list in modal
```

---

## Error Handling

| Case | HTTP | Frontend |
|------|------|---------|
| start_date not Monday | 400 | Inline date field error in modal |
| day_of_week out of range (< 0 or > 6) | 400 | Toast error |
| Duplicate day_of_week in request | 400 | Toast error |
| Template not found / not owned by coach | 404 | Toast error |
| Student not in coach roster | 403 | Modal error message |
| Conflicting assignments | 409 | Modal error listing conflicting dates |
| Generic server error | 500 | Toast error |

---

## Out of Scope

- Multiple workouts per day (future)
- Repeating templates over multiple weeks (future)
- Editing assigned workouts retroactively through the template (by design — assigned workouts are independent)
- UI warning about template edits not affecting already-assigned workouts (future UX improvement)

---

## Resolved Design Decisions

- **Empty days:** Allowed. Days not in `weekly_template_days` are rest days and produce no `assigned_workout`.
- **Conflict behavior:** 409 error — no silent overwrite. Any `assigned_workout` on that date (any status) blocks.
- **Calendar start day:** Monday (day_of_week 0 = Monday, 6 = Sunday).
- **Template scope:** Global to the coach, same as daily templates.
- **Segments on assignment:** Copied to `assigned_workout_segments` — same preload pattern as daily template assignment.
- **Not-found vs forbidden:** Template endpoints return 404 for both to avoid information leakage.
- **Student roster validation:** Assignment returns 403 if student is not in coach's roster.
- **from_template_id:** Set by the client when loading from a daily template; NULL otherwise. Stored as an audit field only (no server-side validation).
