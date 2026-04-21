'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Heart, Users, DollarSign, MessageSquare, Lock, Bell, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/lib/api';
import Link from 'next/link';

const NOTIF_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  NEW_SUBSCRIBER: { icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  NEW_TIP: { icon: DollarSign, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  NEW_COMMENT: { icon: MessageSquare, color: 'text-green-400', bg: 'bg-green-500/20' },
  NEW_LIKE: { icon: Heart, color: 'text-pink-400', bg: 'bg-pink-500/20' },
  NEW_MESSAGE: { icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  PPV_UNLOCK: { icon: Lock, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  WITHDRAWAL_APPROVED: { icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/20' },
  LIVE_STARTED: { icon: Bell, color: 'text-red-400', bg: 'bg-red-500/20' },
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get(`/notifications?page=${pageParam}&limit=20`);
      return data;
    },
    getNextPageParam: (last) => last.hasMore ? last.page + 1 : undefined,
    initialPageParam: 1,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.pages.flatMap(p => p.notifications) ?? [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getNotifLink = (notif: any) => {
    const d = notif.data || {};
    if (notif.type === 'NEW_MESSAGE') return '/messages';
    if (notif.type === 'NEW_SUBSCRIBER' && d.subscriberId) return `/creator/subscribers`;
    if (d.postId) return `/post/${d.postId}`;
    return '#';
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-serif">Notificaciones</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-muted mt-0.5">{unreadCount} sin leer</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="flex items-center gap-1.5 text-sm text-pink-400 hover:text-pink-300 transition-colors"
          >
            <Check className="w-4 h-4" />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-white/20" />
          </div>
          <p className="font-semibold">Sin notificaciones</p>
          <p className="text-muted text-sm mt-1">Aquí aparecerán tus notificaciones</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif: any, i: number) => {
            const config = NOTIF_ICONS[notif.type] || NOTIF_ICONS.NEW_LIKE;
            const Icon = config.icon;

            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  href={getNotifLink(notif)}
                  onClick={() => !notif.isRead && markReadMutation.mutate(notif.id)}
                  className={`flex items-start gap-3 p-4 rounded-2xl transition-colors hover:bg-white/5 ${
                    !notif.isRead ? 'bg-pink-500/5 border border-pink-500/10' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notif.isRead ? 'text-white/70' : 'text-white font-medium'}`}>
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-xs text-muted mt-0.5 truncate">{notif.body}</p>
                    )}
                    <p className="text-xs text-muted mt-1">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <div className="w-2 h-2 rounded-full bg-pink-500 flex-shrink-0 mt-1.5" />
                  )}
                </Link>
              </motion.div>
            );
          })}

          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full py-3 text-sm text-muted hover:text-white transition-colors"
            >
              {isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
