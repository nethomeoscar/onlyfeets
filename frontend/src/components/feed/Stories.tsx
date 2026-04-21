'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function Stories() {
  const { user } = useAuthStore();

  const { data } = useQuery({
    queryKey: ['active-livestreams'],
    queryFn: async () => {
      const { data } = await api.get('/live/active');
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: recentCreators } = useQuery({
    queryKey: ['recent-subscribed-creators'],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/mine');
      return data;
    },
  });

  const liveStreams = data?.streams ?? [];
  const subscriptions = recentCreators?.subscriptions?.slice(0, 8) ?? [];

  if (liveStreams.length === 0 && subscriptions.length === 0) return null;

  return (
    <div className="card p-3">
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {/* Live streams first */}
        {liveStreams.map((stream: any) => (
          <Link
            key={stream.id}
            href={`/live/${stream.id}`}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-red-500 via-pink-500 to-orange-400 ring-2 ring-red-500/30">
                {stream.creator.avatarUrl ? (
                  <img src={stream.creator.avatarUrl} alt="" className="w-full h-full rounded-full object-cover border-2 border-[hsl(230,18%,13%)]" />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold border-2 border-[hsl(230,18%,13%)]">
                    {stream.creator.displayName[0]}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                LIVE
              </div>
            </div>
            <span className="text-[11px] text-white/80 max-w-[64px] truncate text-center group-hover:text-white transition-colors">
              {stream.creator.displayName}
            </span>
          </Link>
        ))}

        {/* Subscribed creators */}
        {subscriptions.map((sub: any) => (
          <Link
            key={sub.creatorId}
            href={`/${sub.creator.username}`}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
          >
            <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-500">
              {sub.creator.avatarUrl ? (
                <img src={sub.creator.avatarUrl} alt="" className="w-full h-full rounded-full object-cover border-2 border-[hsl(230,18%,13%)]" />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold border-2 border-[hsl(230,18%,13%)]">
                  {sub.creator.displayName?.[0]}
                </div>
              )}
            </div>
            <span className="text-[11px] text-white/60 max-w-[64px] truncate text-center group-hover:text-white transition-colors">
              {sub.creator.displayName}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
