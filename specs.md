# FitRegFE - Technical Specification

## Overview

React + TypeScript + Vite SPA for FitReg, a running workout tracking app with coach-athlete role system. Supports i18n (Spanish/English), Google OAuth login, and structured workout segments.

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
    │   ├── auth.ts               # Auth & profile API
    │   ├── workouts.ts           # Workout CRUD API
    │   └── coach.ts              # Coach/student/assignment API
    ├── context/
    │   ├── AuthContext.tsx        # Auth state + localStorage
    │   └── RoleContext.tsx        # Role switching (athlete/coach)
    ├── components/
    │   ├── Navbar.tsx             # Role-aware navigation
    │   ├── ProtectedRoute.tsx     # Auth guard
    │   ├── RoleSwitcher.tsx       # Athlete/Coach toggle
    │   ├── SegmentBuilder.tsx     # Workout structure editor
    │   └── SegmentDisplay.tsx     # Read-only segment view
    ├── pages/
    │   ├── Login.tsx              # Google Sign-In
    │   ├── Home.tsx               # Routes to AthleteHome or CoachDashboard
    │   ├── AthleteHome.tsx        # Next workout, stats, recent activity
    │   ├── Profile.tsx            # User profile editor
    │   ├── WorkoutList.tsx        # Personal workout grid
    │   ├── WorkoutDetail.tsx      # Single workout view
    │   ├── WorkoutForm.tsx        # Create/edit personal workout
    │   ├── CoachDashboard.tsx     # Students list, stats
    │   ├── StudentWorkouts.tsx    # View student's workouts
    │   ├── AssignWorkoutForm.tsx  # Create/edit assigned workout
    │   └── MyAssignedWorkouts.tsx # Athlete's assignments view
    └── i18n/
        ├── index.ts              # i18next config
        ├── es.ts                 # Spanish translations
        └── en.ts                 # English translations
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
| / | Home → AthleteHome or CoachDashboard | Protected | Role-based home |
| /workouts | WorkoutList | Protected | Personal workout list |
| /workouts/new | WorkoutForm | Protected | Create workout |
| /workouts/:id | WorkoutDetail | Protected | View workout |
| /workouts/:id/edit | WorkoutForm | Protected | Edit workout |
| /profile | Profile | Protected | Edit user profile |
| /coach | CoachDashboard | Protected | Coach dashboard |
| /coach/students/:id | StudentWorkouts | Protected | Student's workouts |
| /coach/assign/:studentId | AssignWorkoutForm | Protected | Assign workout |
| /coach/assigned-workouts/:id/edit | AssignWorkoutForm | Protected | Edit assignment |
| /my-assignments | MyAssignedWorkouts | Protected | Athlete's assignments |

## TypeScript Types

### User
```typescript
interface User {
  id: number; google_id: string; email: string; name: string;
  avatar_url: string; sex: string; age: number; weight_kg: number;
  language: string; is_coach: boolean;
  created_at: string; updated_at: string;
}
```

### Workout (personal)
```typescript
interface Workout {
  id: number; user_id: number; date: string;
  distance_km: number; duration_seconds: number; avg_pace: string;
  calories: number; avg_heart_rate: number;
  type: 'easy'|'tempo'|'intervals'|'long_run'|'race'|'other';
  notes: string; created_at: string; updated_at: string;
}
```

### Student
```typescript
interface Student {
  id: number; name: string; email: string; avatar_url: string;
}
```

### AssignedWorkout
```typescript
interface AssignedWorkout {
  id: number; coach_id: number; student_id: number;
  title: string; description: string; type: string;
  distance_km: number; duration_seconds: number;
  notes: string; status: 'pending'|'completed'|'skipped';
  due_date: string; student_name?: string; coach_name?: string;
  segments?: WorkoutSegment[];
  created_at: string; updated_at: string;
}
```

### WorkoutSegment
```typescript
interface WorkoutSegment {
  id?: number; assigned_workout_id?: number;
  order_index: number; segment_type: 'simple'|'interval';
  repetitions: number;
  value: number; unit: 'km'|'m'|'min'|'sec';
  intensity: 'easy'|'moderate'|'fast'|'sprint';
  work_value: number; work_unit: string; work_intensity: string;
  rest_value: number; rest_unit: string; rest_intensity: string;
}
```

### AuthResponse
```typescript
interface AuthResponse { token: string; user: User; }
```

