# Assignment Messages Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a messaging system scoped to assigned workouts so coaches and students can communicate about specific assignments.

**Architecture:** New `assignment_messages` table with a dedicated handler serving three endpoints under `/api/assignment-messages/`. A new dual-role detail endpoint `/api/assigned-workout-detail/` serves the frontend `AssignmentDetail` page. Existing list queries gain an `unread_message_count` subquery. Frontend gets a new page, API module, and integrations in DayModal, Notifications, and Profile.

**Tech Stack:** Go stdlib HTTP + MySQL (backend), React 19 + TypeScript + Vite + Axios (frontend), react-i18next (es/en)

**Spec:** `docs/superpowers/specs/2026-03-13-assignment-messages-design.md`

---

## Chunk 1: Database & Backend Models

### Task 1: Database Migration

**Files:**
- Modify: `~/Desktop/FitReg/FitRegAPI/migrations/001_schema.sql`
- Modify: `~/Desktop/FitReg/FitRegAPI/migrations/002_prod_schema.sql`

- [ ] **Step 1: Add `assignment_messages` table to `001_schema.sql`**

Add after the `assigned_workout_segments` CREATE TABLE block (around line 233), before the `notifications` table:

```sql
-- ============================================================
-- ASSIGNMENT MESSAGES
-- ============================================================
CREATE TABLE assignment_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    assigned_workout_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    FOREIGN KEY (assigned_workout_id) REFERENCES assigned_workouts(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    INDEX idx_assignment_messages_unread (assigned_workout_id, sender_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Also add `DROP TABLE IF EXISTS assignment_messages;` to the DROP block at the top (after `DROP TABLE IF EXISTS notification_preferences;`).

- [ ] **Step 2: Add `assignment_message` column to `notification_preferences` in `001_schema.sql`**

In the `notification_preferences` CREATE TABLE (around line 255), add after `workout_completed_or_skipped`:

```sql
    assignment_message BOOLEAN NOT NULL DEFAULT TRUE,
