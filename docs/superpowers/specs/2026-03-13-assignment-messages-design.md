# Assignment Messages — Design Spec

## Overview

Add a messaging system scoped to assigned workouts so students and coaches can communicate about specific assignments. Messages are available while the assignment is pending and become read-only once completed or skipped.

## Database

### New table: `assignment_messages`

```sql
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

`is_read` tracks whether the other participant has seen the message. Since there are only 2 participants per assignment (coach + student), a single boolean is sufficient — the sender's messages are always "read" by them, and `is_read` refers to the other party.

The composite index `idx_assignment_messages_unread` covers the unread count query (`WHERE assigned_workout_id = ? AND sender_id != ? AND is_read = FALSE`).

### Notification preference column

Add `assignment_message` column to the existing `notification_preferences` table (not `users`):

```sql
ALTER TABLE notification_preferences ADD COLUMN assignment_message BOOLEAN NOT NULL DEFAULT TRUE;
```

This follows the existing pattern — the `notification_preferences` table already has `workout_assigned` and `workout_completed_or_skipped` columns. The `CreateNotification` method in `notification_handler.go` checks this table before creating notifications.

## API

### New endpoints (assignment messages)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/assignment-messages/{id}` | List all messages for assigned workout `{id}` |
| POST | `/api/assignment-messages/{id}` | Send a new message for assigned workout `{id}` |
| PUT | `/api/assignment-messages/{id}/read` | Mark all messages as read for current user |

### New endpoint (assignment detail for both roles)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/assigned-workout-detail/{id}` | Get assigned workout detail (coach OR student) |

The existing `/api/coach/assigned-workouts/{id}` only authorizes coaches (`WHERE coach_id = ?`). The `AssignmentDetail` page needs an endpoint accessible by both roles.

### Route registration in Go

The backend uses Go's stdlib `http.NewServeMux()` with trailing-slash handlers and manual ID extraction via `extractID()`. Registration in `router.go`:

```go
// Assignment messages
mux.HandleFunc("/api/assignment-messages/", func(w http.ResponseWriter, r *http.Request) {
    // Check for /read suffix
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

// Assignment detail (both roles)
mux.HandleFunc("/api/assigned-workout-detail/", func(w http.ResponseWriter, r *http.Request) {
    if r.Method == http.MethodGet {
        amh.GetAssignedWorkoutDetail(w, r)
    } else {
        http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
    }
})
```

ID extraction inside handlers uses `extractID(r.URL.Path, "/api/assignment-messages/")` (stripping `/read` suffix when needed). This follows the same pattern as all existing handlers.

The `amh` handler is instantiated in `router/router.go`'s `New()` function alongside the other handlers:

```go
amh := handlers.NewAssignmentMessageHandler(db, nh)
```

Constructor signature: `func NewAssignmentMessageHandler(db *sql.DB, nh *NotificationHandler) *AssignmentMessageHandler`.

### Authorization

All endpoints validate that the authenticated user is either the `coach_id` or `student_id` of the assigned workout. Returns 404 otherwise.

### GET `/api/assigned-workout-detail/{id}`

Returns the full assigned workout with segments, results, and `unread_message_count`. Authorizes both coach and student (`WHERE aw.id = ? AND (aw.coach_id = ? OR aw.student_id = ?)`).

The `unread_message_count` is computed as a correlated subquery:

```sql
SELECT ...,
    (SELECT COUNT(*) FROM assignment_messages am
     WHERE am.assigned_workout_id = aw.id
       AND am.sender_id != ?
       AND am.is_read = FALSE) AS unread_message_count
FROM assigned_workouts aw
JOIN users u ON u.id = aw.student_id
WHERE aw.id = ? AND (aw.coach_id = ? OR aw.student_id = ?)
```

Response shape matches existing `getAssignedWorkout` with the addition of `unread_message_count: number`.

### GET `/api/assignment-messages/{id}`

Returns array of messages ordered by `created_at ASC`. Each message includes sender info (name, avatar) joined from users table. Works regardless of assignment status (supports read-only history).

Response:
```json
[
  {
    "id": 1,
    "assigned_workout_id": 10,
    "sender_id": 5,
    "sender_name": "Mariano",
    "sender_avatar": "data:image/...",
    "body": "A qué ritmo hago los 3k?",
    "is_read": true,
    "created_at": "2026-03-13T14:30:00Z"
  }
]
```

