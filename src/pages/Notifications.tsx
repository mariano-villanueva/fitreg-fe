import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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

export default function Notifications() {
  const { t } = useTranslation();
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
      // Remember which were already read before marking all
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
      const res = await listNotifications();
      setNotifications(res.data);
    } catch {
      // Could show error but keeping simple
    }
  }

  // Use readIds to determine which were already read when page loaded
  const newNotifications = notifications.filter((n) => !readIds.has(n.id));
  const oldNotifications = notifications.filter((n) => readIds.has(n.id));
  const visibleNotifications = showRead ? notifications : newNotifications;

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="page">
      <h1>{t('notification_title')}</h1>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <p>{t('notification_empty')}</p>
        </div>
      ) : (
        <>
          {visibleNotifications.length === 0 && !showRead ? (
            <div className="empty-state">
              <p>{t('notification_no_new')}</p>
            </div>
          ) : (
            <div className="notification-list">
              {visibleNotifications.map((n) => (
                <div key={n.id} className={`notification-item ${!n.is_read ? 'notification-unread' : ''}`}>
                  {!!n.metadata?.sender_avatar && (
                    <img src={String(n.metadata.sender_avatar)} alt="" className="notification-avatar" />
                  )}
                  <div className="notification-content">
                    <strong className="notification-item-title">{t(n.title, { defaultValue: n.title, ...(n.metadata || {}) })}</strong>
                    <p className="notification-body">{t(n.body, { defaultValue: n.body, ...(n.metadata || {}) })}</p>
                    <span className="notification-time">{timeAgo(n.created_at, t)}</span>
                    {n.actions && n.actions.length > 0 && (
                      <div className="notification-actions">
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
              ))}
            </div>
          )}

          {oldNotifications.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
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
