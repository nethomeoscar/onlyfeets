'use client';

import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Send, Heart, MoreHorizontal, Reply, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface CommentSectionProps {
  postId: string;
  isSubscribed: boolean;
}

export function CommentSection({ postId, isSubscribed }: CommentSectionProps) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['comments', postId],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get(`/posts/${postId}/comments?page=${pageParam}`);
      return data;
    },
    getNextPageParam: (last) => last.comments?.length === 20 ? last.page + 1 : undefined,
    initialPageParam: 1,
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/posts/${postId}/comments`, {
        content: text.trim(),
        parentId: replyTo?.id,
      });
      return data;
    },
    onSuccess: () => {
      setText('');
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ['comments', postId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al comentar'),
  });

  const comments = data?.pages.flatMap(p => p.comments) ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || addCommentMutation.isPending) return;
    addCommentMutation.mutate();
  };

  return (
    <div className="p-4">
      {/* Comments list */}
      {comments.length > 0 && (
        <div className="space-y-4 mb-4 max-h-80 overflow-y-auto">
          {comments.map((comment: any) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              onReply={(id, username) => {
                setReplyTo({ id, username });
                setText(`@${username} `);
              }}
            />
          ))}
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1"
            >
              {isFetchingNextPage ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Ver más comentarios
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {comments.length === 0 && (
        <p className="text-xs text-muted text-center py-4">Sin comentarios aún. ¡Sé la primera!</p>
      )}

      {/* Input */}
      {user ? (
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user.displayName?.[0]}
            </div>
          )}
          <div className="flex-1 relative">
            {replyTo && (
              <div className="flex items-center gap-1 text-xs text-pink-400 mb-1">
                <Reply className="w-3 h-3" />
                Respondiendo a @{replyTo.username}
                <button type="button" onClick={() => { setReplyTo(null); setText(''); }} className="text-white/40 hover:text-white ml-1">×</button>
              </div>
            )}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:border-white/20 transition-colors">
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={isSubscribed ? 'Escribe un comentario...' : 'Suscríbete para comentar'}
                className="flex-1 bg-transparent px-4 py-2.5 text-sm focus:outline-none placeholder:text-white/30"
                maxLength={500}
                disabled={!isSubscribed}
              />
              <button
                type="submit"
                disabled={!text.trim() || addCommentMutation.isPending || !isSubscribed}
                className="p-2.5 pr-3 text-pink-400 hover:text-pink-300 disabled:text-white/20 transition-colors"
              >
                {addCommentMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="text-xs text-center text-muted">
          <Link href="/login" className="text-pink-400 hover:underline">Inicia sesión</Link> para comentar
        </p>
      )}
    </div>
  );
}

function CommentItem({ comment, currentUserId, onReply }: {
  comment: any;
  currentUserId?: string;
  onReply: (id: string, username: string) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2.5"
    >
      <Link href={`/${comment.user.username}`} className="flex-shrink-0">
        {comment.user.avatarUrl ? (
          <img src={comment.user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xs font-bold">
            {comment.user.displayName?.[0]}
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <div className="bg-white/5 rounded-2xl rounded-tl-sm px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Link href={`/${comment.user.username}`} className="text-xs font-semibold hover:text-pink-400 transition-colors">
              {comment.user.displayName}
            </Link>
            {comment.user.isVerified && (
              <svg className="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            )}
          </div>
          <p className="text-sm text-white/85 break-words leading-relaxed">{comment.content}</p>
        </div>

        <div className="flex items-center gap-3 mt-1 px-1">
          <span className="text-[10px] text-muted">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: es })}
          </span>
          <button
            onClick={() => setLiked(!liked)}
            className={`flex items-center gap-0.5 text-[10px] transition-colors ${liked ? 'text-pink-400' : 'text-muted hover:text-pink-400'}`}
          >
            <Heart className={`w-3 h-3 ${liked ? 'fill-pink-400' : ''}`} />
            {comment.likesCount + (liked ? 1 : 0) > 0 && (comment.likesCount + (liked ? 1 : 0))}
          </button>
          <button
            onClick={() => onReply(comment.id, comment.user.username)}
            className="text-[10px] text-muted hover:text-pink-400 transition-colors flex items-center gap-0.5"
          >
            <Reply className="w-3 h-3" />
            Responder
          </button>
        </div>

        {/* Replies */}
        {comment.replies?.length > 0 && (
          <div className="mt-2 ml-2">
            {!showReplies ? (
              <button
                onClick={() => setShowReplies(true)}
                className="text-[10px] text-pink-400 hover:text-pink-300 flex items-center gap-1"
              >
                <Reply className="w-3 h-3" />
                Ver {comment.replies.length} respuesta{comment.replies.length > 1 ? 's' : ''}
              </button>
            ) : (
              <div className="space-y-3">
                {comment.replies.map((reply: any) => (
                  <CommentItem key={reply.id} comment={reply} currentUserId={currentUserId} onReply={onReply} />
                ))}
                <button onClick={() => setShowReplies(false)} className="text-[10px] text-muted">Ocultar respuestas</button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
