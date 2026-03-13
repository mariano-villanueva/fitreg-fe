import client from './client';
import type { WorkoutTemplate } from '../types';

export const listTemplates = () =>
  client.get<WorkoutTemplate[]>('/coach/templates');

export const getTemplate = (id: number) =>
  client.get<WorkoutTemplate>(`/coach/templates/${id}`);

export const createTemplate = (data: {
  title: string; description: string; type: string;
  notes: string; expected_fields: string[]; segments: unknown[];
}) => client.post<WorkoutTemplate>('/coach/templates', data);

export const updateTemplate = (id: number, data: {
  title: string; description: string; type: string;
  notes: string; expected_fields: string[]; segments: unknown[];
}) => client.put<WorkoutTemplate>(`/coach/templates/${id}`, data);

export const deleteTemplate = (id: number) =>
  client.delete(`/coach/templates/${id}`);
