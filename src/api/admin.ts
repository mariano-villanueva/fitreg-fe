import client from './client';
import type { AdminStats, PendingAchievement, AdminUsersResponse } from '../types';

export const getAdminStats = () => client.get<AdminStats>('/admin/stats');
export const listAdminUsers = (params?: {
  search?: string;
  role?: 'athlete' | 'coach' | 'admin' | '';
  sort?: 'name' | 'email' | 'created_at';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}) => client.get<AdminUsersResponse>('/admin/users', { params });
export const updateAdminUser = (id: number, data: { is_coach?: boolean; is_admin?: boolean }) =>
  client.put(`/admin/users/${id}`, data);
export const getPendingAchievements = () =>
  client.get<PendingAchievement[]>('/admin/achievements/pending');
export const verifyAchievement = (id: number) =>
  client.put(`/admin/achievements/${id}/verify`, {});
export const rejectAchievement = (id: number, reason?: string) =>
  client.put(`/admin/achievements/${id}/reject`, { reason: reason || '' });
