import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { getAssignedWorkout } from "../api/coach";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import AssignWorkoutFields from "../components/AssignWorkoutFields";
import ErrorState from "../components/ErrorState";
import type { AssignedWorkout } from "../types";

export default function AssignWorkoutForm() {
  const { studentId, id } = useParams<{ studentId?: string; id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showError } = useFeedback();
  const [loading, setLoading] = useState(false);
  const [errorType, setErrorType] = useState<"not_found" | "generic" | null>(null);
  const [existingWorkout, setExistingWorkout] = useState<AssignedWorkout | undefined>();
  const [resolvedStudentId, setResolvedStudentId] = useState(Number(studentId) || 0);

  useEffect(() => {
    if (isEdit && id) {
      loadWorkout();
    }
  }, [id]);

  async function loadWorkout() {
    setLoading(true);
    try {
      const res = await getAssignedWorkout(Number(id));
      setExistingWorkout(res.data);
      setResolvedStudentId(res.data.student_id);
    } catch (err) {
      if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 403)) {
        setErrorType("not_found");
      } else {
        setErrorType("generic");
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>;
  if (errorType) return <ErrorState type={errorType} backTo="/coach" />;

  return (
    <div className="page">
      <h1>{isEdit ? t('assigned_edit') : t('assigned_new')}</h1>
      <AssignWorkoutFields
        studentId={resolvedStudentId}
        dueDate=""
        existingWorkout={existingWorkout}
        onSave={() => {
          navigate(`/coach/students/${resolvedStudentId}`, {
            state: { feedback: isEdit ? t('assigned_workout_updated') : t('assigned_workout_created') }
          });
        }}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}
