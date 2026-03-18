# Landing Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/login` from a plain login card into a full-screen commercial landing page that emphasizes real, verified human coaches — not AI.

**Architecture:** Four isolated changes applied in order: (1) add i18n keys, (2) patch `App.tsx` to remove the Navbar and container wrapper on `/login`, (3) add `.landing-*` CSS classes to `App.css`, (4) rewrite `Login.tsx` using those classes and keys. Each task can be verified independently by running `npm run dev` and visiting `http://localhost:5173/login`.

**Tech Stack:** React 19, TypeScript, Vite, react-i18next, @react-oauth/google, react-router-dom

---

## File Map

| File | What changes |
|------|-------------|
| `src/i18n/es.ts` | Add 15 `landing_*` keys; update `app_tagline` |
| `src/i18n/en.ts` | Mirror of ES changes in English |
| `src/App.tsx` | Add `useLocation`; conditional `<Navbar>` and `<main className>` |
| `src/App.css` | Add `.landing-page`, `.landing-navbar`, `.landing-panels`, `.landing-left`, `.landing-right`, `.landing-badge`, `.landing-badge-dot`, `.landing-feature`, `.landing-trust`, plus `@keyframes pulse-dot` and mobile breakpoint |
| `src/pages/Login.tsx` | Full rewrite — two-panel layout using new CSS classes and i18n keys |

---

## Task 1: i18n Keys

**Files:**
- Modify: `src/i18n/es.ts` (lines 14–21 — the `// Login` block)
- Modify: `src/i18n/en.ts` (lines 13–19 — the login block)

- [ ] **Step 1: Add `landing_*` keys and update `app_tagline` in `src/i18n/es.ts`**

Replace the existing `app_tagline` value and the `// Login` comment block. Add all new keys **after** the existing login keys (keep old ones — they stay in the file):

```ts
// In the Nav section — update this line:
app_tagline: 'coaching real · logros reales',

// After the existing login keys, add a new // Landing section:
// Landing
landing_badge: '100% HUMANO · CERO IA',
landing_headline: 'Superá tus límites con un coach de verdad.',
landing_subheadline: 'FitReg conecta atletas con entrenadores reales — personas con logros verificados por nuestra comunidad, no algoritmos ni prompts.',
landing_feature_1_title: 'Coaches con logros verificados',
landing_feature_1_sub: 'Cada coach tiene historial real auditado por FitReg',
landing_feature_2_title: 'Planes de entrenamiento personalizados',
landing_feature_2_sub: 'Tu coach arma, asigna y ajusta tu semana',
landing_feature_3_title: 'Seguimiento y feedback real',
landing_feature_3_sub: 'Tu progreso visible para vos y tu coach',
landing_login_title: 'Empezá ahora',
landing_login_desc: 'Para coaches que quieren crecer y atletas que quieren resultados reales.',
landing_free_label: 'Gratis para atletas',
landing_trust_title: 'Por qué FitReg',
landing_trust_1: 'Coaches con identidad verificada',
landing_trust_2: 'Logros auditados, no autoreportados',
landing_trust_3: 'Sin bots ni respuestas automatizadas',
```

- [ ] **Step 2: Add the same keys in English in `src/i18n/en.ts`**

```ts
// In the Nav section — update this line:
app_tagline: 'real coaching · real results',

// After the existing login keys, add a new // Landing section:
// Landing
landing_badge: '100% HUMAN · ZERO AI',
landing_headline: 'Push your limits with a real coach.',
landing_subheadline: 'FitReg connects athletes with real trainers — people with achievements verified by our community, not algorithms or prompts.',
landing_feature_1_title: 'Coaches with verified achievements',
landing_feature_1_sub: 'Every coach has a real record audited by FitReg',
landing_feature_2_title: 'Personalized training plans',
landing_feature_2_sub: 'Your coach builds, assigns and adjusts your week',
landing_feature_3_title: 'Real tracking and feedback',
landing_feature_3_sub: 'Your progress visible to you and your coach',
landing_login_title: 'Get started',
landing_login_desc: 'For coaches who want to grow and athletes who want real results.',
landing_free_label: 'Free for athletes',
landing_trust_title: 'Why FitReg',
landing_trust_1: 'Coaches with verified identity',
landing_trust_2: 'Audited achievements, not self-reported',
landing_trust_3: 'No bots or automated responses',
```

