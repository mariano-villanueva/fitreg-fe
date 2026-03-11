import client from './client';
import type { FileResponse } from '../types';

export const uploadFile = (file: File): Promise<FileResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  return client
    .post<FileResponse>('/files', formData, {
      headers: { 'Content-Type': undefined },
    })
    .then((res) => res.data);
};

export const deleteFile = (uuid: string): Promise<void> =>
  client.delete(`/files/${uuid}`).then(() => undefined);
