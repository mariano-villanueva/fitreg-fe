# Invitations & Notifications System — Design Spec

**Goal:** Implement a bidirectional invitation system between coaches and students, backed by an in-app notification system with dynamic actions and user-configurable preferences.

**Architecture:** Two new subsystems (invitations + notifications) that integrate with the existing coach-student relationship. Invitations replace the current direct-add flow. Notifications are generic and event-driven, with a JSON-based actions system for interactive notifications.

**Tech Stack:** Go (stdlib) backend, MySQL, React 19 + TypeScript frontend. No new dependencies.

---

## 1. Data Model

### 1.1 Table: `invitations`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT AUTO_INCREMENT PK | |
| `type` | ENUM('coach_invite', 'student_request') | Who initiates |
| `sender_id` | BIGINT FK → users | Who sends the invitation |
| `receiver_id` | BIGINT FK → users | Who must accept/reject |
| `message` | TEXT NULL | Optional message from sender |
| `status` | ENUM('pending', 'accepted', 'rejected', 'cancelled') | Current status |
| `created_at` | DATETIME DEFAULT NOW() | |
| `updated_at` | DATETIME DEFAULT NOW() ON UPDATE | |

**Constraints:**
- FK on `sender_id` and `receiver_id` to `users(id)`
- App-level validation: no duplicate pending invitation between same pair of users (in either direction)
- App-level validation: sender_id != receiver_id (no self-invitations)

### 1.2 Table: `coach_students` (recreated)

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT AUTO_INCREMENT PK | |
| `coach_id` | BIGINT FK → users | |
| `student_id` | BIGINT FK → users | |
| `invitation_id` | BIGINT FK → invitations NULL | Invitation that originated this relationship |
| `status` | ENUM('active', 'finished') DEFAULT 'active' | |
| `started_at` | DATETIME DEFAULT NOW() | When relationship started |
| `finished_at` | DATETIME NULL | When relationship ended |
| `created_at` | DATETIME DEFAULT NOW() | |

**Constraints:**
- FK on `coach_id` and `student_id` to `users(id)`
- FK on `invitation_id` to `invitations(id)` (nullable, for traceability)
- Multiple `finished` records allowed for the same pair (history)

**Concurrency control:**
- When accepting an invitation, use a transaction with `SELECT ... FOR UPDATE` on `coach_students` WHERE `student_id = ? AND status = 'active'` to prevent race conditions (e.g., two coaches accepting simultaneously when `MaxCoachesPerStudent = 1`)
- Always INSERT a new record (never reactivate old ones)

**Notes:**
- Existing `coach_students` data is dropped and recreated (clean start)
- When accepting an invitation, always INSERT a new record
- When ending a relationship, UPDATE `status = 'finished'`, `finished_at = NOW()`

### 1.3 Table: `notifications`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT AUTO_INCREMENT PK | |
| `user_id` | BIGINT FK → users | Recipient |
| `type` | VARCHAR(50) NOT NULL | Notification type |
| `title` | VARCHAR(255) NOT NULL | Display title |
| `body` | TEXT | Description |
| `metadata` | JSON | Dynamic data (IDs, names, avatars, URLs) |
| `actions` | JSON NULL | Array of available actions, NULL if informational |
| `is_read` | BOOLEAN DEFAULT FALSE | |
| `created_at` | DATETIME DEFAULT NOW() | |

**Index:** `(user_id, is_read, created_at DESC)` for efficient listing and unread count.

**Notification types (initial):**

| Type | Always active | Has actions | Recipient |
|------|--------------|-------------|-----------|
| `invitation_received` | Yes | Yes (accept/reject) | Receiver of invitation |
| `invitation_accepted` | Yes | No | Sender of invitation |
| `invitation_rejected` | Yes | No | Sender of invitation |
| `achievement_verified` | Yes | No | Coach (owner of the achievement) |
| `workout_assigned` | Configurable | No | Student |
| `workout_completed` | Configurable | No | Coach |
| `workout_skipped` | Configurable | No | Coach |
| `relationship_ended` | Yes | No | The other party |

**Actions JSON structure:**
```json
[
  {"key": "accept", "label": "invitation_accept", "style": "primary"},
  {"key": "reject", "label": "invitation_reject", "style": "danger"}
]
```
- `key`: action identifier (used by backend to resolve what to do)
- `label`: i18n key (frontend translates)
- `style`: CSS hint for button (primary, danger, default)

After an action is executed, `actions` is set to NULL to prevent re-execution.

**Metadata JSON examples:**

Invitation received:
```json
{
  "invitation_id": 5,
  "sender_id": 12,
  "sender_name": "Juan Perez",
  "sender_avatar": "https://..."
}
```

Workout assigned:
```json
{
  "workout_id": 42,
  "workout_title": "Tempo 5K",
  "coach_name": "Maria Garcia"
}
```

