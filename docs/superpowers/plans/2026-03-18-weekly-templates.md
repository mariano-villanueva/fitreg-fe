# Weekly Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weekly workout templates for coaches — a 7-day reusable plan that can be assigned to a student starting on any Monday, creating independent `assigned_workouts` for each day.

**Architecture:** Mirrors the existing daily template feature (`workout_templates`) with an added weekly layer. Backend follows Handler → Service → Repository → DB. Frontend follows the list-page + modal pattern of `CoachTemplates.tsx`. Assignment reuses `coach_repository.IsStudentOf` and inserts into the existing `assigned_workouts` + `assigned_workout_segments` tables.

**Tech Stack:** Go (stdlib), MySQL, React 19 + TypeScript + Vite, Axios, react-i18next

**Spec:** `docs/superpowers/specs/2026-03-18-weekly-templates-design.md`

---

## File Map

### Backend — New files
- `FitRegAPI/models/weekly_template.go` — all request/response structs
- `FitRegAPI/repository/weekly_template_repository.go` — DB access
- `FitRegAPI/services/weekly_template_service.go` — business logic + auth
- `FitRegAPI/handlers/weekly_template_handler.go` — HTTP layer

### Backend — Modified files
- `FitRegAPI/migrations/001_schema.sql` — 3 new tables appended
- `FitRegAPI/repository/interfaces.go` — `WeeklyTemplateRepository` interface
- `FitRegAPI/router/router.go` — 3 new route blocks

### Frontend — New files
- `FitRegFE/src/api/weeklyTemplates.ts` — axios API wrappers
- `FitRegFE/src/pages/CoachWeeklyTemplates.tsx` — list page
- `FitRegFE/src/pages/WeeklyTemplateForm.tsx` — create/edit form page
- `FitRegFE/src/components/WeeklyTemplateCalendar.tsx` — 7-day row display
- `FitRegFE/src/components/WeeklyDayCell.tsx` — single day tile
- `FitRegFE/src/components/WeeklyDayEditor.tsx` — modal to set/edit a day's workout
- `FitRegFE/src/components/WeeklyTemplateAssignModal.tsx` — assign-to-student modal

### Frontend — Modified files
- `FitRegFE/src/types/index.ts` — 3 new interfaces + 1 response type
- `FitRegFE/src/App.tsx` — 2 new routes
- `FitRegFE/src/components/Sidebar.tsx` — 1 new nav link
- `FitRegFE/src/i18n/es.ts` — ~20 new keys
- `FitRegFE/src/i18n/en.ts` — ~20 new keys

---

## Task 1: Database Migration

**Files:**
- Modify: `FitRegAPI/migrations/001_schema.sql` (append at end, before last comment)

- [ ] **Step 1: Append the 3 new tables to the migration file**

At the end of `001_schema.sql`, append:

```sql
-- ============================================================
-- WEEKLY TEMPLATES
-- ============================================================
DROP TABLE IF EXISTS weekly_template_day_segments;
DROP TABLE IF EXISTS weekly_template_days;
DROP TABLE IF EXISTS weekly_templates;

CREATE TABLE weekly_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coach_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_wt_weekly_coach (coach_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE weekly_template_days (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    weekly_template_id BIGINT NOT NULL,
    day_of_week TINYINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50),
    distance_km DECIMAL(10,2),
    duration_seconds INT,
    notes TEXT,
    from_template_id BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    FOREIGN KEY (weekly_template_id) REFERENCES weekly_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (from_template_id) REFERENCES workout_templates(id) ON DELETE SET NULL,
    UNIQUE KEY uq_wtd_day (weekly_template_id, day_of_week),
    CONSTRAINT chk_wtd_day CHECK (day_of_week BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE weekly_template_day_segments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    weekly_template_day_id BIGINT NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    segment_type ENUM('simple','interval') NOT NULL DEFAULT 'simple',
    repetitions INT DEFAULT 1,
    value DECIMAL(10,2),
    unit VARCHAR(10),
    intensity VARCHAR(20),
    work_value DECIMAL(10,2),
    work_unit VARCHAR(10),
    work_intensity VARCHAR(20),
    rest_value DECIMAL(10,2),
    rest_unit VARCHAR(10),
    rest_intensity VARCHAR(20),
    FOREIGN KEY (weekly_template_day_id) REFERENCES weekly_template_days(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Re-run the migration against the local DB**

```bash
mysql -u root -proot fitreg < ~/Desktop/FitReg/FitRegAPI/migrations/001_schema.sql
```

Expected: no errors. Verify:
```bash
mysql -u root -proot fitreg -e "SHOW TABLES LIKE 'weekly%';"
```
Expected output:
```
+-----------------------------+
| Tables_in_fitreg (weekly%)  |
+-----------------------------+
| weekly_template_day_segments|
| weekly_template_days        |
| weekly_templates            |
+-----------------------------+
```

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/FitReg/FitRegAPI
git add migrations/001_schema.sql
git commit -m "feat: add weekly_templates migration"
```

---

## Task 2: Go Models

**Files:**
- Create: `FitRegAPI/models/weekly_template.go`

- [ ] **Step 1: Create the models file**

```go
package models

// WeeklyTemplateSegmentRequest is used when creating/updating weekly template days.
// Identical structure to SegmentRequest in coach.go and template.go.
type WeeklyTemplateSegmentRequest struct {
	SegmentType   string  `json:"segment_type"`
	Repetitions   int     `json:"repetitions"`
	Value         float64 `json:"value"`
	Unit          string  `json:"unit"`
	Intensity     string  `json:"intensity"`
	WorkValue     float64 `json:"work_value"`
	WorkUnit      string  `json:"work_unit"`
	WorkIntensity string  `json:"work_intensity"`
	RestValue     float64 `json:"rest_value"`
	RestUnit      string  `json:"rest_unit"`
	RestIntensity string  `json:"rest_intensity"`
}

// WeeklyTemplateSegment is used in responses.
type WeeklyTemplateSegment struct {
	ID                  int64   `json:"id"`
	WeeklyTemplateDayID int64   `json:"weekly_template_day_id"`
	OrderIndex          int     `json:"order_index"`
	SegmentType         string  `json:"segment_type"`
	Repetitions         int     `json:"repetitions"`
	Value               float64 `json:"value"`
	Unit                string  `json:"unit"`
	Intensity           string  `json:"intensity"`
	WorkValue           float64 `json:"work_value"`
	WorkUnit            string  `json:"work_unit"`
	WorkIntensity       string  `json:"work_intensity"`
	RestValue           float64 `json:"rest_value"`
	RestUnit            string  `json:"rest_unit"`
	RestIntensity       string  `json:"rest_intensity"`
}

// WeeklyTemplateDay represents one day slot in a weekly template (response).
type WeeklyTemplateDay struct {
	ID                 int64                   `json:"id"`
	WeeklyTemplateID   int64                   `json:"weekly_template_id"`
	DayOfWeek          int                     `json:"day_of_week"` // 0=Mon … 6=Sun
	Title              string                  `json:"title"`
	Description        string                  `json:"description"`
	Type               string                  `json:"type"`
	DistanceKm         float64                 `json:"distance_km"`
	DurationSeconds    int                     `json:"duration_seconds"`
	Notes              string                  `json:"notes"`
	FromTemplateID     *int64                  `json:"from_template_id"`
	Segments           []WeeklyTemplateSegment `json:"segments"`
}

// WeeklyTemplate is the full response object.
type WeeklyTemplate struct {
	ID          int64               `json:"id"`
	CoachID     int64               `json:"coach_id"`
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Days        []WeeklyTemplateDay `json:"days"`
	DayCount    int                 `json:"day_count,omitempty"`
	CreatedAt   string              `json:"created_at"`
	UpdatedAt   string              `json:"updated_at"`
}

// --- Request models ---

// CreateWeeklyTemplateRequest is the body for POST /api/coach/weekly-templates.
type CreateWeeklyTemplateRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// UpdateWeeklyTemplateRequest is the body for PUT /api/coach/weekly-templates/:id.
type UpdateWeeklyTemplateRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// WeeklyTemplateDayRequest is one day entry in PutDaysRequest.
type WeeklyTemplateDayRequest struct {
	DayOfWeek       int                             `json:"day_of_week"`
	Title           string                          `json:"title"`
	Description     string                          `json:"description"`
	Type            string                          `json:"type"`
	DistanceKm      float64                         `json:"distance_km"`
	DurationSeconds int                             `json:"duration_seconds"`
	Notes           string                          `json:"notes"`
	FromTemplateID  *int64                          `json:"from_template_id"`
	Segments        []WeeklyTemplateSegmentRequest  `json:"segments"`
}

// PutDaysRequest is the body for PUT /api/coach/weekly-templates/:id/days.
type PutDaysRequest struct {
	Days []WeeklyTemplateDayRequest `json:"days"`
}

// AssignWeeklyTemplateRequest is the body for POST /api/coach/weekly-templates/:id/assign.
type AssignWeeklyTemplateRequest struct {
	StudentID int64  `json:"student_id"`
	StartDate string `json:"start_date"` // "YYYY-MM-DD", must be a Monday
}

// AssignWeeklyTemplateResponse is returned on successful assignment.
type AssignWeeklyTemplateResponse struct {
	AssignedWorkoutIDs []int64 `json:"assigned_workout_ids"`
}

// AssignConflictResponse is returned when one or more dates already have an assigned workout.
type AssignConflictResponse struct {
	Error            string   `json:"error"`
	ConflictingDates []string `json:"conflicting_dates"`
}
```

