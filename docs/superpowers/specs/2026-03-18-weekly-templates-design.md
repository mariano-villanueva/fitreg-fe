# Weekly Templates — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Scope:** FitReg — Coach Weekly Workout Templates

---

## Overview

Coaches need to plan training across multiple weeks (monthly planning). Weekly templates let a coach define a reusable week-long workout plan — each day optionally containing a workout — and then assign that template starting on any Monday of the calendar.

This feature is analogous to the existing daily workout templates, extended to a weekly granularity.

---

## Model Choice: Model A (Simple)

Assignment creates `assigned_workouts` directly. No intermediate `assigned_weeks` entity. Workouts become fully independent after assignment — editing or deleting the template does not affect already-assigned workouts.

---

## Database Schema

### `weekly_templates`

| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| coach_id | INT FK → users.id | |
| name | VARCHAR(255) NOT NULL | |
| description | TEXT NULLABLE | |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### `weekly_template_days`

Stores up to 7 day slots (0=Monday … 6=Sunday). Days not present are rest days.

| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| weekly_template_id | INT FK → weekly_templates.id | ON DELETE CASCADE |
| day_of_week | TINYINT(1) 0–6 | 0=Mon, 6=Sun |
| title | VARCHAR(255) NOT NULL | |
| description | TEXT NULLABLE | |
| type | VARCHAR(50) | e.g. cardio, strength |
| distance_km | DECIMAL(6,2) NULLABLE | |
| duration_seconds | INT NULLABLE | |
| notes | TEXT NULLABLE | |
| from_template_id | INT NULLABLE FK → workout_templates.id | audit: which daily template was used as preload |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**Unique constraint:** `(weekly_template_id, day_of_week)`

### `weekly_template_day_segments`

Mirrors the segment structure of daily workout templates.

| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| weekly_template_day_id | INT FK → weekly_template_days.id | ON DELETE CASCADE |
| order_index | INT | |
| segment fields… | | Same structure as workout_template_segments |

---

## API Endpoints

All endpoints require coach JWT.

### Weekly Template CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/coach/weekly-templates` | List all coach's weekly templates |
| POST | `/api/coach/weekly-templates` | Create a new weekly template |
| GET | `/api/coach/weekly-templates/:id` | Get template with all days and segments |
| PUT | `/api/coach/weekly-templates/:id` | Update name/description |
| DELETE | `/api/coach/weekly-templates/:id` | Delete template and all days |

### Days (full replace)

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/api/coach/weekly-templates/:id/days` | Replace all days atomically |

The request body contains the full desired state of all days (0–7 entries). The handler deletes all existing days for the template and inserts the new set in a single transaction.

### Assignment

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/coach/weekly-templates/:id/assign` | Assign template to a student starting on a Monday |

**Request body:**
```json
{
  "student_id": 42,
  "start_date": "2026-03-23"
}
```

**Validation:**
- `start_date` must be a Monday; otherwise 400
- For each day with a workout, compute `workout_date = start_date + day_of_week`
- Check: no existing `assigned_workout` for `(student_id, workout_date)` — if any conflict, return 409 with list of conflicting dates
- If no conflicts, create `assigned_workouts` rows (one per day that has a workout)

**Assignment does not copy segments** — it creates the same structure as a manually assigned workout: one `assigned_workout` per day.

---

## Frontend

### Route

`/coach/weekly-templates` — protected, coach only. Added to the coach sidebar alongside `/coach/templates`.

### Pages and Components

**`CoachWeeklyTemplates.tsx`** (list + entry point)
- Lists all weekly templates (name, day count, actions)
- "New template" button → navigates to form

**`WeeklyTemplateForm.tsx`** (create / edit)
- Name + description fields
- `WeeklyTemplateCalendar` component — single-row 7-day view starting Monday
- Save / Cancel

**`WeeklyTemplateCalendar.tsx`**
- Single horizontal row of 7 `WeeklyDayCell` components
- Days labeled Mon–Sun
- Each cell shows: empty (rest) or workout title
- Click on any cell → opens `WeeklyDayEditor` modal

**`WeeklyDayCell.tsx`**
- Visual state: empty (rest, dashed border) or filled (workout title + type badge)
- Clickable

**`WeeklyDayEditor.tsx`** (modal)
- "Load from daily template" dropdown (coach's existing templates) — preloads fields
- Manual fields: title, description, type, distance, duration, notes, segments
- Save / Remove day / Cancel

**`WeeklyTemplateAssignModal.tsx`**
- Student selector
- Date picker (validates Monday client-side, shows error if not Monday)
- Confirm → calls POST `/assign`, shows success or conflict error

### Navigation

Sidebar entry: "Plantillas Semanales" (`/coach/weekly-templates`), placed below the existing "Plantillas" entry.

---

## Data Flow

```
Coach opens /coach/weekly-templates
  → GET /api/coach/weekly-templates → list

Click "New" or "Edit"
  → WeeklyTemplateForm loads
  → GET /api/coach/weekly-templates/:id/days (on edit)
  → click cell → WeeklyDayEditor modal
  → on save day → local state update
  → on form save → PUT /api/coach/weekly-templates/:id/days (atomic replace)

Click "Assign"
  → WeeklyTemplateAssignModal
  → POST /api/coach/weekly-templates/:id/assign
  → success: toast notification
  → conflict: error message listing conflicting dates
```

---

## Error Handling

| Case | HTTP | Frontend |
|------|------|---------|
| start_date not Monday | 400 | Inline field error |
| Conflicting assignments | 409 | Modal error with list of dates |
| Template not found | 404 | Toast error |
| Unauthorized (not coach or not owner) | 403 | Redirect or toast |

---

## Out of Scope

- Multiple workouts per day (future)
- Repeating templates over multiple weeks (future)
- Editing assigned workouts retroactively through the template (by design — assigned workouts are independent)

---

## Open Questions (resolved)

- **Empty days?** Yes, allowed. Days without a workout are rest days and do not create an `assigned_workout`.
- **Conflict behavior?** Return error — no silent overwrite.
- **Calendar start day?** Monday (not Sunday).
- **Template scope?** Global to the coach, same as daily templates.
- **Segments on assignment?** No segments copied — same structure as manually assigned workout.
