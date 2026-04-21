'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image, Video, Upload, X, Lock, Clock, Globe, DollarSign,
  GripVertical, Loader2, Eye, ChevronDown
} from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface UploadedFile {
  file: File;
  preview: string;
  type: 'IMAGE' | 'VIDEO';
  url?: string;
  isUploading?: boolean;
  progress?: number;
}

export default function NewPostPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState('');
  const [isPPV, setIsPPV] = useState(false);
  const [ppvPrice, setPpvPrice] = useState('9.99');
  const [isFree, setIsFree] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'VIDEO' as const : 'IMAGE' as const,
    }));
    setFiles(prev => [...prev, ...newFiles].slice(0, 20));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm'],
    },
    maxFiles: 20,
    maxSize: 500 * 1024 * 1024,
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const uploadFiles = async (): Promise<any[]> => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f.file));

    const { data } = await api.post('/upload/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        const progress = Math.round((e.loaded * 100) / (e.total ?? 1));
        setFiles(prev => prev.map(f => ({ ...f, progress })));
      },
    });
    return data.files;
  };

  const publishMutation = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      let mediaUrls: any[] = [];

      if (files.length > 0) {
        const uploaded = await uploadFiles();
        mediaUrls = uploaded.map(u => ({
          url: u.url,
          type: u.type,
          mimeType: u.mimeType,
          fileSize: u.fileSize,
        }));
      }

      setIsUploading(false);

      const { data } = await api.post('/posts', {
        caption: caption.trim() || undefined,
        isPPV,
        ppvPrice: isPPV ? parseFloat(ppvPrice) : undefined,
        isFree,
        scheduledAt: scheduledAt || undefined,
        mediaUrls,
      });
      return data;
    },
    onSuccess: (post) => {
      toast.success('¡Publicación creada!');
      queryClient.invalidateQueries({ queryKey: ['creator-posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      router.push('/creator/posts');
    },
    onError: (err: any) => {
      setIsUploading(false);
      toast.error(err.response?.data?.error || 'Error al publicar');
    },
  });

  const canPublish = files.length > 0 && (!isPPV || parseFloat(ppvPrice) >= 1);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold font-serif">Nueva publicación</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <Eye className="w-4 h-4" />
            {previewMode ? 'Editar' : 'Vista previa'}
          </button>
          <button
            onClick={() => publishMutation.mutate()}
            disabled={!canPublish || publishMutation.isPending}
            className="btn-primary text-sm"
          >
            {publishMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isUploading ? 'Subiendo...' : 'Publicando...'}
              </span>
            ) : scheduledAt ? 'Programar' : 'Publicar'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Media upload */}
        <div className="card overflow-hidden">
          {files.length === 0 ? (
            <div
              {...getRootProps()}
              className={`p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'bg-pink-500/10' : 'hover:bg-white/5'
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-600/20 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-pink-400" />
              </div>
              <p className="font-semibold mb-1">
                {isDragActive ? '¡Suelta aquí!' : 'Sube fotos y videos'}
              </p>
              <p className="text-sm text-muted">Arrastra o haz clic · Máx. 20 archivos, 500MB cada uno</p>
              <div className="flex justify-center gap-4 mt-4 text-xs text-muted">
                <span className="flex items-center gap-1"><Image className="w-3.5 h-3.5" /> JPG, PNG, WebP, GIF</span>
                <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5" /> MP4, MOV, AVI</span>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{files.length} archivo(s)</p>
                <div {...getRootProps()}>
                  <input {...getInputProps()} />
                  <button className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Agregar más
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative aspect-square rounded-xl overflow-hidden bg-black group"
                  >
                    {f.type === 'IMAGE' ? (
                      <img src={f.preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={f.preview} className="w-full h-full object-cover" />
                    )}

                    {f.type === 'VIDEO' && (
                      <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1 py-0.5">
                        <Video className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {f.progress !== undefined && f.progress < 100 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-6 h-6 animate-spin text-white mx-auto mb-1" />
                          <span className="text-xs text-white">{f.progress}%</span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>

                    {i === 0 && (
                      <div className="absolute top-1 left-1 bg-pink-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        PORTADA
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Caption */}
        <div className="card p-4">
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Escribe una descripción... (opcional)"
            className="w-full bg-transparent text-sm resize-none h-28 focus:outline-none placeholder:text-white/30"
            maxLength={2000}
          />
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="text-xs text-muted">{caption.length}/2000</span>
          </div>
        </div>

        {/* Options */}
        <div className="card p-4 space-y-4">
          <h3 className="font-medium text-sm">Opciones de publicación</h3>

          {/* Visibility */}
          <div className="space-y-2">
            <p className="text-xs text-muted font-medium uppercase tracking-wide">Visibilidad</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'subscribers', label: 'Suscriptoras', icon: Lock, active: !isFree && !isPPV },
                { id: 'free', label: 'Gratis', icon: Globe, active: isFree },
                { id: 'ppv', label: 'PPV', icon: DollarSign, active: isPPV },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setIsFree(opt.id === 'free');
                    setIsPPV(opt.id === 'ppv');
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    opt.active
                      ? 'border-pink-500 bg-pink-500/10 text-pink-400'
                      : 'border-white/10 hover:border-white/20 text-muted'
                  }`}
                >
                  <opt.icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* PPV price */}
          <AnimatePresence>
            {isPPV && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div>
                  <label className="text-xs text-muted mb-1.5 block">Precio de desbloqueo</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                    <input
                      type="number"
                      value={ppvPrice}
                      onChange={e => setPpvPrice(e.target.value)}
                      className="input pl-7"
                      placeholder="9.99"
                      min={1} max={500} step={0.01}
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">Recibirás ${(parseFloat(ppvPrice || '0') * 0.8).toFixed(2)} (80%) por cada compra</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Schedule */}
          <div>
            <p className="text-xs text-muted font-medium uppercase tracking-wide mb-2">Programación</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => setScheduledAt('')}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm transition-all ${
                  !scheduledAt ? 'border-pink-500 bg-pink-500/10 text-pink-400' : 'border-white/10 text-muted hover:border-white/20'
                }`}
              >
                <Globe className="w-4 h-4" />
                Publicar ahora
              </button>
              <button
                onClick={() => {
                  const d = new Date();
                  d.setHours(d.getHours() + 1);
                  setScheduledAt(d.toISOString().slice(0, 16));
                }}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm transition-all ${
                  scheduledAt ? 'border-pink-500 bg-pink-500/10 text-pink-400' : 'border-white/10 text-muted hover:border-white/20'
                }`}
              >
                <Clock className="w-4 h-4" />
                Programar
              </button>
            </div>
            <AnimatePresence>
              {scheduledAt && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    className="input text-sm"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Publish button (bottom) */}
        <button
          onClick={() => publishMutation.mutate()}
          disabled={!canPublish || publishMutation.isPending}
          className="btn-primary w-full py-3 text-base"
        >
          {publishMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {isUploading ? 'Subiendo archivos...' : 'Publicando...'}
            </span>
          ) : scheduledAt ? '📅 Programar publicación' : '🚀 Publicar ahora'}
        </button>
      </div>
    </div>
  );
}
