'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Heart, MessageCircle, Send, Bookmark, Lock, DollarSign, Share2, MoreHorizontal, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { MediaViewer } from './MediaViewer';
import { CommentSection } from './CommentSection';
import { TipModal } from '../modals/TipModal';
import { PPVUnlockModal } from '../modals/PPVUnlockModal';
import { PostMenu } from './PostMenu';
import toast from 'react-hot-toast';

interface PostProps {
  post: {
    id: string;
    caption: string;
    isPPV: boolean;
    ppvPrice: number;
    isFree: boolean;
    isPinned: boolean;
    likesCount: number;
    commentsCount: number;
    viewsCount: number;
    tipsCount: number;
    isLiked: boolean;
    isUnlocked: boolean;
    isSubscribed: boolean;
    createdAt: string;
    publishedAt: string;
    creator: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      isVerified: boolean;
    };
    media: Array<{
      id: string;
      type: 'IMAGE' | 'VIDEO' | 'AUDIO';
      url: string | null;
      blurUrl: string | null;
      thumbnailUrl: string | null;
      duration: number | null;
      width: number | null;
      height: number | null;
    }>;
  };
}

export function PostCard({ post }: PostProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const isOwner = user?.id === post.creator.id;
  const isLocked = post.isPPV && !post.isUnlocked && !post.isFree && !isOwner;
  const canSeeContent = !isLocked && (post.isSubscribed || post.isFree || isOwner);

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/posts/${post.id}/like`),
    onMutate: () => {
      const newLiked = !isLiked;
      setIsLiked(newLiked);
      setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
      if (newLiked) {
        setShowHeartAnim(true);
        setTimeout(() => setShowHeartAnim(false), 600);
      }
    },
    onError: () => {
      setIsLiked(post.isLiked);
      setLikesCount(post.likesCount);
      toast.error('Error al procesar me gusta');
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post(`/posts/${post.id}/save`),
    onMutate: () => setIsSaved(prev => !prev),
    onError: () => {
      setIsSaved(prev => !prev);
      toast.error('Error al guardar');
    },
  });

  const handleDoubleTap = () => {
    if (!isLiked && user) {
      likeMutation.mutate();
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/${post.creator.username}/post/${post.id}`;
    if (navigator.share) {
      await navigator.share({ url, title: `${post.creator.displayName} en OnlyFeets` });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      {/* Pin indicator */}
      {post.isPinned && (
        <div className="bg-pink-500/10 border-b border-pink-500/20 px-4 py-1.5 text-xs text-pink-400 font-medium flex items-center gap-1.5">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 4a1 1 0 0 1 .117 1.993L16 6h-1v5.586l1.707 1.707A1 1 0 0 1 17 15H7a1 1 0 0 1-.707-1.707L8 11.586V6H7a1 1 0 0 1-.117-1.993L7 4h9z"/>
          </svg>
          Publicación fijada
        </div>
      )}

      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <Link href={`/${post.creator.username}`} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="relative">
            {post.creator.avatarUrl ? (
              <img
                src={post.creator.avatarUrl}
                alt={post.creator.displayName}
                className="w-11 h-11 rounded-full object-cover ring-2 ring-pink-500/30"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold">
                {post.creator.displayName[0]}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[hsl(var(--background-card))]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm">{post.creator.displayName}</span>
              {post.creator.isVerified && (
                <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              )}
            </div>
            <span className="text-muted text-xs">
              @{post.creator.username} · {formatDistanceToNow(new Date(post.publishedAt || post.createdAt), { addSuffix: true, locale: es })}
            </span>
          </div>
        </Link>

        <PostMenu post={post} isOwner={isOwner} />
      </div>

      {/* Caption */}
      {post.caption && (
        <div className="px-4 pb-3">
          <p className="text-sm leading-relaxed text-white/90">{post.caption}</p>
        </div>
      )}

      {/* Media */}
      {post.media.length > 0 && (
        <div className="relative" onDoubleClick={handleDoubleTap}>
          <MediaViewer
            media={post.media}
            isLocked={isLocked}
            ppvPrice={post.ppvPrice}
            onUnlockClick={() => setShowUnlockModal(true)}
          />

          {/* Double tap heart animation */}
          <AnimatePresence>
            {showHeartAnim && (
              <motion.div
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 1.5, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Heart className="w-20 h-20 text-white fill-white drop-shadow-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* PPV locked state without media */}
      {isLocked && post.media.length === 0 && (
        <div className="mx-4 mb-4 p-6 rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-600/10 border border-pink-500/20 text-center">
          <Lock className="w-8 h-8 text-pink-400 mx-auto mb-3" />
          <p className="text-sm text-white/70 mb-3">Contenido exclusivo</p>
          <button
            onClick={() => setShowUnlockModal(true)}
            className="btn-primary text-sm py-2 px-6"
          >
            Desbloquear por ${post.ppvPrice}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Like */}
            <button
              onClick={() => user ? likeMutation.mutate() : null}
              disabled={!user}
              className="flex items-center gap-1.5 group transition-all"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Heart
                  className={`w-5 h-5 transition-colors ${
                    isLiked
                      ? 'fill-pink-500 text-pink-500'
                      : 'text-white/50 group-hover:text-pink-400'
                  }`}
                />
              </motion.div>
              <span className={`text-sm font-medium tabular-nums ${isLiked ? 'text-pink-400' : 'text-muted'}`}>
                {likesCount.toLocaleString()}
              </span>
            </button>

            {/* Comment */}
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-1.5 group"
            >
              <MessageCircle className="w-5 h-5 text-white/50 group-hover:text-blue-400 transition-colors" />
              <span className="text-sm text-muted font-medium tabular-nums">{post.commentsCount.toLocaleString()}</span>
            </button>

            {/* Tip */}
            {!isOwner && user && (
              <button
                onClick={() => setShowTipModal(true)}
                className="flex items-center gap-1.5 group"
              >
                <Gift className="w-5 h-5 text-white/50 group-hover:text-yellow-400 transition-colors" />
                <span className="text-sm text-muted font-medium">Propina</span>
              </button>
            )}

            {/* Share */}
            <button onClick={handleShare} className="group">
              <Share2 className="w-5 h-5 text-white/50 group-hover:text-green-400 transition-colors" />
            </button>
          </div>

          {/* Save */}
          <button onClick={() => user ? saveMutation.mutate() : null}>
            <Bookmark
              className={`w-5 h-5 transition-colors ${
                isSaved ? 'fill-yellow-400 text-yellow-400' : 'text-white/50 hover:text-yellow-400'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5">
              <CommentSection postId={post.id} isSubscribed={post.isSubscribed || isOwner} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      {showTipModal && (
        <TipModal
          postId={post.id}
          creatorName={post.creator.displayName}
          onClose={() => setShowTipModal(false)}
        />
      )}

      {showUnlockModal && (
        <PPVUnlockModal
          postId={post.id}
          price={post.ppvPrice}
          creatorName={post.creator.displayName}
          onClose={() => setShowUnlockModal(false)}
          onSuccess={() => {
            setShowUnlockModal(false);
            queryClient.invalidateQueries({ queryKey: ['feed'] });
            queryClient.invalidateQueries({ queryKey: ['post', post.id] });
          }}
        />
      )}
    </motion.div>
  );
}
