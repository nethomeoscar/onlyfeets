'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, Heart, Star } from 'lucide-react';
import { SubscribeModal } from '../modals/SubscribeModal';

interface CreatorCardProps {
  creator: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    bio: string | null;
    isVerified: boolean;
    creatorProfile: {
      subscriptionPrice: number;
      subscriberCount: number;
      totalPosts: number;
      totalLikes: number;
      trialDays: number;
    } | null;
  };
}

export function CreatorCard({ creator }: CreatorCardProps) {
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const profile = creator.creatorProfile;

  return (
    <>
      <motion.div
        className="card overflow-hidden cursor-pointer group"
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
      >
        {/* Cover */}
        <Link href={`/${creator.username}`}>
          <div className="relative h-24 overflow-hidden">
            {creator.coverUrl ? (
              <img
                src={creator.coverUrl}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-pink-500/30 via-rose-600/20 to-purple-500/30 group-hover:from-pink-500/40 transition-all duration-500" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(230,18%,13%)] via-transparent to-transparent" />

            {/* Trial badge */}
            {profile?.trialDays > 0 && (
              <div className="absolute top-2 right-2 bg-green-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {profile.trialDays}d GRATIS
              </div>
            )}
          </div>
        </Link>

        <div className="p-3">
          {/* Avatar + name */}
          <div className="flex items-end gap-2.5 -mt-10 mb-2">
            <Link href={`/${creator.username}`}>
              {creator.avatarUrl ? (
                <img
                  src={creator.avatarUrl}
                  alt={creator.displayName}
                  className="w-14 h-14 rounded-full object-cover ring-3 ring-[hsl(230,18%,13%)] group-hover:ring-pink-500/30 transition-all"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 ring-3 ring-[hsl(230,18%,13%)] flex items-center justify-center text-lg font-bold text-white">
                  {creator.displayName[0]}
                </div>
              )}
            </Link>
            <div className="pb-0.5 flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <Link href={`/${creator.username}`} className="font-semibold text-sm truncate hover:text-pink-400 transition-colors">
                  {creator.displayName}
                </Link>
                {creator.isVerified && (
                  <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                )}
              </div>
              <p className="text-[11px] text-muted">@{creator.username}</p>
            </div>
          </div>

          {/* Bio */}
          {creator.bio && (
            <p className="text-xs text-white/60 line-clamp-2 mb-3 leading-relaxed">
              {creator.bio}
            </p>
          )}

          {/* Stats */}
          {profile && (
            <div className="flex items-center gap-3 mb-3 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {profile.subscriberCount.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {profile.totalLikes.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3" />
                {profile.totalPosts} posts
              </span>
            </div>
          )}

          {/* Subscribe button */}
          <button
            onClick={() => setShowSubscribeModal(true)}
            className="w-full btn-primary text-xs py-2 flex items-center justify-center gap-1.5 group-hover:shadow-pink-500/30"
          >
            Suscribirse · ${profile?.subscriptionPrice ?? '—'}/mes
          </button>
        </div>
      </motion.div>

      {showSubscribeModal && (
        <SubscribeModal
          creator={creator}
          onClose={() => setShowSubscribeModal(false)}
          onSuccess={() => setShowSubscribeModal(false)}
        />
      )}
    </>
  );
}
