import client from './client';
import type { Invitation } from '../types';

export const createInvitation = (data: { type: string; receiver_email?: string; receiver_id?: number; message?: string }) =>
  client.post<Invitation>('/invitations', data);

export const listInvitations = (params?: { status?: string; direction?: string; page?: number; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.direction) query.set('direction', params.direction);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return client.get<Invitation[]>(`/invitations${qs ? `?${qs}` : ''}`);
};

export const getInvitation = (id: number) =>
  client.get<Invitation>(`/invitations/${id}`);

export const respondInvitation = (id: number, action: 'accepted' | 'rejected') =>
  client.put(`/invitations/${id}/respond`, { action });

export const cancelInvitation = (id: number) =>
  client.delete(`/invitations/${id}`);
