import client from './client';
import type { Student, AssignedWorkout, Workout, WorkoutSegment } from '../types';

export const listStudents = () => client.get<Student[]>('/coach/students');
export const addStudent = (email: string) => client.post<Student>('/coach/students', { email });
export const removeStudent = (studentId: number) => client.delete(`/coach/students/${studentId}`);
export const getStudentWorkouts = (studentId: number) => client.get<Workout[]>(`/coach/students/${studentId}/workouts`);

export const listAssignedWorkouts = (studentId?: number) => {
  const params = studentId ? `?student_id=${studentId}` : '';
  return client.get<AssignedWorkout[]>(`/coach/assigned-workouts${params}`);
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

export const getMyAssignedWorkouts = () => client.get<AssignedWorkout[]>('/my-assigned-workouts');
export const updateAssignedWorkoutStatus = (id: number, status: string) =>
  client.put<AssignedWorkout>(`/my-assigned-workouts/${id}/status`, { status });
