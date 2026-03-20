# Spec: Dashboard de Cumplimiento Semanal del Coach

_Fecha: 2026-03-20_

---

## Contexto

El coach necesita ver de un vistazo el estado de sus alumnos en la semana actual o anterior. Hoy solo existe el resumen diario (`CoachDailyView`), que requiere navegar día a día. Este dashboard agrega esa información a nivel semanal directamente en el `CoachDashboard`.

---

## Alcance

- **Qué se construye:** Un nuevo componente `WeeklyComplianceDashboard` integrado como sección en `CoachDashboard`.
- **Qué no se toca:** `CoachDailyView`, lógica de asignación de workouts, modelos de datos existentes.

---

## Diseño

### Ubicación

Sección nueva dentro de `CoachDashboard.tsx`, renderizada como componente independiente `WeeklyComplianceDashboard`.

### Semana

- Semana calendario: lunes a domingo.
- El coach puede ver la **semana actual** o la **semana anterior** (toggle de dos botones).
- Por defecto muestra la semana actual.

### Layout

```
[ Header: "Cumplimiento semanal"  |  Sem. ant.  Esta sem. ]

[ AL DÍA: 3 ] [ CON PENDIENTES: 1 ] [ SIN ACTIVIDAD: 0 ] [ TOTAL: 4 ]

[ Tabla: alumno × día (LUN–DOM) + % + km ]
```

### Mini stats (4 contadores)

| Stat | Definición |
|------|-----------|
| **Al día** | El alumno no tiene workouts asignados con `status = pending` en días pasados (< hoy) dentro de la semana. Los pendientes de hoy en adelante no penalizan. |
| **Con pendientes** | Tiene al menos un workout `pending` en un día ya pasado. |
| **Sin actividad** | No tiene ningún workout asignado en toda la semana. |
| **Total** | Total de alumnos activos del coach. |

> Nota: un alumno es exactamente uno de: "al día", "con pendientes", o "sin actividad". Las tres categorías son mutuamente excluyentes y exhaustivas.

### Tabla

- **Filas:** un alumno por fila, ordenados por % de cumplimiento descendente.
- **Columnas de días:** LUN a DOM con la fecha del día (ej. "17") debajo.
- **Celda por día:**
  - `✅` — workout completado
  - `❌` — workout saltado (skipped)
  - `⏳` — workout pendiente
  - `—` — sin workout asignado ese día
- **Columna %:** porcentaje de sesiones completadas sobre sesiones asignadas (los días sin asignación no cuentan). Color según tabla de rangos (distinta de la lógica de categorías de los mini stats, que usa solo ≥80% como umbral de "al día").
- **Columna km:** `km_completados / km_planificados`. Si no hay distancia planificada, muestra `—`.
- **Nombre del alumno:** link a `StudentWorkouts` (perfil del alumno).

### Color del %

| Rango | Color |
|-------|-------|
| ≥ 100% | `#86efac` (verde claro) |
| 80–99% | `#4ade80` (verde) |
| 50–79% | `#fbbf24` (amarillo) |
| < 50% | `#f87171` (rojo) |

---

## Datos necesarios

### Endpoint existente reutilizado

`GET /api/coach/daily-summary?date=YYYY-MM-DD` — devuelve el estado de todos los alumnos para un día dado.

### Estrategia de fetch

El componente hace **7 llamadas en paralelo** (una por día de la semana: lunes a domingo) a `getDailySummary(date)`. Los resultados se combinan en el frontend para construir la matriz alumno × día.

> No se necesita endpoint nuevo en el backend. Los 7 requests son ligeros y permiten reutilizar la lógica existente exactamente igual.

### Cálculo del %

```
% = sesiones_completadas / sesiones_con_asignacion × 100
```

Donde `sesiones_con_asignacion` = días donde `assigned_workout !== null`.

### Cálculo de km

```
km_completados = suma de result_distance_km de workouts completados en la semana
km_planificados = suma de distance_km de todos los workouts asignados en la semana
```

Si `km_planificados === 0`, mostrar `—`.

---

## Componente

### Archivo

`FitRegFE/src/components/WeeklyComplianceDashboard.tsx`

### Props

```ts
interface WeeklyComplianceDashboardProps {
  students: Student[]  // lista de alumnos activos, ya disponible en CoachDashboard
}
```

### Estado interno

```ts
type WeekSelection = 'current' | 'previous'
const [week, setWeek] = useState<WeekSelection>('current')
const [data, setData] = useState<DailySummaryItem[][] | null>(null)  // [dia0..dia6][alumnoN]
const [loading, setLoading] = useState(false)
```

### Lógica de semana

```ts
function getWeekDates(selection: WeekSelection): string[] {
  // Devuelve array de 7 strings YYYY-MM-DD, lunes a domingo
  // 'current': semana calendario que contiene hoy
  // 'previous': semana anterior
}
```

---

## Integración en CoachDashboard

Agregar `<WeeklyComplianceDashboard students={students} />` como sección dentro del JSX de `CoachDashboard.tsx`, debajo del header y lista de alumnos existente.

---

## Casos borde

- **Alumno sin ningún workout en la semana:** toda su fila muestra `—`, la columna % muestra `—` (no hay sesiones sobre las que calcular), aparece en la categoría "sin actividad".
- **Semana en curso (días futuros):** los días futuros muestran `⏳` si tienen asignación o `—` si no tienen.
- **Sin alumnos:** no se renderiza el componente (o muestra mensaje vacío consistente con el resto del dashboard).
- **Loading:** skeleton o spinner mientras se resuelven los 7 requests paralelos.
- **Error en algún request:** mostrar el día como `—` y loggear, sin romper la UI.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/WeeklyComplianceDashboard.tsx` | Componente nuevo |
| `src/pages/CoachDashboard.tsx` | Importar y renderizar `WeeklyComplianceDashboard` |
| `src/api/coach.ts` | Sin cambios (reutiliza `getDailySummary`) |
| `src/types/index.ts` | Sin cambios |

---

## Fuera de scope

- Endpoint nuevo en backend
- Vista diaria desde el componente (para eso existe `CoachDailyView`)
- Semanas anteriores a la semana pasada
- Export / reporte
- Notificaciones o alertas automáticas
