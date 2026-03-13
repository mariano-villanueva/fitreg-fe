import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import { listNotifications, markAsRead, markAllAsRead, executeAction } from "../api/notifications";
import Avatar from "../components/Avatar";
import type { AppNotification } from "../types";

function timeAgo(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('notification_just_now');
  if (diffMin < 60) return t('notification_minutes_ago', { count: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return t('notification_hours_ago', { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  return t('notification_days_ago', { count: diffDays });
}

function notificationIcon(type: string): string {
  switch (type) {
    case 'workout_assigned': return '🏃';
    case 'workout_completed': return '✅';
    case 'workout_skipped': return '⏭️';
    case 'invitation_received': return '📩';
    case 'invitation_accepted': return '🤝';
    case 'invitation_rejected': return '❌';
    case 'achievement_verified': return '🏆';
    case 'achievement_rejected': return '⚠️';
    case 'assignment_message': return '💬';
    default: return '🔔';
  }
}

function getNotificationLink(n: AppNotification): string | null {
  const meta = n.metadata || {};
  switch (n.type) {
    case 'workout_assigned':
      return '/my-assignments';
    case 'workout_completed':
    case 'workout_skipped':
      return meta.workout_id ? `/coach/assigned-workouts/${meta.workout_id}/edit` : '/coach';
    case 'invitation_accepted':
      return '/';
    case 'achievement_verified':
    case 'achievement_rejected':
      return '/coach/profile';
    case 'achievement_pending':
      return meta.achievement_id ? `/admin/achievements/${meta.achievement_id}` : '/admin/achievements';
    case 'coach_request_approved':
      return '/coach/profile';
    case 'relationship_ended':
      return '/coaches';
    case 'assignment_message':
      return meta.assigned_workout_id ? `/assignments/${meta.assigned_workout_id}` : '/my-assignments';
    default:
      return null;
  }
}

export default function Notifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useFeedback();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showRead, setShowRead] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      setLoading(true);
      const res = await listNotifications();
      setNotifications(res.data);
      setReadIds(new Set(res.data.filter((n: AppNotification) => n.is_read).map((n: AppNotification) => n.id)));
    } catch {
      // Fail silently
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAsRead(e: React.MouseEvent, notifId: number) {
    e.stopPropagation();
    try {
      await markAsRead(notifId);
      setReadIds((prev) => new Set([...prev, notifId]));
    } catch {
      showError(t('error'));
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await markAllAsRead();
      setReadIds(new Set(notifications.map((n) => n.id)));
    } catch {
      showError(t('error'));
    }
  }

  async function handleAction(e: React.MouseEvent, notifId: number, actionKey: string) {
    e.stopPropagation();
    try {
      await executeAction(notifId, actionKey);
      showSuccess(t('notification_action_done'));
      const res = await listNotifications();
      setNotifications(res.data);
      setReadIds(new Set(res.data.filter((n: AppNotification) => n.is_read).map((n: AppNotification) => n.id)));
    } catch {
      showError(t('error'));
    }
  }

  function handleNotificationClick(n: AppNotification) {
    const link = getNotificationLink(n);
    if (!link) return;
    // Mark as read on navigation
    if (!readIds.has(n.id)) {
      markAsRead(n.id).catch(() => {});
    }
    navigate(link);
  }

  const newNotifications = notifications.filter((n) => !readIds.has(n.id));
  const oldNotifications = notifications.filter((n) => readIds.has(n.id));
  const visibleNotifications = showRead ? notifications : newNotifications;

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="page notifications-page">
      <div className="notifications-header">
        <h1>{t('notification_title')}</h1>
        <div className="notifications-header-actions">
          {newNotifications.length > 0 && (
            <>
              <span className="notifications-new-badge">{newNotifications.length} {t('notification_new_label')}</span>
              <button className="btn btn-sm" onClick={handleMarkAllAsRead}>
                {t('notification_mark_all_read')}
              </button>
            </>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="notifications-empty">
          <div className="notifications-empty-icon">🔔</div>
          <p>{t('notification_empty')}</p>
        </div>
      ) : (
        <>
          {visibleNotifications.length === 0 && !showRead ? (
            <div className="notifications-empty">
              <div className="notifications-empty-icon">✨</div>
              <p>{t('notification_no_new')}</p>
            </div>
          ) : (
            <div className="notification-list">
              {visibleNotifications.map((n) => {
                const isNew = !readIds.has(n.id);
                const link = getNotificationLink(n);
                const isClickable = link != null;
                return (
                  <div
                    key={n.id}
                    className={`notification-card ${isNew ? 'notification-card--new' : ''} ${isClickable ? 'notification-card--clickable' : ''}`}
                    onClick={isClickable ? () => handleNotificationClick(n) : undefined}
                  >
                    <div className="notification-card-icon">
                      {n.metadata?.sender_avatar ? (
                        <Avatar src={String(n.metadata.sender_avatar)} name={String(n.metadata.sender_name || '')} size={42} className="notification-avatar" />
                      ) : (
                        <span className="notification-emoji">{notificationIcon(n.type)}</span>
                      )}
                      {isNew && <span className="notification-dot" />}
                    </div>
                    <div className="notification-card-body">
                      <div className="notification-card-top">
                        <strong className="notification-card-title">{t(n.title, { defaultValue: n.title, ...(n.metadata || {}) })}</strong>
                        <span className="notification-card-time">{timeAgo(n.created_at, t)}</span>
                      </div>
                      <p className="notification-card-text">{t(n.body, { defaultValue: n.body, ...(n.metadata || {}) })}</p>
                      {(isNew || (n.actions && n.actions.length > 0)) && (
                        <div className="notification-card-footer">
                          {n.actions && n.actions.length > 0 && (
                            <div className="notification-card-actions">
                              {n.actions.map((action) => (
                                <button
                                  key={action.key}
                                  className={`btn btn-sm ${action.style === 'primary' ? 'btn-primary' : action.style === 'danger' ? 'btn-danger' : ''}`}
                                  onClick={(e) => handleAction(e, n.id, action.key)}
                                >
                                  {t(action.label)}
                                </button>
                              ))}
                            </div>
                          )}
                          {isNew && (
                            <button
                              className="btn btn-sm notification-mark-read-btn"
                              onClick={(e) => handleMarkAsRead(e, n.id)}
                            >
                              {t('notification_mark_read')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {oldNotifications.length > 0 && (
            <div className="notifications-toggle-read">
              <button className="btn" onClick={() => setShowRead(!showRead)}>
                {showRead ? t('notification_hide_read') : t('notification_show_read', { count: oldNotifications.length })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
