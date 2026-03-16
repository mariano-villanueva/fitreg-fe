# FitRegFE - Technical Specification

## Overview

React + TypeScript + Vite SPA for FitReg, a running workout tracking app with coach-athlete role system. Supports i18n (Spanish/English), Google OAuth login, structured workout segments, invitations, notifications, and admin approval flows.

## Project Structure

```
FitRegFE/
├── index.html                    # Entry HTML
├── package.json                  # Dependencies
├── vite.config.ts                # Vite config
├── tsconfig.json                 # TypeScript config
└── src/
    ├── main.tsx                  # App entry, imports i18n
    ├── App.tsx                   # Routes, providers (Google, Auth, Role)
    ├── App.css                   # Global styles
    ├── types/
    │   └── index.ts              # All TypeScript interfaces
    ├── api/
    │   ├── client.ts             # Axios instance + interceptors
    │   ├── auth.ts               # Auth, profile, coach request API
    │   ├── workouts.ts           # Workout CRUD API
    │   ├── coach.ts              # Coach/student/assignment API
    │   ├── coaches.ts            # Coach directory, profile, achievements, ratings API
    │   ├── invitations.ts        # Invitation CRUD API
    │   ├── notifications.ts      # Notifications, actions, preferences API
    │   └── admin.ts              # Admin stats, users, achievement verification API
    ├── context/
    │   ├── AuthContext.tsx        # Auth state + localStorage
    │   └── RoleContext.tsx        # Role switching (athlete/coach)
    ├── components/
    │   ├── Navbar.tsx             # Role-aware navigation + notification badge
    │   ├── NotificationBadge.tsx  # Unread notification count indicator
    │   ├── ProtectedRoute.tsx     # Auth guard
    │   ├── AdminRoute.tsx         # Admin guard (requires is_admin)
    │   ├── RoleSwitcher.tsx       # Athlete/Coach toggle
    │   ├── SegmentBuilder.tsx     # Workout structure editor (table + dropdown + edit modal)
    │   ├── SegmentDisplay.tsx     # Read-only segment view
    │   ├── Avatar.tsx             # Avatar with base64/URL support and initials fallback
    │   └── ErrorState.tsx         # Error display for not_found / generic errors with back link
    ├── pages/
    │   ├── Login.tsx              # Google Sign-In
    │   ├── Onboarding.tsx         # First-time user profile setup (birth_date, height)
    │   ├── Home.tsx               # Routes to AthleteHome or CoachDashboard
    │   ├── AthleteHome.tsx        # Next workout, complete/skip, stats, recent activity
    │   ├── Profile.tsx            # User profile editor + coach request button
    │   ├── WorkoutList.tsx        # Personal workout grid
    │   ├── WorkoutDetail.tsx      # Single workout view (edit/delete hidden for assigned)
    │   ├── WorkoutForm.tsx        # Create/edit personal workout
    │   ├── CoachDashboard.tsx     # Students list, stats
    │   ├── StudentWorkouts.tsx    # Pending cards + paginated finished table
    │   ├── AssignWorkoutForm.tsx  # Create/edit assigned workout with expected fields
    │   ├── MyAssignedWorkouts.tsx # Pending cards + finished table with detail modal
    │   ├── CoachDirectory.tsx     # Coach list with filters, pagination, search-on-demand
    │   ├── CoachPublicProfile.tsx # Coach profile with achievements, ratings, rating form
    │   ├── CoachProfileEdit.tsx   # Edit coach description, visibility, CRUD achievements
    │   ├── CoachDailyView.tsx     # Coach daily view: all students' workout status for a given day
    │   ├── Notifications.tsx      # Notification list with action buttons
    │   ├── AdminDashboard.tsx     # Platform metrics dashboard
    │   ├── AdminUsers.tsx         # User management table with role toggles
    │   └── AdminAchievements.tsx  # Pending achievements approve/reject
    └── i18n/
        ├── index.ts              # i18next config
        ├── es.ts                 # Spanish translations (~320 keys)
        └── en.ts                 # English translations (~320 keys)
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.2.0 | UI framework |
| react-dom | ^19.2.0 | DOM rendering |
| react-router-dom | ^7.13.1 | Client-side routing |
| axios | ^1.13.6 | HTTP client |
| i18next | ^25.8.17 | Internationalization |
| react-i18next | ^16.5.6 | React i18n bindings |
| i18next-browser-languagedetector | ^8.2.1 | Auto language detection |
| @react-oauth/google | ^0.13.4 | Google OAuth 2.0 |

Dev: TypeScript ~5.9.3, Vite ^7.3.1, ESLint ^9.39.1

## Routes

| Path | Component | Access | Description |
|------|-----------|--------|-------------|
| /login | Login | Public | Google Sign-In |
| /onboarding | Onboarding | Protected | First-time profile setup |
| / | Home → AthleteHome or CoachDashboard | Protected | Role-based home |
| /workouts | WorkoutList | Protected | Personal workout list |
| /workouts/new | WorkoutForm | Protected | Create workout |
| /workouts/:id | WorkoutDetail | Protected | View workout |
| /workouts/:id/edit | WorkoutForm | Protected | Edit workout |
| /profile | Profile | Protected | Edit user profile + coach request |
| /coach | CoachDashboard | Protected | Coach dashboard |
| /coach/students/:id | StudentWorkouts | Protected | Student's assignments |
| /coach/assign/:studentId | AssignWorkoutForm | Protected | Assign workout |
| /coach/assigned-workouts/:id/edit | AssignWorkoutForm | Protected | Edit assignment |
| /my-assignments | MyAssignedWorkouts | Protected | Athlete's assignments |
| /coaches | CoachDirectory | Protected | Coach listing with filters |
| /coaches/:id | CoachPublicProfile | Protected | Coach profile with achievements & ratings |
| /coach/profile | CoachProfileEdit | Protected | Edit coach description, visibility, achievements |
| /notifications | Notifications | Protected | Notification list |
| /admin | AdminDashboard | Admin | Platform metrics |
| /admin/users | AdminUsers | Admin | User management table |
| /admin/achievements | AdminAchievements | Admin | Pending achievement verification |
| /coach/daily | CoachDailyView | Protected | Daily student workout status view |

## TypeScript Types

### User
```typescript
interface User {
  id: number; google_id: string; email: string; name: string;
  avatar_url: string; custom_avatar: string; sex: string; birth_date: string; age: number;
  weight_kg: number; height_cm: number; language: string;
  is_coach: boolean; is_admin: boolean;
  coach_description: string; coach_public: boolean;
  onboarding_completed: boolean; has_coach: boolean;
  coach_id?: number; coach_name?: string; coach_avatar?: string;  // set when has_coach=true
  created_at: string; updated_at: string;
}
```

### Workout (personal)
```typescript
interface Workout {
  id: number; user_id: number;
  date: string; distance_km: number; duration_seconds: number;
  avg_pace: string; calories: number; avg_heart_rate: number;
  feeling: number | null;
  type: 'easy'|'tempo'|'intervals'|'long_run'|'race'|'other';
  notes: string; segments: WorkoutSegment[];
  created_at: string; updated_at: string;
}
```

### AssignedWorkout
```typescript
type ExpectedField = 'time' | 'distance' | 'heart_rate' | 'feeling';

