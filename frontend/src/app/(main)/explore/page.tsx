'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, Filter, TrendingUp, Star, Flame, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { CreatorCard } from '@/components/creator/CreatorCard';

const CATEGORIES = [
  { id: 'all', label: 'Todas', emoji: '✨' },
  { id: 'trending', label: 'Tendencia', emoji: '🔥' },
  { id: 'new', label: 'Nuevas', emoji: '🌟' },
  { id: 'top', label: 'Top', emoji: '👑' },
  { id: 'price_low', label: 'Más económicas', emoji: '💰' },
  { id: 'free_trial', label: 'Prueba gratis', emoji: '🎁' },
];

const PRICE_RANGES = [
  { label: 'Todos los precios', min: 0, max: 9999 },
  { label: 'Menos de $10', min: 0, max: 10 },
  { label: '$10 - $20', min: 10, max: 20 },
  { label: '$20 - $50', min: 20, max: 50 },
  { label: 'Más de $50', min: 50, max: 9999 },
];

export default function ExplorePage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [priceRange, setPriceRange] = useState(PRICE_RANGES[0]);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['explore', search, activeCategory, priceRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: search,
        category: activeCategory,
        minPrice: String(priceRange.min),
        maxPrice: String(priceRange.max),
      });
      const { data } = await api.get(`/search/creators?${params}`);
      return data;
    },
    staleTime: 30000,
  });

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
      {/* Hero search */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500/10 via-rose-600/10 to-purple-500/10 border border-white/5 p-6 text-center">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 rounded-full bg-pink-500/10 blur-3xl" />
        </div>
        <div className="relative">
          <h1 className="text-2xl font-bold font-serif mb-1">Explorar creadoras</h1>
          <p className="text-muted text-sm mb-4">Descubre contenido exclusivo de las mejores creadoras</p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, usuario..."
              className="input pl-11 py-3 text-sm w-full"
            />
          </div>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeCategory === cat.id
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-500/20'
                : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
            }`}
          >
            <span>{cat.emoji}</span>
            {cat.label}
          </button>
        ))}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            showFilters ? 'bg-white/10 text-white' : 'bg-white/5 text-white/70 border border-white/10'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filtros
        </button>
      </div>

      {/* Price filter */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="card p-4"
        >
          <p className="text-sm font-medium mb-3">Precio de suscripción</p>
          <div className="flex flex-wrap gap-2">
            {PRICE_RANGES.map(range => (
              <button
                key={range.label}
                onClick={() => setPriceRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  priceRange.label === range.label
                    ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                    : 'bg-white/5 text-muted hover:bg-white/10 border border-white/10'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats bar */}
      {data && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Users className="w-3.5 h-3.5" />
          <span>{data.total} creadoras encontradas</span>
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card overflow-hidden animate-pulse">
              <div className="skeleton h-28 w-full" />
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="skeleton w-10 h-10 rounded-full" />
                  <div className="space-y-1.5">
                    <div className="skeleton h-3 w-24 rounded" />
                    <div className="skeleton h-2 w-16 rounded" />
                  </div>
                </div>
                <div className="skeleton h-8 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : data?.creators?.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🦶</p>
          <p className="font-semibold">No encontramos creadoras</p>
          <p className="text-muted text-sm mt-1">Intenta con otros términos de búsqueda</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data?.creators?.map((creator: any, i: number) => (
            <motion.div
              key={creator.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <CreatorCard creator={creator} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
