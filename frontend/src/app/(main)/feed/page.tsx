'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { PostCard } from '@/components/post/PostCard';
import { SuggestedCreators } from '@/components/feed/SuggestedCreators';
import { Stories } from '@/components/feed/Stories';
import { useAuthStore } from '@/store/auth.store';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyFeed } from '@/components/feed/EmptyFeed';
import { useIntersection } from '@/hooks/useIntersection';

export default function FeedPage() {
  const { user } = useAuthStore();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isIntersecting = useIntersection(loadMoreRef);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get(`/posts/feed?page=${pageParam}&limit=10`);
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage]);

  const posts = data?.pages.flatMap(p => p.posts) ?? [];

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        
        {/* Main Feed */}
        <div className="space-y-4">
          {/* Stories row */}
          <Stories />

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <PostCardSkeleton key={i} />
              ))}
            </div>
          ) : isError ? (
            <div className="card p-8 text-center">
              <p className="text-muted">Error al cargar el feed. Intenta de nuevo.</p>
            </div>
          ) : posts.length === 0 ? (
            <EmptyFeed />
          ) : (
            <div className="space-y-4">
              {posts.map((post: any) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}

          {/* Load more trigger */}
          <div ref={loadMoreRef} className="h-4" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <LoadingSpinner size="sm" />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block space-y-6">
          {/* User info */}
          {user && (
            <div className="card p-4 flex items-center gap-3">
              <div className="relative">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold text-lg">
                    {user.displayName?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold text-sm">{user.displayName || user.username}</p>
                <p className="text-muted text-xs">@{user.username}</p>
              </div>
            </div>
          )}

          <SuggestedCreators />
        </div>
      </div>
    </div>
  );
}

function PostCardSkeleton() {
  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-full" />
        <div className="space-y-2">
          <div className="skeleton h-3 w-32 rounded" />
          <div className="skeleton h-2 w-20 rounded" />
        </div>
      </div>
      <div className="skeleton h-72 w-full rounded-xl" />
      <div className="flex gap-4">
        <div className="skeleton h-4 w-16 rounded" />
        <div className="skeleton h-4 w-16 rounded" />
      </div>
    </div>
  );
}
