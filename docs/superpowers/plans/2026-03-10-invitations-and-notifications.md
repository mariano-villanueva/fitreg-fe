# Invitations & Notifications Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a bidirectional invitation system and in-app notification system for the FitReg coach-student platform.

**Architecture:** New `invitation_handler.go` and `notification_handler.go` backend handlers with dedicated models. Frontend adds notification badge to navbar, notifications page, and modifies coach dashboard/directory for invitation flows. Existing handlers are modified minimally to emit notifications on key events.

**Tech Stack:** Go (stdlib, no framework), MySQL, React 19 + TypeScript + Vite, Axios, react-i18next

**Spec:** `docs/superpowers/specs/2026-03-10-invitations-and-notifications-design.md`

---

## File Structure

### Backend (~/Desktop/FitReg/FitRegAPI/)

| File | Action | Responsibility |
|------|--------|---------------|
| `migrations/008_invitations_notifications.sql` | Create | DB schema for invitations, coach_students v2, notifications, notification_preferences |
| `models/invitation.go` | Create | Invitation struct, request/response types |
| `models/notification.go` | Create | Notification struct, NotificationPreferences, request types |
| `models/coach.go` | Modify | Update CoachStudent struct with new fields |
| `handlers/invitation_handler.go` | Create | CRUD for invitations, respond logic |
| `handlers/notification_handler.go` | Create | Notification listing, actions, preferences, helper to create notifications |
| `handlers/coach_handler.go` | Modify | Replace AddStudent/RemoveStudent, add notification emission on workout assign/status |
| `handlers/admin_handler.go` | Modify | Add notification emission on achievement verify |
| `router/router.go` | Modify | Register new routes |

### Frontend (~/Desktop/FitReg/FitRegFE/)

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/index.ts` | Modify | Add Invitation, Notification, NotificationPreferences, NotificationAction types |
| `src/api/invitations.ts` | Create | Invitation API calls |
| `src/api/notifications.ts` | Create | Notification API calls |
| `src/api/coach.ts` | Modify | Update invitation-related calls, remove addStudent/removeStudent |
| `src/components/Navbar.tsx` | Modify | Add notification bell with badge |
| `src/components/NotificationBadge.tsx` | Create | Bell icon with unread count, polling |
| `src/pages/Notifications.tsx` | Create | Notification list page with dynamic actions |
| `src/pages/CoachDashboard.tsx` | Modify | Replace add-student with invite flow, show pending invitations |
| `src/pages/CoachPublicProfile.tsx` | Modify | Add "Request coach" button |
| `src/pages/Profile.tsx` | Modify | Add notification preferences section |
| `src/i18n/es.ts` | Modify | Add invitation + notification i18n keys |
| `src/i18n/en.ts` | Modify | Add invitation + notification i18n keys |
| `src/App.tsx` | Modify | Add /notifications route |
| `src/App.css` | Modify | Add notification and invitation styles |

---

## Chunk 1: Database Migration & Backend Models

### Task 1: Create database migration

**Files:**
- Create: `~/Desktop/FitReg/FitRegAPI/migrations/008_invitations_notifications.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Drop old coach_students table (clean start per spec)
DROP TABLE IF EXISTS assigned_workout_segments;
DROP TABLE IF EXISTS assigned_workouts;
DROP TABLE IF EXISTS coach_ratings;
DROP TABLE IF EXISTS coach_students;

-- Recreate coach_students with new schema
CREATE TABLE coach_students (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coach_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    invitation_id BIGINT NULL,
    status ENUM('active', 'finished') NOT NULL DEFAULT 'active',
    started_at DATETIME NOT NULL DEFAULT NOW(),
    finished_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    FOREIGN KEY (coach_id) REFERENCES users(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
);

-- Recreate dependent tables
CREATE TABLE assigned_workouts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coach_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50),
    distance_km DECIMAL(10,2),
    duration_seconds INT,
    notes TEXT,
    status ENUM('pending','completed','skipped') NOT NULL DEFAULT 'pending',
    due_date DATE,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    FOREIGN KEY (coach_id) REFERENCES users(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
);

CREATE TABLE assigned_workout_segments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    assigned_workout_id BIGINT NOT NULL,
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
    FOREIGN KEY (assigned_workout_id) REFERENCES assigned_workouts(id) ON DELETE CASCADE
);

CREATE TABLE coach_ratings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coach_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    FOREIGN KEY (coach_id) REFERENCES users(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    UNIQUE KEY uk_coach_student_rating (coach_id, student_id)
);

-- Invitations table
CREATE TABLE invitations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('coach_invite', 'student_request') NOT NULL,
    sender_id BIGINT NOT NULL,
    receiver_id BIGINT NOT NULL,
    message TEXT NULL,
    status ENUM('pending', 'accepted', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id),
    INDEX idx_sender_status (sender_id, status),
    INDEX idx_receiver_status (receiver_id, status)
);

-- Add FK from coach_students to invitations (after invitations table exists)
ALTER TABLE coach_students ADD FOREIGN KEY (invitation_id) REFERENCES invitations(id);

-- Notifications table
CREATE TABLE notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    metadata JSON,
    actions JSON NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_read_created (user_id, is_read, created_at DESC)
);

-- Notification preferences table
CREATE TABLE notification_preferences (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    workout_assigned BOOLEAN NOT NULL DEFAULT TRUE,
    workout_completed_or_skipped BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY uk_user_prefs (user_id)
);
```

- [ ] **Step 2: Run the migration against local MySQL**

```bash
cd ~/Desktop/FitReg/FitRegAPI
mysql -u root -proot fitreg < migrations/008_invitations_notifications.sql
```

Expected: No errors. Tables created successfully.

- [ ] **Step 3: Verify tables exist**

```bash
mysql -u root -proot fitreg -e "SHOW TABLES;"
```

Expected: Should show `invitations`, `notifications`, `notification_preferences`, and recreated `coach_students`, `assigned_workouts`, `assigned_workout_segments`, `coach_ratings`.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/FitReg/FitRegAPI
git add migrations/008_invitations_notifications.sql
git commit -m "feat: add migration for invitations and notifications tables"
```

---

### Task 2: Create invitation model

**Files:**
- Create: `~/Desktop/FitReg/FitRegAPI/models/invitation.go`

- [ ] **Step 1: Create the invitation model file**

```go
package models

import "time"

const MaxCoachesPerStudent = 1

type Invitation struct {
	ID         int64     `json:"id"`
	Type       string    `json:"type"`
	SenderID   int64     `json:"sender_id"`
	ReceiverID int64     `json:"receiver_id"`
	Message    string    `json:"message"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	SenderName   string `json:"sender_name,omitempty"`
	SenderAvatar string `json:"sender_avatar,omitempty"`
	ReceiverName   string `json:"receiver_name,omitempty"`
	ReceiverAvatar string `json:"receiver_avatar,omitempty"`
}

type CreateInvitationRequest struct {
	Type          string `json:"type"`
	ReceiverEmail string `json:"receiver_email"`
	Message       string `json:"message"`
}

type RespondInvitationRequest struct {
	Action string `json:"action"`
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/Desktop/FitReg/FitRegAPI && go build ./...
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add models/invitation.go
git commit -m "feat: add invitation model and request types"
```

---

### Task 3: Create notification model

**Files:**
- Create: `~/Desktop/FitReg/FitRegAPI/models/notification.go`

- [ ] **Step 1: Create the notification model file**

```go
package models

import (
	"encoding/json"
	"time"
)

type NotificationAction struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Style string `json:"style"`
}

type Notification struct {
	ID        int64                `json:"id"`
	UserID    int64                `json:"user_id"`
	Type      string               `json:"type"`
	Title     string               `json:"title"`
	Body      string               `json:"body"`
	Metadata  json.RawMessage      `json:"metadata"`
	Actions   json.RawMessage      `json:"actions"`
	IsRead    bool                 `json:"is_read"`
	CreatedAt time.Time            `json:"created_at"`
}

type NotificationPreferences struct {
	ID                      int64 `json:"id"`
	UserID                  int64 `json:"user_id"`
	WorkoutAssigned         bool  `json:"workout_assigned"`
	WorkoutCompletedOrSkipped bool `json:"workout_completed_or_skipped"`
}

type UpdateNotificationPreferencesRequest struct {
	WorkoutAssigned         bool `json:"workout_assigned"`
	WorkoutCompletedOrSkipped bool `json:"workout_completed_or_skipped"`
}

