import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { listStudents } from "../api/coach";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import MonthCalendar from "../components/MonthCalendar";
import WeeklyTemplateAssignModal from "../components/WeeklyTemplateAssignModal";

export default function StudentWorkouts() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const location = useLocation();
  const { t } = useTranslation();
  const { showSuccess } = useFeedback();
  const [studentName, setStudentName] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [calendarKey, setCalendarKey] = useState(0);

  const feedbackShown = useRef(false);
  useEffect(() => {
    const state = location.state as { feedback?: string } | null;
    if (state?.feedback && !feedbackShown.current) {
      feedbackShown.current = true;
      showSuccess(state.feedback);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    loadStudentName();
  }, [studentId]);

  async function loadStudentName() {
    try {
      const res = await listStudents();
      const student = res.data.find((s) => s.id === studentId);
      if (student) setStudentName(student.name);
    } catch {
      // ignore
    }
  }

  function handleAssignSuccess() {
    setShowAssignModal(false);
    showSuccess(t('weekly_template_assigned'));
    setCalendarKey((k) => k + 1);
  }

  return (
    <div className="page">
      <Link to="/coach" className="back-link">{t('detail_back')}</Link>
      <div className="page-header">
        <h1>{studentName || t('coach_student_workouts')}</h1>
        <button className="btn btn-primary" onClick={() => setShowAssignModal(true)}>
          📅 {t('weekly_template_assign')}
        </button>
      </div>
      <MonthCalendar key={calendarKey} role="coach" studentId={studentId} studentName={studentName} />

      {showAssignModal && (
        <WeeklyTemplateAssignModal
          presetStudentId={studentId}
          presetStudentName={studentName}
          onClose={() => setShowAssignModal(false)}
          onSuccess={handleAssignSuccess}
        />
      )}
    </div>
  );
}
