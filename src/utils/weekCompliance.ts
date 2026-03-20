import type { DailySummaryItem } from '../types';

export type WeekSelection = 'current' | 'previous';
export type StudentCategory = 'on_track' | 'has_pending' | 'no_activity';
export type CellStatus = 'completed' | 'skipped' | 'pending' | 'none';

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDates(selection: WeekSelection): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = getMondayOf(today);
  if (selection === 'previous') {
    monday.setDate(monday.getDate() - 7);
  }
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
}

export function getCellStatus(item: DailySummaryItem | null): CellStatus {
  if (!item || !item.assigned_workout) return 'none';
  const s = item.assigned_workout.status;
  if (s === 'completed') return 'completed';
  if (s === 'skipped') return 'skipped';
  return 'pending';
}

export function getCompliancePercent(dayItems: (DailySummaryItem | null)[]): number | null {
  const assigned = dayItems.filter(i => i?.assigned_workout != null);
  if (assigned.length === 0) return null;
  const completed = assigned.filter(i => i?.assigned_workout?.status === 'completed').length;
  return Math.round((completed / assigned.length) * 100);
}

export function getComplianceColor(pct: number): string {
  if (pct >= 100) return '#86efac';
  if (pct >= 80)  return '#4ade80';
  if (pct >= 50)  return '#fbbf24';
  return '#f87171';
}

export function getStudentCategory(
  dayItems: (DailySummaryItem | null)[],
  dates: string[],
  today: string
): StudentCategory {
  const hasAnyAssignment = dayItems.some(i => i?.assigned_workout != null);
  if (!hasAnyAssignment) return 'no_activity';

  const hasPendingInPast = dayItems.some((item, idx) => {
    if (dates[idx] >= today) return false;
    return item?.assigned_workout?.status === 'pending';
  });

  return hasPendingInPast ? 'has_pending' : 'on_track';
}

export function getKmSummary(dayItems: (DailySummaryItem | null)[]): {
  planned: number | null;
  completed: number;
} {
  let planned = 0;
  let hasPlanned = false;
  let completed = 0;

  for (const item of dayItems) {
    if (!item?.assigned_workout) continue;
    const aw = item.assigned_workout;
    if (aw.distance_km > 0) {
      planned += aw.distance_km;
      hasPlanned = true;
    }
    if (aw.status === 'completed' && aw.result_distance_km != null) {
      completed += aw.result_distance_km;
    } else if (aw.status === 'completed' && aw.distance_km > 0) {
      // Student completed but didn't log result distance — assume planned distance as proxy
      completed += aw.distance_km;
    }
  }

  return { planned: hasPlanned ? planned : null, completed };
}