type NotificationActionRequest struct {
	Action string `json:"action"`
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/Desktop/FitReg/FitRegAPI && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add models/notification.go
git commit -m "feat: add notification model and preference types"
```

---

### Task 4: Update CoachStudent model

**Files:**
- Modify: `~/Desktop/FitReg/FitRegAPI/models/coach.go`

- [ ] **Step 1: Update the CoachStudent struct**

Replace the existing `CoachStudent` struct in `models/coach.go` with:

```go
type CoachStudent struct {
	ID           int64     `json:"id"`
	CoachID      int64     `json:"coach_id"`
	StudentID    int64     `json:"student_id"`
	InvitationID int64     `json:"invitation_id,omitempty"`
	Status       string    `json:"status"`
	StartedAt    time.Time `json:"started_at"`
	FinishedAt   *time.Time `json:"finished_at,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/Desktop/FitReg/FitRegAPI && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add models/coach.go
git commit -m "feat: update CoachStudent model with status and invitation tracking"
```

---

## Chunk 2: Backend Handlers — Notifications

### Task 5: Create notification handler

**Files:**
- Create: `~/Desktop/FitReg/FitRegAPI/handlers/notification_handler.go`

- [ ] **Step 1: Create the notification handler with CreateNotification helper, ListNotifications, and UnreadCount**

```go
package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/fitreg/api/middleware"
	"github.com/fitreg/api/models"
)

type NotificationHandler struct {
	DB *sql.DB
}

func NewNotificationHandler(db *sql.DB) *NotificationHandler {
	return &NotificationHandler{DB: db}
}

// CreateNotification is a helper called by other handlers to emit notifications.
// It checks notification preferences before creating.
func (h *NotificationHandler) CreateNotification(userID int64, notifType, title, body string, metadata interface{}, actions []models.NotificationAction) error {
	// Check preferences for configurable types
	if notifType == "workout_assigned" || notifType == "workout_completed" || notifType == "workout_skipped" {
		var pref models.NotificationPreferences
		err := h.DB.QueryRow("SELECT COALESCE(workout_assigned, TRUE), COALESCE(workout_completed_or_skipped, TRUE) FROM notification_preferences WHERE user_id = ?", userID).Scan(&pref.WorkoutAssigned, &pref.WorkoutCompletedOrSkipped)
		if err != nil && err != sql.ErrNoRows {
			return err
		}
		if notifType == "workout_assigned" && !pref.WorkoutAssigned {
			return nil
		}
		if (notifType == "workout_completed" || notifType == "workout_skipped") && !pref.WorkoutCompletedOrSkipped {
			return nil
		}
	}

	metaJSON, err := json.Marshal(metadata)
	if err != nil {
		return err
	}

	var actionsJSON []byte
	if actions != nil {
		actionsJSON, err = json.Marshal(actions)
		if err != nil {
			return err
		}
	}

	_, err = h.DB.Exec(`
		INSERT INTO notifications (user_id, type, title, body, metadata, actions)
		VALUES (?, ?, ?, ?, ?, ?)
	`, userID, notifType, title, body, metaJSON, actionsJSON)
	return err
}

func (h *NotificationHandler) isAdmin(userID int64) bool {
	var isAdmin bool
	err := h.DB.QueryRow("SELECT COALESCE(is_admin, FALSE) FROM users WHERE id = ?", userID).Scan(&isAdmin)
	return err == nil && isAdmin
}

func (h *NotificationHandler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 50 {
		limit = 20
	}
	offset := (page - 1) * limit

	rows, err := h.DB.Query(`
		SELECT id, user_id, type, title, COALESCE(body, ''), metadata, actions, is_read, created_at
		FROM notifications
		WHERE user_id = ?
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, userID, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch notifications")
		return
	}
	defer rows.Close()

	notifications := []models.Notification{}
	for rows.Next() {
		var n models.Notification
		var metadata, actions sql.NullString
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &metadata, &actions, &n.IsRead, &n.CreatedAt); err != nil {
			log.Printf("ERROR scanning notification: %v", err)
			continue
		}
		if metadata.Valid {
			n.Metadata = json.RawMessage(metadata.String)
		}
		if actions.Valid {
			n.Actions = json.RawMessage(actions.String)
		}
		notifications = append(notifications, n)
	}

	writeJSON(w, http.StatusOK, notifications)
}

func (h *NotificationHandler) UnreadCount(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var count int
	err := h.DB.QueryRow("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = FALSE", userID).Scan(&count)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to count notifications")
		return
	}

	writeJSON(w, http.StatusOK, map[string]int{"count": count})
}

func (h *NotificationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	notifID, err := extractID(r.URL.Path, "/api/notifications/")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid notification ID")
		return
	}

	result, err := h.DB.Exec("UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?", notifID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to mark notification as read")
		return
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeError(w, http.StatusNotFound, "Notification not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Notification marked as read"})
}

func (h *NotificationHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	_, err := h.DB.Exec("UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE", userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to mark notifications as read")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "All notifications marked as read"})
}

func (h *NotificationHandler) ExecuteAction(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Extract notification ID — path is /api/notifications/{id}/action
	path := strings.TrimSuffix(r.URL.Path, "/action")
	notifID, err := extractID(path, "/api/notifications/")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid notification ID")
		return
	}

	var req models.NotificationActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Fetch notification
	var notif models.Notification
	var metadata, actions sql.NullString
	err = h.DB.QueryRow(`
		SELECT id, user_id, type, title, COALESCE(body, ''), metadata, actions, is_read, created_at
		FROM notifications WHERE id = ? AND user_id = ?
	`, notifID, userID).Scan(&notif.ID, &notif.UserID, &notif.Type, &notif.Title, &notif.Body, &metadata, &actions, &notif.IsRead, &notif.CreatedAt)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Notification not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch notification")
		return
	}

	if !actions.Valid || actions.String == "" || actions.String == "null" {
		writeError(w, http.StatusBadRequest, "No actions available for this notification")
		return
	}

	// Validate action key exists
	var actionList []models.NotificationAction
	if err := json.Unmarshal([]byte(actions.String), &actionList); err != nil {
		writeError(w, http.StatusInternalServerError, "Invalid actions data")
		return
	}
	validAction := false
	for _, a := range actionList {
		if a.Key == req.Action {
			validAction = true
			break
		}
	}
	if !validAction {
		writeError(w, http.StatusBadRequest, "Invalid action")
		return
	}

	// Resolve action based on notification type
	switch notif.Type {
	case "invitation_received":
		var meta struct {
			InvitationID int64 `json:"invitation_id"`
		}
		if metadata.Valid {
			json.Unmarshal([]byte(metadata.String), &meta)
		}
		if meta.InvitationID == 0 {
			writeError(w, http.StatusInternalServerError, "Missing invitation reference")
			return
		}

		// Check invitation is still pending
		var invStatus string
		err := h.DB.QueryRow("SELECT status FROM invitations WHERE id = ?", meta.InvitationID).Scan(&invStatus)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to check invitation")
			return
		}
		if invStatus != "pending" {
			// Clear actions and return conflict
			h.DB.Exec("UPDATE notifications SET actions = NULL WHERE id = ?", notifID)
			writeError(w, http.StatusConflict, "Invitation is no longer pending")
			return
		}

		switch req.Action {
		case "accept":
			if err := h.acceptInvitation(meta.InvitationID, userID); err != nil {
				writeError(w, http.StatusConflict, err.Error())
				return
			}
		case "reject":
			h.rejectInvitation(meta.InvitationID, userID)
		}
	default:
		writeError(w, http.StatusBadRequest, "Unsupported notification type for actions")
		return
	}

	// Clear actions after execution
	h.DB.Exec("UPDATE notifications SET actions = NULL WHERE id = ?", notifID)

	writeJSON(w, http.StatusOK, map[string]string{"message": "Action executed"})
}