- [ ] **Step 2: Build check**

```bash
cd ~/Desktop/FitReg/FitRegAPI
go build ./...
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add models/weekly_template.go
git commit -m "feat: add weekly template models"
```

---

## Task 3: Repository Interface

**Files:**
- Modify: `FitRegAPI/repository/interfaces.go`

- [ ] **Step 1: Add WeeklyTemplateRepository interface**

In `repository/interfaces.go`, add this block after the existing `TemplateRepository` interface:

```go
// WeeklyTemplateRepository handles CRUD and assignment for weekly workout templates.
type WeeklyTemplateRepository interface {
	Create(coachID int64, req models.CreateWeeklyTemplateRequest) (int64, error)
	GetByID(id int64) (models.WeeklyTemplate, error)
	List(coachID int64) ([]models.WeeklyTemplate, error)
	UpdateMeta(id, coachID int64, req models.UpdateWeeklyTemplateRequest) error
	Delete(id, coachID int64) (bool, error)
	PutDays(templateID int64, days []models.WeeklyTemplateDayRequest) error
	// Assign checks for conflicts and creates assigned_workouts in one transaction.
	// Returns assigned IDs on success, conflicting dates (YYYY-MM-DD) on 409.
	Assign(templateID, coachID int64, req models.AssignWeeklyTemplateRequest) ([]int64, []string, error)
}
```

- [ ] **Step 2: Build check**

```bash
cd ~/Desktop/FitReg/FitRegAPI
go build ./...
```

Expected: no errors (interface not yet implemented, but the interface itself compiles).

- [ ] **Step 3: Commit**

```bash
git add repository/interfaces.go
git commit -m "feat: add WeeklyTemplateRepository interface"
```

---

## Task 4: Repository Implementation

**Files:**
- Create: `FitRegAPI/repository/weekly_template_repository.go`

- [ ] **Step 1: Create the repository file**

