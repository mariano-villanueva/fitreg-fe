import client from "./client";
import type { Workout, WorkoutSegment } from "../types";

export async function listWorkouts(): Promise<Workout[]> {
  const response = await client.get<Workout[]>("/workouts");
  return response.data || [];
}

export async function getWorkout(id: number): Promise<Workout> {
  const response = await client.get<Workout>(`/workouts/${id}`);
  return response.data;
}

export async function createWorkout(
  data: Omit<Workout, "id" | "user_id" | "assigned_workout_id" | "created_at" | "updated_at"> & { segments: WorkoutSegment[] }
): Promise<Workout> {
  const response = await client.post<Workout>("/workouts", data);
  return response.data;
}

export async function updateWorkout(
  id: number,
  data: Partial<Omit<Workout, "id" | "user_id" | "assigned_workout_id" | "created_at" | "updated_at">> & { segments: WorkoutSegment[] }
): Promise<Workout> {
  const response = await client.put<Workout>(`/workouts/${id}`, data);
  return response.data;
}

export async function deleteWorkout(id: number): Promise<void> {
  await client.delete(`/workouts/${id}`);
}
