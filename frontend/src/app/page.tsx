'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Star, Shield, DollarSign, MessageSquare, Lock, TrendingUp, Heart, Users } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-white/5 bg-[hsl(230,25%,7%)]/80 backdrop-blur-md flex items-center px-6 justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-sm">🦶</div>
          <span className="font-bold font-serif text-lg">Only<span className="text-gradient">Feets</span></span>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="btn-ghost text-sm py-2 px-4">Iniciar sesión</Link>
          <Link href="/register" className="btn-primary text-sm py-2 px-4">Comenzar gratis</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 text-center">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-pink-500/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-purple-500/8 blur-3xl" />
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="relative">
          <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 rounded-full px-4 py-2 text-sm text-pink-300 mb-6">
            ✨ La plataforma de contenido exclusivo #1
          </div>
          <h1 className="text-5xl md:text-7xl font-bold font-serif mb-6 leading-tight">
            Contenido exclusivo<br />
            <span className="text-gradient">sin límites</span>
          </h1>
          <p className="text-lg text-muted max-w-xl mx-auto mb-10 leading-relaxed">
            Conecta con tus creadoras favoritas, accede a contenido único y apóyalas directamente. O conviértete en creadora y monetiza tu contenido.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/register?role=FAN" className="btn-primary text-base py-3 px-8">
              Unirme como fan
            </Link>
            <Link href="/register?role=CREATOR" className="btn-secondary text-base py-3 px-8">
              Ser creadora →
            </Link>
          </div>
          <p className="text-xs text-muted mt-4">100% gratis para registrarse · Solo +18</p>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="py-12 px-6 border-y border-white/5">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'Creadoras activas', value: '10K+' },
            { label: 'Fans registradas', value: '500K+' },
            { label: 'Pagado a creadoras', value: '$2M+' },
            { label: 'Países disponibles', value: '150+' },
          ].map(stat => (
            <div key={stat.label}>
              <p className="text-3xl font-bold text-gradient">{stat.value}</p>
              <p className="text-sm text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features for Creators */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold font-serif mb-3">Para creadoras</h2>
            <p className="text-muted">Todas las herramientas que necesitas para monetizar tu contenido</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: DollarSign, title: 'Gana el 80%', desc: 'Nos quedamos solo el 20% de comisión. Uno de los más bajos del mercado.', color: 'text-green-400', bg: 'bg-green-500/10' },
              { icon: Lock, title: 'Contenido PPV', desc: 'Vende contenido individual además de la suscripción. Maximiza tus ingresos.', color: 'text-pink-400', bg: 'bg-pink-500/10' },
              { icon: MessageSquare, title: 'Mensajes directos', desc: 'Habla directamente con tus fans. Envía contenido PPV en DMs.', color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { icon: TrendingUp, title: 'Analytics avanzado', desc: 'Estadísticas detalladas de suscriptoras, ingresos y engagement.', color: 'text-purple-400', bg: 'bg-purple-500/10' },
              { icon: Users, title: 'Mass DM', desc: 'Envía mensajes a todas tus suscriptoras al mismo tiempo.', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
              { icon: Star, title: 'Live streaming', desc: 'Haz streams en vivo y recibe propinas en tiempo real.', color: 'text-orange-400', bg: 'bg-orange-500/10' },
            ].map(feature => (
              <motion.div key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="card p-5 hover:border-white/15 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl ${feature.bg} flex items-center justify-center mb-3`}>
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-muted">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="card p-10 bg-gradient-to-br from-pink-500/10 via-rose-600/10 to-purple-500/10 border-pink-500/20">
            <div className="text-4xl mb-4">🦶</div>
            <h2 className="text-3xl font-bold font-serif mb-3">¿Lista para empezar?</h2>
            <p className="text-muted mb-6">Únete a miles de creadoras que ya ganan dinero con su contenido</p>
            <Link href="/register" className="btn-primary text-base py-3 px-8 inline-flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Crear mi cuenta gratis
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xs">🦶</div>
          <span className="font-semibold font-serif">OnlyFeets</span>
        </div>
        <div className="flex justify-center gap-6 text-xs text-muted mb-3">
          <Link href="/terms" className="hover:text-white">Términos</Link>
          <Link href="/privacy" className="hover:text-white">Privacidad</Link>
          <Link href="/dmca" className="hover:text-white">DMCA</Link>
          <Link href="/contact" className="hover:text-white">Contacto</Link>
        </div>
        <p className="text-xs text-muted">© 2025 OnlyFeets. Solo para mayores de 18 años.</p>
      </footer>
    </div>
  );
}
