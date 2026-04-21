// hooks/useMediaUpload.ts
import { useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface UploadedFile {
  url: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO';
  mimeType: string;
  fileSize: number;
  key: string;
}

export function useMediaUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFiles = async (files: File[]): Promise<UploadedFile[]> => {
    setIsUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));

      const { data } = await api.post('/upload/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded * 100) / (e.total ?? 1));
          setProgress(pct);
        },
      });

      return data.files;
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al subir archivo');
      throw err;
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await api.post('/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    } finally {
      setIsUploading(false);
    }
  };

  const uploadCover = async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('cover', file);
      const { data } = await api.post('/upload/cover', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFiles, uploadAvatar, uploadCover, isUploading, progress };
}