- [ ] **Step 3: Verify — run the dev server and check no TypeScript errors**

```bash
cd /Users/marvillanuev/Desktop/FitReg/FitRegFE
npm run dev
```

Expected: Server starts on port 5173, no errors in terminal.

- [ ] **Step 4: Commit**

```bash
cd /Users/marvillanuev/Desktop/FitReg/FitRegFE
git add src/i18n/es.ts src/i18n/en.ts
git commit -m "feat: add landing page i18n keys (ES + EN)"
```

---

## Task 2: App.tsx — Conditional Navbar & Container

**Files:**
- Modify: `src/App.tsx`

The current `App.tsx` renders `<Navbar />` and `<main className="container">` unconditionally. We need to hide both on `/login`. `useLocation()` from react-router-dom requires being inside `<BrowserRouter>`, so we extract the inner logic into a child component `AppShell`.

- [ ] **Step 1: Rewrite `src/App.tsx`**

Full replacement — same imports, same routes, but with `AppShell` pattern:

```tsx
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import { RoleProvider } from "./context/RoleContext";
import { FeedbackProvider } from "./context/FeedbackContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Home from "./pages/Home";
import WorkoutList from "./pages/WorkoutList";
import WorkoutDetail from "./pages/WorkoutDetail";
import WorkoutForm from "./pages/WorkoutForm";
import CoachDashboard from "./pages/CoachDashboard";
import StudentWorkouts from "./pages/StudentWorkouts";
import AssignWorkoutForm from "./pages/AssignWorkoutForm";
import MyAssignedWorkouts from "./pages/MyAssignedWorkouts";
import CoachDirectory from "./pages/CoachDirectory";
import CoachPublicProfile from "./pages/CoachPublicProfile";
import CoachProfileEdit from "./pages/CoachProfileEdit";
import CoachTemplates from "./pages/CoachTemplates";
import CoachWeeklyTemplates from './pages/CoachWeeklyTemplates';
import WeeklyTemplateForm from './pages/WeeklyTemplateForm';
import CoachDailyView from "./pages/CoachDailyView";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminAchievements from "./pages/AdminAchievements";
import AdminAchievementDetail from "./pages/AdminAchievementDetail";
import AdminRoute from "./components/AdminRoute";
import Notifications from "./pages/Notifications";
import Onboarding from "./pages/Onboarding";
import AssignmentDetail from "./pages/AssignmentDetail";
import "./App.css";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

function AppShell() {
  const location = useLocation();
  const isLanding = location.pathname === '/login';

  return (
    <>
      {!isLanding && <Navbar />}
      <main className={isLanding ? '' : 'container'}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/workouts" element={<ProtectedRoute><WorkoutList /></ProtectedRoute>} />
          <Route path="/workouts/new" element={<ProtectedRoute><WorkoutForm /></ProtectedRoute>} />
          <Route path="/workouts/:id" element={<ProtectedRoute><WorkoutDetail /></ProtectedRoute>} />
          <Route path="/workouts/:id/edit" element={<ProtectedRoute><WorkoutForm /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/coach" element={<ProtectedRoute><CoachDashboard /></ProtectedRoute>} />
          <Route path="/coach/students/:id" element={<ProtectedRoute><StudentWorkouts /></ProtectedRoute>} />
          <Route path="/coach/assign/:studentId" element={<ProtectedRoute><AssignWorkoutForm /></ProtectedRoute>} />
          <Route path="/coach/assigned-workouts/:id/edit" element={<ProtectedRoute><AssignWorkoutForm /></ProtectedRoute>} />
          <Route path="/my-assignments" element={<ProtectedRoute><MyAssignedWorkouts /></ProtectedRoute>} />
          <Route path="/assignments/:id" element={<ProtectedRoute><AssignmentDetail /></ProtectedRoute>} />
          <Route path="/coaches" element={<ProtectedRoute><CoachDirectory /></ProtectedRoute>} />
          <Route path="/coaches/:id" element={<ProtectedRoute><CoachPublicProfile /></ProtectedRoute>} />
          <Route path="/coach/profile" element={<ProtectedRoute><CoachProfileEdit /></ProtectedRoute>} />
          <Route path="/coach/templates" element={<ProtectedRoute><CoachTemplates /></ProtectedRoute>} />
          <Route path="/coach/weekly-templates" element={<ProtectedRoute><CoachWeeklyTemplates /></ProtectedRoute>} />
          <Route path="/coach/weekly-templates/new" element={<ProtectedRoute><WeeklyTemplateForm /></ProtectedRoute>} />
          <Route path="/coach/weekly-templates/:id/edit" element={<ProtectedRoute><WeeklyTemplateForm /></ProtectedRoute>} />
          <Route path="/coach/daily" element={<ProtectedRoute><CoachDailyView /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="/admin/achievements" element={<AdminRoute><AdminAchievements /></AdminRoute>} />
          <Route path="/admin/achievements/:id" element={<AdminRoute><AdminAchievementDetail /></AdminRoute>} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <AuthProvider>
          <RoleProvider>
            <FeedbackProvider>
              <AppShell />
            </FeedbackProvider>
          </RoleProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
```

