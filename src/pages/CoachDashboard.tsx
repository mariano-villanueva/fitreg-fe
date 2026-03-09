import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listStudents, addStudent, removeStudent, listAssignedWorkouts } from "../api/coach";
import type { Student, AssignedWorkout } from "../types";
import { useTranslation } from "react-i18next";

export default function CoachDashboard() {
  const { t } = useTranslation();
  const [students, setStudents] = useState<Student[]>([]);
  const [assignedWorkouts, setAssignedWorkouts] = useState<AssignedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [studentsRes, assignedRes] = await Promise.all([
        listStudents(),
        listAssignedWorkouts(),
      ]);
      setStudents(studentsRes.data);
      setAssignedWorkouts(assignedRes.data);
    } catch {
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await addStudent(newEmail.trim());
      setStudents((prev) => [...prev, res.data]);
      setNewEmail("");
      setShowAddForm(false);
    } catch {
      setError("Failed to add student.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveStudent(studentId: number) {
    if (!confirm(t('coach_remove_student'))) return;
    try {
      await removeStudent(studentId);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
    } catch {
      setError("Failed to remove student.");
    }
  }

  const pendingCount = assignedWorkouts.filter((w) => w.status === 'pending').length;

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="page coach-dashboard">
      <h1>{t('coach_dashboard')}</h1>

      {error && <div className="error">{error}</div>}

      <div className="coach-stats">
        <div className="coach-stat-card">
          <span className="coach-stat-value">{students.length}</span>
          <span className="coach-stat-label">{t('coach_stats_students')}</span>
        </div>
        <div className="coach-stat-card">
          <span className="coach-stat-value">{pendingCount}</span>
          <span className="coach-stat-label">{t('coach_stats_pending')}</span>
        </div>
      </div>

      <div className="coach-section">
        <div className="coach-section-header">
          <h2>{t('coach_students')}</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
            + {t('coach_add_student')}
          </button>
        </div>

        {showAddForm && (
          <form className="add-student-form" onSubmit={handleAddStudent}>
            <input
              type="email"
              placeholder={t('coach_add_student_placeholder')}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
              {t('coach_add_student_btn')}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setShowAddForm(false)}>
              {t('cancel')}
            </button>
          </form>
        )}

        {students.length === 0 ? (
          <div className="empty-state">
            <p>{t('coach_no_students')}</p>
          </div>
        ) : (
          <div className="student-grid">
            {students.map((student) => (
              <div key={student.id} className="student-card">
                <div className="student-card-info">
                  {student.avatar_url ? (
                    <img src={student.avatar_url} alt="" className="student-avatar" />
                  ) : (
                    <div className="student-avatar-placeholder" />
                  )}
                  <div>
                    <h3>{student.name}</h3>
                    <p className="student-email">{student.email}</p>
                  </div>
                </div>
                <div className="student-card-actions">
                  <Link to={`/coach/students/${student.id}`} className="btn btn-sm">
                    {t('coach_student_workouts')}
                  </Link>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleRemoveStudent(student.id)}
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
