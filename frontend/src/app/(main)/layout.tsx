'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Home, Search, PlusSquare, Bell, MessageSquare,
  User, LayoutDashboard, Users, DollarSign, BarChart2
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user]);

  const { data: unreadNotifs } = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      return data;
    },
    refetchInterval: 30000,
    enabled: !!user,
  });

  const { data: unreadMessages } = useQuery({
    queryKey: ['unread-messages'],
    queryFn: async () => {
      const { data } = await api.get('/messages/unread-count');
      return data;
    },
    refetchInterval: 15000,
    enabled: !!user,
  });

  if (!user) return null;

  const isCreator = user.role === 'CREATOR';

  const fanNav = [
    { href: '/feed', icon: Home, label: 'Inicio' },
    { href: '/explore', icon: Search, label: 'Explorar' },
    { href: '/messages', icon: MessageSquare, label: 'Mensajes', badge: unreadMessages?.count },
    { href: '/notifications', icon: Bell, label: 'Notificaciones', badge: unreadNotifs?.count },
    { href: `/${user.username}`, icon: User, label: 'Perfil' },
  ];

  const creatorNav = [
    { href: '/feed', icon: Home, label: 'Inicio' },
    { href: '/explore', icon: Search, label: 'Explorar' },
    { href: '/creator/posts/new', icon: PlusSquare, label: 'Publicar', isSpecial: true },
    { href: '/messages', icon: MessageSquare, label: 'Mensajes', badge: unreadMessages?.count },
    { href: '/creator/dashboard', icon: LayoutDashboard, label: 'Panel' },
  ];

  const nav = isCreator ? creatorNav : fanNav;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Top navbar */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-white/5 bg-[hsl(230,25%,7%)]/90 backdrop-blur-md">
        <div className="max-w-screen-xl mx-auto px-4 h-full flex items-center justify-between">
          {/* Logo */}
          <Link href="/feed" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <span className="text-sm">🦶</span>
            </div>
            <span className="font-bold text-lg font-serif hidden sm:block">
              Only<span className="text-gradient">Feets</span>
            </span>
          </Link>

          {/* Search (desktop) */}
          <div className="hidden md:block w-72">
            <Link href="/explore">
              <div className="input text-sm text-white/30 cursor-pointer hover:border-white/20 transition-colors flex items-center gap-2">
                <Search className="w-4 h-4" />
                Buscar creadoras...
              </div>
            </Link>
          </div>

          {/* Creator extra nav */}
          {isCreator && (
            <div className="hidden md:flex items-center gap-1">
              {[
                { href: '/creator/dashboard', icon: LayoutDashboard, label: 'Panel' },
                { href: '/creator/subscribers', icon: Users, label: 'Suscriptores' },
                { href: '/creator/earnings', icon: DollarSign, label: 'Ganancias' },
                { href: '/creator/analytics', icon: BarChart2, label: 'Estadísticas' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    pathname === item.href ? 'bg-white/10 text-white' : 'text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          {/* Avatar */}
          <Link href={`/${user.username}`}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-pink-500/30 hover:ring-pink-500/60 transition-all" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-sm font-bold text-white">
                {user.displayName?.[0]}
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-14 pb-20 md:pb-0 min-h-screen">
        {children}
      </main>

      {/* Bottom navbar (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-white/5 bg-[hsl(230,25%,7%)]/95 backdrop-blur-md safe-bottom md:hidden">
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
          {nav.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-1 relative"
              >
                {item.isSpecial ? (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-pink-400' : 'text-white/40'}`} />
                      {item.badge > 0 && (
                        <span className="notification-dot">{item.badge > 9 ? '9+' : item.badge}</span>
                      )}
                    </div>
                    <span className={`text-[10px] transition-colors ${isActive ? 'text-pink-400' : 'text-white/40'}`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <motion.div layoutId="nav-indicator" className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-pink-500 rounded-full" />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
