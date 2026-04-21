'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);

    try {
      const { data } = await api.post('/auth/login', {
        email,
        password,
        twoFactorCode: twoFactorCode || undefined,
      });

      if (data.requiresTwoFactor) {
        setRequires2FA(true);
        setIsLoading(false);
        return;
      }

      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`¡Bienvenida, ${data.user.displayName}! 👋`);
      router.push('/feed');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-pink-500/8 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 justify-center mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-2xl shadow-lg shadow-pink-500/30">
              🦶
            </div>
          </Link>
          <h1 className="text-2xl font-bold font-serif">Bienvenida de nuevo</h1>
          <p className="text-muted text-sm mt-1">Inicia sesión en tu cuenta</p>
        </div>

        <div className="card p-6 space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            {!requires2FA ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input"
                    placeholder="tu@email.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="input pr-11"
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Link href="/forgot-password" className="text-xs text-pink-400 hover:text-pink-300">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              </>
            ) : (
              <div>
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <p className="text-sm text-blue-300">Ingresa el código de tu app autenticadora</p>
                </div>
                <label className="block text-sm font-medium mb-1.5">Código 2FA</label>
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Iniciando sesión...
                </span>
              ) : requires2FA ? 'Verificar' : 'Iniciar sesión'}
            </button>

            {requires2FA && (
              <button type="button" onClick={() => setRequires2FA(false)} className="w-full text-sm text-muted hover:text-white transition-colors">
                ← Volver
              </button>
            )}
          </form>

          {!requires2FA && (
            <p className="text-center text-sm text-muted">
              ¿No tienes cuenta?{' '}
              <Link href="/register" className="text-pink-400 hover:text-pink-300 font-medium">
                Regístrate gratis
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
