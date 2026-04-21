'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TrendingUp, Users, DollarSign, Heart, Eye, MessageSquare,
  Image, Video, ChevronRight, Star, Gift, ArrowUpRight
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import Link from 'next/link';

export default function CreatorDashboardPage() {
  const { user } = useAuthStore();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['creator-stats'],
    queryFn: async () => {
      const { data } = await api.get('/creators/stats');
      return data;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['creator-activity'],
    queryFn: async () => {
      const { data } = await api.get('/creators/activity?limit=10');
      return data;
    },
  });

  const { data: earningsChart } = useQuery({
    queryKey: ['creator-earnings-chart'],
    queryFn: async () => {
      const { data } = await api.get('/creators/earnings/chart?period=30d');
      return data;
    },
  });

  const statCards = [
    {
      label: 'Suscriptores',
      value: stats?.subscriberCount ?? 0,
      change: stats?.subscriberGrowth ?? 0,
      icon: Users,
      color: 'from-blue-500/20 to-blue-600/20',
      iconColor: 'text-blue-400',
    },
    {
      label: 'Ganancias del mes',
      value: `$${(stats?.monthlyEarnings ?? 0).toFixed(2)}`,
      change: stats?.earningsGrowth ?? 0,
      icon: DollarSign,
      color: 'from-green-500/20 to-green-600/20',
      iconColor: 'text-green-400',
    },
    {
      label: 'Total me gusta',
      value: stats?.totalLikes ?? 0,
      change: stats?.likesGrowth ?? 0,
      icon: Heart,
      color: 'from-pink-500/20 to-rose-600/20',
      iconColor: 'text-pink-400',
    },
    {
      label: 'Vistas totales',
      value: stats?.totalViews ?? 0,
      change: stats?.viewsGrowth ?? 0,
      icon: Eye,
      color: 'from-purple-500/20 to-purple-600/20',
      iconColor: 'text-purple-400',
    },
  ];

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel de Creador</h1>
          <p className="text-muted text-sm mt-1">
            Bienvenida, {user?.displayName} 👋
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/creator/posts/new" className="btn-primary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nueva publicación
          </Link>
        </div>
      </div>

      {/* Balance card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500/20 via-rose-600/15 to-purple-500/20 border border-pink-500/20 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-pink-500/5 blur-3xl" />
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-white/60 mb-1">Balance disponible</p>
            <p className="text-3xl font-bold text-gradient">
              ${(stats?.availableBalance ?? 0).toFixed(2)}
            </p>
            <p className="text-xs text-white/40 mt-1">Listo para retirar</p>
          </div>
          <div>
            <p className="text-sm text-white/60 mb-1">Balance pendiente</p>
            <p className="text-2xl font-semibold">
              ${(stats?.pendingBalance ?? 0).toFixed(2)}
            </p>
            <p className="text-xs text-white/40 mt-1">En procesamiento (7 días)</p>
          </div>
          <div>
            <p className="text-sm text-white/60 mb-1">Total ganado</p>
            <p className="text-2xl font-semibold">
              ${(stats?.totalEarned ?? 0).toFixed(2)}
            </p>
            <p className="text-xs text-white/40 mt-1">Desde que empezaste</p>
          </div>
        </div>
        <div className="relative mt-4 flex gap-3">
          <Link href="/creator/earnings" className="btn-primary text-sm py-2">
            Retirar fondos
          </Link>
          <Link href="/creator/earnings" className="btn-secondary text-sm py-2">
            Ver historial
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`card p-4 bg-gradient-to-br ${stat.color} border-0`}
          >
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              {stat.change !== 0 && (
                <span className={`text-xs font-medium flex items-center gap-0.5 ${
                  stat.change > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  <ArrowUpRight className={`w-3 h-3 ${stat.change < 0 ? 'rotate-180' : ''}`} />
                  {Math.abs(stat.change)}%
                </span>
              )}
            </div>
            <p className="text-xl font-bold">{stat.value.toLocaleString()}</p>
            <p className="text-xs text-white/50 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Ganancias (30 días)</h3>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={earningsChart?.data || []}>
              <defs>
                <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickFormatter={(v) => format(new Date(v), 'd MMM', { locale: es })}
                axisLine={false} tickLine={false}
              />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ background: 'hsl(230, 18%, 13%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                formatter={(v: any) => [`$${v}`, 'Ganancias']}
              />
              <Area type="monotone" dataKey="amount" stroke="#ec4899" strokeWidth={2} fill="url(#earningsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Subscribers chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Nuevos suscriptores (30 días)</h3>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={earningsChart?.subscribers || []}>
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickFormatter={(v) => format(new Date(v), 'd MMM', { locale: es })}
                axisLine={false} tickLine={false}
              />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(230, 18%, 13%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                formatter={(v: any) => [v, 'Nuevos subs']}
              />
              <Bar dataKey="count" fill="rgba(96,165,250,0.6)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Gestionar posts', href: '/creator/posts', icon: Image, desc: `${stats?.totalPosts ?? 0} publicaciones` },
          { label: 'Mis suscriptores', href: '/creator/subscribers', icon: Users, desc: `${stats?.subscriberCount ?? 0} activos` },
          { label: 'Mensajes', href: '/messages', icon: MessageSquare, desc: 'Mass DM disponible' },
          { label: 'Promociones', href: '/creator/promotions', icon: Star, desc: 'Descuentos y bundles' },
        ].map(action => (
          <Link key={action.href} href={action.href}
            className="card p-4 hover:bg-white/5 transition-colors group flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <action.icon className="w-5 h-5 text-pink-400" />
              <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
            <div>
              <p className="font-medium text-sm">{action.label}</p>
              <p className="text-xs text-muted mt-0.5">{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      {recentActivity?.activities?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Actividad reciente</h3>
          <div className="space-y-3">
            {recentActivity.activities.map((activity: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  activity.type === 'NEW_SUBSCRIBER' ? 'bg-blue-500/20' :
                  activity.type === 'NEW_TIP' ? 'bg-yellow-500/20' :
                  activity.type === 'PPV_UNLOCK' ? 'bg-green-500/20' :
                  'bg-pink-500/20'
                }`}>
                  {activity.type === 'NEW_SUBSCRIBER' ? <Users className="w-4 h-4 text-blue-400" /> :
                   activity.type === 'NEW_TIP' ? <Gift className="w-4 h-4 text-yellow-400" /> :
                   activity.type === 'PPV_UNLOCK' ? <DollarSign className="w-4 h-4 text-green-400" /> :
                   <Heart className="w-4 h-4 text-pink-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <p className="text-xs text-muted">{activity.body}</p>
                </div>
                <span className="text-xs text-muted whitespace-nowrap">
                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: es })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
