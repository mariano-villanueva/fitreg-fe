import client from './client';
import type { AppNotification, NotificationPreferences } from '../types';

export const listNotifications = (page = 1, limit = 20) =>
  client.get<AppNotification[]>(`/notifications?page=${page}&limit=${limit}`);

export const getUnreadCount = () =>
  client.get<{ count: number }>('/notifications/unread-count');

export const markAsRead = (id: number) =>
  client.put(`/notifications/${id}/read`);

export const markAllAsRead = () =>
  client.put('/notifications/read-all');

export const executeAction = (id: number, action: string) =>
  client.post(`/notifications/${id}/action`, { action });

export const getNotificationPreferences = () =>
  client.get<NotificationPreferences>('/notification-preferences');

export const updateNotificationPreferences = (data: { workout_assigned: boolean; workout_completed_or_skipped: boolean; assignment_message?: boolean }) =>
  client.put('/notification-preferences', data);