// acceptInvitation handles the accept logic for an invitation.
// Uses transaction with SELECT FOR UPDATE to prevent race conditions.
func (h *NotificationHandler) acceptInvitation(invitationID, userID int64) error {
	tx, err := h.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Lock and fetch invitation
	var inv struct {
		Type       string
		SenderID   int64
		ReceiverID int64
	}
	err = tx.QueryRow("SELECT type, sender_id, receiver_id FROM invitations WHERE id = ? AND status = 'pending' FOR UPDATE", invitationID).Scan(&inv.Type, &inv.SenderID, &inv.ReceiverID)
	if err != nil {
		return fmt.Errorf("invitation not found or already resolved")
	}

	// Determine coach and student
	var coachID, studentID int64
	if inv.Type == "coach_invite" {
		coachID = inv.SenderID
		studentID = inv.ReceiverID
	} else {
		coachID = inv.ReceiverID
		studentID = inv.SenderID
	}

	// Check MaxCoachesPerStudent
	var activeCount int
	tx.QueryRow("SELECT COUNT(*) FROM coach_students WHERE student_id = ? AND status = 'active' FOR UPDATE", studentID).Scan(&activeCount)
	if activeCount >= models.MaxCoachesPerStudent {
		return fmt.Errorf("student has reached the maximum number of coaches (%d)", models.MaxCoachesPerStudent)
	}

	// Create coach_students record
	_, err = tx.Exec(`
		INSERT INTO coach_students (coach_id, student_id, invitation_id, status, started_at)
		VALUES (?, ?, ?, 'active', NOW())
	`, coachID, studentID, invitationID)
	if err != nil {
		return fmt.Errorf("failed to create relationship")
	}

	// Update invitation status
	_, err = tx.Exec("UPDATE invitations SET status = 'accepted', updated_at = NOW() WHERE id = ?", invitationID)
	if err != nil {
		return fmt.Errorf("failed to update invitation")
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	// Create notification for sender (outside transaction)
	var senderName string
	h.DB.QueryRow("SELECT COALESCE(name, '') FROM users WHERE id = ?", userID).Scan(&senderName)
	meta := map[string]interface{}{"invitation_id": invitationID, "user_name": senderName}
	h.CreateNotification(inv.SenderID, "invitation_accepted", "Invitation accepted", senderName+" accepted your invitation", meta, nil)

	return nil
}

func (h *NotificationHandler) rejectInvitation(invitationID, userID int64) {
	h.DB.Exec("UPDATE invitations SET status = 'rejected', updated_at = NOW() WHERE id = ?", invitationID)

	// Fetch invitation to notify sender
	var senderID int64
	h.DB.QueryRow("SELECT sender_id FROM invitations WHERE id = ?", invitationID).Scan(&senderID)

	var userName string
	h.DB.QueryRow("SELECT COALESCE(name, '') FROM users WHERE id = ?", userID).Scan(&userName)
	meta := map[string]interface{}{"invitation_id": invitationID, "user_name": userName}
	h.CreateNotification(senderID, "invitation_rejected", "Invitation declined", userName+" declined your invitation", meta, nil)
}

func (h *NotificationHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var prefs models.NotificationPreferences
	err := h.DB.QueryRow("SELECT id, user_id, workout_assigned, workout_completed_or_skipped FROM notification_preferences WHERE user_id = ?", userID).Scan(&prefs.ID, &prefs.UserID, &prefs.WorkoutAssigned, &prefs.WorkoutCompletedOrSkipped)
	if err == sql.ErrNoRows {
		// Return defaults
		prefs = models.NotificationPreferences{UserID: userID, WorkoutAssigned: true, WorkoutCompletedOrSkipped: true}
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch preferences")
		return
	}

	writeJSON(w, http.StatusOK, prefs)
}

func (h *NotificationHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.UpdateNotificationPreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	_, err := h.DB.Exec(`
		INSERT INTO notification_preferences (user_id, workout_assigned, workout_completed_or_skipped)
		VALUES (?, ?, ?)
		ON DUPLICATE KEY UPDATE workout_assigned = VALUES(workout_assigned), workout_completed_or_skipped = VALUES(workout_completed_or_skipped)
	`, userID, req.WorkoutAssigned, req.WorkoutCompletedOrSkipped)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update preferences")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Preferences updated"})
}
```

**IMPORTANT:** This file uses `fmt.Errorf` — add `"fmt"` to the imports.

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/Desktop/FitReg/FitRegAPI && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add handlers/notification_handler.go
git commit -m "feat: add notification handler with CRUD, actions, and preferences"
```

---

## Chunk 3: Backend Handlers — Invitations

### Task 6: Create invitation handler

**Files:**
- Create: `~/Desktop/FitReg/FitRegAPI/handlers/invitation_handler.go`

- [ ] **Step 1: Create the invitation handler**

