import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import { listNotifications, markAllAsRead, executeAction } from "../api/notifications";
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
    default: return '🔔';
  }
}

export default function Notifications() {
  const { t } = useTranslation();
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
      markAllAsRead();
    } catch {
      // Fail silently
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(notifId: number, actionKey: string) {
    try {
      await executeAction(notifId, actionKey);
      showSuccess(t('notification_action_done'));
      const res = await listNotifications();
      setNotifications(res.data);
    } catch {
      showError(t('error'));
    }
  }

  const newNotifications = notifications.filter((n) => !readIds.has(n.id));
  const oldNotifications = notifications.filter((n) => readIds.has(n.id));
  const visibleNotifications = showRead ? notifications : newNotifications;

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="page notifications-page">
      <div className="notifications-header">
        <h1>{t('notification_title')}</h1>
        {newNotifications.length > 0 && (
          <span className="notifications-new-badge">{newNotifications.length} {t('notification_new_label')}</span>
        )}
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
                return (
                  <div key={n.id} className={`notification-card ${isNew ? 'notification-card--new' : ''}`}>
                    <div className="notification-card-icon">
                      {n.metadata?.sender_avatar ? (
                        <img src={String(n.metadata.sender_avatar)} alt="" className="notification-avatar" />
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
                      {n.actions && n.actions.length > 0 && (
                        <div className="notification-card-actions">
                          {n.actions.map((action) => (
                            <button
                              key={action.key}
                              className={`btn btn-sm ${action.style === 'primary' ? 'btn-primary' : action.style === 'danger' ? 'btn-danger' : ''}`}
                              onClick={() => handleAction(n.id, action.key)}
                            >
                              {t(action.label)}
                            </button>
                          ))}
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
