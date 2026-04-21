'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Image, Video, Music, Filter, Play, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/lib/api';
import Link from 'next/link';

const FILTERS = [
  { id: '', label: 'Todo', icon: Filter },
  { id: 'IMAGE', label: 'Fotos', icon: Image },
  { id: 'VIDEO', label: 'Videos', icon: Video },
  { id: 'AUDIO', label: 'Audio', icon: Music },
];

export default function VaultPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['vault', typeFilter],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ page: String(pageParam) });
      if (typeFilter) params.set('type', typeFilter);
      const { data } = await api.get(`/creators/vault?${params}`);
      return data;
    },
    getNextPageParam: (last) => last.hasMore ? last.page + 1 : undefined,
    initialPageParam: 1,
  });

  const media = data?.pages.flatMap(p => p.media) ?? [];

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif">Mi Vault</h1>
          <p className="text-muted text-sm mt-0.5">Todos tus archivos multimedia</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setSelectionMode(!selectionMode); setSelected(new Set()); }}
            className={`btn-ghost text-sm ${selectionMode ? 'text-pink-400' : ''}`}
          >
            {selectionMode ? `${selected.size} seleccionados` : 'Seleccionar'}
          </button>
          <Link href="/creator/posts/new" className="btn-primary text-sm">
            + Nuevo post
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setTypeFilter(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              typeFilter === f.id
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white'
                : 'bg-white/5 text-muted hover:bg-white/10 border border-white/10'
            }`}
          >
            <f.icon className="w-3.5 h-3.5" />
            {f.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      {data?.pages[0] && (
        <p className="text-xs text-muted">{data.pages[0].total} archivos</p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square rounded-xl" />
          ))}
        </div>
      ) : media.length === 0 ? (
        <div className="text-center py-20">
          <Image className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="font-semibold">Tu vault está vacío</p>
          <p className="text-muted text-sm mt-1">Sube contenido para verlo aquí</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {media.map((item: any) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`relative aspect-square rounded-xl overflow-hidden group cursor-pointer border-2 transition-all ${
                selected.has(item.id) ? 'border-pink-500' : 'border-transparent'
              }`}
              onClick={() => selectionMode ? toggleSelect(item.id) : null}
            >
              {item.type === 'IMAGE' ? (
                <img
                  src={item.url}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : item.type === 'VIDEO' ? (
                <div className="w-full h-full bg-black relative">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                      <Video className="w-8 h-8 text-white/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-purple-500/20 flex items-center justify-center">
                  <Music className="w-8 h-8 text-purple-400" />
                </div>
              )}

              {/* Overlay info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="flex items-center justify-between">
                    {item.post?.isPPV && (
                      <span className="flex items-center gap-1 text-[9px] text-yellow-400 bg-black/60 rounded px-1.5 py-0.5">
                        <Lock className="w-2.5 h-2.5" />
                        ${item.post.ppvPrice}
                      </span>
                    )}
                    <span className="text-[9px] text-white/60 ml-auto">
                      {item.post?.publishedAt ? format(new Date(item.post.publishedAt), 'd MMM', { locale: es }) : 'Borrador'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selection overlay */}
              {selectionMode && (
                <div className={`absolute inset-0 flex items-center justify-center transition-all ${
                  selected.has(item.id) ? 'bg-pink-500/30' : 'bg-black/20'
                }`}>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selected.has(item.id) ? 'bg-pink-500 border-pink-500' : 'border-white bg-black/40'
                  }`}>
                    {selected.has(item.id) && <span className="text-white text-xs">✓</span>}
                  </div>
                </div>
              )}

              {/* Post link */}
              {!selectionMode && item.post?.id && (
                <Link
                  href={`/creator/posts/${item.post.id}`}
                  className="absolute inset-0"
                  onClick={e => e.stopPropagation()}
                />
              )}
            </motion.div>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="text-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="btn-secondary text-sm"
          >
            {isFetchingNextPage ? 'Cargando...' : 'Ver más'}
          </button>
        </div>
      )}
    </div>
  );
}
