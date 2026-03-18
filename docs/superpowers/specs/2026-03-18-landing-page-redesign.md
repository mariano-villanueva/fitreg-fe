# Landing Page Redesign — Design Spec

## Goal

Rediseñar la página de login (`/login`) como una landing page comercial de pantalla única que comunique con fuerza que FitReg es una plataforma de coaching humano con logros verificados — explícitamente diferenciada de soluciones de IA.

## Context

- La ruta `/login` es la única página visible para usuarios no autenticados
- Actualmente es una login card minimalista con un título y botón de Google
- El tagline actual "Tu tracker de running" está desactualizado — la app es una plataforma coach↔alumno
- La app es bilingual (ES/EN) via react-i18next; todo el copy vive en `src/i18n/es.ts` y `src/i18n/en.ts`
- El global navbar de la app (`<Navbar>`) debe ocultarse en la ruta `/login` — la landing tiene su propio mini-navbar inline

## Target Audiences

1. **Coaches** — buscan una herramienta para gestionar alumnos, asignar planes y hacer seguimiento
2. **Atletas** — buscan coaches reales con logros verificados, no IA ni bots

## Design Decisions

### Layout: Hero + Login Card (una pantalla, sin scroll)

- **Left panel (`flex: 1.3`):** propuesta de valor — badge, headline, descripción, 3 feature items
- **Right panel (`width: 300px` fijo):** login card — título, descripción, botón Google, separator, trust signals
- En mobile (< 768px): los paneles se apilan verticalmente. El right panel (login) va **primero** (arriba), el left panel va debajo. Sin scroll horizontal.

### Global Navbar & Container Wrapper

El componente `<Navbar>` global **se oculta en la ruta `/login`**. El `<main className="container">` que envuelve las rutas también se condiciona: en `/login` se renderiza sin wrapper (o con un wrapper sin clase, ej. `<main>`) para que la landing pueda ocupar el viewport completo sin el `max-width: 960px` y el padding del container.

Implementar en `App.tsx`:
```tsx
const location = useLocation(); // via useLocation() de react-router-dom
const isLanding = location.pathname === '/login';

// Navbar: no renderizar si isLanding
{!isLanding && <Navbar />}

// Main wrapper: sin container si isLanding
<main className={isLanding ? '' : 'container'}>
  <Routes>...</Routes>
</main>
```

### Mini-navbar inline (dentro de Login.tsx)

La landing tiene su propio mini-navbar inline al top de la página:
- Logo: texto `<span style="color:#4ade80">Fit</span><span style="color:#fff">Reg</span>`, font-size `20px`, font-weight `800`
- Tagline: `{t('app_tagline')}` — alineado a la derecha, font-size `11px`, color `#555`
- Layout: `display: flex; justify-content: space-between; align-items: center`
- Padding: `16px 32px`
- Background: `#0a0a0a` (igual al resto de la página)
- Border-bottom: `1px solid #1a1a1a`

### Google OAuth Button

Se mantiene el componente `<GoogleLogin>` de `@react-oauth/google` con el prop `text="continue_with"`. No se usa un botón custom. El handler `handleGoogleSuccess` no cambia. Los props serán:
```tsx
<GoogleLogin
  onSuccess={handleGoogleSuccess}
  onError={() => showError("Google login failed.")}
  theme="filled_black"
  size="large"
  width="260"   // intentionally 260 (not 300) — leaves ~20px margin inside the 300px panel
  text="continue_with"
/>
```

### Pulse Animation

El badge "100% HUMANO · CERO IA" tiene un punto verde con animación `pulse`:
```css
@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 4px #4ade80; opacity: 1; }
  50%       { box-shadow: 0 0 10px #4ade80; opacity: 0.6; }
}
.landing-badge-dot {
  animation: pulse-dot 1.8s ease-in-out infinite;
}
```

## i18n Keys

### Keys to ADD (both `es.ts` and `en.ts`)

