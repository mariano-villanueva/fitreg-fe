import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listStudents, listAssignedWorkouts } from "../api/coach";
import { createInvitation, listInvitations, cancelInvitation } from "../api/invitations";
import type { Student, AssignedWorkout, Invitation } from "../types";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";

export default function CoachDashboard() {
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const [students, setStudents] = useState<Student[]>([]);
  const [assignedWorkouts, setAssignedWorkouts] = useState<AssignedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [studentsRes, assignedRes, invRes] = await Promise.all([
        listStudents(),
        listAssignedWorkouts(),
        listInvitations({ status: 'pending', direction: 'sent' }),
      ]);
      setStudents(studentsRes.data);
      const raw = assignedRes.data;
      setAssignedWorkouts(Array.isArray(raw) ? raw : raw.data);
      setPendingInvitations(invRes.data);
    } catch {
      showError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      await createInvitation({ type: 'coach_invite', receiver_email: newEmail.trim(), message: newMessage.trim() || undefined });
      showSuccess(t('invitation_sent_success'));
      setNewEmail("");
      setNewMessage("");
      setShowAddForm(false);
      loadData();
    } catch {
      showError(t('error'));
    } finally {
      setAdding(false);
    }
  }

  async function handleCancelInvitation(id: number) {
    try {
      await cancelInvitation(id);
      showSuccess(t('invitation_cancelled_success'));
      setPendingInvitations((prev) => prev.filter((i) => i.id !== id));
    } catch {
      showError(t('error'));
    }
  }

  const pendingCount = assignedWorkouts.filter((w) => w.status === 'pending').length;

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="page coach-dashboard">
      <h1>{t('coach_dashboard')}</h1>

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
            + {t('invitation_invite_student')}
          </button>
        </div>

        {showAddForm && (
          <form className="add-student-form" onSubmit={handleInvite}>
            <input
              type="email"
              placeholder={t('coach_add_student_placeholder')}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder={t('invitation_message_placeholder')}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
              {t('invitation_invite_student')}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setShowAddForm(false)}>
              {t('cancel')}
            </button>
          </form>
        )}

        {pendingInvitations.length > 0 && (
          <div className="invitation-pending-section">
            <h3>{t('invitation_pending')}</h3>
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="invitation-card">
                <div className="invitation-card-info">
                  {inv.receiver_avatar && <img src={inv.receiver_avatar} alt="" className="student-avatar" />}
                  <div>
                    <strong>{inv.receiver_name}</strong>
                    {inv.message && <p className="invitation-message">{inv.message}</p>}
                  </div>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => handleCancelInvitation(inv.id)}>
                  {t('invitation_cancel')}
                </button>
              </div>
            ))}
          </div>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
