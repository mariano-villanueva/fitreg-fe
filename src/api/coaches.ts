import client from './client';
import type { CoachListItem, CoachPublicProfile, CoachAchievement, CoachRating } from '../types';

export const listCoaches = (params?: { search?: string; locality?: string; level?: string; sort?: string; page?: number; limit?: number }) => {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.locality) qs.set('locality', params.locality);
  if (params?.level) qs.set('level', params.level);
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return client.get<{ data: CoachListItem[]; total: number }>(`/coaches${q ? `?${q}` : ''}`);
};

export const getCoachProfile = (id: number) =>
  client.get<CoachPublicProfile>(`/coaches/${id}`);

export const getCoachRatings = (coachId: number) =>
  client.get<CoachRating[]>(`/coaches/${coachId}/ratings`);

export const upsertRating = (coachId: number, data: { rating: number; comment: string }) =>
  client.post(`/coaches/${coachId}/ratings`, data);

export const updateCoachProfile = (data: { coach_description: string; coach_public: boolean }) =>
  client.put('/coach/profile', data);

export const listMyAchievements = () =>
  client.get<CoachAchievement[]>('/coach/achievements');

export const createAchievement = (data: {
  event_name: string; event_date: string; distance_km: number;
  result_time: string; position: number;
}) => client.post('/coach/achievements', data);

export const updateAchievement = (id: number, data: {
  event_name: string; event_date: string; distance_km: number;
  result_time: string; position: number;
}) => client.put(`/coach/achievements/${id}`, data);

export const deleteAchievement = (id: number) =>
  client.delete(`/coach/achievements/${id}`);