```go
package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/fitreg/api/middleware"
	"github.com/fitreg/api/models"
)

type InvitationHandler struct {
	DB           *sql.DB
	Notification *NotificationHandler
}

func NewInvitationHandler(db *sql.DB, nh *NotificationHandler) *InvitationHandler {
	return &InvitationHandler{DB: db, Notification: nh}
}

func (h *InvitationHandler) isAdmin(userID int64) bool {
	var isAdmin bool
	err := h.DB.QueryRow("SELECT COALESCE(is_admin, FALSE) FROM users WHERE id = ?", userID).Scan(&isAdmin)
	return err == nil && isAdmin
}

func (h *InvitationHandler) CreateInvitation(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreateInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Find receiver by email
	var receiverID int64
	var receiverIsCoach, receiverCoachPublic bool
	err := h.DB.QueryRow("SELECT id, COALESCE(is_coach, FALSE), COALESCE(coach_public, FALSE) FROM users WHERE email = ?", req.ReceiverEmail).Scan(&receiverID, &receiverIsCoach, &receiverCoachPublic)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Cannot send invitation")
		return
	}

	// No self-invitation
	if userID == receiverID {
		writeError(w, http.StatusBadRequest, "Cannot send invitation")
		return
	}

	// Validate type-specific rules
	if req.Type == "coach_invite" {
		var isCoach bool
		h.DB.QueryRow("SELECT COALESCE(is_coach, FALSE) FROM users WHERE id = ?", userID).Scan(&isCoach)
		if !isCoach {
			writeError(w, http.StatusBadRequest, "Cannot send invitation")
			return
		}
	} else if req.Type == "student_request" {
		if !receiverIsCoach || !receiverCoachPublic {
			writeError(w, http.StatusBadRequest, "Cannot send invitation")
			return
		}
	} else {
		writeError(w, http.StatusBadRequest, "Invalid invitation type")
		return
	}

	// Check no pending invitation exists between these users (either direction)
	var pendingCount int
	h.DB.QueryRow(`
		SELECT COUNT(*) FROM invitations
		WHERE status = 'pending' AND (
			(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
		)
	`, userID, receiverID, receiverID, userID).Scan(&pendingCount)
	if pendingCount > 0 {
		writeError(w, http.StatusBadRequest, "Cannot send invitation")
		return
	}

	// Check no active relationship exists
	var activeCount int
	h.DB.QueryRow(`
		SELECT COUNT(*) FROM coach_students
		WHERE status = 'active' AND (
			(coach_id = ? AND student_id = ?) OR (coach_id = ? AND student_id = ?)
		)
	`, userID, receiverID, receiverID, userID).Scan(&activeCount)
	if activeCount > 0 {
		writeError(w, http.StatusBadRequest, "Cannot send invitation")
		return
	}

	// Check MaxCoachesPerStudent (early check)
	var studentID int64
	if req.Type == "coach_invite" {
		studentID = receiverID
	} else {
		studentID = userID
	}
	var studentCoachCount int
	h.DB.QueryRow("SELECT COUNT(*) FROM coach_students WHERE student_id = ? AND status = 'active'", studentID).Scan(&studentCoachCount)
	if studentCoachCount >= models.MaxCoachesPerStudent {
		writeError(w, http.StatusBadRequest, "Cannot send invitation")
		return
	}

	// Create invitation
	result, err := h.DB.Exec(`
		INSERT INTO invitations (type, sender_id, receiver_id, message, status)
		VALUES (?, ?, ?, ?, 'pending')
	`, req.Type, userID, receiverID, req.Message)
	if err != nil {
		log.Printf("ERROR creating invitation: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to create invitation")
		return
	}
	invID, _ := result.LastInsertId()

	// Create notification for receiver
	var senderName, senderAvatar string
	h.DB.QueryRow("SELECT COALESCE(name, ''), COALESCE(avatar_url, '') FROM users WHERE id = ?", userID).Scan(&senderName, &senderAvatar)

	meta := map[string]interface{}{
		"invitation_id": invID,
		"sender_id":     userID,
		"sender_name":   senderName,
		"sender_avatar": senderAvatar,
	}
	actions := []models.NotificationAction{
		{Key: "accept", Label: "invitation_accept", Style: "primary"},
		{Key: "reject", Label: "invitation_reject", Style: "danger"},
	}

	var title, body string
	if req.Type == "coach_invite" {
		title = "New coach invitation"
		body = senderName + " wants to be your coach"
	} else {
		title = "New student request"
		body = senderName + " wants to be your student"
	}
	h.Notification.CreateNotification(receiverID, "invitation_received", title, body, meta, actions)

	// Return created invitation
	var inv models.Invitation
	h.DB.QueryRow(`
		SELECT i.id, i.type, i.sender_id, i.receiver_id, COALESCE(i.message, ''), i.status, i.created_at, i.updated_at,
			COALESCE(s.name, ''), COALESCE(s.avatar_url, ''), COALESCE(rv.name, ''), COALESCE(rv.avatar_url, '')
		FROM invitations i
		JOIN users s ON s.id = i.sender_id
		JOIN users rv ON rv.id = i.receiver_id
		WHERE i.id = ?
	`, invID).Scan(&inv.ID, &inv.Type, &inv.SenderID, &inv.ReceiverID, &inv.Message, &inv.Status, &inv.CreatedAt, &inv.UpdatedAt,
		&inv.SenderName, &inv.SenderAvatar, &inv.ReceiverName, &inv.ReceiverAvatar)

	writeJSON(w, http.StatusCreated, inv)
}

func (h *InvitationHandler) ListInvitations(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	status := r.URL.Query().Get("status")
	direction := r.URL.Query().Get("direction")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 50 {
		limit = 20
	}
	offset := (page - 1) * limit

	query := `
		SELECT i.id, i.type, i.sender_id, i.receiver_id, COALESCE(i.message, ''), i.status, i.created_at, i.updated_at,
			COALESCE(s.name, ''), COALESCE(s.avatar_url, ''), COALESCE(rv.name, ''), COALESCE(rv.avatar_url, '')
		FROM invitations i
		JOIN users s ON s.id = i.sender_id
		JOIN users rv ON rv.id = i.receiver_id
		WHERE 1=1
	`
	args := []interface{}{}

	if direction == "sent" {
		query += " AND i.sender_id = ?"
		args = append(args, userID)
	} else if direction == "received" {
		query += " AND i.receiver_id = ?"
		args = append(args, userID)
	} else {
		query += " AND (i.sender_id = ? OR i.receiver_id = ?)"
		args = append(args, userID, userID)
	}

	if status != "" {
		query += " AND i.status = ?"
		args = append(args, status)
	}

	query += " ORDER BY i.created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		log.Printf("ERROR listing invitations: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to fetch invitations")
		return
	}
	defer rows.Close()

	invitations := []models.Invitation{}
	for rows.Next() {
		var inv models.Invitation
		if err := rows.Scan(&inv.ID, &inv.Type, &inv.SenderID, &inv.ReceiverID, &inv.Message, &inv.Status, &inv.CreatedAt, &inv.UpdatedAt,
			&inv.SenderName, &inv.SenderAvatar, &inv.ReceiverName, &inv.ReceiverAvatar); err != nil {
			log.Printf("ERROR scanning invitation: %v", err)
			continue
		}
		invitations = append(invitations, inv)
	}

	writeJSON(w, http.StatusOK, invitations)
}

func (h *InvitationHandler) GetInvitation(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	invID, err := extractID(r.URL.Path, "/api/invitations/")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid invitation ID")
		return
	}

	var inv models.Invitation
	err = h.DB.QueryRow(`
		SELECT i.id, i.type, i.sender_id, i.receiver_id, COALESCE(i.message, ''), i.status, i.created_at, i.updated_at,
			COALESCE(s.name, ''), COALESCE(s.avatar_url, ''), COALESCE(rv.name, ''), COALESCE(rv.avatar_url, '')
		FROM invitations i
		JOIN users s ON s.id = i.sender_id
		JOIN users rv ON rv.id = i.receiver_id
		WHERE i.id = ?
	`, invID).Scan(&inv.ID, &inv.Type, &inv.SenderID, &inv.ReceiverID, &inv.Message, &inv.Status, &inv.CreatedAt, &inv.UpdatedAt,
		&inv.SenderName, &inv.SenderAvatar, &inv.ReceiverName, &inv.ReceiverAvatar)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Invitation not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch invitation")
		return
	}

	// Check ownership
	if inv.SenderID != userID && inv.ReceiverID != userID && !h.isAdmin(userID) {
		writeError(w, http.StatusForbidden, "Access denied")
		return
	}

	writeJSON(w, http.StatusOK, inv)
}

func (h *InvitationHandler) RespondInvitation(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	path := strings.TrimSuffix(r.URL.Path, "/respond")
	invID, err := extractID(path, "/api/invitations/")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid invitation ID")
		return
	}

	var req models.RespondInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Action != "accepted" && req.Action != "rejected" {
		writeError(w, http.StatusBadRequest, "Action must be 'accepted' or 'rejected'")
		return
	}

	// Fetch invitation and verify receiver
	var invSenderID, invReceiverID int64
	var invStatus, invType string
	err = h.DB.QueryRow("SELECT sender_id, receiver_id, status, type FROM invitations WHERE id = ?", invID).Scan(&invSenderID, &invReceiverID, &invStatus, &invType)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Invitation not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch invitation")
		return
	}

	if invReceiverID != userID && !h.isAdmin(userID) {
		writeError(w, http.StatusForbidden, "Only the receiver can respond")
		return
	}

	if invStatus != "pending" {
		writeError(w, http.StatusConflict, "Invitation is no longer pending")
		return
	}

	if req.Action == "accepted" {
		if err := h.Notification.acceptInvitation(invID, userID); err != nil {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
	} else {
		h.Notification.rejectInvitation(invID, userID)
	}

	// Nullify actions on related notification
	h.DB.Exec(`
		UPDATE notifications SET actions = NULL
		WHERE type = 'invitation_received' AND user_id = ? AND JSON_EXTRACT(metadata, '$.invitation_id') = ?
	`, userID, invID)

	writeJSON(w, http.StatusOK, map[string]string{"message": "Invitation " + req.Action})
}

func (h *InvitationHandler) CancelInvitation(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	invID, err := extractID(r.URL.Path, "/api/invitations/")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid invitation ID")
		return
	}

	// Check sender and status
	var senderID, receiverID int64
	var status string
	err = h.DB.QueryRow("SELECT sender_id, receiver_id, status FROM invitations WHERE id = ?", invID).Scan(&senderID, &receiverID, &status)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Invitation not found")
		return
	}
	if senderID != userID && !h.isAdmin(userID) {
		writeError(w, http.StatusForbidden, "Only the sender can cancel")
		return
	}
	if status != "pending" {
		writeError(w, http.StatusConflict, "Invitation is no longer pending")
		return
	}

	h.DB.Exec("UPDATE invitations SET status = 'cancelled', updated_at = NOW() WHERE id = ?", invID)

	// Nullify actions on related notification
	h.DB.Exec(`
		UPDATE notifications SET actions = NULL, body = 'This invitation was cancelled'
		WHERE type = 'invitation_received' AND user_id = ? AND JSON_EXTRACT(metadata, '$.invitation_id') = ?
	`, receiverID, invID)

	writeJSON(w, http.StatusOK, map[string]string{"message": "Invitation cancelled"})
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/Desktop/FitReg/FitRegAPI && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add handlers/invitation_handler.go
git commit -m "feat: add invitation handler with create, list, respond, cancel"
```

---

### Task 7: Update coach_handler.go — replace AddStudent/RemoveStudent, add notification emissions

**Files:**
- Modify: `~/Desktop/FitReg/FitRegAPI/handlers/coach_handler.go`

- [ ] **Step 1: Add NotificationHandler reference to CoachHandler**

The CoachHandler struct needs a reference to NotificationHandler. Update the struct and constructor:

Find the existing struct definition and change it to:

```go
type CoachHandler struct {
	DB           *sql.DB
	Notification *NotificationHandler
}

func NewCoachHandler(db *sql.DB, nh *NotificationHandler) *CoachHandler {
	return &CoachHandler{DB: db, Notification: nh}
}
```

- [ ] **Step 2: Update ListStudents to filter by active status**

Find all SQL queries in `ListStudents` that reference `coach_students` and add `AND cs.status = 'active'` to the WHERE clause. The query should be:

```sql
SELECT u.id, u.name, u.email, COALESCE(u.avatar_url, '') as avatar_url
FROM users u
JOIN coach_students cs ON cs.student_id = u.id
WHERE cs.coach_id = ? AND cs.status = 'active'
```

- [ ] **Step 3: Remove AddStudent method body — replace with error directing to invitations**

Replace the `AddStudent` method body with a redirect message:

```go
func (h *CoachHandler) AddStudent(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusGone, "Use POST /api/invitations to invite students")
}
```

- [ ] **Step 4: Replace RemoveStudent with EndRelationship**

Replace `RemoveStudent` with:

```go
func (h *CoachHandler) EndRelationship(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	csID, err := extractID(r.URL.Path, "/api/coach-students/")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid relationship ID")
		return
	}

	// Fetch relationship and verify user is part of it
	var coachID, studentID int64
	var status string
	err = h.DB.QueryRow("SELECT coach_id, student_id, status FROM coach_students WHERE id = ?", csID).Scan(&coachID, &studentID, &status)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Relationship not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch relationship")
		return
	}

	isAdmin := false
	h.DB.QueryRow("SELECT COALESCE(is_admin, FALSE) FROM users WHERE id = ?", userID).Scan(&isAdmin)

	if coachID != userID && studentID != userID && !isAdmin {
		writeError(w, http.StatusForbidden, "Access denied")
		return
	}
	if status != "active" {
		writeError(w, http.StatusConflict, "Relationship is not active")
		return
	}

	_, err = h.DB.Exec("UPDATE coach_students SET status = 'finished', finished_at = NOW() WHERE id = ?", csID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to end relationship")
		return
	}

	// Notify the other party
	var otherID int64
	if userID == coachID {
		otherID = studentID
	} else {
		otherID = coachID
	}
	var userName string
	h.DB.QueryRow("SELECT COALESCE(name, '') FROM users WHERE id = ?", userID).Scan(&userName)
	meta := map[string]interface{}{"user_id": userID, "user_name": userName}
	h.Notification.CreateNotification(otherID, "relationship_ended", "Relationship ended", userName+" ended the coaching relationship", meta, nil)

	writeJSON(w, http.StatusOK, map[string]string{"message": "Relationship ended"})
}
```

- [ ] **Step 5: Add notification emission to CreateAssignedWorkout**

After the successful INSERT into `assigned_workouts` (after `awID, _ := result.LastInsertId()`), add:

```go
// Emit notification for student
var coachName string
h.DB.QueryRow("SELECT COALESCE(name, '') FROM users WHERE id = ?", userID).Scan(&coachName)
notifMeta := map[string]interface{}{
	"workout_id":    awID,
	"workout_title": req.Title,
	"coach_name":    coachName,
}
h.Notification.CreateNotification(req.StudentID, "workout_assigned", "New workout assigned", coachName+" assigned you: "+req.Title, notifMeta, nil)
```

- [ ] **Step 6: Add notification emission to UpdateAssignedWorkoutStatus**

After the successful UPDATE of workout status, add:

```go
// Emit notification for coach
var studentName string
h.DB.QueryRow("SELECT COALESCE(name, '') FROM users WHERE id = ?", userID).Scan(&studentName)
var coachID int64
var workoutTitle string
h.DB.QueryRow("SELECT coach_id, title FROM assigned_workouts WHERE id = ?", awID).Scan(&coachID, &workoutTitle)

notifType := "workout_completed"
if req.Status == "skipped" {
	notifType = "workout_skipped"
}
notifMeta := map[string]interface{}{
	"workout_id":    awID,
	"workout_title": workoutTitle,
	"student_name":  studentName,
}
body := studentName + " " + req.Status + " the workout: " + workoutTitle
h.Notification.CreateNotification(coachID, notifType, "Workout "+req.Status, body, notifMeta, nil)
```

- [ ] **Step 7: Update any query that references coach_students to filter by status = 'active'**

Search for all SQL queries referencing `coach_students` in this file and ensure they filter by `cs.status = 'active'` (or `status = 'active'`). This includes:
- `ListStudents` (done in step 2)
- `GetStudentWorkouts` — add `AND cs.status = 'active'`
- `CreateAssignedWorkout` — the validation query should check `AND cs.status = 'active'`
- `ListAssignedWorkouts`, `GetMyAssignedWorkouts` — these join on coach_students, add `AND cs.status = 'active'`

- [ ] **Step 8: Verify it compiles**

```bash
cd ~/Desktop/FitReg/FitRegAPI && go build ./...
```

- [ ] **Step 9: Commit**

```bash
git add handlers/coach_handler.go
git commit -m "feat: update coach handler for invitation system, add notification emissions"
```

---

### Task 8: Update admin_handler.go — add notification on achievement verify

**Files:**
- Modify: `~/Desktop/FitReg/FitRegAPI/handlers/admin_handler.go`

- [ ] **Step 1: Add NotificationHandler reference**

Update the AdminHandler struct:

```go
type AdminHandler struct {
	DB           *sql.DB
	Notification *NotificationHandler
}

func NewAdminHandler(db *sql.DB, nh *NotificationHandler) *AdminHandler {
	return &AdminHandler{DB: db, Notification: nh}
}
```

- [ ] **Step 2: Add notification emission in VerifyAchievement**

After the successful UPDATE and the `rowsAffected` check, before the response, add:

```go
// Notify coach
var coachID int64
var eventName string
h.DB.QueryRow("SELECT coach_id, event_name FROM coach_achievements WHERE id = ?", achID).Scan(&coachID, &eventName)
meta := map[string]interface{}{"achievement_id": achID, "event_name": eventName}
h.Notification.CreateNotification(coachID, "achievement_verified", "Achievement verified", "Your achievement '"+eventName+"' has been verified", meta, nil)
```

- [ ] **Step 3: Verify it compiles**

```bash
cd ~/Desktop/FitReg/FitRegAPI && go build ./...
```

- [ ] **Step 4: Commit**

```bash
git add handlers/admin_handler.go
git commit -m "feat: add notification emission on achievement verification"
```

---

### Task 9: Update router.go — register new routes

**Files:**
- Modify: `~/Desktop/FitReg/FitRegAPI/router/router.go`

- [ ] **Step 1: Update handler initialization**

In the `New` function, after the existing handler instantiations, add the notification and invitation handlers. Update `NewCoachHandler` and `NewAdminHandler` to pass the notification handler:

```go
nh := handlers.NewNotificationHandler(db)
ih := handlers.NewInvitationHandler(db, nh)
ch := handlers.NewCoachHandler(db, nh)
adm := handlers.NewAdminHandler(db, nh)
```

Note: `nh` must be created before `ih`, `ch`, and `adm` since they depend on it.

- [ ] **Step 2: Add invitation routes**

After the coach routes section, add:

```go
// Invitation routes
mux.HandleFunc("/api/invitations", func(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		ih.ListInvitations(w, r)
	case http.MethodPost:
		ih.CreateInvitation(w, r)
	default:
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
})

mux.HandleFunc("/api/invitations/", func(w http.ResponseWriter, r *http.Request) {
	if strings.HasSuffix(r.URL.Path, "/respond") {
		if r.Method == http.MethodPut {
			ih.RespondInvitation(w, r)
		} else {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		}
		return
	}
	switch r.Method {
	case http.MethodGet:
		ih.GetInvitation(w, r)
	case http.MethodDelete:
		ih.CancelInvitation(w, r)
	default:
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
})
```

- [ ] **Step 3: Add notification routes**

```go
// Notification routes
mux.HandleFunc("/api/notifications", func(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		nh.ListNotifications(w, r)
	} else {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
})

mux.HandleFunc("/api/notifications/unread-count", func(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		nh.UnreadCount(w, r)
	} else {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
})

mux.HandleFunc("/api/notifications/read-all", func(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPut {
		nh.MarkAllRead(w, r)
	} else {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
})

mux.HandleFunc("/api/notifications/", func(w http.ResponseWriter, r *http.Request) {
	if strings.HasSuffix(r.URL.Path, "/action") {
		if r.Method == http.MethodPost {
			nh.ExecuteAction(w, r)
		} else {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		}
		return
	}
	if strings.HasSuffix(r.URL.Path, "/read") {
		if r.Method == http.MethodPut {
			nh.MarkRead(w, r)
		} else {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		}
		return
	}
	http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
})
```

- [ ] **Step 4: Add notification preference routes**

```go
// Notification preferences routes
mux.HandleFunc("/api/notification-preferences", func(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		nh.GetPreferences(w, r)
	case http.MethodPut:
		nh.UpdatePreferences(w, r)
	default:
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
})
```

- [ ] **Step 5: Add coach-students relationship end route**

```go
// Coach-student relationship routes
mux.HandleFunc("/api/coach-students/", func(w http.ResponseWriter, r *http.Request) {
	if strings.HasSuffix(r.URL.Path, "/end") {
		if r.Method == http.MethodPut {
			ch.EndRelationship(w, r)
		} else {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		}
		return
	}
	http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
})
```

- [ ] **Step 6: Verify it compiles**

```bash
cd ~/Desktop/FitReg/FitRegAPI && go build ./...
```

- [ ] **Step 7: Commit**

```bash
git add router/router.go
git commit -m "feat: register invitation, notification, and preference routes"
```

---

## Chunk 4: Frontend — Types, API Modules, i18n

### Task 10: Add frontend types

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/types/index.ts`

- [ ] **Step 1: Add new interfaces at the end of the file (before the closing)**

```typescript
export interface Invitation {
  id: number;
  type: 'coach_invite' | 'student_request';
  sender_id: number;
  receiver_id: number;
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  updated_at: string;
  sender_name: string;
  sender_avatar: string;
  receiver_name: string;
  receiver_avatar: string;
}

export interface NotificationAction {
  key: string;
  label: string;
  style: 'primary' | 'danger' | 'default';
}

export interface AppNotification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  actions: NotificationAction[] | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  id: number;
  user_id: number;
  workout_assigned: boolean;
  workout_completed_or_skipped: boolean;
}
```

Note: Named `AppNotification` to avoid collision with the browser's built-in `Notification` type.

- [ ] **Step 2: Verify types compile**

```bash
cd ~/Desktop/FitReg/FitRegFE && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add invitation and notification TypeScript types"
```

---

### Task 11: Create invitations API module

**Files:**
- Create: `~/Desktop/FitReg/FitRegFE/src/api/invitations.ts`

- [ ] **Step 1: Create the API module**

```typescript
import client from './client';
import type { Invitation } from '../types';

