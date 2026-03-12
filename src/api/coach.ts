import client from './client';
import type { Student, AssignedWorkout, Workout, WorkoutSegment } from '../types';

export const listStudents = () => client.get<Student[]>('/coach/students');
export const addStudent = (email: string) => client.post<Student>('/coach/students', { email });
export const removeStudent = (studentId: number) => client.delete(`/coach/students/${studentId}`);
export const getStudentWorkouts = (studentId: number) => client.get<Workout[]>(`/coach/students/${studentId}/workouts`);

export const listAssignedWorkouts = (studentId?: number, status?: string, page?: number, limit?: number, startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  if (studentId) params.set('student_id', String(studentId));
  if (status) params.set('status', status);
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  const qs = params.toString();
  return client.get<AssignedWorkout[] | { data: AssignedWorkout[]; total: number }>(`/coach/assigned-workouts${qs ? `?${qs}` : ''}`);
};
export const createAssignedWorkout = (data: {
  student_id: number;
  title: string;
  description: string;
  type: string;
  distance_km: number;
  duration_seconds: number;
  notes: string;
  due_date: string;
  segments?: WorkoutSegment[];
}) => client.post<AssignedWorkout>('/coach/assigned-workouts', data);
export const getAssignedWorkout = (id: number) => client.get<AssignedWorkout>(`/coach/assigned-workouts/${id}`);
export const updateAssignedWorkout = (id: number, data: {
  title: string;
  description: string;
  type: string;
  distance_km: number;
  duration_seconds: number;
  notes: string;
  due_date: string;
  segments?: WorkoutSegment[];
}) => client.put<AssignedWorkout>(`/coach/assigned-workouts/${id}`, data);
export const deleteAssignedWorkout = (id: number) => client.delete(`/coach/assigned-workouts/${id}`);

export const getMyAssignedWorkouts = (startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  const qs = params.toString();
  return client.get<AssignedWorkout[]>(`/my-assigned-workouts${qs ? `?${qs}` : ''}`);
};
export const updateAssignedWorkoutStatus = (id: number, data: {
  status: string;
  result_time_seconds?: number | null;
  result_distance_km?: number | null;
  result_heart_rate?: number | null;
  result_feeling?: number | null;
  image_file_id?: number | null;
}) =>
  client.put<AssignedWorkout>(`/my-assigned-workouts/${id}/status`, data);
