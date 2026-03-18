import WeeklyDayCell from './WeeklyDayCell';
import type { WeeklyTemplateDay } from '../types';

interface Props {
  days: (WeeklyTemplateDay | null)[]; // index 0–6, null = rest day
  onDayClick: (dayIndex: number) => void;
}

export default function WeeklyTemplateCalendar({ days, onDayClick }: Props) {
  return (
    <div className="weekly-template-calendar">
      {Array.from({ length: 7 }, (_, i) => (
        <WeeklyDayCell
          key={i}
          dayIndex={i}
          day={days[i] ?? null}
          onClick={() => onDayClick(i)}
        />
      ))}
    </div>
  );
}