export const createInvitation = (data: { type: string; receiver_email: string; message?: string }) =>
  client.post<Invitation>('/invitations', data);

export const listInvitations = (params?: { status?: string; direction?: string; page?: number; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.direction) query.set('direction', params.direction);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return client.get<Invitation[]>(`/invitations${qs ? `?${qs}` : ''}`);
};

export const getInvitation = (id: number) =>
  client.get<Invitation>(`/invitations/${id}`);

export const respondInvitation = (id: number, action: 'accepted' | 'rejected') =>
  client.put(`/invitations/${id}/respond`, { action });

export const cancelInvitation = (id: number) =>
  client.delete(`/invitations/${id}`);
```

- [ ] **Step 2: Commit**

```bash
git add src/api/invitations.ts
git commit -m "feat: add invitations API module"
```

---

### Task 12: Create notifications API module

**Files:**
- Create: `~/Desktop/FitReg/FitRegFE/src/api/notifications.ts`

- [ ] **Step 1: Create the API module**

```typescript
import client from './client';
import type { AppNotification, NotificationPreferences } from '../types';

export const listNotifications = (page = 1, limit = 20) =>
  client.get<AppNotification[]>(`/notifications?page=${page}&limit=${limit}`);

export const getUnreadCount = () =>
  client.get<{ count: number }>('/notifications/unread-count');

