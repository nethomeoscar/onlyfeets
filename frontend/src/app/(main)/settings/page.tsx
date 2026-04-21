'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, CreditCard, Shield, Bell, Eye, LogOut, Upload,
  DollarSign, ChevronRight, Camera, Trash2, Plus, Loader2
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'payments', label: 'Pagos', icon: CreditCard },
  { id: 'security', label: 'Seguridad', icon: Shield },
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
  { id: 'privacy', label: 'Privacidad', icon: Eye },
] as const;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string>('profile');
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold font-serif mb-6">Configuración</h1>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar */}
        <div className="space-y-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}

          <div className="pt-4 border-t border-white/5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'profile' && <ProfileSettings />}
            {activeTab === 'payments' && <PaymentSettings />}
            {activeTab === 'security' && <SecuritySettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'privacy' && <PrivacySettings />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProfileSettings() {
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: {
      displayName: user?.displayName || '',
      bio: '',
      website: '',
      location: '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/users/profile', data);
      return res.data;
    },
    onSuccess: (data) => {
      updateUser(data);
      toast.success('Perfil actualizado');
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: () => toast.error('Error al actualizar perfil'),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const { data } = await api.post('/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await api.put('/users/profile', { avatarUrl: data.url });
      updateUser({ avatarUrl: data.url });
      toast.success('Avatar actualizado');
    } catch {
      toast.error('Error al subir imagen');
    }
  };

  return (
    <div className="card p-6 space-y-6">
      <h2 className="font-semibold">Información del perfil</h2>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-2xl font-bold text-white">
              {user?.displayName?.[0]}
            </div>
          )}
          <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
            <Camera className="w-6 h-6 text-white" />
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
        </div>
        <div>
          <label className="btn-secondary text-sm py-2 px-4 cursor-pointer">
            <Upload className="w-4 h-4 inline mr-2" />
            Cambiar avatar
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
          <p className="text-xs text-muted mt-1">JPG, PNG o WebP. Máx. 10MB</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(d => updateMutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nombre</label>
            <input {...register('displayName')} className="input" placeholder="Tu nombre" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Ubicación</label>
            <input {...register('location')} className="input" placeholder="Ciudad, País" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Sitio web</label>
          <input {...register('website')} className="input" placeholder="https://..." type="url" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Biografía</label>
          <textarea
            {...register('bio')}
            className="input resize-none h-24"
            placeholder="Cuéntanos sobre ti..."
            maxLength={500}
          />
        </div>

        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="btn-primary"
        >
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}

