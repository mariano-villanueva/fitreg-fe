import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import {
  getAssignedWorkoutDetail,
  listAssignmentMessages,
  sendAssignmentMessage,
  markAssignmentMessagesRead,
} from "../api/assignments";
import { updateAssignedWorkoutStatus, deleteAssignedWorkout } from "../api/coach";
import ErrorState from "../components/ErrorState";
import SegmentDisplay from "../components/SegmentDisplay";
import Avatar from "../components/Avatar";
import type { AssignedWorkout, AssignmentMessage } from "../types";

export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [workout, setWorkout] = useState<AssignedWorkout | null>(null);
  const [messages, setMessages] = useState<AssignmentMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<"not_found" | "generic" | null>(null);

  const isCoach = user?.id === workout?.coach_id;
  const isPending = workout?.status === "pending";

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [wRes, mRes] = await Promise.all([
        getAssignedWorkoutDetail(Number(id)),
        listAssignmentMessages(Number(id)),
      ]);
      setWorkout(wRes.data);
      setMessages(mRes.data || []);
      markAssignmentMessagesRead(Number(id)).catch(() => {});
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = newMessage.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await sendAssignmentMessage(Number(id), body);
      setMessages((prev) => [...prev, res.data]);
      setNewMessage("");
    } catch {
      showError(t("error"));
    } finally {
      setSending(false);
    }
  }

  async function handleComplete() {
    try {
      await updateAssignedWorkoutStatus(Number(id), { status: "completed" });
      showSuccess(t("assigned_mark_completed"));
      loadData();
    } catch {
      showError(t("error"));
    }
  }

  async function handleSkip() {
    try {
      await updateAssignedWorkoutStatus(Number(id), { status: "skipped" });
      showSuccess(t("assigned_mark_skipped"));
      loadData();
    } catch {
      showError(t("error"));
    }
  }

  async function handleDelete() {
    if (!confirm(t("calendar_confirm_delete"))) return;
    try {
      await deleteAssignedWorkout(Number(id));
      showSuccess(t("assigned_workout_deleted"));
      navigate(-1);
    } catch {
      showError(t("error"));
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  if (loading) return <div className="loading">{t("loading")}</div>;
  if (errorType) return <ErrorState type={errorType} backTo="/my-assignments" />;
  if (!workout) return <ErrorState type="generic" backTo="/my-assignments" />;

  const statusClass = workout.status === "completed" ? "badge-completed" : workout.status === "skipped" ? "badge-skipped" : "badge-pending";

  return (
    <div className="page assignment-detail">
      {/* Header */}
      <div className="assignment-detail-header">
        <button className="btn btn-link" onClick={() => navigate(-1)}>
          {t("assignment_back")}
        </button>
        <span className={`badge ${statusClass}`}>{t(`assigned_status_${workout.status}`)}</span>
      </div>

      {/* Detail card */}
      <div className="detail-card">
        <h2>{workout.title}</h2>
        <div className="detail-grid">
          {workout.type && (
            <div className="detail-item">
              <span className="detail-label">{t("assigned_type")}</span>
              <span className="badge">{t(`workout_type_${workout.type}`)}</span>
            </div>
          )}
          {workout.distance_km > 0 && (
            <div className="detail-item">
              <span className="detail-label">{t("assigned_distance")}</span>
              <span>{workout.distance_km} km</span>
            </div>
          )}
          {workout.duration_seconds > 0 && (
            <div className="detail-item">
              <span className="detail-label">{t("assigned_duration")}</span>
              <span>{formatDuration(workout.duration_seconds)}</span>
            </div>
          )}
          {workout.due_date && (
            <div className="detail-item">
              <span className="detail-label">{t("assigned_due_date")}</span>
              <span>{workout.due_date}</span>
            </div>
          )}
        </div>

        {workout.segments && workout.segments.length > 0 && (
          <div className="day-modal-section">
            <strong>{t("assigned_segments")}</strong>
            <SegmentDisplay segments={workout.segments} />
          </div>
        )}

        {workout.notes && (
          <div className="day-modal-section">
            <strong>{t("assigned_notes")}</strong>
            <p>{workout.notes}</p>
          </div>
        )}

        {workout.description && (
          <div className="day-modal-section">
            <strong>{t("assigned_description")}</strong>
            <p>{workout.description}</p>
          </div>
        )}

        {/* Results if completed */}
        {workout.status === "completed" && (
          <div className="day-modal-section">
            <strong>{t("assigned_results")}</strong>
            <div className="detail-grid">
              {workout.result_time_seconds && (
                <div className="detail-item">
                  <span className="detail-label">{t("assigned_result_time")}</span>
                  <span>{formatDuration(workout.result_time_seconds)}</span>
                </div>
              )}
              {workout.result_distance_km && (
                <div className="detail-item">
                  <span className="detail-label">{t("assigned_result_distance")}</span>
                  <span>{workout.result_distance_km} km</span>
                </div>
              )}
              {workout.result_heart_rate && (
                <div className="detail-item">
                  <span className="detail-label">{t("assigned_result_hr")}</span>
                  <span>{workout.result_heart_rate} bpm</span>
                </div>
              )}
              {workout.result_feeling && (
                <div className="detail-item">
                  <span className="detail-label">{t("assigned_result_feeling")}</span>
                  <span>{workout.result_feeling}/10</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {isPending && (
        <div className="assignment-detail-actions">
          {isCoach ? (
            <>
              <Link to={`/coach/assigned-workouts/${workout.id}/edit`} className="btn btn-primary">
                {t("calendar_edit")}
              </Link>
              <button className="btn btn-danger" onClick={handleDelete}>
                {t("calendar_delete")}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" onClick={handleComplete}>
                {t("assigned_mark_completed")}
              </button>
              <button className="btn" onClick={handleSkip}>
                {t("assigned_mark_skipped")}
              </button>
            </>
          )}
        </div>
      )}

      {/* Messages section */}
      <div className="assignment-messages">
        <h3>{t("assignment_messages_title")} ({messages.length})</h3>

        {messages.length === 0 && (
          <p className="text-secondary">{t("assignment_messages_empty")}</p>
        )}

        <div className="assignment-messages-list">
          {messages.map((m) => {
            const isOwn = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`assignment-message ${isOwn ? "assignment-message--own" : ""}`}>
                {!isOwn && (
                  <Avatar src={m.sender_avatar} name={m.sender_name} size={32} />
                )}
                <div className="assignment-message-bubble">
                  {!isOwn && <span className="assignment-message-name">{m.sender_name}</span>}
                  <p className="assignment-message-body">{m.body}</p>
                  <span className="assignment-message-time">{formatTime(m.created_at)}</span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar or read-only notice */}
        {isPending ? (
          <form className="assignment-message-input" onSubmit={handleSend}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t("assignment_messages_placeholder")}
              maxLength={2000}
            />
            <button type="submit" className="btn btn-primary" disabled={sending || !newMessage.trim()}>
              {t("assignment_messages_send")}
            </button>
          </form>
        ) : (
          <p className="assignment-message-input--disabled">
            {t("assignment_messages_readonly")}
          </p>
        )}
      </div>
    </div>
  );
}
