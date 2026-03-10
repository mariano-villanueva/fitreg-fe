import client from './client';
import type { CoachListItem, CoachPublicProfile, CoachAchievement, CoachRating } from '../types';

export const listCoaches = (search?: string) => {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return client.get<CoachListItem[]>(`/coaches${params}`);
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
