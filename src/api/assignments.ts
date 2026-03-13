import client from "./client";
import type { AssignedWorkout, AssignmentMessage } from "../types";

export const getAssignedWorkoutDetail = (id: number) =>
  client.get<AssignedWorkout>(`/assigned-workout-detail/${id}`);

export const listAssignmentMessages = (assignedWorkoutId: number) =>
  client.get<AssignmentMessage[]>(`/assignment-messages/${assignedWorkoutId}`);

export const sendAssignmentMessage = (assignedWorkoutId: number, body: string) =>
  client.post<AssignmentMessage>(`/assignment-messages/${assignedWorkoutId}`, { body });

export const markAssignmentMessagesRead = (assignedWorkoutId: number) =>
  client.put(`/assignment-messages/${assignedWorkoutId}/read`);