```

- [ ] **Step 3: Add production migration to `002_prod_schema.sql`**

Append at the end of the file:

```sql
-- Assignment messages (2026-03-13)
CREATE TABLE IF NOT EXISTS assignment_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    assigned_workout_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    FOREIGN KEY (assigned_workout_id) REFERENCES assigned_workouts(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    INDEX idx_assignment_messages_unread (assigned_workout_id, sender_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS assignment_message BOOLEAN NOT NULL DEFAULT TRUE;
```

- [ ] **Step 4: Run migration on local database**

```bash
cd ~/Desktop/FitReg/FitRegAPI
mysql -u root -proot fitreg < migrations/002_prod_schema.sql
```

Expected: No errors. Verify with:
```bash
mysql -u root -proot fitreg -e "DESCRIBE assignment_messages;"
mysql -u root -proot fitreg -e "DESCRIBE notification_preferences;"
```

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/FitReg/FitRegAPI
git add migrations/001_schema.sql migrations/002_prod_schema.sql
git commit -m "db: add assignment_messages table and notification preference column"
```

---

### Task 2: Backend Models

**Files:**
- Create: `~/Desktop/FitReg/FitRegAPI/models/assignment_message.go`
- Modify: `~/Desktop/FitReg/FitRegAPI/models/notification.go`
- Modify: `~/Desktop/FitReg/FitRegAPI/models/coach.go`

- [ ] **Step 1: Create `models/assignment_message.go`**

```go
package models

import "time"

type AssignmentMessage struct {
	ID                int64     `json:"id"`
	AssignedWorkoutID int64     `json:"assigned_workout_id"`
	SenderID          int64     `json:"sender_id"`
	SenderName        string    `json:"sender_name"`
	SenderAvatar      string    `json:"sender_avatar"`
	Body              string    `json:"body"`
	IsRead            bool      `json:"is_read"`
	CreatedAt         time.Time `json:"created_at"`
}

type CreateAssignmentMessageRequest struct {
	Body string `json:"body"`
}
```

- [ ] **Step 2: Add `AssignmentMessage` field to `NotificationPreferences` in `models/notification.go`**

Update the struct and request type:

```go
type NotificationPreferences struct {
	ID                        int64 `json:"id"`
	UserID                    int64 `json:"user_id"`
	WorkoutAssigned           bool  `json:"workout_assigned"`
	WorkoutCompletedOrSkipped bool  `json:"workout_completed_or_skipped"`
	AssignmentMessage         bool  `json:"assignment_message"`
}

type UpdateNotificationPreferencesRequest struct {
	WorkoutAssigned           bool `json:"workout_assigned"`
	WorkoutCompletedOrSkipped bool `json:"workout_completed_or_skipped"`
	AssignmentMessage         bool `json:"assignment_message"`
}
```

- [ ] **Step 3: Add `UnreadMessageCount` to `AssignedWorkout` in `models/coach.go`**

Add after the `ImageURL` field (last field before the closing brace):

```go
	UnreadMessageCount int              `json:"unread_message_count"`
```

- [ ] **Step 4: Verify build**

```bash
cd ~/Desktop/FitReg/FitRegAPI
go build ./...
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add models/assignment_message.go models/notification.go models/coach.go
git commit -m "models: add AssignmentMessage type and update preferences/workout models"
```

---

## Chunk 2: Backend Handler & Route Updates

### Task 3: Assignment Message Handler

**Files:**
- Create: `~/Desktop/FitReg/FitRegAPI/handlers/assignment_message_handler.go`

- [ ] **Step 1: Create the handler file with struct, constructor, and helper**

```go
package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/fitreg/api/middleware"
	"github.com/fitreg/api/models"
)

// Note: This file uses helper functions from the handlers package:
// extractID, writeJSON, writeError, logErr (defined in workout_handler.go)
// fetchSegments, truncateDate (defined in coach_handler.go)

type AssignmentMessageHandler struct {
	DB           *sql.DB
	Notification *NotificationHandler
}

func NewAssignmentMessageHandler(db *sql.DB, nh *NotificationHandler) *AssignmentMessageHandler {
	return &AssignmentMessageHandler{DB: db, Notification: nh}
}

// getAssignmentParticipants returns coachID, studentID, status, title for an assigned workout.
func (h *AssignmentMessageHandler) getAssignmentParticipants(awID int64) (int64, int64, string, string, error) {
	var coachID, studentID int64
	var status, title string
	err := h.DB.QueryRow(
		"SELECT coach_id, student_id, status, title FROM assigned_workouts WHERE id = ?", awID,
	).Scan(&coachID, &studentID, &status, &title)
	return coachID, studentID, status, title, err
}
```

- [ ] **Step 2: Add `ListMessages` method**

```go
func (h *AssignmentMessageHandler) ListMessages(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	awID, err := extractID(r.URL.Path, "/api/assignment-messages/")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid assigned workout ID")
		return
	}

	coachID, studentID, _, _, err := h.getAssignmentParticipants(awID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Assigned workout not found")
		return
	}
	if userID != coachID && userID != studentID {
		writeError(w, http.StatusNotFound, "Assigned workout not found")
		return
	}

	rows, err := h.DB.Query(`
		SELECT am.id, am.assigned_workout_id, am.sender_id,
			u.name, COALESCE(u.custom_avatar, ''),
			am.body, am.is_read, am.created_at
		FROM assignment_messages am
		JOIN users u ON u.id = am.sender_id
		WHERE am.assigned_workout_id = ?
		ORDER BY am.created_at ASC
	`, awID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch messages")
		return
	}
	defer rows.Close()

	messages := []models.AssignmentMessage{}
	for rows.Next() {
		var m models.AssignmentMessage
		if err := rows.Scan(&m.ID, &m.AssignedWorkoutID, &m.SenderID,
			&m.SenderName, &m.SenderAvatar,
			&m.Body, &m.IsRead, &m.CreatedAt); err != nil {
			logErr("scan assignment message", err)
			continue
		}
		messages = append(messages, m)
	}

	writeJSON(w, http.StatusOK, messages)
}
```

- [ ] **Step 3: Add `SendMessage` method**

```go
func (h *AssignmentMessageHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	awID, err := extractID(r.URL.Path, "/api/assignment-messages/")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid assigned workout ID")
		return
	}

	coachID, studentID, status, title, err := h.getAssignmentParticipants(awID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Assigned workout not found")
		return
	}
	if userID != coachID && userID != studentID {
		writeError(w, http.StatusNotFound, "Assigned workout not found")
		return
	}
	if status != "pending" {
		writeError(w, http.StatusConflict, "Assignment is no longer pending")
		return
	}

	var req models.CreateAssignmentMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	body := strings.TrimSpace(req.Body)
	if body == "" || utf8.RuneCountInString(body) > 2000 {
		writeError(w, http.StatusBadRequest, "Body must be 1-2000 characters")
		return
	}

	result, err := h.DB.Exec(
		"INSERT INTO assignment_messages (assigned_workout_id, sender_id, body) VALUES (?, ?, ?)",
		awID, userID, body,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to send message")
		return
	}

	msgID, _ := result.LastInsertId()

	// Fetch the created message with sender info
	var m models.AssignmentMessage
	err = h.DB.QueryRow(`
		SELECT am.id, am.assigned_workout_id, am.sender_id,
			u.name, COALESCE(u.custom_avatar, ''),
			am.body, am.is_read, am.created_at
		FROM assignment_messages am
		JOIN users u ON u.id = am.sender_id
		WHERE am.id = ?
	`, msgID).Scan(&m.ID, &m.AssignedWorkoutID, &m.SenderID,
		&m.SenderName, &m.SenderAvatar,
		&m.Body, &m.IsRead, &m.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch created message")
		return
	}

	// Send notification to the other participant
	recipientID := coachID
	if userID == coachID {
		recipientID = studentID
	}
	notifMeta := map[string]interface{}{
		"assigned_workout_id": awID,
		"sender_name":         m.SenderName,
		"workout_title":       title,
	}
	h.Notification.CreateNotification(recipientID, "assignment_message",
		"notif_assignment_message_title", "notif_assignment_message_body", notifMeta, nil)

	writeJSON(w, http.StatusCreated, m)
}
```

- [ ] **Step 4: Add `MarkRead` method**

```go
func (h *AssignmentMessageHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	path := strings.TrimSuffix(r.URL.Path, "/read")
	awID, err := extractID(path, "/api/assignment-messages/")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid assigned workout ID")
		return
	}

	coachID, studentID, _, _, err := h.getAssignmentParticipants(awID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Assigned workout not found")
		return
	}
	if userID != coachID && userID != studentID {
		writeError(w, http.StatusNotFound, "Assigned workout not found")
		return
	}

	_, err = h.DB.Exec(
		"UPDATE assignment_messages SET is_read = TRUE WHERE assigned_workout_id = ? AND sender_id != ?",
		awID, userID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to mark messages as read")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Messages marked as read"})
}
```

- [ ] **Step 5: Add `GetAssignedWorkoutDetail` method**

This is the dual-role endpoint that authorizes both coach and student. It reuses the same query/scan pattern from `GetAssignedWorkout` in `coach_handler.go` but with `OR` authorization and the `unread_message_count` subquery.

```go
func (h *AssignmentMessageHandler) GetAssignedWorkoutDetail(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	awID, err := extractID(r.URL.Path, "/api/assigned-workout-detail/")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid assigned workout ID")
		return
	}

	var aw models.AssignedWorkout
	var description, notes, dueDate, expectedFields sql.NullString
	var studentName, coachName string

	err = h.DB.QueryRow(`
		SELECT aw.id, aw.coach_id, aw.student_id, aw.title, aw.description, aw.type,
			aw.distance_km, aw.duration_seconds, aw.notes, aw.expected_fields,
			aw.result_time_seconds, aw.result_distance_km, aw.result_heart_rate, aw.result_feeling,
			aw.image_file_id, aw.status, aw.due_date,
			aw.created_at, aw.updated_at,
			su.name, cu.name,
			(SELECT COUNT(*) FROM assignment_messages am
			 WHERE am.assigned_workout_id = aw.id AND am.sender_id != ? AND am.is_read = FALSE)
		FROM assigned_workouts aw
		JOIN users su ON su.id = aw.student_id
		JOIN users cu ON cu.id = aw.coach_id
		WHERE aw.id = ? AND (aw.coach_id = ? OR aw.student_id = ?)
	`, userID, awID, userID, userID).Scan(
		&aw.ID, &aw.CoachID, &aw.StudentID, &aw.Title, &description, &aw.Type,
		&aw.DistanceKm, &aw.DurationSeconds, &notes, &expectedFields,
		&aw.ResultTimeSeconds, &aw.ResultDistanceKm, &aw.ResultHeartRate, &aw.ResultFeeling,
		&aw.ImageFileID, &aw.Status, &dueDate,
		&aw.CreatedAt, &aw.UpdatedAt,
		&studentName, &coachName,
		&aw.UnreadMessageCount,
	)
	if err != nil {
		writeError(w, http.StatusNotFound, "Assigned workout not found")
		return
	}

	if description.Valid {
		aw.Description = description.String
	}
	if notes.Valid {
		aw.Notes = notes.String
	}
	if dueDate.Valid {
		aw.DueDate = truncateDate(dueDate.String)
	}
	if expectedFields.Valid {
		aw.ExpectedFields = json.RawMessage(expectedFields.String)
	}
	aw.StudentName = studentName
	aw.CoachName = coachName

	// Fetch segments
	aw.Segments = fetchSegments(h.DB, aw.ID)

	// Build image URL (same pattern as CoachHandler.populateImageURL)
	if aw.ImageFileID != nil {
		var uuid string
		if err := h.DB.QueryRow("SELECT uuid FROM files WHERE id = ?", *aw.ImageFileID).Scan(&uuid); err == nil {
			aw.ImageURL = "/api/files/" + uuid + "/download"
		}
	}

	writeJSON(w, http.StatusOK, aw)
}
```

Note: This method uses `fetchSegments()` which is defined in `coach_handler.go`. Since both files are in the `handlers` package, it's accessible directly. The image URL construction replicates the pattern from `CoachHandler.populateImageURL` (queries `files` table for UUID).

- [ ] **Step 6: Verify build**

```bash
cd ~/Desktop/FitReg/FitRegAPI
go build ./...
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add handlers/assignment_message_handler.go
git commit -m "feat: add assignment message handler with CRUD and detail endpoints"
```

---

### Task 4: Update Notification Handler for Preferences

**Files:**
- Modify: `~/Desktop/FitReg/FitRegAPI/handlers/notification_handler.go`

- [ ] **Step 1: Update `CreateNotification` preference check**

Find the existing preference check block (around line 28):

```go
	if notifType == "workout_assigned" || notifType == "workout_completed" || notifType == "workout_skipped" {
		var workoutAssigned, workoutCompletedOrSkipped bool
		err := h.DB.QueryRow("SELECT COALESCE(workout_assigned, TRUE), COALESCE(workout_completed_or_skipped, TRUE) FROM notification_preferences WHERE user_id = ?", userID).Scan(&workoutAssigned, &workoutCompletedOrSkipped)
```

Replace with:

```go
	if notifType == "workout_assigned" || notifType == "workout_completed" || notifType == "workout_skipped" || notifType == "assignment_message" {
		var workoutAssigned, workoutCompletedOrSkipped, assignmentMessage bool
		err := h.DB.QueryRow("SELECT COALESCE(workout_assigned, TRUE), COALESCE(workout_completed_or_skipped, TRUE), COALESCE(assignment_message, TRUE) FROM notification_preferences WHERE user_id = ?", userID).Scan(&workoutAssigned, &workoutCompletedOrSkipped, &assignmentMessage)
```

And add after the existing preference checks (after the `workout_skipped` check, around line 42):

```go
		if notifType == "assignment_message" && !assignmentMessage {
			return nil
		}
```

Also update the `ErrNoRows` default block to include: `assignmentMessage = true`.

- [ ] **Step 2: Update `GetPreferences` query**

Find (around line 444):
```go
	err := h.DB.QueryRow("SELECT id, user_id, workout_assigned, workout_completed_or_skipped FROM notification_preferences WHERE user_id = ?", userID).Scan(&prefs.ID, &prefs.UserID, &prefs.WorkoutAssigned, &prefs.WorkoutCompletedOrSkipped)
```

Replace with:
```go
	err := h.DB.QueryRow("SELECT id, user_id, workout_assigned, workout_completed_or_skipped, COALESCE(assignment_message, TRUE) FROM notification_preferences WHERE user_id = ?", userID).Scan(&prefs.ID, &prefs.UserID, &prefs.WorkoutAssigned, &prefs.WorkoutCompletedOrSkipped, &prefs.AssignmentMessage)
```

Also update the `ErrNoRows` default:
```go
		prefs = models.NotificationPreferences{UserID: userID, WorkoutAssigned: true, WorkoutCompletedOrSkipped: true, AssignmentMessage: true}
```

- [ ] **Step 3: Update `UpdatePreferences` upsert query**

Find (around line 468):
```go
	_, err := h.DB.Exec(`
		INSERT INTO notification_preferences (user_id, workout_assigned, workout_completed_or_skipped)
		VALUES (?, ?, ?)
		ON DUPLICATE KEY UPDATE workout_assigned = VALUES(workout_assigned), workout_completed_or_skipped = VALUES(workout_completed_or_skipped)
	`, userID, req.WorkoutAssigned, req.WorkoutCompletedOrSkipped)
```

Replace with:
```go
	_, err := h.DB.Exec(`
		INSERT INTO notification_preferences (user_id, workout_assigned, workout_completed_or_skipped, assignment_message)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE workout_assigned = VALUES(workout_assigned), workout_completed_or_skipped = VALUES(workout_completed_or_skipped), assignment_message = VALUES(assignment_message)
	`, userID, req.WorkoutAssigned, req.WorkoutCompletedOrSkipped, req.AssignmentMessage)
```

- [ ] **Step 4: Verify build**

```bash
cd ~/Desktop/FitReg/FitRegAPI
go build ./...
```

- [ ] **Step 5: Commit**

```bash
git add handlers/notification_handler.go
git commit -m "feat: add assignment_message to notification preferences"
```

---

### Task 5: Update Existing List Queries & Register Routes

**Files:**
- Modify: `~/Desktop/FitReg/FitRegAPI/handlers/coach_handler.go`
- Modify: `~/Desktop/FitReg/FitRegAPI/router/router.go`

- [ ] **Step 1: Add `unread_message_count` subquery to `ListAssignedWorkouts`**

In `coach_handler.go`, find the `ListAssignedWorkouts` query (around line 242):

```go
	query := `
		SELECT aw.id, aw.coach_id, aw.student_id, aw.title, aw.description, aw.type,
			aw.distance_km, aw.duration_seconds, aw.notes, aw.expected_fields,
			aw.result_time_seconds, aw.result_distance_km, aw.result_heart_rate, aw.result_feeling,
			aw.image_file_id, aw.status, aw.due_date,
			aw.created_at, aw.updated_at, u.name as student_name
		FROM assigned_workouts aw
		JOIN users u ON u.id = aw.student_id
		WHERE aw.coach_id = ?
	`
```

Replace with:

```go
	query := `
		SELECT aw.id, aw.coach_id, aw.student_id, aw.title, aw.description, aw.type,
			aw.distance_km, aw.duration_seconds, aw.notes, aw.expected_fields,
			aw.result_time_seconds, aw.result_distance_km, aw.result_heart_rate, aw.result_feeling,
			aw.image_file_id, aw.status, aw.due_date,
			aw.created_at, aw.updated_at, u.name as student_name,
			(SELECT COUNT(*) FROM assignment_messages am WHERE am.assigned_workout_id = aw.id AND am.sender_id != ? AND am.is_read = FALSE)
		FROM assigned_workouts aw
		JOIN users u ON u.id = aw.student_id
		WHERE aw.coach_id = ?
	`
```

**Important:** This adds a new `?` parameter before the existing `coach_id` parameter. Update the query args to pass `userID` first, then the remaining args. Find where `args` is built and prepend `userID`:

The function builds `args` dynamically. Find the initial args assignment and change it. Look for `args := []interface{}{userID}` or similar. The first arg should now be the subquery's `userID`, and the second should be the coach_id filter's `userID`. Since both are `userID`, prepend `userID` to the args slice:

```go
	args := []interface{}{userID, userID} // first for subquery, second for WHERE coach_id = ?
```

Then update the Scan call to include `&aw.UnreadMessageCount` at the end (after `&aw.StudentName`).

- [ ] **Step 2: Add `unread_message_count` subquery to `GetMyAssignedWorkouts`**

Find the `GetMyAssignedWorkouts` query (around line 746):

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
```

Replace with:

```go
	query := `
		SELECT aw.id, aw.coach_id, aw.student_id, aw.title, aw.description, aw.type,
			aw.distance_km, aw.duration_seconds, aw.notes, aw.expected_fields,
			aw.result_time_seconds, aw.result_distance_km, aw.result_heart_rate, aw.result_feeling,
			aw.image_file_id, aw.status, aw.due_date,
			aw.created_at, aw.updated_at, u.name as coach_name,
			(SELECT COUNT(*) FROM assignment_messages am WHERE am.assigned_workout_id = aw.id AND am.sender_id != ? AND am.is_read = FALSE)
		FROM assigned_workouts aw
		JOIN users u ON u.id = aw.coach_id
		WHERE aw.student_id = ?
	`
```

Same pattern: prepend `userID` to the args, and add `&aw.UnreadMessageCount` to Scan. Update the scan that reads `&aw.CoachName` to also read `&aw.UnreadMessageCount` after it.

- [ ] **Step 3: Register routes in `router/router.go`**

Add handler instantiation after the existing handlers (around line 27, after `th := handlers.NewTemplateHandler(db)`):

```go
	amh := handlers.NewAssignmentMessageHandler(db, nh)
```

Add route registrations. Find a good place (after the coach routes, before the middleware wrapping). Add:

```go
	// Assignment messages
	mux.HandleFunc("/api/assignment-messages/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/read") {
			if r.Method == http.MethodPut {
				amh.MarkRead(w, r)
			} else {
				http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
			}
			return
		}
		switch r.Method {
		case http.MethodGet:
			amh.ListMessages(w, r)
		case http.MethodPost:
			amh.SendMessage(w, r)
		default:
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		}
	})

	// Assignment detail (both coach and student)
	mux.HandleFunc("/api/assigned-workout-detail/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			amh.GetAssignedWorkoutDetail(w, r)
		} else {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		}
	})
