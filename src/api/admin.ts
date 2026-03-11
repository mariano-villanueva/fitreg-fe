import client from './client';
import type { AdminUser, AdminStats, PendingAchievement } from '../types';

export const getAdminStats = () => client.get<AdminStats>('/admin/stats');
export const listAdminUsers = () => client.get<AdminUser[]>('/admin/users');
export const updateAdminUser = (id: number, data: { is_coach?: boolean; is_admin?: boolean }) =>
  client.put(`/admin/users/${id}`, data);
export const getPendingAchievements = () =>
  client.get<PendingAchievement[]>('/admin/achievements/pending');
export const verifyAchievement = (id: number) =>
  client.put(`/admin/achievements/${id}/verify`, {});
export const rejectAchievement = (id: number, reason?: string) =>
  client.put(`/admin/achievements/${id}/reject`, { reason: reason || '' });