- [ ] **Step 2: Verify — open browser at http://localhost:5173/login**

Expected: No global navbar visible. The existing Login card renders without `max-width: 960px` constraints. All other routes still show the Navbar normally.

- [ ] **Step 3: Commit**

```bash
cd /Users/marvillanuev/Desktop/FitReg/FitRegFE
git add src/App.tsx
git commit -m "feat: hide navbar and container wrapper on /login route"
```

---

## Task 3: CSS — Landing Classes

**Files:**
- Modify: `src/App.css` (append at the end of the file)

- [ ] **Step 1: Append the landing CSS block to the end of `src/App.css`**

```css
/* ============================================================
   Landing Page
   ============================================================ */

.landing-page {
  background: #0a0a0a;
  color: #fff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}

/* Mini-navbar */
.landing-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  background: #0a0a0a;
  border-bottom: 1px solid #1a1a1a;
  flex-shrink: 0;
}

.landing-logo {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1;
}

.landing-logo-fit {
  color: #4ade80;
}

.landing-logo-reg {
  color: #fff;
}

.landing-tagline {
  font-size: 11px;
  color: #555;
}

/* Two-panel layout */
.landing-panels {
  flex: 1;
  display: flex;
}

/* Left panel — value proposition */
.landing-left {
  flex: 1.3;
  padding: 48px 48px 48px 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 24px;
  border-right: 1px solid #151515;
}

/* Badge */
.landing-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #1a2a1a;
  border: 1px solid rgba(74, 222, 128, 0.4);
  border-radius: 20px;
  padding: 6px 14px;
  width: fit-content;
}

.landing-badge-dot {
  width: 8px;
  height: 8px;
  background: #4ade80;
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse-dot 1.8s ease-in-out infinite;
}

.landing-badge-text {
  font-size: 11px;
  font-weight: 600;
  color: #4ade80;
  letter-spacing: 0.5px;
}

/* Headline block */
.landing-headline {
  font-size: 36px;
  font-weight: 900;
  line-height: 1.15;
  letter-spacing: -1px;
  margin: 0 0 10px 0;
  color: #fff;
}

.landing-headline-accent {
  color: #4ade80;
}

.landing-subheadline {
  font-size: 14px;
  color: #999;
  line-height: 1.65;
  max-width: 380px;
  margin: 0;
}

.landing-subheadline strong {
  color: #ccc;
  font-weight: 600;
}

/* Feature list */
.landing-features {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.landing-feature {
  display: flex;
  align-items: center;
  gap: 14px;
}

.landing-feature-icon {
  width: 36px;
  height: 36px;
  background: #1a2a1a;
  border: 1px solid rgba(74, 222, 128, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.landing-feature-title {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 2px 0;
}

.landing-feature-sub {
  font-size: 11px;
  color: #666;
  margin: 0;
}

/* Right panel — login card */
.landing-right {
  width: 300px;
  padding: 48px 32px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
  background: #0d0d0d;
  flex-shrink: 0;
}

.landing-login-title {
  font-size: 20px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 6px 0;
}

.landing-login-desc {
  font-size: 12px;
  color: #666;
  line-height: 1.55;
  margin: 0;
}

/* Separator between Google button and trust box */
.landing-separator {
  display: flex;
  align-items: center;
  gap: 10px;
}

.landing-separator-line {
  flex: 1;
  height: 1px;
  background: #1e1e1e;
}

.landing-separator-label {
  font-size: 10px;
  color: #444;
  white-space: nowrap;
}

/* Trust signals box */
.landing-trust {
  background: #111;
  border: 1px solid #1e1e1e;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.landing-trust-title {
  font-size: 10px;
  color: #555;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin: 0 0 2px 0;
}

.landing-trust-item {
  font-size: 11px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
}

.landing-trust-check {
  color: #4ade80;
  font-weight: 700;
}

/* Pulse animation */
@keyframes pulse-dot {
  0%, 100% {
    box-shadow: 0 0 4px #4ade80;
    opacity: 1;
  }
  50% {
    box-shadow: 0 0 10px #4ade80;
    opacity: 0.6;
  }
}

/* Mobile — stack panels vertically, login first */
@media (max-width: 767px) {
  .landing-navbar {
    padding: 14px 20px;
  }

  .landing-panels {
    flex-direction: column;
  }

  .landing-right {
    width: 100%;
    order: -1;
    padding: 24px 20px;
    border-bottom: 1px solid #151515;
  }

  .landing-left {
    padding: 24px 20px;
    border-right: none;
    gap: 20px;
  }

  .landing-headline {
    font-size: 26px;
  }
}
```

