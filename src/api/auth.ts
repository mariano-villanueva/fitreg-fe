import client from './client';
import type { AuthResponse, User } from '../types';

export const googleLogin = (credential: string) =>
  client.post<AuthResponse>('/auth/google', { credential });

export const getMe = () => client.get<User>('/me');

export const updateProfile = (data: { name: string; sex: string; age: number; weight_kg: number; language: string; is_coach: boolean }) =>
  client.put<User>('/me', data);
