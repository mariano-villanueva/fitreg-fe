import { useTranslation } from "react-i18next";
import MonthCalendar from "../components/MonthCalendar";

export default function MyAssignedWorkouts() {
  const { t } = useTranslation();

  return (
    <div className="page">
      <h1>{t('assigned_my')}</h1>
      <MonthCalendar role="student" />
    </div>
  );
}