### POST `/api/assignment-messages/{id}`

Request: `{ "body": "message text" }`

Validations:
- `body` must be non-empty (max 2000 chars)
- Assignment status must be `pending` — returns 409 Conflict if completed/skipped
- User must be coach or student of the assignment

Side effects:
- Calls `nh.CreateNotification(recipientID, "assignment_message", ...)`. The existing `CreateNotification` method's preference-checking `if` block must be extended to include `"assignment_message"`, querying the new `assignment_message` column from `notification_preferences`:

```go
// In CreateNotification, extend the existing preference check:
if notifType == "workout_assigned" || notifType == "workout_completed" || notifType == "workout_skipped" || notifType == "assignment_message" {
    var workoutAssigned, workoutCompletedOrSkipped, assignmentMessage bool
    err := h.DB.QueryRow("SELECT COALESCE(workout_assigned, TRUE), COALESCE(workout_completed_or_skipped, TRUE), COALESCE(assignment_message, TRUE) FROM notification_preferences WHERE user_id = ?", userID).Scan(&workoutAssigned, &workoutCompletedOrSkipped, &assignmentMessage)
    // ... existing logic, plus:
    if notifType == "assignment_message" && !assignmentMessage { return nil }
}
```

Response: the created message object (same shape as GET items).

### PUT `/api/assignment-messages/{id}/read`

Marks all messages where `sender_id != current_user` as `is_read = TRUE`. Returns `{ "message": "Messages marked as read" }`.

## Backend Model

