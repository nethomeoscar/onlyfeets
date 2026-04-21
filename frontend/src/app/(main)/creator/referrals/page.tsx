'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Copy, Users, DollarSign, Link2, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ReferralsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['referrals'],
    queryFn: async () => {
      const { data } = await api.get('/creators/referral');
      return data;
    },
  });

  const copyLink = async () => {
    await navigator.clipboard.writeText(data?.referralUrl || '');
    toast.success('Enlace copiado 🔗');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold font-serif">Programa de referidos</h1>
        <p className="text-muted text-sm mt-1">Gana comisiones invitando nuevas creadoras</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Referidas', value: data?.totalReferrals ?? 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Comisión total', value: `$${(data?.totalCommission ?? 0).toFixed(2)}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Tasa', value: `${data?.commissionRate ?? 5}%`, icon: TrendingUp, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        ].map(stat => (
          <div key={stat.label} className={`card p-4 ${stat.bg} border-0`}>
            <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-pink-400" />
          <h3 className="font-semibold text-sm">Tu enlace de referido</h3>
        </div>
        <p className="text-xs text-muted">Cuando alguien se registre como creadora usando tu enlace, ganarás el {data?.commissionRate ?? 5}% de sus ganancias durante 12 meses.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 truncate font-mono text-xs">
            {data?.referralUrl || 'Cargando...'}
          </div>
          <button onClick={copyLink} className="btn-primary text-sm py-2.5 px-4 flex items-center gap-1.5">
            <Copy className="w-4 h-4" />
            Copiar
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="card p-5">
        <h3 className="font-semibold text-sm mb-4">¿Cómo funciona?</h3>
        <div className="space-y-3">
          {[
            { step: '1', text: 'Comparte tu enlace de referido con otras creadoras' },
            { step: '2', text: 'Cuando se registren y comiencen a ganar, tú ganas el 5% de sus ingresos' },
            { step: '3', text: 'La comisión se acredita automáticamente en tu billetera' },
            { step: '4', text: 'Sin límite de referidos ni cap de ganancias' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5">
                {item.step}
              </div>
              <p className="text-sm text-white/70">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral list */}
      {data?.referrals?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-4">Mis referidas ({data.totalReferrals})</h3>
          <div className="space-y-3">
            {data.referrals.map((ref: any) => (
              <motion.div
                key={ref.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
              >
                {ref.referred.avatarUrl ? (
                  <img src={ref.referred.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xs font-bold">
                    {ref.referred.displayName?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{ref.referred.displayName || ref.referred.username}</p>
                  <p className="text-xs text-muted">
                    @{ref.referred.username} · {ref.referred.role === 'CREATOR' ? 'Creadora' : 'Fan'} ·{' '}
                    {format(new Date(ref.createdAt), 'd MMM yyyy', { locale: es })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-400">${Number(ref.totalEarned).toFixed(2)}</p>
                  <p className="text-xs text-muted">ganado</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
