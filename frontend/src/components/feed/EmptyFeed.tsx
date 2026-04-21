'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, Heart } from 'lucide-react';

export function EmptyFeed() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-10 text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-500/20 to-rose-600/20 flex items-center justify-center mx-auto mb-5">
        <span className="text-4xl">🦶</span>
      </div>
      <h3 className="text-lg font-bold font-serif mb-2">Tu feed está vacío</h3>
      <p className="text-muted text-sm mb-6 max-w-xs mx-auto">
        Suscríbete a creadoras para ver su contenido exclusivo aquí.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/explore" className="btn-primary flex items-center gap-2 text-sm">
          <Search className="w-4 h-4" />
          Explorar creadoras
        </Link>
      </div>
    </motion.div>
  );
}
