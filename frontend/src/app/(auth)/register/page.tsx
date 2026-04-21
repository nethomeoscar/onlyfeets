'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, User, Star, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'role' | 'form'>('role');
  const [role, setRole] = useState<'FAN' | 'CREATOR'>('FAN');
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const referralCode = searchParams.get('ref');

  const passwordStrength = (() => {
    const p = form.password;
    if (p.length === 0) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  })();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (!agreedToTerms) {
      toast.error('Debes aceptar los términos de servicio');
      return;
    }
    setIsLoading(true);

    try {
      const { data } = await api.post('/auth/register', {
        email: form.email,
        username: form.username,
        password: form.password,
        role,
        referralCode: referralCode || undefined,
      });

      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success('¡Cuenta creada! Revisa tu email para verificarla 🎉');
      router.push(role === 'CREATOR' ? '/creator/dashboard' : '/feed');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al crear la cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-pink-500/8 blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 justify-center mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-2xl shadow-lg shadow-pink-500/30">🦶</div>
          </Link>
          <h1 className="text-2xl font-bold font-serif">Crear cuenta</h1>
          <p className="text-muted text-sm mt-1">Únete a OnlyFeets hoy</p>
          {referralCode && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
              🎁 Invitada por @{referralCode}
            </div>
          )}
        </div>

        {step === 'role' ? (
          <div className="card p-6 space-y-4">
            <p className="text-sm font-medium text-center">¿Cómo quieres usar OnlyFeets?</p>
            <div className="space-y-3">
              {[
                { r: 'FAN' as const, icon: User, title: 'Soy fan', desc: 'Accede a contenido exclusivo de tus creadoras favoritas', features: ['Feed personalizado', 'Mensajes directos', 'Suscripciones flexibles'] },
                { r: 'CREATOR' as const, icon: Star, title: 'Soy creadora', desc: 'Comparte contenido y gana dinero con tus seguidoras', features: ['Sube fotos y videos', 'Gana con suscripciones y PPV', 'Panel de estadísticas'] },
              ].map(opt => (
                <button
                  key={opt.r}
                  onClick={() => { setRole(opt.r); setStep('form'); }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.01] ${
                    role === opt.r ? 'border-pink-500 bg-pink-500/10' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-600/20 flex items-center justify-center">
                      <opt.icon className="w-5 h-5 text-pink-400" />
                    </div>
                    <div>
                      <p className="font-semibold">{opt.title}</p>
                      <p className="text-xs text-muted">{opt.desc}</p>
                    </div>
                  </div>
                  <div className="space-y-1 mt-2">
                    {opt.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs text-white/60">
                        <Check className="w-3 h-3 text-green-400" />
                        {f}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-6">
            <button onClick={() => setStep('role')} className="text-xs text-muted hover:text-white mb-4 flex items-center gap-1">
              ← Cambiar tipo de cuenta
            </button>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="input" placeholder="tu@email.com" required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Nombre de usuario</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-sm">@</span>
                  <input type="text" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                    className="input pl-7" placeholder="tunombre" required minLength={3} maxLength={30} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Contraseña</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    className="input pr-11" placeholder="Mínimo 8 caracteres" required minLength={8} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-1.5 flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${
                        i <= passwordStrength
                          ? passwordStrength <= 1 ? 'bg-red-500' : passwordStrength <= 2 ? 'bg-yellow-500' : 'bg-green-500'
                          : 'bg-white/10'
                      }`} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Confirmar contraseña</label>
                <input type="password" value={form.confirmPassword}
                  onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  className={`input ${form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-500/50' : ''}`}
                  placeholder="Repite tu contraseña" required />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 accent-pink-500" />
                <span className="text-xs text-muted">
                  Acepto los <Link href="/terms" className="text-pink-400 hover:underline">Términos de servicio</Link> y la{' '}
                  <Link href="/privacy" className="text-pink-400 hover:underline">Política de privacidad</Link>.
                  Confirmo tener 18 años o más.
                </span>
              </label>

              <button type="submit" disabled={isLoading || !agreedToTerms} className="btn-primary w-full py-3">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando cuenta...
                  </span>
                ) : `Crear cuenta ${role === 'CREATOR' ? 'de creadora' : 'de fan'}`}
              </button>
            </form>

            <p className="text-center text-sm text-muted mt-4">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-pink-400 hover:text-pink-300 font-medium">Iniciar sesión</Link>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
