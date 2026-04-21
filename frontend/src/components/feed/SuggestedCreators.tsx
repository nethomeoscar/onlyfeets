// SuggestedCreators.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { api } from '@/lib/api';

export function SuggestedCreators() {
  const { data } = useQuery({
    queryKey: ['suggested-creators'],
    queryFn: async () => {
      const { data } = await api.get('/search/creators?category=trending&limit=5');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const creators = data?.creators?.slice(0, 5) ?? [];

  if (creators.length === 0) return null;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-pink-400" />
        <h3 className="text-sm font-semibold">Sugeridas para ti</h3>
      </div>
      <div className="space-y-3">
        {creators.map((creator: any) => (
          <div key={creator.id} className="flex items-center gap-3">
            <Link href={`/${creator.username}`}>
              {creator.avatarUrl ? (
                <img src={creator.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-pink-500/20 hover:ring-pink-500/50 transition-all" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-sm font-bold text-white">
                  {creator.displayName?.[0]}
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/${creator.username}`} className="block text-sm font-medium hover:text-pink-400 transition-colors truncate">
                {creator.displayName}
              </Link>
              <p className="text-xs text-muted">{creator.creatorProfile?.subscriberCount ?? 0} suscriptoras</p>
            </div>
            <Link
              href={`/${creator.username}`}
              className="text-xs text-pink-400 hover:text-pink-300 font-medium whitespace-nowrap"
            >
              Ver →
            </Link>
          </div>
        ))}
      </div>
      <Link href="/explore" className="block text-center text-xs text-muted hover:text-white transition-colors mt-4 pt-3 border-t border-white/5">
        Ver todas las creadoras →
      </Link>
    </div>
  );
}
