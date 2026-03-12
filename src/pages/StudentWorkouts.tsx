import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { listStudents } from "../api/coach";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import MonthCalendar from "../components/MonthCalendar";

export default function StudentWorkouts() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const location = useLocation();
  const { t } = useTranslation();
  const { showSuccess } = useFeedback();
  const [studentName, setStudentName] = useState("");

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

  return (
    <div className="page">
      <Link to="/coach" className="back-link">{t('detail_back')}</Link>
      <h1>{t('coach_student_workouts')}</h1>
      <MonthCalendar role="coach" studentId={studentId} studentName={studentName} />
    </div>
  );
}