```

Make sure `"strings"` is in the import block of `router.go` (it's already imported on line 7).

- [ ] **Step 4: Verify build**

```bash
cd ~/Desktop/FitReg/FitRegAPI
go build ./...
```

- [ ] **Step 5: Start backend and test manually**

```bash
cd ~/Desktop/FitReg/FitRegAPI
export $(cat .env | xargs) && go run main.go
```

Test with curl (substitute a valid JWT token and assigned workout ID):
```bash
TOKEN="your_jwt_token"
# List messages (should return [])
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/assignment-messages/1
# Get detail
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/assigned-workout-detail/1
```

- [ ] **Step 6: Commit**

```bash
git add handlers/coach_handler.go router/router.go
git commit -m "feat: register assignment message routes and add unread count to list queries"
```

---

## Chunk 3: Frontend API, Types & i18n

### Task 6: Frontend Types & API Module

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/types/index.ts`
- Create: `~/Desktop/FitReg/FitRegFE/src/api/assignments.ts`

- [ ] **Step 1: Add `AssignmentMessage` type and update `AssignedWorkout`**

In `src/types/index.ts`, add the new type (at the end, before closing or after existing interfaces):

```typescript
export interface AssignmentMessage {
  id: number;
  assigned_workout_id: number;
  sender_id: number;
  sender_name: string;
  sender_avatar: string;
  body: string;
  is_read: boolean;
  created_at: string;
}
```