```go
package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/fitreg/api/models"
)

type weeklyTemplateRepository struct {
	db *sql.DB
}

// NewWeeklyTemplateRepository creates a new WeeklyTemplateRepository.
func NewWeeklyTemplateRepository(db *sql.DB) WeeklyTemplateRepository {
	return &weeklyTemplateRepository{db: db}
}

func (r *weeklyTemplateRepository) Create(coachID int64, req models.CreateWeeklyTemplateRequest) (int64, error) {
	res, err := r.db.Exec(
		`INSERT INTO weekly_templates (coach_id, name, description) VALUES (?, ?, ?)`,
		coachID, req.Name, req.Description,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *weeklyTemplateRepository) GetByID(id int64) (models.WeeklyTemplate, error) {
	var wt models.WeeklyTemplate
	var description sql.NullString
	err := r.db.QueryRow(
		`SELECT id, coach_id, name, description, created_at, updated_at FROM weekly_templates WHERE id = ?`, id,
	).Scan(&wt.ID, &wt.CoachID, &wt.Name, &description, &wt.CreatedAt, &wt.UpdatedAt)
	if err != nil {
		return wt, err
	}
	wt.Description = description.String

	days, err := r.getDays(id)
	if err != nil {
		return wt, err
	}
	wt.Days = days
	wt.DayCount = len(days)
	return wt, nil
}

func (r *weeklyTemplateRepository) getDays(templateID int64) ([]models.WeeklyTemplateDay, error) {
	rows, err := r.db.Query(
		`SELECT id, weekly_template_id, day_of_week, title, description, type,
		        distance_km, duration_seconds, notes, from_template_id
		 FROM weekly_template_days WHERE weekly_template_id = ? ORDER BY day_of_week`, templateID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var days []models.WeeklyTemplateDay
	for rows.Next() {
		var d models.WeeklyTemplateDay
		var desc, typ, notes sql.NullString
		var distKm sql.NullFloat64
		var durSec sql.NullInt64
		var fromTmplID sql.NullInt64
		if err := rows.Scan(&d.ID, &d.WeeklyTemplateID, &d.DayOfWeek, &d.Title,
			&desc, &typ, &distKm, &durSec, &notes, &fromTmplID); err != nil {
			return nil, err
		}
		d.Description = desc.String
		d.Type = typ.String
		d.Notes = notes.String
		d.DistanceKm = distKm.Float64
		d.DurationSeconds = int(durSec.Int64)
		if fromTmplID.Valid {
			v := fromTmplID.Int64
			d.FromTemplateID = &v
		}
		segs, err := r.getSegments(d.ID)
		if err != nil {
			return nil, err
		}
		d.Segments = segs
		days = append(days, d)
	}
	if days == nil {
		days = []models.WeeklyTemplateDay{}
	}
	return days, rows.Err()
}

func (r *weeklyTemplateRepository) getSegments(dayID int64) ([]models.WeeklyTemplateSegment, error) {
	rows, err := r.db.Query(
		`SELECT id, weekly_template_day_id, order_index, segment_type, repetitions,
		        value, unit, intensity, work_value, work_unit, work_intensity,
		        rest_value, rest_unit, rest_intensity
		 FROM weekly_template_day_segments WHERE weekly_template_day_id = ? ORDER BY order_index`, dayID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var segs []models.WeeklyTemplateSegment
	for rows.Next() {
		var s models.WeeklyTemplateSegment
		var val, wv, rv sql.NullFloat64
		var unit, intensity, wu, wi, ru, ri sql.NullString
		if err := rows.Scan(&s.ID, &s.WeeklyTemplateDayID, &s.OrderIndex, &s.SegmentType,
			&s.Repetitions, &val, &unit, &intensity,
			&wv, &wu, &wi, &rv, &ru, &ri); err != nil {
			return nil, err
		}
		s.Value = val.Float64
		s.Unit = unit.String
		s.Intensity = intensity.String
		s.WorkValue = wv.Float64
		s.WorkUnit = wu.String
		s.WorkIntensity = wi.String
		s.RestValue = rv.Float64
		s.RestUnit = ru.String
		s.RestIntensity = ri.String
		segs = append(segs, s)
	}
	if segs == nil {
		segs = []models.WeeklyTemplateSegment{}
	}
	return segs, rows.Err()
}

func (r *weeklyTemplateRepository) List(coachID int64) ([]models.WeeklyTemplate, error) {
	rows, err := r.db.Query(
		`SELECT id, coach_id, name, description, created_at, updated_at FROM weekly_templates
		 WHERE coach_id = ? ORDER BY created_at DESC`, coachID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []models.WeeklyTemplate
	for rows.Next() {
		var wt models.WeeklyTemplate
		var description sql.NullString
		if err := rows.Scan(&wt.ID, &wt.CoachID, &wt.Name, &description, &wt.CreatedAt, &wt.UpdatedAt); err != nil {
			return nil, err
		}
		wt.Description = description.String

		// Count days without fetching segments for list performance
		var count int
		if err := r.db.QueryRow(
			`SELECT COUNT(*) FROM weekly_template_days WHERE weekly_template_id = ?`, wt.ID,
		).Scan(&count); err != nil {
			return nil, err
		}
		wt.Days = []models.WeeklyTemplateDay{}
		wt.DayCount = count
		templates = append(templates, wt)
	}
	if templates == nil {
		templates = []models.WeeklyTemplate{}
	}
	return templates, rows.Err()
}

func (r *weeklyTemplateRepository) UpdateMeta(id, coachID int64, req models.UpdateWeeklyTemplateRequest) error {
	_, err := r.db.Exec(
		`UPDATE weekly_templates SET name = ?, description = ? WHERE id = ? AND coach_id = ?`,
		req.Name, req.Description, id, coachID,
	)
	return err
}

func (r *weeklyTemplateRepository) Delete(id, coachID int64) (bool, error) {
	res, err := r.db.Exec(`DELETE FROM weekly_templates WHERE id = ? AND coach_id = ?`, id, coachID)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

// PutDays replaces all days (and their segments) for the given template atomically.
func (r *weeklyTemplateRepository) PutDays(templateID int64, days []models.WeeklyTemplateDayRequest) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM weekly_template_days WHERE weekly_template_id = ?`, templateID); err != nil {
		return err
	}

	for _, d := range days {
		res, err := tx.Exec(
			`INSERT INTO weekly_template_days
			 (weekly_template_id, day_of_week, title, description, type, distance_km, duration_seconds, notes, from_template_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			templateID, d.DayOfWeek, d.Title, d.Description, d.Type, d.DistanceKm, d.DurationSeconds, d.Notes, d.FromTemplateID,
		)
		if err != nil {
			return err
		}
		dayID, err := res.LastInsertId()
		if err != nil {
			return err
		}
		for i, seg := range d.Segments {
			if _, err := tx.Exec(
				`INSERT INTO weekly_template_day_segments
				 (weekly_template_day_id, order_index, segment_type, repetitions, value, unit, intensity,
				  work_value, work_unit, work_intensity, rest_value, rest_unit, rest_intensity)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				dayID, i, seg.SegmentType, seg.Repetitions, seg.Value, seg.Unit, seg.Intensity,
				seg.WorkValue, seg.WorkUnit, seg.WorkIntensity, seg.RestValue, seg.RestUnit, seg.RestIntensity,
			); err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

// Assign creates assigned_workouts for each day with content, starting at startDate (a Monday).
// Returns (assignedIDs, conflictDates, error).
// conflictDates is non-nil when there are conflicts (caller should return 409).
func (r *weeklyTemplateRepository) Assign(templateID, coachID int64, req models.AssignWeeklyTemplateRequest) ([]int64, []string, error) {
	startDate, err := time.Parse(time.DateOnly, req.StartDate)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid start_date: %w", err)
	}

	days, err := r.getDays(templateID)
	if err != nil {
		return nil, nil, err
	}

	// Build the list of (day, dueDate) pairs for days that have content.
	type dayWithDate struct {
		day     models.WeeklyTemplateDay
		dueDate time.Time
	}
	var planned []dayWithDate
	for _, d := range days {
		planned = append(planned, dayWithDate{
			day:     d,
			dueDate: startDate.AddDate(0, 0, d.DayOfWeek), // 0=Mon → same day, 6=Sun → +6 days
		})
	}

	tx, err := r.db.Begin()
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback()

	// Check for conflicts.
	var conflicting []string
	for _, p := range planned {
		dateStr := p.dueDate.Format(time.DateOnly)
		var exists int
		if err := tx.QueryRow(
			`SELECT COUNT(*) FROM assigned_workouts WHERE student_id = ? AND due_date = ?`,
			req.StudentID, dateStr,
		).Scan(&exists); err != nil {
			return nil, nil, err
		}
		if exists > 0 {
			conflicting = append(conflicting, dateStr)
		}
	}
	if len(conflicting) > 0 {
		return nil, conflicting, nil
	}

	// No conflicts — insert assigned_workouts and segments.
	var ids []int64
	for _, p := range planned {
		dateStr := p.dueDate.Format(time.DateOnly)
		res, err := tx.Exec(
			`INSERT INTO assigned_workouts
			 (coach_id, student_id, title, description, type, distance_km, duration_seconds, notes, due_date, status)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
			coachID, req.StudentID, p.day.Title, p.day.Description, p.day.Type,
			p.day.DistanceKm, p.day.DurationSeconds, p.day.Notes, dateStr,
		)
		if err != nil {
			return nil, nil, err
		}
		awID, err := res.LastInsertId()
		if err != nil {
			return nil, nil, err
		}
		for i, seg := range p.day.Segments {
			if _, err := tx.Exec(
				`INSERT INTO assigned_workout_segments
				 (assigned_workout_id, order_index, segment_type, repetitions, value, unit, intensity,
				  work_value, work_unit, work_intensity, rest_value, rest_unit, rest_intensity)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				awID, i, seg.SegmentType, seg.Repetitions, seg.Value, seg.Unit, seg.Intensity,
				seg.WorkValue, seg.WorkUnit, seg.WorkIntensity, seg.RestValue, seg.RestUnit, seg.RestIntensity,
			); err != nil {
				return nil, nil, err
			}
		}
		ids = append(ids, awID)
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, err
	}
	return ids, nil, nil
}
```

- [ ] **Step 2: Verify module path**

Check the module name (needed for the import path):
```bash
head -1 ~/Desktop/FitReg/FitRegAPI/go.mod
```

If the module is not `github.com/fitreg/api`, update all import paths in the file accordingly.

- [ ] **Step 3: Build check**

```bash
cd ~/Desktop/FitReg/FitRegAPI
go build ./...
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add repository/weekly_template_repository.go
git commit -m "feat: add weekly template repository implementation"
```

---

## Task 5: Service Layer

**Files:**
- Create: `FitRegAPI/services/weekly_template_service.go`

- [ ] **Step 1: Create the service file**

```go
package services

import (
	"database/sql"
	"errors"
	"time"

	"github.com/fitreg/api/models"
	"github.com/fitreg/api/repository"
)

// ErrWeeklyTemplateNotFound is returned when the template does not exist or belongs to another coach.
var ErrWeeklyTemplateNotFound = errors.New("weekly template not found")

// ErrAssignConflict is returned when one or more dates already have an assigned workout.
// The caller should inspect ConflictDates for the 409 response.
var ErrAssignConflict = errors.New("assignment conflict")

// WeeklyTemplateService encapsulates business logic for weekly templates.
type WeeklyTemplateService struct {
	repo      repository.WeeklyTemplateRepository
	coachRepo repository.CoachRepository
	userRepo  repository.UserRepository
}

// NewWeeklyTemplateService creates a new WeeklyTemplateService.
func NewWeeklyTemplateService(
	repo repository.WeeklyTemplateRepository,
	coachRepo repository.CoachRepository,
	userRepo repository.UserRepository,
) *WeeklyTemplateService {
	return &WeeklyTemplateService{repo: repo, coachRepo: coachRepo, userRepo: userRepo}
}

func (s *WeeklyTemplateService) List(coachID int64) ([]models.WeeklyTemplate, error) {
	isCoach, err := s.userRepo.IsCoach(coachID)
	if err != nil || !isCoach {
		return nil, ErrNotCoach
	}
	return s.repo.List(coachID)
}

func (s *WeeklyTemplateService) Create(coachID int64, req models.CreateWeeklyTemplateRequest) (models.WeeklyTemplate, error) {
	isCoach, err := s.userRepo.IsCoach(coachID)
	if err != nil || !isCoach {
		return models.WeeklyTemplate{}, ErrNotCoach
	}
	if req.Name == "" {
		return models.WeeklyTemplate{}, errors.New("name is required")
	}
	id, err := s.repo.Create(coachID, req)
	if err != nil {
		return models.WeeklyTemplate{}, err
	}
	return s.repo.GetByID(id)
}

