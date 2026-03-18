import { useTranslation } from 'react-i18next';
import type { WeeklyTemplateDay } from '../types';

interface Props {
  dayIndex: number; // 0=Mon … 6=Sun
  day: WeeklyTemplateDay | null;
  onClick: () => void;
}

const DAY_LABELS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeeklyDayCell({ dayIndex, day, onClick }: Props) {
  const { i18n } = useTranslation();
  const labels = i18n.language.startsWith('es') ? DAY_LABELS_ES : DAY_LABELS_EN;

  return (
    <div
      className={`weekly-day-cell ${day ? 'weekly-day-cell--filled' : 'weekly-day-cell--empty'}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <span className="weekly-day-cell__label">{labels[dayIndex]}</span>
      {day ? (
        <>
          <span className="weekly-day-cell__title">{day.title}</span>
          {day.type && (
            <span className="day-modal-type-badge">{day.type}</span>
          )}
        </>
      ) : (
        <span className="weekly-day-cell__rest">—</span>
      )}
    </div>
  );
}
