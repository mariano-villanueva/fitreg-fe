import client from './client';
import type { WeeklyTemplate, WeeklyTemplateDay } from '../types';

export const listWeeklyTemplates = () =>
  client.get<WeeklyTemplate[]>('/coach/weekly-templates');

export const getWeeklyTemplate = (id: number) =>
  client.get<WeeklyTemplate>(`/coach/weekly-templates/${id}`);

export const createWeeklyTemplate = (data: { name: string; description?: string }) =>
  client.post<WeeklyTemplate>('/coach/weekly-templates', data);

export const updateWeeklyTemplateMeta = (id: number, data: { name: string; description?: string }) =>
  client.put<WeeklyTemplate>(`/coach/weekly-templates/${id}`, data);

export const deleteWeeklyTemplate = (id: number) =>
  client.delete(`/coach/weekly-templates/${id}`);

export const putWeeklyTemplateDays = (id: number, days: WeeklyTemplateDay[]) =>
  client.put<WeeklyTemplate>(`/coach/weekly-templates/${id}/days`, { days });

export const assignWeeklyTemplate = (id: number, studentId: number, startDate: string, force = false) =>
  client.post<{ assigned_workout_ids: number[] }>(
    `/coach/weekly-templates/${id}/assign`,
    { student_id: studentId, start_date: startDate, force }
  );
