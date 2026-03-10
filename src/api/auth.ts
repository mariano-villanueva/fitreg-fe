import client from './client';
import type { AuthResponse, User } from '../types';

export const googleLogin = (credential: string) =>
  client.post<AuthResponse>('/auth/google', { credential });

export const getMe = () => client.get<User>('/me');

export const updateProfile = (data: {
  name: string;
  sex: string;
  birth_date: string;
  weight_kg: number;
  height_cm: number;
  language: string;
  is_coach: boolean;
  onboarding_completed: boolean;
}) => client.put<User>('/me', data);