- [ ] **Step 2: Verify — check no CSS syntax errors**

```bash
cd /Users/marvillanuev/Desktop/FitReg/FitRegFE
npm run dev
```

Expected: Dev server still starts cleanly. No Vite CSS parse errors in terminal.

- [ ] **Step 3: Commit**

```bash
cd /Users/marvillanuev/Desktop/FitReg/FitRegFE
git add src/App.css
git commit -m "feat: add landing page CSS classes and pulse animation"
```

---

## Task 4: Rewrite Login.tsx

**Files:**
- Modify: `src/pages/Login.tsx` (full replacement)

- [ ] **Step 1: Replace `src/pages/Login.tsx` with the new two-panel layout**

```tsx
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { googleLogin } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { useTranslation } from "react-i18next";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  const { showError } = useFeedback();

  async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) {
      showError("Google login failed. No credential received.");
      return;
    }
    try {
      const res = await googleLogin(credentialResponse.credential);
      login(res.data.token, res.data.user);
      navigate("/");
    } catch {
      showError("Login failed. Please try again.");
    }
  }

  const features = [
    { icon: '🏅', titleKey: 'landing_feature_1_title', subKey: 'landing_feature_1_sub' },
    { icon: '📋', titleKey: 'landing_feature_2_title', subKey: 'landing_feature_2_sub' },
    { icon: '📊', titleKey: 'landing_feature_3_title', subKey: 'landing_feature_3_sub' },
  ];

  return (
    <div className="landing-page">
      {/* Mini-navbar */}
      <nav className="landing-navbar">
        <div className="landing-logo">
          <span className="landing-logo-fit">Fit</span>
          <span className="landing-logo-reg">Reg</span>
        </div>
        <span className="landing-tagline">{t('app_tagline')}</span>
      </nav>

      {/* Two-panel body */}
      <div className="landing-panels">

        {/* Left — value proposition */}
        <div className="landing-left">
          {/* Anti-AI badge */}
          <div className="landing-badge">
            <span className="landing-badge-dot" />
            <span className="landing-badge-text">{t('landing_badge')}</span>
          </div>

          {/* Headline */}
          <div>
            <h1 className="landing-headline">{t('landing_headline')}</h1>
            <p className="landing-subheadline"
              dangerouslySetInnerHTML={{ __html: t('landing_subheadline').replace(
                'verificados por nuestra comunidad',
                '<strong>verificados por nuestra comunidad</strong>'
              ).replace(
                'verified by our community',
                '<strong>verified by our community</strong>'
              )}}
            />
          </div>

          {/* Feature list */}
          <div className="landing-features">
            {features.map((f) => (
              <div key={f.titleKey} className="landing-feature">
                <div className="landing-feature-icon">{f.icon}</div>
                <div>
                  <p className="landing-feature-title">{t(f.titleKey)}</p>
                  <p className="landing-feature-sub">{t(f.subKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — login card */}
        <div className="landing-right">
          <div>
            <h2 className="landing-login-title">{t('landing_login_title')}</h2>
            <p className="landing-login-desc">{t('landing_login_desc')}</p>
          </div>

          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => showError("Google login failed.")}
            theme="filled_black"
            size="large"
            width="260"
            text="continue_with"
          />

          {/* Separator */}
          <div className="landing-separator">
            <div className="landing-separator-line" />
            <span className="landing-separator-label">{t('landing_free_label')}</span>
            <div className="landing-separator-line" />
          </div>

          {/* Trust signals */}
          <div className="landing-trust">
            <p className="landing-trust-title">{t('landing_trust_title')}</p>
            <p className="landing-trust-item">
              <span className="landing-trust-check">✓</span>
              {t('landing_trust_1')}
            </p>
            <p className="landing-trust-item">
              <span className="landing-trust-check">✓</span>
              {t('landing_trust_2')}
            </p>
            <p className="landing-trust-item">
              <span className="landing-trust-check">✓</span>
              {t('landing_trust_3')}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
```