function PaymentSettings() {
  const { data: methods, refetch } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data } = await api.get('/payments/methods');
      return data;
    },
  });

  const { data: balance } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const { data } = await api.get('/payments/balance');
      return data;
    },
  });

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('PAYPAL');
  const [accountDetails, setAccountDetails] = useState('');

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/payments/withdraw', {
        amount: parseFloat(withdrawAmount),
        method: withdrawMethod,
        accountDetails: { account: accountDetails },
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Solicitud de retiro enviada');
      setWithdrawAmount('');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al retirar'),
  });

  const deleteMethodMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payments/methods/${id}`),
    onSuccess: () => {
      refetch();
      toast.success('Método eliminado');
    },
  });

  return (
    <div className="space-y-6">
      {/* Balance */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">Mi billetera</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Disponible', value: balance?.availableBalance, color: 'text-green-400' },
            { label: 'Pendiente', value: balance?.pendingBalance, color: 'text-yellow-400' },
            { label: 'Total ganado', value: balance?.totalEarned, color: 'text-white' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className={`text-xl font-bold ${item.color}`}>${Number(item.value ?? 0).toFixed(2)}</p>
              <p className="text-xs text-muted mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-4 border-t border-white/5">
          <p className="text-sm font-medium">Solicitar retiro</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Monto ($)</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                className="input text-sm"
                placeholder="20.00"
                min={20}
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Método</label>
              <select
                value={withdrawMethod}
                onChange={e => setWithdrawMethod(e.target.value)}
                className="input text-sm"
              >
                <option value="PAYPAL">PayPal</option>
                <option value="BANK_TRANSFER">Transferencia bancaria</option>
                <option value="CRYPTO_USDT">USDT (Crypto)</option>
                <option value="CRYPTO_BTC">Bitcoin</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">
              {withdrawMethod === 'PAYPAL' ? 'Email de PayPal' :
               withdrawMethod === 'BANK_TRANSFER' ? 'CLABE / IBAN' :
               'Dirección de wallet'}
            </label>
            <input
              type="text"
              value={accountDetails}
              onChange={e => setAccountDetails(e.target.value)}
              className="input text-sm"
              placeholder={withdrawMethod === 'PAYPAL' ? 'correo@paypal.com' : ''}
            />
          </div>
          <button
            onClick={() => withdrawMutation.mutate()}
            disabled={withdrawMutation.isPending || !withdrawAmount || !accountDetails}
            className="btn-primary text-sm"
          >
            {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Solicitar retiro'}
          </button>
        </div>
      </div>

      {/* Saved cards */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">Métodos de pago</h2>
        {methods?.methods?.length === 0 ? (
          <p className="text-muted text-sm">No tienes métodos de pago guardados</p>
        ) : (
          <div className="space-y-2">
            {methods?.methods?.map((method: any) => (
              <div key={method.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-white/50" />
                  <div>
                    <p className="text-sm capitalize">{method.brand} •••• {method.last4}</p>
                    <p className="text-xs text-muted">Vence {method.expMonth}/{method.expYear}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteMethodMutation.mutate(method.id)}
                  className="p-1.5 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error('Las contraseñas no coinciden');
      await api.put('/users/password', { currentPassword, newPassword });
    },
    onSuccess: () => {
      toast.success('Contraseña actualizada');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    },
    onError: (err: any) => toast.error(err.message || err.response?.data?.error || 'Error'),
  });

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Cambiar contraseña</h2>
        <input
          type="password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          className="input"
          placeholder="Contraseña actual"
        />
        <input
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="input"
          placeholder="Nueva contraseña"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          className="input"
          placeholder="Confirmar nueva contraseña"
        />
        <button
          onClick={() => changePasswordMutation.mutate()}
          disabled={changePasswordMutation.isPending}
          className="btn-primary text-sm"
        >
          Actualizar contraseña
        </button>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-1">Autenticación de dos factores</h2>
        <p className="text-sm text-muted mb-4">Agrega una capa extra de seguridad a tu cuenta</p>
        <a href="/settings/2fa" className="btn-secondary text-sm flex items-center gap-2 w-fit">
          <Shield className="w-4 h-4" />
          Configurar 2FA
          <ChevronRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const [prefs, setPrefs] = useState({
    emailNewSubscriber: true,
    emailNewTip: true,
    emailNewMessage: false,
    pushNewSubscriber: true,
    pushNewTip: true,
    pushNewMessage: true,
    pushNewComment: true,
    pushNewLike: false,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put('/users/notification-preferences', prefs);
    },
    onSuccess: () => toast.success('Preferencias guardadas'),
  });

  const Toggle = ({ id }: { id: keyof typeof prefs }) => (
    <button
      onClick={() => setPrefs(p => ({ ...p, [id]: !p[id] }))}
      className={`relative w-11 h-6 rounded-full transition-colors ${prefs[id] ? 'bg-pink-500' : 'bg-white/20'}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs[id] ? 'left-6' : 'left-1'}`} />
    </button>
  );

  const sections = [
    { title: 'Email', items: [
      { id: 'emailNewSubscriber', label: 'Nuevo suscriptor' },
      { id: 'emailNewTip', label: 'Nueva propina' },
      { id: 'emailNewMessage', label: 'Nuevo mensaje' },
    ]},
    { title: 'Push', items: [
      { id: 'pushNewSubscriber', label: 'Nuevo suscriptor' },
      { id: 'pushNewTip', label: 'Nueva propina' },
      { id: 'pushNewMessage', label: 'Nuevo mensaje' },
      { id: 'pushNewComment', label: 'Nuevo comentario' },
      { id: 'pushNewLike', label: 'Nuevo me gusta' },
    ]},
  ];

  return (
    <div className="space-y-4">
      {sections.map(section => (
        <div key={section.title} className="card p-5">
          <h2 className="font-semibold mb-4">Notificaciones por {section.title}</h2>
          <div className="space-y-4">
            {section.items.map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-sm">{item.label}</span>
                <Toggle id={item.id as keyof typeof prefs} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => saveMutation.mutate()} className="btn-primary text-sm">
        Guardar preferencias
      </button>
    </div>
  );
}

function PrivacySettings() {
  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-semibold">Privacidad</h2>
      {[
        { label: 'Perfil público', desc: 'Cualquiera puede encontrar tu perfil', key: 'isPublic' },
        { label: 'Mostrar conteo de suscriptores', desc: 'Visible en tu perfil', key: 'showSubscriberCount' },
        { label: 'Mostrar conteo de publicaciones', desc: 'Visible en tu perfil', key: 'showPostCount' },
        { label: 'Mensajes de desconocidos', desc: 'Recibir DMs de no suscriptores', key: 'allowDmsFromAll' },
      ].map(item => (
        <div key={item.key} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
          <div>
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted">{item.desc}</p>
          </div>
          <button className="relative w-11 h-6 rounded-full bg-pink-500">
            <div className="absolute top-1 left-6 w-4 h-4 rounded-full bg-white transition-transform" />
          </button>
        </div>
      ))}
      <div className="pt-4 border-t border-white/5">
        <button className="text-sm text-red-400 hover:text-red-300 transition-colors">
          Eliminar cuenta permanentemente
        </button>
      </div>
    </div>
  );
}