export const markAsRead = (id: number) =>
  client.put(`/notifications/${id}/read`);

export const markAllAsRead = () =>
  client.put('/notifications/read-all');

export const executeAction = (id: number, action: string) =>
  client.post(`/notifications/${id}/action`, { action });

export const getNotificationPreferences = () =>
  client.get<NotificationPreferences>('/notification-preferences');

export const updateNotificationPreferences = (data: { workout_assigned: boolean; workout_completed_or_skipped: boolean }) =>
  client.put('/notification-preferences', data);
```

- [ ] **Step 2: Commit**

```bash
git add src/api/notifications.ts
git commit -m "feat: add notifications API module"
```

---

### Task 13: Add i18n keys for both languages

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/i18n/es.ts`
- Modify: `~/Desktop/FitReg/FitRegFE/src/i18n/en.ts`

- [ ] **Step 1: Add Spanish i18n keys**

Add these keys before the `// Common` section in `es.ts`:

```typescript
    // Invitations
    invitation_invite_student: 'Invitar alumno',
    invitation_request_coach: 'Solicitar coach',
    invitation_accept: 'Aceptar',
    invitation_reject: 'Rechazar',
    invitation_cancel: 'Cancelar invitación',
    invitation_message: 'Mensaje (opcional)',
    invitation_message_placeholder: 'Escribí un mensaje...',
    invitation_pending: 'Pendientes',
    invitation_sent: 'Enviadas',
    invitation_received: 'Recibidas',
    invitation_no_pending: 'No hay invitaciones pendientes.',
    invitation_status_pending: 'Pendiente',
    invitation_status_accepted: 'Aceptada',
    invitation_status_rejected: 'Rechazada',
    invitation_status_cancelled: 'Cancelada',
    invitation_coach_invite: 'Invitación de coach',
    invitation_student_request: 'Solicitud de alumno',
    invitation_already_sent: 'Ya hay una invitación pendiente',
    invitation_already_connected: 'Ya están conectados',

    // Notifications
    notification_title: 'Notificaciones',
    notification_empty: 'No hay notificaciones.',
    notification_mark_all_read: 'Marcar todas como leídas',
    notification_just_now: 'Ahora',
    notification_minutes_ago: 'hace {{count}} min',
    notification_hours_ago: 'hace {{count}} h',
    notification_days_ago: 'hace {{count}} d',

    // Notification preferences
    notification_preferences: 'Preferencias de notificaciones',
    notification_pref_workout_assigned: 'Nuevo entrenamiento asignado',
    notification_pref_workout_status: 'Entrenamiento completado/omitido',

    // Relationship
    relationship_end: 'Desvincular',
    relationship_end_confirm: '¿Estás seguro de que querés desvincular esta relación?',
```

- [ ] **Step 2: Add English i18n keys**

Add the equivalent keys in `en.ts`:

```typescript
    // Invitations
    invitation_invite_student: 'Invite student',
    invitation_request_coach: 'Request coach',
    invitation_accept: 'Accept',
    invitation_reject: 'Reject',
    invitation_cancel: 'Cancel invitation',
    invitation_message: 'Message (optional)',
    invitation_message_placeholder: 'Write a message...',
    invitation_pending: 'Pending',
    invitation_sent: 'Sent',
    invitation_received: 'Received',
    invitation_no_pending: 'No pending invitations.',
    invitation_status_pending: 'Pending',
    invitation_status_accepted: 'Accepted',
    invitation_status_rejected: 'Rejected',
    invitation_status_cancelled: 'Cancelled',
    invitation_coach_invite: 'Coach invitation',
    invitation_student_request: 'Student request',
    invitation_already_sent: 'An invitation is already pending',
    invitation_already_connected: 'Already connected',

    // Notifications
    notification_title: 'Notifications',
    notification_empty: 'No notifications.',
    notification_mark_all_read: 'Mark all as read',
    notification_just_now: 'Just now',
    notification_minutes_ago: '{{count}} min ago',
    notification_hours_ago: '{{count}} h ago',
    notification_days_ago: '{{count}} d ago',

    // Notification preferences
    notification_preferences: 'Notification preferences',
    notification_pref_workout_assigned: 'New assigned workout',
    notification_pref_workout_status: 'Workout completed/skipped',

    // Relationship
    relationship_end: 'End relationship',
    relationship_end_confirm: 'Are you sure you want to end this coaching relationship?',
```

- [ ] **Step 3: Verify types compile**

```bash
cd ~/Desktop/FitReg/FitRegFE && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/i18n/es.ts src/i18n/en.ts
git commit -m "feat: add invitation and notification i18n keys"
```