Add `unread_message_count` to the existing `AssignedWorkout` interface (after `segments?`):

```typescript
  unread_message_count?: number;
```

Update `NotificationPreferences` interface to add:

```typescript
  assignment_message: boolean;
```

- [ ] **Step 2: Create `src/api/assignments.ts`**

```typescript
import client from "./client";
import type { AssignedWorkout, AssignmentMessage } from "../types";

export const getAssignedWorkoutDetail = (id: number) =>
  client.get<AssignedWorkout>(`/assigned-workout-detail/${id}`);

export const listAssignmentMessages = (assignedWorkoutId: number) =>
  client.get<AssignmentMessage[]>(`/assignment-messages/${assignedWorkoutId}`);

export const sendAssignmentMessage = (assignedWorkoutId: number, body: string) =>
  client.post<AssignmentMessage>(`/assignment-messages/${assignedWorkoutId}`, { body });

export const markAssignmentMessagesRead = (assignedWorkoutId: number) =>
  client.put(`/assignment-messages/${assignedWorkoutId}/read`);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/types/index.ts src/api/assignments.ts
git commit -m "feat: add AssignmentMessage type and API module"
```

---

### Task 7: i18n Keys

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/i18n/es.ts`
- Modify: `~/Desktop/FitReg/FitRegFE/src/i18n/en.ts`

- [ ] **Step 1: Add Spanish translations**

Add to `es.ts` in the notifications section (after existing `notif_*` keys):

```typescript
  notif_assignment_message_title: 'Nuevo mensaje en asignación',
  notif_assignment_message_body: '{{sender_name}} escribió en: {{workout_title}}',