**Note on `dangerouslySetInnerHTML`:** This is used only to bold specific words in the subheadline. Both strings are hardcoded translation values — no user input involved, so no XSS risk.

- [ ] **Step 2: Verify in browser at http://localhost:5173/login**

Checklist:
- [ ] Page fills the full viewport (no 960px max-width box)
- [ ] No global Navbar visible
- [ ] Mini-navbar shows "FitReg" logo (green Fit, white Reg) + tagline on the right
- [ ] Green pulsing dot visible in badge
- [ ] Badge reads "100% HUMANO · CERO IA"
- [ ] Headline reads "Superá tus límites con un coach de verdad."
- [ ] 3 feature items with icons visible
- [ ] Right panel has login card with Google button, separator, and trust signals
- [ ] Navigate to any other route (e.g. `/`) — global Navbar and container are back

- [ ] **Step 3: Verify mobile layout**

Open browser DevTools → toggle device toolbar → set viewport to 375px wide.

Expected:
- Login card appears **above** the hero text
- Both panels stack vertically, full width
- No horizontal scroll

- [ ] **Step 4: Commit**

```bash
cd /Users/marvillanuev/Desktop/FitReg/FitRegFE
git add src/pages/Login.tsx
git commit -m "feat: redesign /login as commercial landing page with anti-AI messaging"
```

---

## Task 5: Push & Verify

- [ ] **Step 1: Push to develop**

```bash
cd /Users/marvillanuev/Desktop/FitReg/FitRegFE
git push origin develop
```

- [ ] **Step 2: Final smoke test**

1. Open http://localhost:5173/login — landing renders correctly
2. Click "Continuar con Google" — OAuth flow triggers
3. After login, redirected to `/` — Navbar is visible again, container is active
4. Switch language (if lang switcher available) — English copy appears correctly