interface AssignedWorkout {
  id: number; coach_id: number; student_id: number;
  title: string; description: string; type: string;
  distance_km: number; duration_seconds: number; notes: string;
  expected_fields: ExpectedField[] | null;
  result_time_seconds: number | null; result_distance_km: number | null;
  result_heart_rate: number | null; result_feeling: number | null;
  status: 'pending'|'completed'|'skipped';
  due_date: string; student_name?: string; coach_name?: string;
  segments?: WorkoutSegment[];
  created_at: string; updated_at: string;
}
```

### Invitation
```typescript
interface Invitation {
  id: number; type: 'coach_invite' | 'student_request';
  sender_id: number; receiver_id: number; message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  sender_name: string; sender_avatar: string;
  receiver_name: string; receiver_avatar: string;
  created_at: string; updated_at: string;
}
```

### AppNotification
```typescript
interface NotificationAction { key: string; label: string; style: 'primary' | 'danger' | 'default'; }

interface AppNotification {
  id: number; user_id: number; type: string;
  title: string; body: string;
  metadata: Record<string, unknown>;
  actions: NotificationAction[] | null;
  is_read: boolean; created_at: string;
}

interface NotificationPreferences {
  id: number; user_id: number;
  workout_assigned: boolean;
  workout_completed_or_skipped: boolean;
}
```

### CoachListItem
```typescript
interface CoachListItem {
  id: number; name: string; avatar_url: string;
  coach_description: string; coach_locality: string; coach_level: string;
  avg_rating: number; rating_count: number; verified_achievements: number;
}
```

### DailySummaryItem
```typescript
interface DailySummaryItem {
  student_id: number;
  student_name: string;
  student_avatar: string | null;
  assigned_workout: AssignedWorkout | null;
}
```

### Other types
Student, WorkoutSegment, CoachAchievement, CoachRating, CoachPublicProfile, AdminUser, AdminStats, PendingAchievement, AuthResponse — see `src/types/index.ts` for full definitions.

## API Client

**Base URL:** `VITE_API_URL` env var (defaults to `http://localhost:8080`) + `/api`