### 1.4 Table: `notification_preferences`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT AUTO_INCREMENT PK | |
| `user_id` | BIGINT FK → users (UNIQUE) | |
| `workout_assigned` | BOOLEAN DEFAULT TRUE | Student receives workout assignment notifications |
| `workout_completed_or_skipped` | BOOLEAN DEFAULT TRUE | Coach receives workout completion/skip notifications |

- Created with defaults when user completes onboarding
- Only configurable types appear here; always-active types are not listed

### 1.5 Configuration constant

```go
const MaxCoachesPerStudent = 1
```

Validated at both invitation creation (early feedback) and acceptance (authoritative check with transactional isolation). Counts only `active` coach_students records where the user is the student.

---

## 2. API Endpoints

### 2.1 Invitations

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST /api/invitations` | Create invitation | Authenticated user |
| `GET /api/invitations` | List my invitations (sent + received) | Owner or admin |
| `GET /api/invitations/{id}` | Get invitation details | Sender, receiver, or admin |
| `PUT /api/invitations/{id}/respond` | Accept or reject | Receiver or admin |
| `DELETE /api/invitations/{id}` | Cancel pending invitation | Sender or admin |

**GET /api/invitations query params:**
- `?status=pending|accepted|rejected` — filter by status
- `?direction=sent|received` — filter by direction
- `?page=1&limit=20` — pagination (default limit 20)

**POST /api/invitations body:**
```json
{
  "type": "coach_invite",
  "receiver_email": "student@email.com",
  "message": "I'd like to coach you"
}
```

**Validations on POST:**
- sender_id != receiver_id (no self-invitations)
- `coach_invite`: sender must have `is_coach = true`, receiver must exist
- `student_request`: receiver must have `is_coach = true` and `coach_public = true`
- No pending invitation between both users (in either direction)
- No active `coach_students` relationship between both users
- `MaxCoachesPerStudent` for the would-be student (early check, re-validated at acceptance)
- On validation failure (including user not found): return HTTP 400 with generic message `"Cannot send invitation"` to avoid leaking user existence

**PUT /api/invitations/{id}/respond body:**
```json
{ "action": "accepted" }
```
Values: `"accepted"` or `"rejected"`.

**Precondition:** invitation must be in `pending` status. If not (e.g., already cancelled or responded), return HTTP 409 Conflict.

On accept: transactional INSERT into `coach_students` with `SELECT FOR UPDATE` to re-validate `MaxCoachesPerStudent`.
On reject: update invitation status only.
Both: create notification for the sender.

**DELETE /api/invitations/{id}:**
- Sets invitation status to `cancelled`
- Nullifies `actions` on the corresponding `invitation_received` notification (so receiver can no longer act on it)
- Updates notification body to indicate the invitation was cancelled

### 2.2 Notifications

| Method | Route | Description |
|--------|-------|-------------|
| `GET /api/notifications` | List my notifications (paginated, newest first) |
| `GET /api/notifications/unread-count` | Unread count for badge |
| `PUT /api/notifications/{id}/read` | Mark as read |
| `PUT /api/notifications/read-all` | Mark all as read |
| `POST /api/notifications/{id}/action` | Execute an action |

**GET /api/notifications query params:**
- `?page=1&limit=20` — offset-based pagination (default limit 20)

**POST /api/notifications/{id}/action body:**
```json
{ "action": "accept" }
```

Backend resolves based on `type` + `action`:
- `invitation_received` + `accept` → accepts the invitation (same as PUT respond)
- `invitation_received` + `reject` → rejects the invitation

**Precondition:** the underlying invitation must still be `pending`. If not, return HTTP 409 Conflict.

After execution, `actions` is set to NULL on the notification.

**All endpoints filter by JWT userID unless user is admin.**

### 2.3 Notification Preferences

| Method | Route | Description |
|--------|-------|-------------|
| `GET /api/notification-preferences` | Get my preferences |
| `PUT /api/notification-preferences` | Update preferences |

### 2.4 Coach-Students

| Method | Route | Description |
|--------|-------|-------------|
| `PUT /api/coach-students/{id}/end` | End relationship | Either party or admin |

Validates the authenticated user is part of the relationship. Sets `status = 'finished'`, `finished_at = NOW()`. Creates `relationship_ended` notification for the other party.

---

## 3. Business Flows

### 3.1 Coach invites student

1. Coach enters student email and optional message
2. `POST /api/invitations` with `type: "coach_invite"`
3. Invitation created with `status: pending`
4. Notification `invitation_received` created for student with actions `[accept, reject]`
5. Student sees badge on navbar, opens notifications
6. Student accepts or rejects (from notification or invitations list)
7. If accepted: `coach_students` record created (transactional), `invitation_accepted` notification to coach
8. If rejected: `invitation_rejected` notification to coach

### 3.2 Student requests coach

1. Student browses coach directory (only `coach_public = true` visible)
2. Clicks "Request coach" on a coach's profile, adds optional message
3. `POST /api/invitations` with `type: "student_request"`
4. Notification `invitation_received` created for coach with actions `[accept, reject]`
5. Coach accepts or rejects
6. If accepted: validate `MaxCoachesPerStudent` (transactional), create `coach_students`, notify student
7. If rejected: notify student

### 3.3 Invitation cancelled

1. Sender calls `DELETE /api/invitations/{id}`
2. Invitation status set to `cancelled`
3. Corresponding notification's `actions` set to NULL, body updated
4. No new notification created for receiver (the existing one is updated)

### 3.4 Relationship ends

1. Coach or student calls `PUT /api/coach-students/{id}/end`
2. Validated: user is part of the relationship (or admin)
3. Record updated: `status = 'finished'`, `finished_at = NOW()`
4. Notification `relationship_ended` created for the other party (informational, no actions)

### 3.5 Workout assigned (existing flow + notification)

1. Coach assigns workout (existing endpoint)
2. Check student's `notification_preferences.workout_assigned`
3. If enabled: create `workout_assigned` notification (informational)

### 3.6 Workout completed/skipped (existing flow + notification)

1. Student updates workout status (existing endpoint)
2. Check coach's `notification_preferences.workout_completed_or_skipped`
3. If enabled: create `workout_completed` or `workout_skipped` notification (informational)

### 3.7 Achievement verified

1. Admin approves achievement (existing endpoint)
2. Create `achievement_verified` notification for coach (always, informational)

### 3.8 Edge cases

- **Coach goes private (`coach_public = false`):** Existing pending `student_request` invitations can still be accepted/rejected. No auto-cancellation (the coach already received the request).
- **User disables `is_coach`:** Existing pending `coach_invite` invitations sent by this user should be auto-cancelled (they are no longer a coach). Pending `student_request` invitations received by this user should also be auto-cancelled.
- **Concurrent acceptance race condition:** Handled by `SELECT FOR UPDATE` in transaction when checking `MaxCoachesPerStudent`. Second acceptance will fail with HTTP 409.

---

## 4. Frontend Components

### 4.1 Navbar — Notification badge

- Bell icon next to avatar/profile in navbar
- Badge with unread count from `GET /api/notifications/unread-count`
- Polling interval: configurable constant `NOTIFICATION_POLL_INTERVAL_MS = 30000`
- Click navigates to `/notifications`

### 4.2 Notifications page (`/notifications`)

- List of notifications sorted by date (newest first), paginated
- Each notification shows:
  - Avatar of related user (from metadata)
  - Title and body
  - Relative time ("5 min ago")
  - Unread indicator (different background)
  - **Dynamic actions**: if `actions` is not null, render buttons per array item. `label` is translated via i18n, `style` maps to CSS class
- Action click → `POST /api/notifications/{id}/action` with the `key`
- On page enter: mark all as read (`PUT /api/notifications/read-all`). This is intentional — opening the notifications page signals the user has seen them.

### 4.3 Coach Dashboard changes

- "Add student" button renamed to **"Invite student"**
- Email input + optional message field → sends invitation instead of direct add
- Section showing pending sent invitations (with cancel option)
- Empty state for invitations section: "No pending invitations"

### 4.4 Coach Directory changes

- On each public coach profile: **"Request coach"** button
- Click opens modal with optional message field → sends `student_request`
- Button disabled with indicator if pending invitation exists or relationship is active

### 4.5 Notification Preferences

- New section in Profile page
- Toggles for configurable types:
  - "New assigned workout" (for students)
  - "Workout completed/skipped" (for coaches)
- Only shows relevant toggles based on user role (is_coach)

### 4.6 i18n

New keys for both languages covering:
- Invitation labels (invite, request, accept, reject, cancel, pending, cancelled, status messages)
- Notification labels (types, actions, empty state, mark read)
- Preference labels
- Relationship end labels

---

## 5. Security

- All notification and invitation endpoints filter by `userID` from JWT
- Admin users can access any user's notifications/invitations
- Actions on notifications/invitations validate ownership before execution
- `receiver_email` lookup returns generic HTTP 400 `"Cannot send invitation"` for all failure cases (user not found, duplicate, self-invite) to avoid leaking user existence
- `MaxCoachesPerStudent` validated at both creation (early feedback) and acceptance (authoritative, transactional) to prevent race conditions
- Self-invitation explicitly blocked (sender_id != receiver_id)
- Invitation respond/action validates invitation is still `pending` (optimistic concurrency — prevents acting on cancelled/already-responded invitations)