```

Add in the notification preferences section:

```typescript
  notification_pref_assignment_message: 'Mensajes en asignaciones',
```

Add assignment detail / messages keys (group them together):

```typescript
  // Assignment detail & messages
  assignment_detail_title: 'Detalle de asignación',
  assignment_back: '← Volver',
  assignment_messages_title: 'Mensajes',
  assignment_messages_empty: 'No hay mensajes aún.',
  assignment_messages_placeholder: 'Escribe un mensaje...',
  assignment_messages_send: 'Enviar',
  assignment_messages_readonly: 'Los mensajes son de solo lectura para asignaciones finalizadas.',
  assignment_messages_link: 'Mensajes',
```

- [ ] **Step 2: Add English translations**

Add to `en.ts` in the same sections:

```typescript
  notif_assignment_message_title: 'New assignment message',
  notif_assignment_message_body: '{{sender_name}} wrote in: {{workout_title}}',
```

```typescript
  notification_pref_assignment_message: 'Assignment messages',
```

```typescript
  // Assignment detail & messages
  assignment_detail_title: 'Assignment detail',
  assignment_back: '← Back',
  assignment_messages_title: 'Messages',
  assignment_messages_empty: 'No messages yet.',
  assignment_messages_placeholder: 'Write a message...',
  assignment_messages_send: 'Send',
  assignment_messages_readonly: 'Messages are read-only for completed assignments.',
  assignment_messages_link: 'Messages',
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/es.ts src/i18n/en.ts
git commit -m "i18n: add assignment messages translation keys"
```

---

## Chunk 4: Frontend AssignmentDetail Page

### Task 8: AssignmentDetail Page & CSS

**Files:**
- Create: `~/Desktop/FitReg/FitRegFE/src/pages/AssignmentDetail.tsx`
- Modify: `~/Desktop/FitReg/FitRegFE/src/App.tsx`
- Modify: `~/Desktop/FitReg/FitRegFE/src/App.css`

- [ ] **Step 1: Create `src/pages/AssignmentDetail.tsx`**

```tsx
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import {
  getAssignedWorkoutDetail,
  listAssignmentMessages,
  sendAssignmentMessage,
  markAssignmentMessagesRead,
} from "../api/assignments";
import { updateAssignedWorkoutStatus, deleteAssignedWorkout } from "../api/coach";
import ErrorState from "../components/ErrorState";
import SegmentDisplay from "../components/SegmentDisplay";
import Avatar from "../components/Avatar";
import type { AssignedWorkout, AssignmentMessage } from "../types";

