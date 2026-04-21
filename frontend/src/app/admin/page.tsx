'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, DollarSign, Shield, FileText, TrendingUp,
  Ban, CheckCircle, XCircle, Eye, Search, ChevronRight,
  BarChart2, AlertTriangle, Clock, LogOut
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'overview', label: 'Resumen', icon: BarChart2 },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'kyc', label: 'KYC', icon: Shield },
  { id: 'withdrawals', label: 'Retiros', icon: DollarSign },
  { id: 'content', label: 'Contenido', icon: FileText },
  { id: 'revenue', label: 'Revenue', icon: TrendingUp },
] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<string>('overview');
  const { user, logout } = useAuthStore();
  const router = useRouter();

  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Acceso denegado</h2>
          <p className="text-muted">No tienes permisos de administrador</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex">
      {/* Sidebar */}
      <aside className="w-60 border-r border-white/5 flex flex-col py-6 px-3 fixed h-full">
        <div className="flex items-center gap-2 px-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-sm">🦶</div>
          <span className="font-bold font-serif">Admin Panel</span>
        </div>

        <nav className="flex-1 space-y-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-pink-500/10 text-pink-400'
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </nav>

        <button
          onClick={async () => { await logout(); router.push('/login'); }}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </aside>

      {/* Content */}
      <main className="pl-60 flex-1 p-6">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {tab === 'overview' && <AdminOverview />}
            {tab === 'users' && <AdminUsers />}
            {tab === 'kyc' && <AdminKYC />}
            {tab === 'withdrawals' && <AdminWithdrawals />}
            {tab === 'content' && <AdminContent />}
            {tab === 'revenue' && <AdminRevenue />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function AdminOverview() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => { const { data } = await api.get('/admin/stats'); return data; },
    refetchInterval: 60000,
  });

  const { data: revenue } = useQuery({
    queryKey: ['admin-revenue', 30],
    queryFn: async () => { const { data } = await api.get('/admin/revenue?days=30'); return data; },
  });

  const cards = [
    { label: 'Total usuarios', value: stats?.users?.total ?? 0, sub: `+${stats?.users?.newThisMonth ?? 0} este mes`, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Creadoras', value: stats?.users?.creators ?? 0, sub: 'Con perfil activo', icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Suscripciones activas', value: stats?.subscriptions?.active ?? 0, sub: `${stats?.subscriptions?.total ?? 0} total`, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Revenue plataforma (30d)', value: `$${(stats?.revenue?.platformLast30Days ?? 0).toFixed(2)}`, sub: 'Comisión 20%', icon: DollarSign, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ];

  const alerts = [
    stats?.pending?.kyc > 0 && { type: 'kyc', msg: `${stats.pending.kyc} KYC pendiente(s) de revisión`, color: 'text-orange-400', icon: Shield },
    stats?.pending?.withdrawals > 0 && { type: 'withdraw', msg: `${stats.pending.withdrawals} retiro(s) pendiente(s)`, color: 'text-yellow-400', icon: DollarSign },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-serif">Panel de Administración</h1>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert: any, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <alert.icon className={`w-4 h-4 ${alert.color}`} />
              <span className="text-sm">{alert.msg}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className={`card p-4 ${card.bg} border-0`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${card.bg}`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className="text-xl font-bold">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</p>
            <p className="text-xs font-medium mt-0.5">{card.label}</p>
            <p className="text-xs text-muted mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {revenue?.chartData && (
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Revenue de la plataforma (30 días)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenue.chartData}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickFormatter={v => format(new Date(v), 'd MMM', { locale: es })} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ background: 'hsl(230,18%,13%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                formatter={(v: any) => [`$${v}`, 'Revenue']} />
              <Area type="monotone" dataKey="amount" stroke="#ec4899" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────

function AdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const { data } = useQuery({
    queryKey: ['admin-users', search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ search, role: roleFilter });
      const { data } = await api.get(`/admin/users?${params}`);
      return data;
    },
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/admin/users/${id}/ban`, { reason }),
    onSuccess: () => { toast.success('Usuario suspendido'); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
  });

  const unbanMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/unban`),
    onSuccess: () => { toast.success('Usuario reactivado'); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/verify`),
    onSuccess: () => { toast.success('Usuario verificado'); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold font-serif">Gestión de usuarios</h1>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por email, username..." className="input pl-9 text-sm" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input w-36 text-sm">
          <option value="">Todos</option>
          <option value="FAN">Fans</option>
          <option value="CREATOR">Creadoras</option>
          <option value="ADMIN">Admins</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left p-3 text-muted font-medium">Usuario</th>
              <th className="text-left p-3 text-muted font-medium">Rol</th>
              <th className="text-left p-3 text-muted font-medium">Estado</th>
              <th className="text-left p-3 text-muted font-medium">Registrado</th>
              <th className="text-left p-3 text-muted font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data?.users?.map((u: any) => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/2">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xs font-bold">
                        {u.displayName?.[0] || u.username[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{u.displayName || u.username}</p>
                      <p className="text-xs text-muted">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <span className={`badge text-xs ${
                    u.role === 'CREATOR' ? 'bg-purple-500/20 text-purple-400' :
                    u.role === 'ADMIN' ? 'bg-red-500/20 text-red-400' :
                    'bg-white/10 text-white/60'
                  }`}>{u.role}</span>
                </td>
                <td className="p-3">
                  {u.isBanned ? (
                    <span className="badge bg-red-500/20 text-red-400 text-xs">Suspendido</span>
                  ) : u.isVerified ? (
                    <span className="badge bg-blue-500/20 text-blue-400 text-xs">Verificado</span>
                  ) : (
                    <span className="badge bg-green-500/20 text-green-400 text-xs">Activo</span>
                  )}
                </td>
                <td className="p-3 text-muted text-xs">
                  {format(new Date(u.createdAt), 'd MMM yyyy', { locale: es })}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    {!u.isVerified && (
                      <button onClick={() => verifyMutation.mutate(u.id)}
                        className="text-xs px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
                        Verificar
                      </button>
                    )}
                    {u.isBanned ? (
                      <button onClick={() => unbanMutation.mutate(u.id)}
                        className="text-xs px-2 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors">
                        Reactivar
                      </button>
                    ) : (
                      <button onClick={() => {
                        const reason = window.prompt('Razón de la suspensión:');
                        if (reason) banMutation.mutate({ id: u.id, reason });
                      }}
                        className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                        Suspender
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── KYC ────────────────────────────────────────────────────────────────────

function AdminKYC() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');

  const { data } = useQuery({
    queryKey: ['admin-kyc', status],
    queryFn: async () => { const { data } = await api.get(`/admin/kyc?status=${status}`); return data; },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/kyc/${id}/approve`),
    onSuccess: () => { toast.success('KYC aprobado'); qc.invalidateQueries({ queryKey: ['admin-kyc'] }); },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.patch(`/admin/kyc/${id}/reject`, { reason }),
    onSuccess: () => { toast.success('KYC rechazado'); qc.invalidateQueries({ queryKey: ['admin-kyc'] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-serif">Verificación KYC</h1>
        <div className="flex gap-2">
          {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                status === s ? 'bg-pink-500/20 text-pink-400' : 'bg-white/5 text-muted hover:bg-white/10'
              }`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {data?.verifications?.length === 0 && (
          <div className="text-center py-10 text-muted">No hay verificaciones {status.toLowerCase()}</div>
        )}
        {data?.verifications?.map((v: any) => (
          <div key={v.id} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {v.user.avatarUrl ? (
                  <img src={v.user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center font-bold text-sm">
                    {v.user.displayName?.[0]}
                  </div>
                )}
                <div>
                  <p className="font-medium">{v.user.displayName || v.user.username}</p>
                  <p className="text-xs text-muted">{v.user.email}</p>
                </div>
              </div>
              <span className="text-xs text-muted">
                {format(new Date(v.submittedAt), 'd MMM yyyy HH:mm', { locale: es })}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {v.user.verificationDocs?.map((doc: any) => (
                <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                  className="card p-2 text-center hover:border-white/20 transition-colors">
                  <Eye className="w-4 h-4 mx-auto mb-1 text-white/50" />
                  <p className="text-xs text-muted capitalize">{doc.docType.replace('_', ' ')}</p>
                </a>
              ))}
            </div>

            {status === 'PENDING' && (
              <div className="flex gap-2 pt-2 border-t border-white/5">
                <button onClick={() => approveMutation.mutate(v.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors text-sm font-medium">
                  <CheckCircle className="w-4 h-4" /> Aprobar
                </button>
                <button onClick={() => {
                  const reason = window.prompt('Razón del rechazo:');
                  if (reason) rejectMutation.mutate({ id: v.id, reason });
                }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium">
                  <XCircle className="w-4 h-4" /> Rechazar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Withdrawals ─────────────────────────────────────────────────────────────

function AdminWithdrawals() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');

  const { data } = useQuery({
    queryKey: ['admin-withdrawals', status],
    queryFn: async () => { const { data } = await api.get(`/admin/withdrawals?status=${status}`); return data; },
  });

  const processMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/withdrawals/${id}/process`),
    onSuccess: () => { toast.success('Retiro procesado'); qc.invalidateQueries({ queryKey: ['admin-withdrawals'] }); },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/admin/withdrawals/${id}/reject`, { reason }),
    onSuccess: () => { toast.success('Retiro rechazado'); qc.invalidateQueries({ queryKey: ['admin-withdrawals'] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-serif">Retiros</h1>
        <div className="flex gap-2">
          {['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                status === s ? 'bg-pink-500/20 text-pink-400' : 'bg-white/5 text-muted hover:bg-white/10'
              }`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {data?.withdrawals?.map((w: any) => (
          <div key={w.id} className="card p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium">{w.user.displayName || w.user.username}</p>
                <span className="text-xs text-muted">@{w.user.username}</span>
              </div>
              <p className="text-xs text-muted">{w.method} · {JSON.stringify(w.accountDetails)}</p>
              <p className="text-xs text-muted">{format(new Date(w.createdAt), 'd MMM yyyy HH:mm', { locale: es })}</p>
            </div>
            <div className="text-right mr-4">
              <p className="text-xl font-bold text-green-400">${Number(w.amount).toFixed(2)}</p>
              <p className="text-xs text-muted">USD</p>
            </div>
            {status === 'PENDING' && (
              <div className="flex gap-2">
                <button onClick={() => processMutation.mutate(w.id)}
                  className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30">
                  Procesar
                </button>
                <button onClick={() => {
                  const reason = window.prompt('Razón del rechazo:');
                  if (reason) rejectMutation.mutate({ id: w.id, reason });
                }}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30">
                  Rechazar
                </button>
              </div>
            )}
          </div>
        ))}
        {data?.withdrawals?.length === 0 && (
          <div className="text-center py-10 text-muted">Sin retiros {status.toLowerCase()}</div>
        )}
      </div>
    </div>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

function AdminContent() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['admin-posts'],
    queryFn: async () => { const { data } = await api.get('/admin/posts'); return data; },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/posts/${id}`, { data: { reason: 'Violación de términos' } }),
    onSuccess: () => { toast.success('Publicación eliminada'); qc.invalidateQueries({ queryKey: ['admin-posts'] }); },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold font-serif">Moderación de contenido</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {data?.posts?.map((post: any) => (
          <div key={post.id} className="card overflow-hidden group">
            {post.media?.[0] ? (
              <div className="aspect-square bg-black relative">
                {post.media[0].type === 'IMAGE' ? (
                  <img src={post.media[0].url} alt="" className="w-full h-full object-cover opacity-80" />
                ) : (
                  <video src={post.media[0].url} className="w-full h-full object-cover opacity-80" />
                )}
                <button
                  onClick={() => { if (window.confirm('¿Eliminar esta publicación?')) deleteMutation.mutate(post.id); }}
                  className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <XCircle className="w-8 h-8 text-white" />
                </button>
              </div>
            ) : (
              <div className="aspect-square bg-white/5 flex items-center justify-center p-4">
                <p className="text-xs text-muted text-center line-clamp-4">{post.caption}</p>
              </div>
            )}
            <div className="p-2">
              <p className="text-xs font-medium">@{post.creator?.username}</p>
              <p className="text-xs text-muted">{post._count?.likes} likes</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Revenue ─────────────────────────────────────────────────────────────────

function AdminRevenue() {
  const [days, setDays] = useState(30);
  const { data } = useQuery({
    queryKey: ['admin-revenue-detail', days],
    queryFn: async () => { const { data } = await api.get(`/admin/revenue?days=${days}`); return data; },
  });

  const COLORS = ['#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6'];
  const pieData = data?.byType ? Object.entries(data.byType).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-serif">Revenue & Analytics</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                days === d ? 'bg-pink-500/20 text-pink-400' : 'bg-white/5 text-muted hover:bg-white/10'
              }`}>{d}d</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Revenue total: <span className="text-green-400">${data?.totalRevenue?.toFixed(2) ?? 0}</span></h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.chartData ?? []}>
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickFormatter={v => format(new Date(v), 'd MMM', { locale: es })} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ background: 'hsl(230,18%,13%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                formatter={(v: any) => [`$${v}`, 'Revenue']} />
              <Bar dataKey="amount" fill="rgba(236,72,153,0.6)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4">Revenue por tipo</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} contentStyle={{ background: 'hsl(230,18%,13%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted text-sm">Sin datos</div>
          )}
        </div>
      </div>
    </div>
  );
}