```go
// models/assignment_message.go
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

## Backend Handler

New file `handlers/assignment_message_handler.go` with `AssignmentMessageHandler` struct holding `DB *sql.DB` and `NH *NotificationHandler`.

Methods:
- `ListMessages(w, r)` — GET handler, extracts ID via `extractID(path, "/api/assignment-messages/")`
- `SendMessage(w, r)` — POST handler, same ID extraction
- `MarkRead(w, r)` — PUT handler, strips `/read` suffix before extracting ID: `extractID(strings.TrimSuffix(path, "/read"), "/api/assignment-messages/")`
- `GetAssignedWorkoutDetail(w, r)` — GET handler, extracts ID via `extractID(path, "/api/assigned-workout-detail/")`

Helper `getAssignmentParticipants(assignedWorkoutID)` returns `(coachID, studentID, status, title, error)` — queries `assigned_workouts` for `coach_id`, `student_id`, `status`, and `title` (the title is stored directly on the `assigned_workouts` table). Used by all message endpoints for authorization, status checks, and notification metadata.

## Notifications

New notification type: `assignment_message`.

Metadata:
```json
{
  "assigned_workout_id": 10,
  "sender_name": "Mariano",
  "workout_title": "3k Suave"
}
```

i18n keys:
- `notif_assignment_message_title`: "Nuevo mensaje en asignación" / "New assignment message"
- `notif_assignment_message_body`: "{{sender_name}} escribió en: {{workout_title}}" / "{{sender_name}} wrote in: {{workout_title}}"

Click on notification navigates to `/assignments/:id` (using `assigned_workout_id` from metadata).

### Notification icon

Add `assignment_message` case to `notificationIcon()` in `Notifications.tsx`:
```typescript
case 'assignment_message': return '💬';
```

## Frontend

### Type updates

New type in `types/index.ts`:
```typescript
interface AssignmentMessage {
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

Add `unread_message_count` to the existing `AssignedWorkout` interface:
```typescript
export interface AssignedWorkout {
  // ... existing fields ...
  unread_message_count: number;
}
```

### New API functions (new `api/assignments.ts`)

```typescript
getAssignedWorkoutDetail(id: number): Promise<AssignedWorkout>
listAssignmentMessages(assignedWorkoutId: number): Promise<AssignmentMessage[]>
sendAssignmentMessage(assignedWorkoutId: number, body: string): Promise<AssignmentMessage>
markAssignmentMessagesRead(assignedWorkoutId: number): Promise<void>
```

### New page: `/assignments/:id` (`pages/AssignmentDetail.tsx`)

Layout (top to bottom):
1. **Header**: back link (← Volver) + status badge (pending/completed/skipped)
2. **Detail card**: title, type badge, distance, duration, segments (SegmentDisplay), coach notes, results (if completed)
3. **Action buttons** (only if pending):
   - Student: "Completar" + "Omitir" buttons
   - Coach: "Editar" (link to edit form) + "Eliminar" button
4. **Messages section**: "Mensajes (N)" header + list of message bubbles
   - Own messages aligned right with user color
   - Other's messages aligned left with their color
   - Each bubble shows avatar, name, time, and body
5. **Input bar** (only if pending): text input + send button
   - If completed/skipped: no input, messages are read-only

On mount:
- Fetch assigned workout detail (`getAssignedWorkoutDetail` — the new dual-role endpoint)
- Fetch messages (`listAssignmentMessages`)
- Mark messages as read (`markAssignmentMessagesRead`)
- Auto-scroll to bottom of message list

On send:
- POST message, append to local list, scroll to bottom

### DayModal changes

In the detail view, add a button/link below the existing action buttons:

```
💬 Mensajes (3)  →
```

This links to `/assignments/:id`. The number shows unread count from the assignment's `unread_message_count` field.

### Existing list endpoint changes

Both `/api/my-assigned-workouts/` (in `GetMyAssignedWorkouts`) and `/api/coach/assigned-workouts/` (in `ListAssignedWorkouts`) must add the `unread_message_count` correlated subquery to their SELECT. Changes required:

1. **SQL**: Add `(SELECT COUNT(*) FROM assignment_messages am WHERE am.assigned_workout_id = aw.id AND am.sender_id != ? AND am.is_read = FALSE) AS unread_message_count` to the SELECT clause. The `?` parameter is the current user's ID.
2. **Scan**: Add `&aw.UnreadMessageCount` to the `Scan()` call.
3. **Go model**: Add `UnreadMessageCount int `json:"unread_message_count"`` to the `AssignedWorkout` struct in `models/coach.go`.

This ensures DayModal can show the badge without an extra API call.

### Route registration

Add to `App.tsx`:
```tsx
<Route path="/assignments/:id" element={<ProtectedRoute><AssignmentDetail /></ProtectedRoute>} />
```

### Notification routing

Update `getNotificationLink` in `Notifications.tsx` to handle `assignment_message`:
```typescript
case 'assignment_message':
  return meta.assigned_workout_id ? `/assignments/${meta.assigned_workout_id}` : '/my-assignments';
```

### Notification preference UI

Add `assignment_message` toggle to the notification preferences section in `Profile.tsx`, visible to both coaches and students who have a coach. Update the frontend `NotificationPreferences` type and the GET/PUT API calls to include the new `assignment_message` field.

### Notification preferences backend changes

Update `NotificationPreferences` model in `models/notification.go`:
```go
type NotificationPreferences struct {
    ID                        int64 `json:"id"`
    UserID                    int64 `json:"user_id"`
    WorkoutAssigned           bool  `json:"workout_assigned"`
    WorkoutCompletedOrSkipped bool  `json:"workout_completed_or_skipped"`
    AssignmentMessage         bool  `json:"assignment_message"`
}
```

Update `UpdateNotificationPreferencesRequest` similarly. Update GET handler query to `SELECT id, user_id, workout_assigned, workout_completed_or_skipped, COALESCE(assignment_message, TRUE) ...`. Update PUT handler's INSERT/ON DUPLICATE KEY UPDATE to include `assignment_message`.

## CSS

New styles in `App.css`:
- `.assignment-detail` — page container
- `.assignment-messages` — messages section
- `.assignment-message` — individual message bubble
- `.assignment-message--own` — right-aligned variant
- `.assignment-message-input` — bottom input bar
- `.assignment-message-input--disabled` — read-only state (grayed out, no interaction)

Reuse existing patterns: `.detail-card`, `.detail-grid`, `.day-modal-section`, avatar component, etc.

## Migration

### `001_schema.sql` addition

Add `CREATE TABLE assignment_messages` (with composite index) after the `assigned_workout_segments` table. Add `assignment_message BOOLEAN NOT NULL DEFAULT TRUE` column to the `notification_preferences` CREATE TABLE.

### `002_prod_schema.sql` addition

```sql
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