export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [workout, setWorkout] = useState<AssignedWorkout | null>(null);
  const [messages, setMessages] = useState<AssignmentMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<"not_found" | "generic" | null>(null);

  const isCoach = user?.id === workout?.coach_id;
  const isPending = workout?.status === "pending";

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [wRes, mRes] = await Promise.all([
        getAssignedWorkoutDetail(Number(id)),
        listAssignmentMessages(Number(id)),
      ]);
      setWorkout(wRes.data);
      setMessages(mRes.data || []);
      // Mark as read
      markAssignmentMessagesRead(Number(id)).catch(() => {});
    } catch (err) {
      if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 403)) {
        setErrorType("not_found");
      } else {
        setErrorType("generic");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = newMessage.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await sendAssignmentMessage(Number(id), body);
      setMessages((prev) => [...prev, res.data]);
      setNewMessage("");
    } catch {
      showError(t("error"));
    } finally {
      setSending(false);
    }
  }

  async function handleComplete() {
    try {
      await updateAssignedWorkoutStatus(Number(id), { status: "completed" });
      showSuccess(t("assigned_mark_completed"));
      loadData();
    } catch {
      showError(t("error"));
    }
  }

  async function handleSkip() {
    try {
      await updateAssignedWorkoutStatus(Number(id), { status: "skipped" });
      showSuccess(t("assigned_mark_skipped"));
      loadData();
    } catch {
      showError(t("error"));
    }
  }

  async function handleDelete() {
    if (!confirm(t("calendar_confirm_delete"))) return;
    try {
      await deleteAssignedWorkout(Number(id));
      showSuccess(t("assigned_workout_deleted"));
      navigate(-1);
    } catch {
      showError(t("error"));
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  if (loading) return <div className="loading">{t("loading")}</div>;
  if (errorType) return <ErrorState type={errorType} backTo="/my-assignments" />;
  if (!workout) return <ErrorState type="generic" backTo="/my-assignments" />;

  const statusClass = workout.status === "completed" ? "badge-completed" : workout.status === "skipped" ? "badge-skipped" : "badge-pending";

  return (
    <div className="page assignment-detail">
      {/* Header */}
      <div className="assignment-detail-header">
        <button className="btn btn-link" onClick={() => navigate(-1)}>
          {t("assignment_back")}
        </button>
        <span className={`badge ${statusClass}`}>{t(`assigned_status_${workout.status}`)}</span>
      </div>

      {/* Detail card */}
      <div className="detail-card">
        <h2>{workout.title}</h2>
        <div className="detail-grid">
          {workout.type && (
            <div className="detail-item">
              <span className="detail-label">{t("assigned_type")}</span>
              <span className="badge">{t(`workout_type_${workout.type}`)}</span>
            </div>
          )}
          {workout.distance_km > 0 && (
            <div className="detail-item">
              <span className="detail-label">{t("assigned_distance")}</span>
              <span>{workout.distance_km} km</span>
            </div>
          )}
          {workout.duration_seconds > 0 && (
            <div className="detail-item">
              <span className="detail-label">{t("assigned_duration")}</span>
              <span>{formatDuration(workout.duration_seconds)}</span>
            </div>
          )}
          {workout.due_date && (
            <div className="detail-item">
              <span className="detail-label">{t("assigned_due_date")}</span>
              <span>{workout.due_date}</span>
            </div>
          )}
        </div>

        {workout.segments && workout.segments.length > 0 && (
          <div className="day-modal-section">
            <strong>{t("assigned_segments")}</strong>
            <SegmentDisplay segments={workout.segments} />
          </div>
        )}

        {workout.notes && (
          <div className="day-modal-section">
            <strong>{t("assigned_notes")}</strong>
            <p>{workout.notes}</p>
          </div>
        )}

        {workout.description && (
          <div className="day-modal-section">
            <strong>{t("assigned_description")}</strong>
            <p>{workout.description}</p>
          </div>
        )}

        {/* Results if completed */}
        {workout.status === "completed" && (
          <div className="day-modal-section">
            <strong>{t("assigned_results")}</strong>
            <div className="detail-grid">
              {workout.result_time_seconds && (
                <div className="detail-item">
                  <span className="detail-label">{t("assigned_result_time")}</span>
                  <span>{formatDuration(workout.result_time_seconds)}</span>
                </div>
              )}
              {workout.result_distance_km && (
                <div className="detail-item">
                  <span className="detail-label">{t("assigned_result_distance")}</span>
                  <span>{workout.result_distance_km} km</span>
                </div>
              )}
              {workout.result_heart_rate && (
                <div className="detail-item">
                  <span className="detail-label">{t("assigned_result_hr")}</span>
                  <span>{workout.result_heart_rate} bpm</span>
                </div>
              )}
              {workout.result_feeling && (
                <div className="detail-item">
                  <span className="detail-label">{t("assigned_result_feeling")}</span>
                  <span>{workout.result_feeling}/10</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {isPending && (
        <div className="assignment-detail-actions">
          {isCoach ? (
            <>
              <Link to={`/coach/assigned-workouts/${workout.id}/edit`} className="btn btn-primary">
                {t("calendar_edit")}
              </Link>
              <button className="btn btn-danger" onClick={handleDelete}>
                {t("calendar_delete")}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" onClick={handleComplete}>
                {t("assigned_mark_completed")}
              </button>
              <button className="btn" onClick={handleSkip}>
                {t("assigned_mark_skipped")}
              </button>
            </>
          )}
        </div>
      )}

      {/* Messages section */}
      <div className="assignment-messages">
        <h3>{t("assignment_messages_title")} ({messages.length})</h3>

        {messages.length === 0 && (
          <p className="text-secondary">{t("assignment_messages_empty")}</p>
        )}

        <div className="assignment-messages-list">
          {messages.map((m) => {
            const isOwn = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`assignment-message ${isOwn ? "assignment-message--own" : ""}`}>
                {!isOwn && (
                  <Avatar src={m.sender_avatar} name={m.sender_name} size={32} />
                )}
                <div className="assignment-message-bubble">
                  {!isOwn && <span className="assignment-message-name">{m.sender_name}</span>}
                  <p className="assignment-message-body">{m.body}</p>
                  <span className="assignment-message-time">{formatTime(m.created_at)}</span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar or read-only notice */}
        {isPending ? (
          <form className="assignment-message-input" onSubmit={handleSend}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t("assignment_messages_placeholder")}
              maxLength={2000}
            />
            <button type="submit" className="btn btn-primary" disabled={sending || !newMessage.trim()}>
              {t("assignment_messages_send")}
            </button>
          </form>
        ) : (
          <p className="assignment-message-input--disabled">
            {t("assignment_messages_readonly")}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register route in `App.tsx`**

Add the import at the top with other lazy/page imports:

```typescript
import AssignmentDetail from "./pages/AssignmentDetail";
```

Add the route inside `<Routes>`, near the other assignment routes:

```tsx
<Route path="/assignments/:id" element={<ProtectedRoute><AssignmentDetail /></ProtectedRoute>} />
```

- [ ] **Step 3: Add CSS styles to `App.css`**

Add at the end of `App.css`:

```css
/* ============================================================
   ASSIGNMENT DETAIL PAGE
   ============================================================ */
.assignment-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.assignment-detail-actions {
  display: flex;
  gap: 0.75rem;
  margin: 1rem 0;
}

/* ============================================================
   ASSIGNMENT MESSAGES
   ============================================================ */
.assignment-messages {
  margin-top: 1.5rem;
}

.assignment-messages h3 {
  margin-bottom: 1rem;
}

.assignment-messages-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.assignment-message {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.assignment-message--own {
  flex-direction: row-reverse;
}

.assignment-message-bubble {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
  max-width: 75%;
}

.assignment-message--own .assignment-message-bubble {
  background: rgba(0, 212, 170, 0.1);
  border-color: rgba(0, 212, 170, 0.3);
}

.assignment-message-name {
  font-size: 0.75rem;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 0.25rem;
}

.assignment-message-body {
  margin: 0;
  word-break: break-word;
}

.assignment-message-time {
  font-size: 0.7rem;
  color: var(--text-secondary);
  display: block;
  text-align: right;
  margin-top: 0.25rem;
}

.assignment-message-input {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.assignment-message-input input {
  flex: 1;
}

.assignment-message-input--disabled {
  margin-top: 1rem;
  color: var(--text-secondary);
  font-style: italic;
  text-align: center;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius);
}
```

- [ ] **Step 4: Verify TypeScript compiles and dev server starts**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/AssignmentDetail.tsx src/App.tsx src/App.css
git commit -m "feat: add AssignmentDetail page with messages UI"
```

---

## Chunk 5: Frontend Integration (DayModal, Notifications, Profile)

### Task 9: DayModal Messages Link

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/components/DayModal.tsx`

- [ ] **Step 1: Add messages link to DayModal detail view**

Add `Link` to the imports from `react-router-dom`, and `useTranslation` if not already imported.

Find the action buttons section (around line 303-314, after the coach/student action buttons, before the closing of the detail view). Add after the action buttons `div`:

```tsx
{/* Messages link */}
<Link to={`/assignments/${workout.id}`} className="btn btn-link assignment-messages-link" onClick={onClose}>
  💬 {t('assignment_messages_link')}
  {(workout.unread_message_count ?? 0) > 0 && (
    <span className="badge badge-accent">{workout.unread_message_count}</span>
  )}
</Link>
```

This should appear for all statuses (pending, completed, skipped) since messages are viewable in read-only mode after completion.

- [ ] **Step 2: Add CSS for the link**

Add to `App.css`:

```css
.assignment-messages-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  font-size: 0.95rem;
}

.assignment-messages-link .badge-accent {
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
}
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/components/DayModal.tsx src/App.css
git commit -m "feat: add messages link with unread badge in DayModal"
```

---

### Task 10: Notification Integration

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/pages/Notifications.tsx`

- [ ] **Step 1: Add `assignment_message` to `notificationIcon`**

Find the `notificationIcon` function and add a case:

```typescript
case 'assignment_message': return '💬';
```

- [ ] **Step 2: Add `assignment_message` to `getNotificationLink`**

Find the `getNotificationLink` function and add a case:

```typescript
case 'assignment_message':
  return meta.assigned_workout_id ? `/assignments/${meta.assigned_workout_id}` : '/my-assignments';
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Notifications.tsx
git commit -m "feat: add assignment_message notification icon and routing"
```

---

### Task 11: Profile Notification Preference

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/pages/Profile.tsx`

- [ ] **Step 1: Add assignment_message preference toggle**

Find the notification preferences section (around line 309-333). After the existing preference checkboxes, add a new one visible to both coaches and students with a coach:

```tsx
{(user.has_coach || user.is_coach) && (
  <label className="checkbox-label">
    <input
      type="checkbox"
      checked={notifPrefs.assignment_message}
      onChange={(e) => handlePrefChange('assignment_message', e.target.checked)}
    />
    <span>{t('notification_pref_assignment_message')}</span>
  </label>
)}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add src/pages/Profile.tsx
git commit -m "feat: add assignment messages notification preference toggle"
```

---

### Task 12: End-to-End Manual Test

- [ ] **Step 1: Start both backend and frontend**

```bash
# Terminal 1: Backend
cd ~/Desktop/FitReg/FitRegAPI
export $(cat .env | xargs) && go run main.go

# Terminal 2: Frontend
cd ~/Desktop/FitReg/FitRegFE
npm run dev
```

- [ ] **Step 2: Test the full flow**

1. Log in as a coach, create or find an existing pending assignment
2. Open the assignment in DayModal, verify the "Mensajes" link appears
3. Click the link, verify the AssignmentDetail page loads with workout details
4. Send a message, verify it appears in the chat
5. Log in as the student, navigate to the same assignment
6. Verify the coach's message appears, verify the student can reply
7. Complete or skip the assignment, verify the input bar becomes read-only
8. Check notifications page — verify the message notification appears with 💬 icon
9. Click the notification, verify it navigates to the assignment detail
10. Check Profile → notification preferences — verify the new toggle appears

- [ ] **Step 3: Final commit with any fixes**

If any adjustments were needed during testing, commit them:

```bash
git add -A
git commit -m "fix: adjustments from end-to-end testing"
```