---

## Chunk 5: Frontend — UI Components

### Task 14: Create NotificationBadge component

**Files:**
- Create: `~/Desktop/FitReg/FitRegFE/src/components/NotificationBadge.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getUnreadCount } from "../api/notifications";

const POLL_INTERVAL_MS = 30000;

export default function NotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  async function fetchCount() {
    try {
      const res = await getUnreadCount();
      setCount(res.data.count);
    } catch {
      // Silently fail — badge is non-critical
    }
  }

  return (
    <Link to="/notifications" className="notification-badge">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && <span className="notification-count">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NotificationBadge.tsx
git commit -m "feat: add NotificationBadge component with polling"
```

---

### Task 15: Add NotificationBadge to Navbar

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/components/Navbar.tsx`

- [ ] **Step 1: Import NotificationBadge**

Add import at the top:

```typescript
import NotificationBadge from "./NotificationBadge";
```

- [ ] **Step 2: Add badge before the profile link**

Insert `<NotificationBadge />` just before the `<Link to="/profile"` element:

```tsx
          <NotificationBadge />
          <Link to="/profile" className="navbar-user">
```

- [ ] **Step 3: Verify types compile**

```bash
cd ~/Desktop/FitReg/FitRegFE && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat: add notification bell badge to navbar"
```

---

### Task 16: Create Notifications page

**Files:**
- Create: `~/Desktop/FitReg/FitRegFE/src/pages/Notifications.tsx`

- [ ] **Step 1: Create the notifications page**

```tsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { listNotifications, markAllAsRead, executeAction } from "../api/notifications";
import type { AppNotification } from "../types";

