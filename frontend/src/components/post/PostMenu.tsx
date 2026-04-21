'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Edit, Trash2, Pin, EyeOff, Flag, Copy, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface PostMenuProps {
  post: any;
  isOwner: boolean;
}

export function PostMenu({ post, isOwner }: PostMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const togglePinMutation = useMutation({
    mutationFn: () => api.put(`/posts/${post.id}`, { isPinned: !post.isPinned }),
    onSuccess: () => {
      toast.success(post.isPinned ? 'Publicación desprendida' : 'Publicación fijada');
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['creator-posts'] });
      setOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/posts/${post.id}`),
    onSuccess: () => {
      toast.success('Publicación eliminada');
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['creator-posts'] });
      setOpen(false);
    },
  });

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/${post.creator.username}/post/${post.id}`);
    toast.success('Enlace copiado');
    setOpen(false);
  };

  const ownerItems = [
    { icon: Edit, label: 'Editar', action: () => { router.push(`/creator/posts/${post.id}/edit`); setOpen(false); } },
    { icon: Pin, label: post.isPinned ? 'Desprender' : 'Fijar al perfil', action: () => togglePinMutation.mutate() },
    { icon: EyeOff, label: 'Archivar', action: () => { api.put(`/posts/${post.id}`, { isArchived: true }).then(() => { qc.invalidateQueries({ queryKey: ['feed'] }); setOpen(false); }); } },
    null,
    { icon: Trash2, label: 'Eliminar', action: () => { if (confirm('¿Eliminar esta publicación?')) deleteMutation.mutate(); }, className: 'text-red-400' },
  ];

  const visitorItems = [
    { icon: Flag, label: 'Reportar contenido', action: () => { toast.success('Reporte enviado, lo revisaremos'); setOpen(false); } },
  ];

  const commonItems = [
    { icon: Copy, label: 'Copiar enlace', action: copyLink },
    { icon: ExternalLink, label: 'Abrir en nueva pestaña', action: () => window.open(`/${post.creator.username}/post/${post.id}`, '_blank') },
  ];

  const items = isOwner ? [...ownerItems, null, ...commonItems] : [...visitorItems, null, ...commonItems];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
      >
        <MoreHorizontal className="w-5 h-5 text-white/50" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-48 bg-[hsl(230,15%,16%)] border border-white/10 rounded-2xl shadow-xl z-20 overflow-hidden py-1">
          {items.map((item, i) =>
            item === null ? (
              <div key={`sep-${i}`} className="my-1 border-t border-white/5" />
            ) : (
              <button
                key={item.label}
                onClick={item.action}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left ${(item as any).className || 'text-white/80'}`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