**Interceptors:**
- Request: Adds `Authorization: Bearer {token}` from localStorage
- Response: Redirects to `/login` on 401

### Auth API (auth.ts)
- `googleLogin(credential)` → POST /auth/google → AuthResponse
- `getMe()` → GET /me → User
- `updateProfile(data)` → PUT /me → User (no is_coach field)
- `requestCoach({ locality, level: string[] })` → POST /coach-request (level is array of selected levels)
- `getCoachRequestStatus()` → GET /coach-request → `{ status }`
- `uploadAvatar(image: string)` → POST /me/avatar (base64 data URI, max 500KB)
- `deleteAvatar()` → DELETE /me/avatar

### Workouts API (workouts.ts)
- `listWorkouts()` → GET /workouts → Workout[]
- `getWorkout(id)` → GET /workouts/:id → Workout
- `createWorkout(data)` → POST /workouts → Workout
- `updateWorkout(id, data)` → PUT /workouts/:id → Workout
- `deleteWorkout(id)` → DELETE /workouts/:id

### Coach API (coach.ts)
- `listStudents()` → GET /coach/students → Student[]
- `addStudent(email)` → POST /coach/students
- `removeStudent(id)` → DELETE /coach/students/:id
- `getStudentWorkouts(id)` → GET /coach/students/:id/workouts → Workout[]
- `listAssignedWorkouts(studentId?, status?, page?, limit?)` → GET /coach/assigned-workouts → AssignedWorkout[] | { data, total }
- `createAssignedWorkout(data)` → POST /coach/assigned-workouts
- `getAssignedWorkout(id)` → GET /coach/assigned-workouts/:id → AssignedWorkout
- `updateAssignedWorkout(id, data)` → PUT /coach/assigned-workouts/:id
- `deleteAssignedWorkout(id)` → DELETE /coach/assigned-workouts/:id
- `getMyAssignedWorkouts()` → GET /my-assigned-workouts → AssignedWorkout[]
- `updateAssignedWorkoutStatus(id, data)` → PUT /my-assigned-workouts/:id/status
- `getDailySummary(date: string)` → GET /coach/daily-summary?date=YYYY-MM-DD → DailySummaryItem[]

### Coaches API (coaches.ts)
- `listCoaches({ search?, locality?, level?, sort?, page?, limit? })` → GET /coaches → `{ data, total }`
- `getCoachProfile(id)` → GET /coaches/:id → CoachPublicProfile
- `updateCoachProfile(data)` → PUT /coach/profile
- `listMyAchievements()` → GET /coach/achievements → CoachAchievement[]
- `createAchievement(data)` → POST /coach/achievements
- `updateAchievement(id, data)` → PUT /coach/achievements/:id
- `deleteAchievement(id)` → DELETE /coach/achievements/:id
- `upsertRating(coachId, data)` → POST /coaches/:id/ratings
- `getRatings(coachId)` → GET /coaches/:id/ratings → CoachRating[]