function timeAgo(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('notification_just_now');
  if (diffMin < 60) return t('notification_minutes_ago', { count: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return t('notification_hours_ago', { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  return t('notification_days_ago', { count: diffDays });
}

export default function Notifications() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      setLoading(true);
      const res = await listNotifications();
      setNotifications(res.data);
      // Mark all as read on page enter
      await markAllAsRead();
    } catch {
      // Fail silently
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(notifId: number, actionKey: string) {
    try {
      await executeAction(notifId, actionKey);
      // Refresh list
      const res = await listNotifications();
      setNotifications(res.data);
    } catch {
      // Could show error but keeping simple
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="page">
      <h1>{t('notification_title')}</h1>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <p>{t('notification_empty')}</p>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map((n) => (
            <div key={n.id} className={`notification-item ${!n.is_read ? 'notification-unread' : ''}`}>
              {n.metadata?.sender_avatar && (
                <img src={n.metadata.sender_avatar as string} alt="" className="notification-avatar" />
              )}
              <div className="notification-content">
                <strong className="notification-item-title">{n.title}</strong>
                <p className="notification-body">{n.body}</p>
                <span className="notification-time">{timeAgo(n.created_at, t)}</span>
                {n.actions && n.actions.length > 0 && (
                  <div className="notification-actions">
                    {n.actions.map((action) => (
                      <button
                        key={action.key}
                        className={`btn btn-sm ${action.style === 'primary' ? 'btn-primary' : action.style === 'danger' ? 'btn-danger' : ''}`}
                        onClick={() => handleAction(n.id, action.key)}
                      >
                        {t(action.label)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Notifications.tsx
git commit -m "feat: add Notifications page with dynamic actions"
```

---

### Task 17: Update CoachDashboard for invitation flow

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/pages/CoachDashboard.tsx`

- [ ] **Step 1: Replace the add-student form with invitation form**

Update imports:

```typescript
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listStudents, listAssignedWorkouts } from "../api/coach";
import { createInvitation, listInvitations, cancelInvitation } from "../api/invitations";
import type { Student, AssignedWorkout, Invitation } from "../types";
import { useTranslation } from "react-i18next";
```

Add state for invitations and message:

```typescript
const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
const [newMessage, setNewMessage] = useState("");
```

Update `loadData` to also fetch pending invitations:

```typescript
async function loadData() {
  try {
    setLoading(true);
    const [studentsRes, assignedRes, invRes] = await Promise.all([
      listStudents(),
      listAssignedWorkouts(),
      listInvitations({ status: 'pending', direction: 'sent' }),
    ]);
    setStudents(studentsRes.data);
    setAssignedWorkouts(assignedRes.data);
    setPendingInvitations(invRes.data);
  } catch {
    setError("Failed to load dashboard data.");
  } finally {
    setLoading(false);
  }
}
```

Replace `handleAddStudent` with `handleInvite`:

```typescript
async function handleInvite(e: React.FormEvent) {
  e.preventDefault();
  if (!newEmail.trim()) return;
  setAdding(true);
  setError("");
  try {
    await createInvitation({ type: 'coach_invite', receiver_email: newEmail.trim(), message: newMessage.trim() || undefined });
    setNewEmail("");
    setNewMessage("");
    setShowAddForm(false);
    loadData();
  } catch {
    setError(t('error'));
  } finally {
    setAdding(false);
  }
}

async function handleCancelInvitation(id: number) {
  try {
    await cancelInvitation(id);
    setPendingInvitations((prev) => prev.filter((i) => i.id !== id));
  } catch {
    setError(t('error'));
  }
}
```

Replace `handleRemoveStudent` with `handleEndRelationship` using the new endpoint — but since the student card currently shows student.id and the endpoint needs coach_students.id, we need the coach_students record. For simplicity, keep showing students and use a separate API call. Actually, we should add the relationship_id to the student list response. Let's handle this by calling the end endpoint with a lookup.

Actually, a simpler approach: update the form button label and the section header to use invitation terminology, and replace the add form's onSubmit:

Update the section header button:

```tsx
<button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
  + {t('invitation_invite_student')}
</button>
```

Update the form:

```tsx
{showAddForm && (
  <form className="add-student-form" onSubmit={handleInvite}>
    <input
      type="email"
      placeholder={t('coach_add_student_placeholder')}
      value={newEmail}
      onChange={(e) => setNewEmail(e.target.value)}
      required
    />
    <input
      type="text"
      placeholder={t('invitation_message_placeholder')}
      value={newMessage}
      onChange={(e) => setNewMessage(e.target.value)}
    />
    <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
      {t('invitation_invite_student')}
    </button>
    <button type="button" className="btn btn-sm" onClick={() => setShowAddForm(false)}>
      {t('cancel')}
    </button>
  </form>
)}
```

Add pending invitations section after the form, before the student grid:

```tsx
{pendingInvitations.length > 0 && (
  <div className="invitation-pending-section">
    <h3>{t('invitation_pending')}</h3>
    {pendingInvitations.map((inv) => (
      <div key={inv.id} className="invitation-card">
        <div className="invitation-card-info">
          {inv.receiver_avatar && <img src={inv.receiver_avatar} alt="" className="student-avatar" />}
          <div>
            <strong>{inv.receiver_name}</strong>
            {inv.message && <p className="invitation-message">{inv.message}</p>}
          </div>
        </div>
        <button className="btn btn-sm btn-danger" onClick={() => handleCancelInvitation(inv.id)}>
          {t('invitation_cancel')}
        </button>
      </div>
    ))}
  </div>
)}
```

Remove the old `handleRemoveStudent` function and the delete button from student cards (or replace with end-relationship logic if desired — for now, keep the delete button but wire it to the end endpoint once we have the coach_students ID).

- [ ] **Step 2: Verify types compile**

```bash
cd ~/Desktop/FitReg/FitRegFE && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/CoachDashboard.tsx
git commit -m "feat: replace direct add-student with invitation flow on dashboard"
```

---

### Task 18: Update CoachPublicProfile with "Request coach" button

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/pages/CoachPublicProfile.tsx` (read first to understand structure)

- [ ] **Step 1: Read the current file to understand structure**

Read `~/Desktop/FitReg/FitRegFE/src/pages/CoachPublicProfile.tsx` fully before editing.

- [ ] **Step 2: Add invitation imports and state**

Add imports:

```typescript
import { createInvitation } from "../api/invitations";
```

Add state:

```typescript
const [showRequestModal, setShowRequestModal] = useState(false);
const [requestMessage, setRequestMessage] = useState("");
const [requesting, setRequesting] = useState(false);
const [requestSent, setRequestSent] = useState(false);
```

- [ ] **Step 3: Add handleRequestCoach function**

```typescript
async function handleRequestCoach(e: React.FormEvent) {
  e.preventDefault();
  setRequesting(true);
  try {
    await createInvitation({ type: 'student_request', receiver_email: profile!.email || '', message: requestMessage.trim() || undefined });
    setRequestSent(true);
    setShowRequestModal(false);
    setRequestMessage("");
  } catch {
    setError(t('error'));
  } finally {
    setRequesting(false);
  }
}
```

Note: The `CoachPublicProfile` type doesn't include `email`. We need to either:
- Pass the coach ID and use a different endpoint, OR
- The `createInvitation` endpoint could also accept `receiver_id` instead of email

For simplicity, add `receiver_id` support to the invitation API. Update the `CreateInvitationRequest` in `models/invitation.go`:

```go
type CreateInvitationRequest struct {
	Type          string `json:"type"`
	ReceiverEmail string `json:"receiver_email"`
	ReceiverID    int64  `json:"receiver_id"`
	Message       string `json:"message"`
}
```

And in `invitation_handler.go` `CreateInvitation`, after parsing the request, check `ReceiverID` first:

```go
var receiverID int64
if req.ReceiverID > 0 {
	receiverID = req.ReceiverID
	err = h.DB.QueryRow("SELECT COALESCE(is_coach, FALSE), COALESCE(coach_public, FALSE) FROM users WHERE id = ?", receiverID).Scan(&receiverIsCoach, &receiverCoachPublic)
} else {
	err = h.DB.QueryRow("SELECT id, COALESCE(is_coach, FALSE), COALESCE(coach_public, FALSE) FROM users WHERE email = ?", req.ReceiverEmail).Scan(&receiverID, &receiverIsCoach, &receiverCoachPublic)
}
```

Then the frontend can use `receiver_id`:

```typescript
// in invitations.ts, update the data type:
export const createInvitation = (data: { type: string; receiver_email?: string; receiver_id?: number; message?: string }) =>
  client.post<Invitation>('/invitations', data);
```

And the handleRequestCoach becomes:

```typescript
async function handleRequestCoach(e: React.FormEvent) {
  e.preventDefault();
  if (!profile) return;
  setRequesting(true);
  try {
    await createInvitation({ type: 'student_request', receiver_id: profile.id, message: requestMessage.trim() || undefined });
    setRequestSent(true);
    setShowRequestModal(false);
    setRequestMessage("");
  } catch {
    setError(t('error'));
  } finally {
    setRequesting(false);
  }
}
```

- [ ] **Step 4: Add "Request coach" button and modal in the JSX**

Add after the coach description section:

```tsx
{!requestSent ? (
  <button className="btn btn-primary" onClick={() => setShowRequestModal(true)}>
    {t('invitation_request_coach')}
  </button>
) : (
  <span className="badge badge-pending">{t('invitation_status_pending')}</span>
)}

{showRequestModal && (
  <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <h3>{t('invitation_request_coach')}</h3>
      <form onSubmit={handleRequestCoach}>
        <div className="form-group">
          <label>{t('invitation_message')}</label>
          <textarea
            value={requestMessage}
            onChange={(e) => setRequestMessage(e.target.value)}
            placeholder={t('invitation_message_placeholder')}
            rows={3}
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={requesting}>
            {requesting ? t('form_saving') : t('invitation_request_coach')}
          </button>
          <button type="button" className="btn" onClick={() => setShowRequestModal(false)}>
            {t('cancel')}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify types compile**

```bash
cd ~/Desktop/FitReg/FitRegFE && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/pages/CoachPublicProfile.tsx src/api/invitations.ts
cd ~/Desktop/FitReg/FitRegAPI
git add models/invitation.go handlers/invitation_handler.go
git commit -m "feat: add request-coach button and receiver_id support"
```

---

### Task 19: Add notification preferences to Profile page

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/pages/Profile.tsx`

- [ ] **Step 1: Add imports and state**

Add imports:

```typescript
import { getNotificationPreferences, updateNotificationPreferences } from "../api/notifications";
import type { NotificationPreferences } from "../types";
```

Add state:

```typescript
const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
```

- [ ] **Step 2: Load preferences on mount**

Add a `useEffect` to load preferences:

```typescript
useEffect(() => {
  getNotificationPreferences().then((res) => setNotifPrefs(res.data)).catch(() => {});
}, []);
```

- [ ] **Step 3: Add preference update handler**

```typescript
async function handlePrefChange(field: keyof NotificationPreferences, value: boolean) {
  if (!notifPrefs) return;
  const updated = { ...notifPrefs, [field]: value };
  setNotifPrefs(updated);
  try {
    await updateNotificationPreferences({
      workout_assigned: updated.workout_assigned,
      workout_completed_or_skipped: updated.workout_completed_or_skipped,
    });
  } catch {
    // Revert on error
    setNotifPrefs(notifPrefs);
  }
}
```

- [ ] **Step 4: Add preferences section in the JSX**

Add after the `is_coach` checkbox, before the form-actions:

```tsx
{notifPrefs && (
  <div className="form-group">
    <label><strong>{t('notification_preferences')}</strong></label>
    <label className="checkbox-label">
      <input
        type="checkbox"
        checked={notifPrefs.workout_assigned}
        onChange={(e) => handlePrefChange('workout_assigned', e.target.checked)}
      />
      <span>{t('notification_pref_workout_assigned')}</span>
    </label>
    {user?.is_coach && (
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={notifPrefs.workout_completed_or_skipped}
          onChange={(e) => handlePrefChange('workout_completed_or_skipped', e.target.checked)}
        />
        <span>{t('notification_pref_workout_status')}</span>
      </label>
    )}
  </div>
)}
```

- [ ] **Step 5: Verify types compile**

```bash
cd ~/Desktop/FitReg/FitRegFE && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: add notification preferences to Profile page"
```

---

### Task 20: Add /notifications route and CSS styles

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/App.tsx`
- Modify: `~/Desktop/FitReg/FitRegFE/src/App.css`

- [ ] **Step 1: Add Notifications route to App.tsx**

Add import:

```typescript
import Notifications from "./pages/Notifications";
```

Add route (inside the `<Routes>`, after other protected routes):

```tsx
<Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
```

- [ ] **Step 2: Add CSS styles to App.css**

Add at the end of App.css:

```css
/* Notification Badge */
.notification-badge {
  position: relative;
  display: flex;
  align-items: center;
  color: inherit;
  text-decoration: none;
  padding: 4px;
}

.notification-count {
  position: absolute;
  top: -4px;
  right: -6px;
  background: #e53e3e;
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

/* Notification List */
.notification-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.notification-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #eee;
  align-items: flex-start;
}

.notification-unread {
  background: #f0f7ff;
}

.notification-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-item-title {
  font-size: 0.95rem;
}

.notification-body {
  font-size: 0.85rem;
  color: #555;
  margin: 4px 0;
}

.notification-time {
  font-size: 0.75rem;
  color: #999;
}

.notification-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* Invitation cards */
.invitation-pending-section {
  margin: 16px 0;
}

.invitation-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 8px;
  margin-bottom: 8px;
}

.invitation-card-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.invitation-message {
  font-size: 0.85rem;
  color: #666;
  margin: 2px 0 0;
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd ~/Desktop/FitReg/FitRegFE && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: add notifications route and CSS styles"
```

---

## Chunk 6: Integration Testing & Verification

### Task 21: Backend compilation and smoke test

- [ ] **Step 1: Verify full backend compiles**

```bash
cd ~/Desktop/FitReg/FitRegAPI && go build ./...
```

Expected: No errors.

- [ ] **Step 2: Start the backend and verify health**

```bash
cd ~/Desktop/FitReg/FitRegAPI
export $(cat .env | xargs)
go run main.go &
sleep 2
curl http://localhost:8080/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Kill the test server**

```bash
lsof -i :8080 -t | xargs kill -9
```

### Task 22: Frontend compilation and smoke test

- [ ] **Step 1: Verify full frontend compiles**

```bash
cd ~/Desktop/FitReg/FitRegFE && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 2: Verify dev build works**

```bash
cd ~/Desktop/FitReg/FitRegFE && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Final commit if any pending changes**

```bash
cd ~/Desktop/FitReg/FitRegAPI && git status
cd ~/Desktop/FitReg/FitRegFE && git status
```

If any uncommitted changes, stage and commit.
