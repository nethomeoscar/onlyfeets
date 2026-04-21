'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid3X3, Lock, Heart, MessageCircle, Users, Star, Share2, Flag, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { PostCard } from '@/components/post/PostCard';
import { SubscribeModal } from '@/components/modals/SubscribeModal';
import { TipModal } from '@/components/modals/TipModal';
import toast from 'react-hot-toast';

export default function CreatorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'media' | 'locked'>('posts');
  const [showFullBio, setShowFullBio] = useState(false);

  const { data: creator, isLoading } = useQuery({
    queryKey: ['creator', username],
    queryFn: async () => {
      const { data } = await api.get(`/creators/${username}`);
      return data;
    },
  });

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['creator-posts', username, activeTab],
    queryFn: async () => {
      const { data } = await api.get(`/creators/${username}/posts?tab=${activeTab}`);
      return data;
    },
    enabled: !!creator,
  });

  const isOwner = user?.username === username;
  const isSubscribed = creator?.isSubscribed;

  if (isLoading) return <ProfileSkeleton />;
  if (!creator) return <div className="text-center py-20 text-muted">Creadora no encontrada</div>;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Cover */}
      <div className="relative h-52 md:h-64 bg-gradient-to-br from-pink-900/40 to-rose-900/40">
        {creator.coverUrl ? (
          <img src={creator.coverUrl} alt="Portada" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-pink-500/20 via-rose-600/20 to-purple-500/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(230,25%,7%)] via-transparent to-transparent" />
      </div>

      {/* Profile info */}
      <div className="px-4 pb-4 -mt-16 relative">
        <div className="flex items-end justify-between mb-4">
          <div className="relative">
            {creator.avatarUrl ? (
              <img
                src={creator.avatarUrl}
                alt={creator.displayName}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-[hsl(230,25%,7%)]"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 ring-4 ring-[hsl(230,25%,7%)] flex items-center justify-center text-3xl font-bold text-white">
                {creator.displayName[0]}
              </div>
            )}
            {creator.isVerified && (
              <div className="absolute bottom-1 right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[hsl(230,25%,7%)]">
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-16">
            {!isOwner && (
              <>
                <button
                  onClick={() => setShowTipModal(true)}
                  className="btn-secondary text-sm py-2 px-4 flex items-center gap-1.5"
                >
                  <Star className="w-4 h-4 text-yellow-400" />
                  Propina
                </button>
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}/${username}`;
                    await navigator.clipboard.writeText(url);
                    toast.success('Enlace copiado');
                  }}
                  className="btn-ghost p-2"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </>
            )}
            {isOwner && (
              <a href="/settings/profile" className="btn-secondary text-sm py-2 px-4">
                Editar perfil
              </a>
            )}
          </div>
        </div>

        {/* Name & username */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-serif">{creator.displayName}</h1>
            {creator.isVerified && (
              <span className="badge badge-verified">Verificada</span>
            )}
          </div>
          <p className="text-muted text-sm">@{creator.username}</p>
          {creator.website && (
            <a href={creator.website} target="_blank" rel="noopener noreferrer" className="text-pink-400 text-sm hover:underline mt-0.5 block">
              {creator.website.replace('https://', '')}
            </a>
          )}
        </div>

        {/* Bio */}
        {creator.bio && (
          <div className="mb-4">
            <p className={`text-sm text-white/80 leading-relaxed ${!showFullBio && 'line-clamp-3'}`}>
              {creator.bio}
            </p>
            {creator.bio.length > 150 && (
              <button onClick={() => setShowFullBio(!showFullBio)} className="text-pink-400 text-xs mt-1 flex items-center gap-1">
                {showFullBio ? 'Ver menos' : 'Ver más'}
                <ChevronDown className={`w-3 h-3 transition-transform ${showFullBio ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-6 mb-5 py-3 border-y border-white/5">
          {creator.creatorProfile?.showPostCount !== false && (
            <div className="text-center">
              <p className="font-bold">{creator.creatorProfile?.totalPosts ?? 0}</p>
              <p className="text-xs text-muted">Posts</p>
            </div>
          )}
          {creator.creatorProfile?.showSubscriberCount !== false && (
            <div className="text-center">
              <p className="font-bold">{creator.creatorProfile?.subscriberCount ?? 0}</p>
              <p className="text-xs text-muted">Suscriptores</p>
            </div>
          )}
          <div className="text-center">
            <p className="font-bold">{creator.creatorProfile?.totalLikes ?? 0}</p>
            <p className="text-xs text-muted">Me gusta</p>
          </div>
        </div>

        {/* Subscribe CTA */}
        {!isOwner && (
          <div className="mb-6">
            {isSubscribed ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                  <p className="text-green-400 text-sm font-medium">✓ Suscrita actualmente</p>
                  <p className="text-xs text-muted mt-0.5">
                    Por ${creator.creatorProfile?.subscriptionPrice}/mes
                  </p>
                </div>
                <a href="/messages" className="btn-secondary text-sm py-3 px-4">
                  <MessageCircle className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setShowSubscribeModal(true)}
                  className="btn-primary w-full py-3 text-base"
                >
                  Suscribirse por ${creator.creatorProfile?.subscriptionPrice}/mes
                </button>

                {/* Bundle options */}
                {creator.creatorProfile?.bundles?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {creator.creatorProfile.bundles.filter((b: any) => b.isActive).map((bundle: any) => (
                      <button
                        key={bundle.id}
                        onClick={() => setShowSubscribeModal(true)}
                        className="card p-2.5 text-center hover:border-pink-500/40 transition-colors"
                      >
                        <p className="text-xs text-muted">{bundle.months} meses</p>
                        <p className="text-sm font-bold text-pink-400 mt-0.5">{bundle.discountPercent}% OFF</p>
                      </button>
                    ))}
                  </div>
                )}

                {creator.creatorProfile?.trialDays > 0 && (
                  <p className="text-center text-xs text-green-400">
                    🎁 {creator.creatorProfile.trialDays} días de prueba GRATIS
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tip menu */}
        {creator.creatorProfile?.tipMenuItems?.length > 0 && (isSubscribed || isOwner) && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted mb-2">Menú de propinas</h3>
            <div className="grid grid-cols-2 gap-2">
              {creator.creatorProfile.tipMenuItems.filter((t: any) => t.isActive).map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => setShowTipModal(true)}
                  className="card p-3 text-left hover:border-yellow-500/30 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.emoji || '🎁'}</span>
                    <div>
                      <p className="text-xs text-white/80 group-hover:text-white transition-colors">{item.description}</p>
                      <p className="text-sm font-bold text-yellow-400">${item.amount}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-4">
          {([
            { id: 'posts', label: 'Todos', icon: Grid3X3 },
            { id: 'media', label: 'Fotos/Videos', icon: Heart },
            { id: 'locked', label: 'PPV', icon: Lock },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id ? 'text-white' : 'text-muted hover:text-white/70'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500" />
              )}
            </button>
          ))}
        </div>

        {/* Posts */}
        {postsLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="skeleton h-64 rounded-2xl" />)}
          </div>
        ) : !isSubscribed && !isOwner ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-600/20 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-pink-400" />
            </div>
            <div>
              <p className="font-semibold">Contenido exclusivo</p>
              <p className="text-muted text-sm mt-1">Suscríbete para ver todo el contenido de {creator.displayName}</p>
            </div>
            <button onClick={() => setShowSubscribeModal(true)} className="btn-primary">
              Suscribirse ahora
            </button>
          </div>
        ) : posts?.posts?.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted">No hay publicaciones en esta sección</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts?.posts?.map((post: any) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showSubscribeModal && (
        <SubscribeModal
          creator={creator}
          onClose={() => setShowSubscribeModal(false)}
          onSuccess={() => {
            setShowSubscribeModal(false);
            queryClient.invalidateQueries({ queryKey: ['creator', username] });
          }}
        />
      )}
      {showTipModal && (
        <TipModal
          creatorId={creator.id}
          creatorName={creator.displayName}
          tipMenu={creator.creatorProfile?.tipMenuItems}
          onClose={() => setShowTipModal(false)}
        />
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse">
      <div className="skeleton h-52 w-full" />
      <div className="px-4 -mt-12 space-y-4">
        <div className="skeleton w-24 h-24 rounded-full" />
        <div className="skeleton h-5 w-40 rounded" />
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}