| Key | ES | EN |
|-----|----|----|
| `landing_badge` | `100% HUMANO · CERO IA` | `100% HUMAN · ZERO AI` |
| `landing_headline` | `Superá tus límites con un coach de verdad.` | `Push your limits with a real coach.` |
| `landing_subheadline` | `FitReg conecta atletas con entrenadores reales — personas con logros verificados por nuestra comunidad, no algoritmos ni prompts.` | `FitReg connects athletes with real trainers — people with achievements verified by our community, not algorithms or prompts.` |
| `landing_feature_1_title` | `Coaches con logros verificados` | `Coaches with verified achievements` |
| `landing_feature_1_sub` | `Cada coach tiene historial real auditado por FitReg` | `Every coach has a real record audited by FitReg` |
| `landing_feature_2_title` | `Planes de entrenamiento personalizados` | `Personalized training plans` |
| `landing_feature_2_sub` | `Tu coach arma, asigna y ajusta tu semana` | `Your coach builds, assigns and adjusts your week` |
| `landing_feature_3_title` | `Seguimiento y feedback real` | `Real tracking and feedback` |
| `landing_feature_3_sub` | `Tu progreso visible para vos y tu coach` | `Your progress visible to you and your coach` |
| `landing_login_title` | `Empezá ahora` | `Get started` |
| `landing_login_desc` | `Para coaches que quieren crecer y atletas que quieren resultados reales.` | `For coaches who want to grow and athletes who want real results.` |
| `landing_free_label` | `Gratis para atletas` | `Free for athletes` |
| `landing_trust_title` | `Por qué FitReg` | `Why FitReg` |
| `landing_trust_1` | `Coaches con identidad verificada` | `Coaches with verified identity` |
| `landing_trust_2` | `Logros auditados, no autoreportados` | `Audited achievements, not self-reported` |
| `landing_trust_3` | `Sin bots ni respuestas automatizadas` | `No bots or automated responses` |

### Keys to UPDATE

| Key | Old ES | New ES | Old EN | New EN |
|-----|--------|--------|--------|--------|
| `app_tagline` | `Tu tracker de running` | `coaching real · logros reales` | `Your running tracker` | `real coaching · real results` |
| `login_subtitle` | `Seguí tu progreso de running` | *(no longer used in Login.tsx — keep key but do not delete; Login.tsx uses new keys)* | — | — |

### Keys to REMOVE from Login.tsx JSX (not from translation files)

`login_feature_1`, `login_feature_2`, `login_feature_3` — these keys stay in translation files (other pages may reference them), but `Login.tsx` stops rendering them. The new feature items use `landing_feature_*_title` and `landing_feature_*_sub`.

## Visual Style

- Page background: `#0a0a0a`
- Left panel border-right: `1px solid #151515`
- Right panel background: `#0d0d0d`
- Accent color: `#4ade80` (green) — logo "Fit", badge dot, feature icon borders, trust checkmarks
- Text: white headings, `#999` body, `#666` secondary/labels
- Badge background: `#1a2a1a`, border: `1px solid #4ade8066`, border-radius: `20px`
- Feature icon boxes: `32x32px`, background `#1a2a1a`, border `1px solid #4ade8033`, border-radius `8px`
- Trust box: background `#111`, border `1px solid #1e1e1e`, border-radius `8px`
- Separator line: `1px solid #1e1e1e`
- Separator label color: `#444`, font-size: `10px`

## Layout Separator (trust signals)

The separator sits **between the `<GoogleLogin>` button and the trust signals box**. It's a horizontal flex row: `[line] [label text] [line]`. Lines are `flex:1` divs with `height:1px; background:#1e1e1e`.

## Files to Change

| File | Change |
|------|--------|
| `src/App.tsx` | Import `useLocation`; hide `<Navbar>` when `pathname === '/login'` |
| `src/pages/Login.tsx` | Full redesign — two-panel layout, inline mini-navbar, anti-AI copy, trust signals |
| `src/i18n/es.ts` | Add all `landing_*` keys; update `app_tagline` |
| `src/i18n/en.ts` | Same in English |
| `src/App.css` | Add `.landing-*` CSS classes; add `@keyframes pulse-dot`; add mobile breakpoint for landing panels |

## Mobile Breakpoint

At `max-width: 767px`:
- `.landing-panels` changes from `flex-direction: row` to `flex-direction: column`
- `.landing-right` loses fixed width, becomes `width: 100%`
- `.landing-left` loses border-right
- Order: right panel (login) first (`order: -1`), left panel second
- Padding reduced to `24px 20px` per panel

## Out of Scope

- No new routes or API changes
- No changes to the post-login experience
- No scroll sections, testimonials, or pricing — reserved for future iteration
- The Google OAuth callback logic (`handleGoogleSuccess`) stays exactly the same