func (s *WeeklyTemplateService) Get(id, coachID int64) (models.WeeklyTemplate, error) {
	wt, err := s.repo.GetByID(id)
	if err == sql.ErrNoRows {
		return wt, ErrWeeklyTemplateNotFound
	}
	if err != nil {
		return wt, err
	}
	if wt.CoachID != coachID {
		return models.WeeklyTemplate{}, ErrWeeklyTemplateNotFound
	}
	return wt, nil
}

func (s *WeeklyTemplateService) UpdateMeta(id, coachID int64, req models.UpdateWeeklyTemplateRequest) (models.WeeklyTemplate, error) {
	wt, err := s.Get(id, coachID)
	if err != nil {
		return wt, err
	}
	if req.Name == "" {
		return models.WeeklyTemplate{}, errors.New("name is required")
	}
	if err := s.repo.UpdateMeta(id, coachID, req); err != nil {
		return models.WeeklyTemplate{}, err
	}
	return s.repo.GetByID(id)
}

func (s *WeeklyTemplateService) Delete(id, coachID int64) error {
	if _, err := s.Get(id, coachID); err != nil {
		return err
	}
	found, err := s.repo.Delete(id, coachID)
	if err != nil {
		return err
	}
	if !found {
		return ErrWeeklyTemplateNotFound
	}
	return nil
}

// ConflictError carries the conflicting dates for the 409 response.
type ConflictError struct {
	Dates []string
}

func (e *ConflictError) Error() string { return ErrAssignConflict.Error() }

func (s *WeeklyTemplateService) PutDays(id, coachID int64, req models.PutDaysRequest) (models.WeeklyTemplate, error) {
	if _, err := s.Get(id, coachID); err != nil {
		return models.WeeklyTemplate{}, err
	}

	// Validate day_of_week range and uniqueness.
	seen := map[int]bool{}
	for _, d := range req.Days {
		if d.DayOfWeek < 0 || d.DayOfWeek > 6 {
			return models.WeeklyTemplate{}, errors.New("day_of_week must be between 0 and 6")
		}
		if seen[d.DayOfWeek] {
			return models.WeeklyTemplate{}, errors.New("duplicate day_of_week in request")
		}
		seen[d.DayOfWeek] = true
		if d.Title == "" {
			return models.WeeklyTemplate{}, errors.New("each day must have a title")
		}
	}

	if err := s.repo.PutDays(id, req.Days); err != nil {
		return models.WeeklyTemplate{}, err
	}
	return s.repo.GetByID(id)
}

func (s *WeeklyTemplateService) Assign(id, coachID int64, req models.AssignWeeklyTemplateRequest) (models.AssignWeeklyTemplateResponse, error) {
	// Ownership check.
	if _, err := s.Get(id, coachID); err != nil {
		return models.AssignWeeklyTemplateResponse{}, err
	}

	// start_date must be a Monday.
	startDate, err := time.Parse(time.DateOnly, req.StartDate)
	if err != nil {
		return models.AssignWeeklyTemplateResponse{}, errors.New("invalid start_date format, expected YYYY-MM-DD")
	}
	if startDate.Weekday() != time.Monday {
		return models.AssignWeeklyTemplateResponse{}, errors.New("start_date must be a Monday")
	}

	// Student must be in coach roster.
	isStudent, err := s.coachRepo.IsStudentOf(coachID, req.StudentID)
	if err != nil {
		return models.AssignWeeklyTemplateResponse{}, err
	}
	if !isStudent {
		return models.AssignWeeklyTemplateResponse{}, ErrForbidden
	}

	ids, conflicts, err := s.repo.Assign(id, coachID, req)
	if err != nil {
		return models.AssignWeeklyTemplateResponse{}, err
	}
	if len(conflicts) > 0 {
		return models.AssignWeeklyTemplateResponse{}, &ConflictError{Dates: conflicts}
	}
	if ids == nil {
		ids = []int64{}
	}
	return models.AssignWeeklyTemplateResponse{AssignedWorkoutIDs: ids}, nil
}
```

Note: `ErrNotCoach`, `ErrForbidden` are already defined in `services/errors.go` (or wherever the existing services define them). Check with:

```bash
grep -rn "ErrNotCoach\|ErrForbidden" ~/Desktop/FitReg/FitRegAPI/services/
```

If they're defined in another file (e.g., `services/coach_service.go`), use the existing definitions — do NOT redeclare them.

- [ ] **Step 2: Build check**

```bash
cd ~/Desktop/FitReg/FitRegAPI
go build ./...
```

Fix any "already declared" errors by removing duplicate `var Err...` declarations.

- [ ] **Step 3: Commit**

```bash
git add services/weekly_template_service.go
git commit -m "feat: add weekly template service"
```

---

## Task 6: HTTP Handler

**Files:**
- Create: `FitRegAPI/handlers/weekly_template_handler.go`

- [ ] **Step 1: Create the handler file**

```go
package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/fitreg/api/middleware"
	"github.com/fitreg/api/models"
	"github.com/fitreg/api/services"
)

// WeeklyTemplateHandler handles /api/coach/weekly-templates endpoints.
type WeeklyTemplateHandler struct {
	svc *services.WeeklyTemplateService
}

// NewWeeklyTemplateHandler creates a new WeeklyTemplateHandler.
func NewWeeklyTemplateHandler(svc *services.WeeklyTemplateService) *WeeklyTemplateHandler {
	return &WeeklyTemplateHandler{svc: svc}
}

// weeklyTemplateIDFromPath extracts the numeric ID from a path like /api/coach/weekly-templates/42
// or /api/coach/weekly-templates/42/days. Returns 0 and an error string on failure.
func weeklyTemplateIDFromPath(r *http.Request) (int64, string) {
	// Path: /api/coach/weekly-templates/{id} or /api/coach/weekly-templates/{id}/...
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/coach/weekly-templates/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		return 0, "missing id"
	}
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, "invalid id"
	}
	return id, ""
}

// List handles GET /api/coach/weekly-templates
func (h *WeeklyTemplateHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	templates, err := h.svc.List(userID)
	if errors.Is(err, services.ErrNotCoach) {
		writeError(w, http.StatusForbidden, "User is not a coach")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch weekly templates")
		return
	}
	writeJSON(w, http.StatusOK, templates)
}

// Create handles POST /api/coach/weekly-templates
func (h *WeeklyTemplateHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var req models.CreateWeeklyTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	tmpl, err := h.svc.Create(userID, req)
	if errors.Is(err, services.ErrNotCoach) {
		writeError(w, http.StatusForbidden, "User is not a coach")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, tmpl)
}

// Get handles GET /api/coach/weekly-templates/{id}
func (h *WeeklyTemplateHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id, errMsg := weeklyTemplateIDFromPath(r)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}
	tmpl, err := h.svc.Get(id, userID)
	if errors.Is(err, services.ErrWeeklyTemplateNotFound) {
		writeError(w, http.StatusNotFound, "Weekly template not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch weekly template")
		return
	}
	writeJSON(w, http.StatusOK, tmpl)
}