## API Client

**Base URL:** `http://localhost:8080/api`

**Interceptors:**
- Request: Adds `Authorization: Bearer {token}` from localStorage
- Response: Redirects to `/login` on 401

### Auth API (auth.ts)
- `googleLogin(credential)` → POST /auth/google → AuthResponse
- `getMe()` → GET /me → User
- `updateProfile(data)` → PUT /me → User

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
- `listAssignedWorkouts(studentId?)` → GET /coach/assigned-workouts → AssignedWorkout[]
- `createAssignedWorkout(data)` → POST /coach/assigned-workouts
- `getAssignedWorkout(id)` → GET /coach/assigned-workouts/:id → AssignedWorkout
- `updateAssignedWorkout(id, data)` → PUT /coach/assigned-workouts/:id
- `deleteAssignedWorkout(id)` → DELETE /coach/assigned-workouts/:id
- `getMyAssignedWorkouts()` → GET /my-assigned-workouts → { data: AssignedWorkout[] }
- `updateAssignedWorkoutStatus(id, status)` → PUT /my-assigned-workouts/:id/status

## Context Providers

### AuthContext
- **State:** user, token, isAuthenticated
- **Methods:** login(token, user), logout(), setUser(user)
- **Persistence:** localStorage (token, user)
- **Behavior:** Auto-loads user on mount via getMe(), syncs i18n language from user preference
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
- **150+ translation keys** covering: navigation, login, workouts, types, fields, forms, profile, roles, coach, assignments, segments, units, intensities, home

### Translation Key Categories
- `app_*` - App branding
- `login_*` - Login page
- `workouts_*` - Workout list
- `type_*` - Workout types (easy, tempo, intervals, long_run, race, fartlek, other)
- `field_*` - Form fields
- `form_*` - Form actions
- `detail_*` - Detail page
- `profile_*` - Profile page
- `role_*` - Role switching
- `coach_*` - Coach dashboard
- `assigned_*` - Assigned workouts
- `segment_*` - Workout segments
- `unit_*` - Distance/time units
- `intensity_*` - Intensity levels
- `home_*` - Home page

## Component Details

### Navbar
- Role-aware: shows different links for athlete vs coach
- Athlete links: Home, Workouts, New Workout, My Assignments
- Coach links: Home (Coach Dashboard)
- Shows RoleSwitcher if user.is_coach is true
- User avatar + name link to profile

### RoleSwitcher
- Pill-style toggle: Athlete ↔ Coach
- Navigates to `/` on role change

### SegmentBuilder
- Used in AssignWorkoutForm for creating structured workouts
- Two segment types: Simple (distance/time at intensity) and Interval (reps × work/rest)
- Supports: add, remove, reorder (up/down)
- Units: km, m, min, sec
- Intensities: easy, moderate, fast, sprint

### SegmentDisplay
- Read-only view of segments
- Shows numbered list with intensity-colored badges
- Used in AthleteHome and MyAssignedWorkouts

## Page Behaviors

### AthleteHome
- Loads assigned workouts + personal workouts in parallel
- Shows next upcoming pending workout (by due_date)
- Shows pending workout count and recent workout count
- Displays last 3 personal workouts

### CoachDashboard
- Shows student count and pending assignment count
- Add student form (by email)
- Student grid with actions (view workouts, remove)

### AssignWorkoutForm
- Dual mode: create (from URL param studentId) or edit (loads existing)
- Cannot edit completed assignments (backend blocks it)
- SegmentBuilder for workout structure
- Due date = "training day"

### MyAssignedWorkouts
- Groups by status display order
- Complete/Skip buttons for pending workouts
- Shows coach name and segment details

## Styling

CSS classes follow BEM-like conventions. Key class families:
- `.page`, `.page-header` - Page layout
- `.navbar`, `.navbar-*` - Navigation
- `.workout-card`, `.workout-grid` - Workout display
- `.student-card`, `.student-grid` - Student display
- `.segment-builder`, `.segment-card`, `.segment-display` - Segments
- `.btn`, `.btn-primary`, `.btn-danger`, `.btn-sm` - Buttons
- `.type-badge`, `.status-badge` - Badges
- `.home-section`, `.home-stats`, `.home-stat-card` - Home page
- `.role-switcher` - Role toggle
- `.form-group`, `.form-row`, `.form-actions` - Forms

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