### Invitations API (invitations.ts)
- `listInvitations()` → GET /invitations → Invitation[]
- `createInvitation(data)` → POST /invitations
- `respondInvitation(id, action)` → PUT /invitations/:id/respond
- `cancelInvitation(id)` → DELETE /invitations/:id

### Notifications API (notifications.ts)
- `listNotifications(page?, limit?)` → GET /notifications → AppNotification[]
- `getUnreadCount()` → GET /notifications/unread-count → `{ count }`
- `markAsRead(id)` → PUT /notifications/:id/read
- `markAllAsRead()` → PUT /notifications/read-all
- `executeAction(id, action)` → POST /notifications/:id/action
- `getNotificationPreferences()` → GET /notification-preferences → NotificationPreferences
- `updateNotificationPreferences(data)` → PUT /notification-preferences

### Admin API (admin.ts)
- `getStats()` → GET /admin/stats → AdminStats
- `listUsers()` → GET /admin/users → AdminUser[]
- `updateUser(id, data)` → PUT /admin/users/:id
- `getPendingAchievements()` → GET /admin/achievements/pending → PendingAchievement[]
- `verifyAchievement(id)` → PUT /admin/achievements/:id/verify
- `rejectAchievement(id)` → PUT /admin/achievements/:id/reject

## Context Providers

### AuthContext
- **State:** user, token, isAuthenticated
- **Methods:** login(token, user), logout(), setUser(user)
- **Persistence:** localStorage (token, user)
- **Behavior:** Auto-loads user on mount via getMe(), syncs i18n language from user preference, redirects to /onboarding if not completed. User object includes `has_coach` (computed by backend from coach_students table).
- **Hook:** `useAuth()`

### RoleContext
- **State:** activeRole ('athlete' | 'coach'), isCoachMode
- **Methods:** setActiveRole(role)
- **Persistence:** localStorage (activeRole)
- **Behavior:** Resets to 'athlete' if user is not a coach
- **Hook:** `useRole()`

## Internationalization (i18n)

- **Default language:** Spanish (es)
- **Available:** Spanish (es), English (en)
- **Detection:** Browser language detector
- **User preference:** Stored in user profile, synced on login
- **~320 translation keys** covering all features

### Translation Key Categories
- `app_*` - App branding
- `login_*` - Login page
- `workouts_*` - Workout list
- `type_*` - Workout types (easy, tempo, intervals, long_run, long, race, fartlek, hills, recovery, other)
- `daily_*` - Coach daily view (daily_title, daily_hide_empty, daily_no_assignment, daily_prev, daily_next, daily_today, daily_col_*, daily_no_students, daily_all_hidden, daily_modal_*, daily_retry)
- `field_*` - Form fields
- `form_*` - Form actions
- `detail_*` - Detail page
- `profile_*` - Profile page
- `role_*` - Role switching
- `coach_*` - Coach dashboard, directory, profile
- `coach_request_*` - Coach request flow
- `coach_filter_*`, `coach_sort_*` - Coach directory filters
- `level_*` - Training levels (beginner, intermediate, advanced, competitive)
- `assigned_*` - Assigned workouts
- `segment_*` - Workout segments
- `unit_*` - Distance/time units
- `intensity_*` - Intensity levels
- `home_*` - Home page
- `achievement_*` - Achievements
- `rating_*` - Ratings
- `admin_*` - Admin panel
- `invitation_*` - Invitations
- `notification_*` - Notifications
- `notif_*` - Notification i18n keys (used by backend, translated by frontend)
- `expected_field_*` - Expected student data labels
- `date_*` - Date labels (today, tomorrow)
- Common: loading, error, delete, edit, save, cancel

### Notification i18n Pattern
Backend stores i18n keys in notification title/body fields and dynamic data in metadata. Frontend translates with:
```tsx
t(n.title, { defaultValue: n.title, ...(n.metadata || {}) })
```
Old notifications with hardcoded text fall back gracefully via `defaultValue`.

## Component Details