// UpdateMeta handles PUT /api/coach/weekly-templates/{id}
func (h *WeeklyTemplateHandler) UpdateMeta(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id, errMsg := weeklyTemplateIDFromPath(r)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}
	var req models.UpdateWeeklyTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	tmpl, err := h.svc.UpdateMeta(id, userID, req)
	if errors.Is(err, services.ErrWeeklyTemplateNotFound) {
		writeError(w, http.StatusNotFound, "Weekly template not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, tmpl)
}

// Delete handles DELETE /api/coach/weekly-templates/{id}
func (h *WeeklyTemplateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id, errMsg := weeklyTemplateIDFromPath(r)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}
	err := h.svc.Delete(id, userID)
	if errors.Is(err, services.ErrWeeklyTemplateNotFound) {
		writeError(w, http.StatusNotFound, "Weekly template not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete weekly template")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PutDays handles PUT /api/coach/weekly-templates/{id}/days
func (h *WeeklyTemplateHandler) PutDays(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id, errMsg := weeklyTemplateIDFromPath(r)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}
	var req models.PutDaysRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Days == nil {
		req.Days = []models.WeeklyTemplateDayRequest{}
	}
	tmpl, err := h.svc.PutDays(id, userID, req)
	if errors.Is(err, services.ErrWeeklyTemplateNotFound) {
		writeError(w, http.StatusNotFound, "Weekly template not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, tmpl)
}

// Assign handles POST /api/coach/weekly-templates/{id}/assign
func (h *WeeklyTemplateHandler) Assign(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id, errMsg := weeklyTemplateIDFromPath(r)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}
	var req models.AssignWeeklyTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.StudentID == 0 {
		writeError(w, http.StatusBadRequest, "student_id is required")
		return
	}
	if req.StartDate == "" {
		writeError(w, http.StatusBadRequest, "start_date is required")
		return
	}

	resp, err := h.svc.Assign(id, userID, req)
	if errors.Is(err, services.ErrWeeklyTemplateNotFound) {
		writeError(w, http.StatusNotFound, "Weekly template not found")
		return
	}
	if errors.Is(err, services.ErrForbidden) {
		writeError(w, http.StatusForbidden, "Student is not in your roster")
		return
	}
	// Conflict error: extract the dates and return 409.
	var conflictErr *services.ConflictError
	if errors.As(err, &conflictErr) {
		writeJSON(w, http.StatusConflict, models.AssignConflictResponse{
			Error:            "conflict",
			ConflictingDates: conflictErr.Dates,
		})
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}
```

- [ ] **Step 2: Build check**

```bash
cd ~/Desktop/FitReg/FitRegAPI
go build ./...
```

Fix any errors. Common issues:
- `ErrForbidden` may be in a different package — check with `grep -rn "ErrForbidden" services/`
- `writeError` and `writeJSON` are already defined in another handler file — no redeclaration needed

- [ ] **Step 3: Commit**

```bash
git add handlers/weekly_template_handler.go
git commit -m "feat: add weekly template HTTP handler"
```

---

## Task 7: Router Registration + Full Build Check

**Files:**
- Modify: `FitRegAPI/router/router.go`

- [ ] **Step 1: Wire up dependencies and add routes**

In `router/router.go`, find where the template handler is instantiated (look for `NewTemplateHandler` or similar) and add the weekly template wiring nearby.

First add the import (if the module path differs, adjust accordingly):
```go
// no new imports needed — handlers and services packages already imported
```

Find the section where handlers are created (look for `template := handlers.NewTemplateHandler(...)`) and add:

```go
weeklyTemplateRepo := repository.NewWeeklyTemplateRepository(db)
weeklyTemplateSvc := services.NewWeeklyTemplateService(weeklyTemplateRepo, coachRepo, userRepo)
weeklyTemplate := handlers.NewWeeklyTemplateHandler(weeklyTemplateSvc)
```

Then add 3 route blocks after the existing `/api/coach/templates` routes:

```go
// Weekly template collection: GET list, POST create
mux.HandleFunc("/api/coach/weekly-templates", func(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		weeklyTemplate.List(w, r)
	case http.MethodPost:
		weeklyTemplate.Create(w, r)
	default:
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
})

// Individual template: GET, PUT (meta), DELETE, plus /days and /assign sub-paths
mux.HandleFunc("/api/coach/weekly-templates/", func(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	if strings.HasSuffix(path, "/days") && r.Method == http.MethodPut {
		weeklyTemplate.PutDays(w, r)
		return
	}
	if strings.HasSuffix(path, "/assign") && r.Method == http.MethodPost {
		weeklyTemplate.Assign(w, r)
		return
	}

	switch r.Method {
	case http.MethodGet:
		weeklyTemplate.Get(w, r)
	case http.MethodPut:
		weeklyTemplate.UpdateMeta(w, r)
	case http.MethodDelete:
		weeklyTemplate.Delete(w, r)
	default:
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
})
```

Note: The existing routes use `mux.HandleFunc` without explicit auth middleware — authentication is enforced inside each handler via `middleware.UserIDFromContext(r.Context())` (returns 0 if unauthenticated). Auth middleware is applied at the mux level in `main.go` or as a wrapper for the entire mux. Match this pattern exactly — do not add per-route auth wrappers.

- [ ] **Step 2: Full build + run check**

```bash
cd ~/Desktop/FitReg/FitRegAPI
go build ./...
```

Then start the server and manually verify the new routes respond:
```bash
export $(cat .env | xargs)
go run main.go &
sleep 2

# Should get 401 (not 404), which means route is registered and auth middleware fires
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/coach/weekly-templates
# Expected: 401

kill %1
```

- [ ] **Step 3: Commit**

```bash
git add router/router.go
git commit -m "feat: register weekly template routes"
```

---

## Task 8: Frontend Types + API Client

**Files:**
- Modify: `FitRegFE/src/types/index.ts`
- Create: `FitRegFE/src/api/weeklyTemplates.ts`

- [ ] **Step 1: Add types to `src/types/index.ts`**

Add after the existing `WorkoutTemplate` interface:

```typescript
export interface WeeklyTemplateSegment {
  order_index: number;
  segment_type: 'simple' | 'interval';
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
  coach_id: number;
  name: string;
  description: string | null;
  days: WeeklyTemplateDay[];
  day_count?: number;
  created_at: string;
  updated_at: string;
}

export interface AssignConflictResponse {
  error: string;
  conflicting_dates: string[];
}
```

- [ ] **Step 2: Create `src/api/weeklyTemplates.ts`**

```typescript
import client from './client';
import type { WeeklyTemplate, WeeklyTemplateDay } from '../types';

export const listWeeklyTemplates = () =>
  client.get<WeeklyTemplate[]>('/coach/weekly-templates');

export const getWeeklyTemplate = (id: number) =>
  client.get<WeeklyTemplate>(`/coach/weekly-templates/${id}`);

export const createWeeklyTemplate = (data: { name: string; description?: string }) =>
  client.post<WeeklyTemplate>('/coach/weekly-templates', data);

export const updateWeeklyTemplateMeta = (id: number, data: { name: string; description?: string }) =>
  client.put<WeeklyTemplate>(`/coach/weekly-templates/${id}`, data);

export const deleteWeeklyTemplate = (id: number) =>
  client.delete(`/coach/weekly-templates/${id}`);

export const putWeeklyTemplateDays = (id: number, days: WeeklyTemplateDay[]) =>
  client.put<WeeklyTemplate>(`/coach/weekly-templates/${id}/days`, { days });

export const assignWeeklyTemplate = (id: number, studentId: number, startDate: string) =>
  client.post<{ assigned_workout_ids: number[] }>(
    `/coach/weekly-templates/${id}/assign`,
    { student_id: studentId, start_date: startDate }
  );
```

- [ ] **Step 3: TypeScript check**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/api/weeklyTemplates.ts
git commit -m "feat: add weekly template types and API client"
```

---

## Task 9: List Page

**Files:**
- Create: `FitRegFE/src/pages/CoachWeeklyTemplates.tsx`

- [ ] **Step 1: Create the list page**

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useFeedback } from '../context/FeedbackContext';
import { listWeeklyTemplates, deleteWeeklyTemplate } from '../api/weeklyTemplates';
import WeeklyTemplateAssignModal from '../components/WeeklyTemplateAssignModal';
import type { WeeklyTemplate } from '../types';

export default function CoachWeeklyTemplates() {
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WeeklyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [assigningTemplate, setAssigningTemplate] = useState<WeeklyTemplate | null>(null);

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await listWeeklyTemplates();
      setTemplates(res.data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteWeeklyTemplate(id);
      showSuccess(t('weekly_template_deleted'));
      setConfirmDeleteId(null);
      loadTemplates();
    } catch {
      showError(t('error'));
    }
  }

  return (
    <div className="page">
      <div className="coach-section-header">
        <h1>{t('weekly_template_title')}</h1>
        <button className="btn btn-primary" onClick={() => navigate('/coach/weekly-templates/new')}>
          + {t('weekly_template_new')}
        </button>
      </div>

      {loading && <p>{t('loading')}</p>}

      {!loading && templates.length === 0 && (
        <p className="empty-hint">{t('weekly_template_empty')}</p>
      )}

      {!loading && templates.length > 0 && (
        <div className="template-list">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="template-card">
              <div className="template-card-header">
                <h3>{tmpl.name}</h3>
                <span className="day-modal-type-badge">
                  {t('weekly_template_days_count', { count: tmpl.day_count ?? 0 })}
                </span>
              </div>
              {tmpl.description && (
                <p className="template-card-desc">{tmpl.description}</p>
              )}
              <div className="template-card-actions">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => navigate(`/coach/weekly-templates/${tmpl.id}/edit`)}
                >
                  {t('edit')}
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setAssigningTemplate(tmpl)}
                >
                  {t('weekly_template_assign')}
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => setConfirmDeleteId(tmpl.id)}
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDeleteId !== null && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('weekly_template_delete')}</h3>
            <p>{t('weekly_template_delete_confirm')}</p>
            <div className="form-actions">
              <button className="btn" onClick={() => setConfirmDeleteId(null)}>
                {t('cancel')}
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDeleteId)}>
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {assigningTemplate && (
        <WeeklyTemplateAssignModal
          template={assigningTemplate}
          onClose={() => setAssigningTemplate(null)}
          onSuccess={() => {
            setAssigningTemplate(null);
            showSuccess(t('weekly_template_assigned'));
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

Ignore errors for components not yet created (`WeeklyTemplateAssignModal`) — they will be resolved in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/pages/CoachWeeklyTemplates.tsx
git commit -m "feat: add CoachWeeklyTemplates list page"
```

---

## Task 10: Calendar and Cell Components

**Files:**
- Create: `FitRegFE/src/components/WeeklyTemplateCalendar.tsx`
- Create: `FitRegFE/src/components/WeeklyDayCell.tsx`

- [ ] **Step 1: Create `WeeklyDayCell.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import type { WeeklyTemplateDay } from '../types';

interface Props {
  dayIndex: number; // 0=Mon … 6=Sun
  day: WeeklyTemplateDay | null;
  onClick: () => void;
}

const DAY_LABELS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeeklyDayCell({ dayIndex, day, onClick }: Props) {
  const { i18n } = useTranslation();
  const labels = i18n.language.startsWith('es') ? DAY_LABELS_ES : DAY_LABELS_EN;

  return (
    <div
      className={`weekly-day-cell ${day ? 'weekly-day-cell--filled' : 'weekly-day-cell--empty'}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <span className="weekly-day-cell__label">{labels[dayIndex]}</span>
      {day ? (
        <>
          <span className="weekly-day-cell__title">{day.title}</span>
          {day.type && (
            <span className="day-modal-type-badge">{day.type}</span>
          )}
        </>
      ) : (
        <span className="weekly-day-cell__rest">—</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `WeeklyTemplateCalendar.tsx`**

```tsx
import WeeklyDayCell from './WeeklyDayCell';
import type { WeeklyTemplateDay } from '../types';

interface Props {
  days: (WeeklyTemplateDay | null)[]; // index 0–6, null = rest day
  onDayClick: (dayIndex: number) => void;
}

export default function WeeklyTemplateCalendar({ days, onDayClick }: Props) {
  return (
    <div className="weekly-template-calendar">
      {Array.from({ length: 7 }, (_, i) => (
        <WeeklyDayCell
          key={i}
          dayIndex={i}
          day={days[i] ?? null}
          onClick={() => onDayClick(i)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add CSS for the calendar and cells**

In `FitRegFE/src/App.css` (or the appropriate CSS file used for coach components), append:

```css
/* Weekly Template Calendar */
.weekly-template-calendar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0;
}

.weekly-day-cell {
  flex: 1;
  min-width: 80px;
  min-height: 90px;
  border-radius: 8px;
  border: 2px dashed var(--color-border, #d1d5db);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 8px 4px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  gap: 4px;
  text-align: center;
}

.weekly-day-cell:hover {
  border-color: var(--color-primary, #6366f1);
  background: var(--color-primary-light, #eef2ff);
}

.weekly-day-cell--filled {
  border-style: solid;
  border-color: var(--color-primary, #6366f1);
  background: var(--color-primary-light, #eef2ff);
}

.weekly-day-cell__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text-muted, #6b7280);
}

.weekly-day-cell__title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text, #111827);
  word-break: break-word;
}

.weekly-day-cell__rest {
  font-size: 0.75rem;
  color: var(--color-text-muted, #9ca3af);
}
```

Check what CSS variables are available by searching:
```bash
grep -n "\-\-color-" ~/Desktop/FitReg/FitRegFE/src/App.css | head -20
```

Adjust variable names to match what exists in the project.

- [ ] **Step 4: TypeScript check**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/WeeklyTemplateCalendar.tsx src/components/WeeklyDayCell.tsx src/App.css
git commit -m "feat: add WeeklyTemplateCalendar and WeeklyDayCell components"
```

---

## Task 11: Day Editor Modal

**Files:**
- Create: `FitRegFE/src/components/WeeklyDayEditor.tsx`

The day editor allows editing a single day's workout. It can preload from a daily template or be filled manually.

- [ ] **Step 1: Create `WeeklyDayEditor.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listTemplates } from '../api/templates';
import type { WeeklyTemplateDay, WeeklyTemplateSegment, WorkoutTemplate } from '../types';

interface Props {
  dayIndex: number; // 0=Mon … 6=Sun
  initial: WeeklyTemplateDay | null;
  onSave: (day: WeeklyTemplateDay) => void;
  onRemove: () => void;
  onCancel: () => void;
}

const DAY_NAMES_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const emptySegment = (): WeeklyTemplateSegment => ({
  order_index: 0,
  segment_type: 'simple',
  repetitions: 1,
  value: 0,
  unit: '',
  intensity: '',
  work_value: 0,
  work_unit: '',
  work_intensity: '',
  rest_value: 0,
  rest_unit: '',
  rest_intensity: '',
});

export default function WeeklyDayEditor({ dayIndex, initial, onSave, onRemove, onCancel }: Props) {
  const { t, i18n } = useTranslation();
  const dayNames = i18n.language.startsWith('es') ? DAY_NAMES_ES : DAY_NAMES_EN;

  const [dailyTemplates, setDailyTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState(initial?.type ?? '');
  const [distanceKm, setDistanceKm] = useState(initial?.distance_km ?? 0);
  const [durationSeconds, setDurationSeconds] = useState(initial?.duration_seconds ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [fromTemplateId, setFromTemplateId] = useState<number | null>(initial?.from_template_id ?? null);
  const [segments, setSegments] = useState<WeeklyTemplateSegment[]>(initial?.segments ?? []);

  useEffect(() => {
    listTemplates().then((res) => setDailyTemplates(res.data)).catch(() => {});
  }, []);

  function handleTemplateLoad(templateId: number | '') {
    setSelectedTemplateId(templateId);
    if (templateId === '') return;
    const tmpl = dailyTemplates.find((t) => t.id === templateId);
    if (!tmpl) return;
    setTitle(tmpl.title);
    setDescription(tmpl.description ?? '');
    setType(tmpl.type ?? '');
    setNotes(tmpl.notes ?? '');
    setFromTemplateId(tmpl.id);
    setSegments(
      (tmpl.segments ?? []).map((s, i) => ({
        order_index: i,
        segment_type: s.segment_type,
        repetitions: s.repetitions,
        value: s.value,
        unit: s.unit,
        intensity: s.intensity,
        work_value: s.work_value,
        work_unit: s.work_unit,
        work_intensity: s.work_intensity,
        rest_value: s.rest_value,
        rest_unit: s.rest_unit,
        rest_intensity: s.rest_intensity,
      }))
    );
  }

  function addSegment() {
    setSegments((prev) => [...prev, { ...emptySegment(), order_index: prev.length }]);
  }

  function removeSegment(index: number) {
    setSegments((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order_index: i })));
  }

  function updateSegment(index: number, field: keyof WeeklyTemplateSegment, value: string | number) {
    setSegments((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function handleSave() {
    if (!title.trim()) return;
    onSave({
      day_of_week: dayIndex,
      title: title.trim(),
      description,
      type,
      distance_km: distanceKm,
      duration_seconds: durationSeconds,
      notes,
      from_template_id: fromTemplateId,
      segments,
    });
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h3>{dayNames[dayIndex]}</h3>

        {/* Preload from daily template */}
        <div className="form-group">
          <label>{t('weekly_template_load_from')}</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateLoad(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">{t('weekly_template_load_select')}</option>
            {dailyTemplates.map((tmpl) => (
              <option key={tmpl.id} value={tmpl.id}>{tmpl.title}</option>
            ))}
          </select>
        </div>

        {/* Manual fields */}
        <div className="form-group">
          <label>{t('title')} *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label>{t('description')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="form-group">
          <label>{t('type')}</label>
          <input value={type} onChange={(e) => setType(e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>{t('distance_km')}</label>
            <input type="number" min="0" step="0.1" value={distanceKm}
              onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="form-group">
            <label>{t('duration_seconds')}</label>
            <input type="number" min="0" value={durationSeconds}
              onChange={(e) => setDurationSeconds(parseInt(e.target.value) || 0)} />
          </div>
        </div>
        <div className="form-group">
          <label>{t('notes')}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        {/* Segments */}
        <div className="form-group">
          <label>{t('segments')}</label>
          {segments.map((seg, i) => (
            <div key={i} className="segment-row">
              <select
                value={seg.segment_type}
                onChange={(e) => updateSegment(i, 'segment_type', e.target.value as 'simple' | 'interval')}
              >
                <option value="simple">{t('segment_simple')}</option>
                <option value="interval">{t('segment_interval')}</option>
              </select>
              <input
                type="number" placeholder={t('value')} min="0" step="0.01"
                value={seg.value || ''} onChange={(e) => updateSegment(i, 'value', parseFloat(e.target.value) || 0)}
              />
              <input
                placeholder={t('unit')} value={seg.unit}
                onChange={(e) => updateSegment(i, 'unit', e.target.value)}
              />
              <button type="button" className="btn btn-sm btn-danger" onClick={() => removeSegment(i)}>×</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={addSegment}>
            + {t('add_segment')}
          </button>
        </div>

        <div className="form-actions">
          <button className="btn" onClick={onCancel}>{t('cancel')}</button>
          {initial && (
            <button className="btn btn-danger" onClick={onRemove}>
              {t('weekly_template_remove_day')}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={!title.trim()}>
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Note: The segment row only shows `value` and `unit` for simplicity. The existing segment editor in `AssignWorkoutFields` has more fields (intensity, work/rest for intervals). Check what fields `AssignWorkoutFields` renders for segments, and consider either reusing its segment row component or extending `WeeklyDayEditor` to match. The key requirement is correctness — all segment fields must be saveable.

If the project has a reusable `SegmentRow` component, use it instead. Search with:
```bash
grep -rn "SegmentRow\|segment-row\|segment_type" ~/Desktop/FitReg/FitRegFE/src/components/ | head -10
```

- [ ] **Step 2: TypeScript check**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/WeeklyDayEditor.tsx
git commit -m "feat: add WeeklyDayEditor modal component"
```

---

## Task 12: Form Page (Create / Edit)

**Files:**
- Create: `FitRegFE/src/pages/WeeklyTemplateForm.tsx`

This page handles both create (`/coach/weekly-templates/new`) and edit (`/coach/weekly-templates/:id/edit`).

- [ ] **Step 1: Create `WeeklyTemplateForm.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useFeedback } from '../context/FeedbackContext';
import {
  getWeeklyTemplate,
  createWeeklyTemplate,
  updateWeeklyTemplateMeta,
  putWeeklyTemplateDays,
} from '../api/weeklyTemplates';
import WeeklyTemplateCalendar from '../components/WeeklyTemplateCalendar';
import WeeklyDayEditor from '../components/WeeklyDayEditor';
import type { WeeklyTemplateDay } from '../types';

export default function WeeklyTemplateForm() {
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // days[i] = day with day_of_week === i, or null for rest
  const [days, setDays] = useState<(WeeklyTemplateDay | null)[]>(Array(7).fill(null));
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit || !id) return;
    getWeeklyTemplate(Number(id))
      .then((res) => {
        setName(res.data.name);
        setDescription(res.data.description ?? '');
        const arr: (WeeklyTemplateDay | null)[] = Array(7).fill(null);
        for (const day of res.data.days) {
          arr[day.day_of_week] = day;
        }
        setDays(arr);
      })
      .catch(() => showError(t('error')))
      .finally(() => setLoading(false));
  }, [id]);

  function handleDayChange(dayIndex: number, data: WeeklyTemplateDay) {
    setDays((prev) => {
      const next = [...prev];
      next[dayIndex] = { ...data, day_of_week: dayIndex };
      return next;
    });
    setEditingDayIndex(null);
  }

  function handleRemoveDay(dayIndex: number) {
    setDays((prev) => {
      const next = [...prev];
      next[dayIndex] = null;
      return next;
    });
    setEditingDayIndex(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      showError(t('weekly_template_name_required'));
      return;
    }
    setSaving(true);
    try {
      let templateId = id ? Number(id) : null;

      if (isEdit && templateId) {
        await updateWeeklyTemplateMeta(templateId, { name: name.trim(), description });
      } else {
        const res = await createWeeklyTemplate({ name: name.trim(), description });
        templateId = res.data.id;
      }

      // Save all non-null days.
      const activeDays = days.filter((d): d is WeeklyTemplateDay => d !== null);
      await putWeeklyTemplateDays(templateId!, activeDays);

      showSuccess(isEdit ? t('weekly_template_updated') : t('weekly_template_created'));
      navigate('/coach/weekly-templates');
    } catch {
      showError(t('error'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>{t('loading')}</p>;

  return (
    <div className="page">
      <h1>{isEdit ? t('weekly_template_edit') : t('weekly_template_new')}</h1>

      <div className="form-group">
        <label>{t('name')} *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label>{t('description')}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>

      <WeeklyTemplateCalendar days={days} onDayClick={setEditingDayIndex} />

      <div className="form-actions">
        <button className="btn" onClick={() => navigate('/coach/weekly-templates')}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? t('saving') : t('save')}
        </button>
      </div>

      {editingDayIndex !== null && (
        <WeeklyDayEditor
          dayIndex={editingDayIndex}
          initial={days[editingDayIndex]}
          onSave={(day) => handleDayChange(editingDayIndex, day)}
          onRemove={() => handleRemoveDay(editingDayIndex)}
          onCancel={() => setEditingDayIndex(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/WeeklyTemplateForm.tsx
git commit -m "feat: add WeeklyTemplateForm page"
```

---

## Task 13: Assign Modal

**Files:**
- Create: `FitRegFE/src/components/WeeklyTemplateAssignModal.tsx`

- [ ] **Step 1: Create `WeeklyTemplateAssignModal.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listStudents } from '../api/coach';
import { assignWeeklyTemplate } from '../api/weeklyTemplates';
import type { Student, WeeklyTemplate, AssignConflictResponse } from '../types';

interface Props {
  template: WeeklyTemplate;
  onClose: () => void;
  onSuccess: () => void;
}

function isMonday(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00'); // force local midnight
  return d.getDay() === 1; // 1 = Monday in JS Date
}

export default function WeeklyTemplateAssignModal({ template, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [dateError, setDateError] = useState('');
  const [conflictDates, setConflictDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listStudents().then((res) => setStudents(res.data)).catch(() => {});
  }, []);

  function handleDateChange(val: string) {
    setStartDate(val);
    setConflictDates([]);
    if (val && !isMonday(val)) {
      setDateError(t('weekly_template_must_be_monday'));
    } else {
      setDateError('');
    }
  }

  async function handleConfirm() {
    if (!studentId || !startDate) return;
    if (!isMonday(startDate)) {
      setDateError(t('weekly_template_must_be_monday'));
      return;
    }
    setSaving(true);
    setConflictDates([]);
    try {
      await assignWeeklyTemplate(template.id, Number(studentId), startDate);
      onSuccess();
    } catch (err: unknown) {
      // Check for 409 conflict response
      const axiosErr = err as { response?: { status: number; data: AssignConflictResponse } };
      if (axiosErr.response?.status === 409) {
        setConflictDates(axiosErr.response.data.conflicting_dates ?? []);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('weekly_template_assign')}: {template.name}</h3>

        <div className="form-group">
          <label>{t('student')}</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">{t('select_student')}</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>{t('weekly_template_start_date')}</label>
          <input type="date" value={startDate} onChange={(e) => handleDateChange(e.target.value)} />
          {dateError && <p className="form-error">{dateError}</p>}
        </div>

        {conflictDates.length > 0 && (
          <div className="form-error">
            <p>{t('weekly_template_conflict')}</p>
            <ul>
              {conflictDates.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </div>
        )}

        <div className="form-actions">
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!studentId || !startDate || !!dateError || saving}
          >
            {saving ? t('saving') : t('weekly_template_assign_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/WeeklyTemplateAssignModal.tsx
git commit -m "feat: add WeeklyTemplateAssignModal component"
```

---

## Task 14: Routing, Navigation, and i18n

**Files:**
- Modify: `FitRegFE/src/App.tsx`
- Modify: `FitRegFE/src/components/Sidebar.tsx`
- Modify: `FitRegFE/src/i18n/es.ts`
- Modify: `FitRegFE/src/i18n/en.ts`

- [ ] **Step 1: Add routes to `App.tsx`**

In the `<Routes>` block, add these two routes after the existing `/coach/templates` route:

```tsx
import CoachWeeklyTemplates from './pages/CoachWeeklyTemplates';
import WeeklyTemplateForm from './pages/WeeklyTemplateForm';
```

```tsx
<Route path="/coach/weekly-templates" element={<ProtectedRoute><CoachWeeklyTemplates /></ProtectedRoute>} />
<Route path="/coach/weekly-templates/new" element={<ProtectedRoute><WeeklyTemplateForm /></ProtectedRoute>} />
<Route path="/coach/weekly-templates/:id/edit" element={<ProtectedRoute><WeeklyTemplateForm /></ProtectedRoute>} />
```

- [ ] **Step 2: Add sidebar navigation link**

In `src/components/Sidebar.tsx`, find the existing link to `/coach/templates` and add a new entry directly below it:

```tsx
<Link
  to="/coach/weekly-templates"
  className={`sidebar-link ${isActive('/coach/weekly-templates') ? 'active' : ''}`}
  onClick={handleNav}
>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="4" rx="1"/>
    <rect x="3" y="10" width="18" height="4" rx="1"/>
    <rect x="3" y="16" width="18" height="4" rx="1"/>
  </svg>
  {t('weekly_template_title')}
</Link>
```

- [ ] **Step 3: Add Spanish translations to `src/i18n/es.ts`**

Add these keys in the same section as the existing `template_*` keys:

```typescript
weekly_template_title: 'Plantillas Semanales',
weekly_template_new: 'Nueva plantilla semanal',
weekly_template_edit: 'Editar plantilla semanal',
weekly_template_delete: 'Eliminar plantilla semanal',
weekly_template_delete_confirm: '¿Eliminar esta plantilla semanal? Esta acción no se puede deshacer.',
weekly_template_deleted: 'Plantilla semanal eliminada',
weekly_template_created: 'Plantilla semanal creada',
weekly_template_updated: 'Plantilla semanal actualizada',
weekly_template_assigned: 'Plantilla asignada exitosamente',
weekly_template_empty: 'No tenés plantillas semanales todavía',
weekly_template_days_count: '{{count}} día(s)',
weekly_template_name_required: 'El nombre es obligatorio',
weekly_template_assign: 'Asignar',
weekly_template_assign_confirm: 'Confirmar asignación',
weekly_template_start_date: 'Lunes de inicio',
weekly_template_must_be_monday: 'La fecha debe ser un lunes',
weekly_template_conflict: 'Ya existen entrenamientos en estas fechas:',
weekly_template_load_from: 'Cargar desde plantilla diaria',
weekly_template_load_select: 'Seleccionar plantilla...',
weekly_template_remove_day: 'Quitar día',
```

- [ ] **Step 4: Add English translations to `src/i18n/en.ts`**

Same section as existing `template_*` keys:

```typescript
weekly_template_title: 'Weekly Templates',
weekly_template_new: 'New weekly template',
weekly_template_edit: 'Edit weekly template',
weekly_template_delete: 'Delete weekly template',
weekly_template_delete_confirm: 'Delete this weekly template? This action cannot be undone.',
weekly_template_deleted: 'Weekly template deleted',
weekly_template_created: 'Weekly template created',
weekly_template_updated: 'Weekly template updated',
weekly_template_assigned: 'Template assigned successfully',
weekly_template_empty: "You don't have weekly templates yet",
weekly_template_days_count: '{{count}} day(s)',
weekly_template_name_required: 'Name is required',
weekly_template_assign: 'Assign',
weekly_template_assign_confirm: 'Confirm assignment',
weekly_template_start_date: 'Start Monday',
weekly_template_must_be_monday: 'Date must be a Monday',
weekly_template_conflict: 'Workouts already exist on these dates:',
weekly_template_load_from: 'Load from daily template',
weekly_template_load_select: 'Select template...',
weekly_template_remove_day: 'Remove day',
```

- [ ] **Step 5: Full TypeScript check**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/Sidebar.tsx src/i18n/es.ts src/i18n/en.ts
git commit -m "feat: add weekly template routes, nav link, and i18n keys"
```

---

## Task 15: End-to-End Manual Verification

- [ ] **Step 1: Start the backend**

```bash
cd ~/Desktop/FitReg/FitRegAPI
export $(cat .env | xargs)
go run main.go
```

- [ ] **Step 2: Start the frontend**

```bash
cd ~/Desktop/FitReg/FitRegFE
npm run dev
```

- [ ] **Step 3: Run through the full flow manually**

Open `http://localhost:5173` and log in as a coach.

**Test 1 — Create a weekly template:**
1. Click "Plantillas Semanales" in the sidebar
2. Click "Nueva plantilla semanal"
3. Enter a name and optional description
4. Click "Lun" → fill in a workout → Save
5. Click "Mié" → load from a daily template → Save
6. Click "Guardar" → should redirect to list with new template showing 2 days

**Test 2 — Edit the template:**
1. Click "Editar" on the template
2. Change the name
3. Remove the Wednesday workout (click cell → "Quitar día")
4. Click "Guardar" → list should show 1 day

**Test 3 — Assign the template:**
1. Click "Asignar" on the template
2. Select a student
3. Pick a non-Monday date → should show error "La fecha debe ser un lunes"
4. Pick the next Monday → Click "Confirmar asignación"
5. Should show success toast

**Test 4 — Conflict detection:**
1. Assign the same template to the same student on the same Monday again
2. Should show 409 error with the conflicting date listed

**Test 5 — Delete:**
1. Click "Eliminar" → confirm → template disappears from list

- [ ] **Step 4: Verify assigned workouts were created in DB**

```bash
mysql -u root -proot fitreg -e "SELECT id, student_id, title, due_date FROM assigned_workouts ORDER BY id DESC LIMIT 5;"
```

Expected: rows for the days that had workouts, with correct `due_date` values (Monday and following days of the week).

- [ ] **Step 5: Final commit and push**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add -A
git commit -m "feat: weekly templates — complete implementation"
git push origin develop

cd ~/Desktop/FitReg/FitRegAPI
git push origin develop
```