### Navbar
- Role-aware: shows different links for athlete vs coach
- Athlete links: Home, Entrenamientos, Registrar Entrenamiento, Asignaciones, Entrenadores
- Coach links: Home (Coach Dashboard), Mi Perfil Coach, Entrenadores
- Admin link: Admin (visible only if user.is_admin)
- NotificationBadge: shows unread count, links to /notifications
- Shows RoleSwitcher if user.is_coach is true
- User avatar + name link to profile

### Avatar
- Displays `custom_avatar` (base64) or URL image, with initials fallback when no image available
- Props: `src`, `name`, `size`, `className`
- Used in: Sidebar, CoachDashboard (students/invitations), CoachDirectory, CoachPublicProfile

### ErrorState
- Generic error component for `not_found` and `generic` error types with back link
- Replaces inline `<div className="error">` patterns across detail/form pages

### NotificationBadge
- Polls unread count on mount
- Displays red badge with count when > 0

### DayModal
- Props: `date`, `workout`, `role`, `studentId?`, `templates?`, `onClose`, `onRefresh`, `readOnly?`
- `readOnly={true}`: hides all action buttons (edit/delete for coach, complete/skip for student). Used by CoachDailyView.
- Default `readOnly` is `false` (existing behavior unchanged).

### SegmentBuilder
- Table-based layout with dropdown menus per row
- Actions: edit (opens modal), duplicate, move up/down, delete
- Two segment types: Simple (value + unit + intensity) and Interval (reps × work/rest)
- Add buttons above the table

### Profile
- Standard profile fields (name, sex, birth_date, weight, height, language)
- Coach request section:
  - If not coach and no request: green "Quiero ser entrenador" button → opens modal
  - Modal asks for locality (text) and training levels (checkboxes: beginner/intermediate/advanced/competitive — multiple allowed)
  - Sends `level` as `string[]` to API
  - If pending: yellow badge "Solicitud pendiente de aprobación"
  - If approved: green badge "Sos entrenador"
- Notification preferences section

## Page Behaviors

### AthleteHome
- Loads assigned workouts + personal workouts in parallel
- Shows next upcoming pending workout (by due_date) with Complete/Skip buttons
- Completion modal with expected fields + always-required feeling
- Shows pending workout count and recent activity
- Displays last 3 personal workouts (links to detail, edit/delete hidden for assigned)

### MyAssignedWorkouts
- Always accessible from nav (handles empty state gracefully — shows "no assignments" instead of error)
- Split into pending (cards) and finished (table) sections
- Table columns: Title, Type, Date, Status, Feeling, Detail link
- Detail modal with full workout info + results section when completed
- Completion modal: feeling always visible with required marker
- Reloads all data after status update (not partial merge)
- If API fails (e.g. network error), silently shows empty state instead of error message

### StudentWorkouts (Coach view)
- Pending: max 4 cards + "Ver más (N)" button that reveals full table
- Finished: paginated table (10/page) with pagination controls
- Detail modal with results section for completed assignments
- Edit/delete hidden for completed assignments

### AdminUsers
- Actions column uses a `···` dropdown menu (`admin-actions-menu`) instead of inline buttons
- Dropdown items colored: green (add role), red (remove role)
- Closes on outside click

### CoachDashboard
- Invitation errors are mapped to specific i18n keys: `invitation_error_user_not_found`, `invitation_error_self`, `invitation_error_already_pending`, `invitation_error_already_connected`, `invitation_error_max_coaches`
- Uses `Avatar` component for students and pending invitations
- Stat cards: Students, Pending assignments, "Ejercicios del día" (links to `/coach/daily`)

### CoachDailyView
- Route: `/coach/daily` — coach-only, protected
- Date navigator: `←` / `→` buttons + `<input type="date">` + "Hoy" badge/button. No date restriction (past and future allowed).
- Table columns: Alumno (avatar + name, clicking name navigates to `/coach/students/:id`) | Entrenamiento | Tipo | Estado | Sensación
- Clicking any cell except the student name opens `DayModal` in `readOnly` mode
- Rows without workout: single `colSpan={4}` cell in gray italic
- Filter: "Ocultar sin asignación" checkbox (toggle switch style) — local state, no re-fetch
- Empty states: loading spinner, error + retry button, no students, all hidden by filter
- Modal: reuses `DayModal` component with `readOnly={true}` (hides edit/delete/complete/skip actions)
- Date helpers use local timezone (`getFullYear/Month/Date`), not UTC `toISOString()`

### CoachDirectory
- Uses `Avatar` component for coach list items
- Does NOT auto-load coaches on page load — shows hint message
- Filters: search (name + description), locality, level, sort order
- Sort options: best rated (default), alphabetical, newest, oldest
- Results shown as list (not cards): avatar, name, level badges (multiple per coach), locality, description, star rating
- Level badges split from comma-separated `coach_level` string (e.g. "beginner,advanced" → 2 badges)
- Paginated (12/page)

### WorkoutDetail
- Edit/Delete buttons always visible for personal workouts
- Delete uses confirmation modal (not browser `confirm()`)
- Shows segments via `SegmentDisplay` if workout has segments
- Uses `ErrorState` for 404/403 load errors

### WorkoutForm
- Requires at least one segment — shows `segment_required` error if none
- Loads existing segments when editing a workout
- Uses `ErrorState` for 404/403 load errors

### Notifications
- Lists all notifications with time-ago display
- Renders action buttons (approve/reject/accept) from notification.actions
- Action labels are i18n keys translated via `t(action.label)`
- Marks all as read on page load
- Reloads list after action execution

## Styling

CSS classes follow BEM-like conventions. Key class families:
- `.page`, `.page-header` - Page layout
- `.navbar`, `.navbar-*` - Navigation
- `.workout-card`, `.workout-grid` - Workout display
- `.student-card`, `.student-grid` - Student display
- `.segment-table`, `.segment-dropdown`, `.segment-edit-modal` - Segment builder
- `.segment-display` - Read-only segments
- `.btn`, `.btn-primary`, `.btn-danger`, `.btn-sm`, `.btn-coach-request` - Buttons
- `.type-badge`, `.status-badge`, `.coach-level-badge` - Badges
- `.home-section`, `.home-stats`, `.home-stat-card` - Home page
- `.role-switcher` - Role toggle
- `.form-group`, `.form-row`, `.form-actions` - Forms
- `.coach-filters`, `.coach-list`, `.coach-list-item` - Coach directory
- `.notification-list`, `.notification-item`, `.notification-badge` - Notifications
- `.modal-overlay`, `.modal`, `.modal-actions` - Modals
- `.assignments-table`, `.pagination` - Tables & pagination
- `.coach-status-badge`, `.coach-status-pending`, `.coach-status-approved` - Coach request status
- `.detail-card`, `.detail-grid`, `.detail-item` - Detail views
- `.admin-table`, `.admin-table th/td` - Admin table with sortable headers
- `.admin-actions-menu`, `.admin-actions-trigger`, `.admin-actions-dropdown`, `.admin-actions-item` - Admin dropdown actions
- `.admin-actions-item--add`, `.admin-actions-item--danger` - Colored action items
- `.checkbox-label input[type="checkbox"]` - Rendered as a toggle switch (pill shape, slides on check, uses `--accent` color). Applied globally to all `<label className="checkbox-label">` wrappers.

## Google OAuth

**Client ID:** `1022083787469-g78j2i0b1shlrdd26ttb8jsham44fbcq.apps.googleusercontent.com`

Wrapped at app root with `<GoogleOAuthProvider>`.

## Development

```bash
npm install      # Install dependencies
npm run dev      # Start dev server (Vite, port 5173)
npm run build    # Production build → /dist
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Deployment

- **Platform:** Vercel
- **Branch:** `master` (auto-deploy)
- **Framework:** Vite (auto-detected)
- **SPA routing:** `vercel.json` with rewrite rule `{ "source": "/(.*)", "destination": "/index.html" }`
- **Registry override:** `.npmrc` forces `registry=https://registry.npmjs.org/` (avoids private registry conflicts)
- **Env vars (Vercel dashboard):** `VITE_API_URL` = production API URL (e.g., `https://fitreg-api-production.up.railway.app`)
