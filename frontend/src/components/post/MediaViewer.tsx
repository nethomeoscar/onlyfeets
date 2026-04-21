'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Lock, Play, Volume2, VolumeX, Maximize2 } from 'lucide-react';

interface Media {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO';
  url: string | null;
  blurUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
}

interface MediaViewerProps {
  media: Media[];
  isLocked?: boolean;
  ppvPrice?: number;
  onUnlockClick?: () => void;
}

export function MediaViewer({ media, isLocked, ppvPrice, onUnlockClick }: MediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = media[currentIndex];
  const hasMultiple = media.length > 1;

  const prev = () => setCurrentIndex(i => (i - 1 + media.length) % media.length);
  const next = () => setCurrentIndex(i => (i + 1) % media.length);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'Escape') setIsFullscreen(false);
  };

  if (!current) return null;

  return (
    <>
      <div className="relative bg-black overflow-hidden" onKeyDown={handleKeyDown} tabIndex={0}>
        {/* Main media */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative"
          >
            {current.type === 'IMAGE' ? (
              <div className="relative">
                <img
                  src={isLocked ? (current.blurUrl || current.url || '') : (current.url || '')}
                  alt=""
                  className={`w-full max-h-[600px] object-contain bg-black ${isLocked ? 'blur-xl scale-110' : ''}`}
                  style={{ minHeight: '200px' }}
                  loading="lazy"
                />
                {isLocked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                    <div className="text-center p-6">
                      <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 border border-white/20">
                        <Lock className="w-7 h-7 text-white" />
                      </div>
                      <p className="text-white font-semibold mb-1">Contenido exclusivo</p>
                      <p className="text-white/60 text-sm mb-4">Desbloquea este contenido</p>
                      <button
                        onClick={onUnlockClick}
                        className="btn-primary text-sm py-2.5 px-6"
                      >
                        Desbloquear por ${ppvPrice}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : current.type === 'VIDEO' ? (
              <div className="relative group">
                {isLocked ? (
                  <div className="relative">
                    {current.thumbnailUrl ? (
                      <img src={current.thumbnailUrl} alt="" className="w-full max-h-[500px] object-contain blur-xl scale-110 bg-black" />
                    ) : (
                      <div className="w-full h-72 bg-black" />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                      <div className="text-center p-6">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 border border-white/20">
                          <Lock className="w-7 h-7 text-white" />
                        </div>
                        <p className="text-white font-semibold mb-1">Video exclusivo</p>
                        {current.duration && (
                          <p className="text-white/50 text-xs mb-3">Duración: {Math.floor(current.duration / 60)}:{String(current.duration % 60).padStart(2, '0')}</p>
                        )}
                        <button onClick={onUnlockClick} className="btn-primary text-sm py-2.5 px-6">
                          Desbloquear por ${ppvPrice}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      src={current.url || ''}
                      poster={current.thumbnailUrl || undefined}
                      className="w-full max-h-[600px] object-contain bg-black"
                      controls={false}
                      muted={videoMuted}
                      loop
                      playsInline
                      onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
                    />
                    {/* Video controls overlay */}
                    <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setVideoMuted(!videoMuted)}
                        className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                      >
                        {videoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setIsFullscreen(true)}
                        className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Play button overlay */}
                    <div
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
                    >
                      <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto cursor-pointer">
                        <Play className="w-6 h-6 text-white fill-white" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        {hasMultiple && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors z-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors z-10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Dots indicator */}
        {hasMultiple && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`rounded-full transition-all ${
                  i === currentIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        )}

        {/* Media count badge */}
        {hasMultiple && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-white">
            {currentIndex + 1}/{media.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {hasMultiple && media.length > 2 && (
        <div className="flex gap-1 p-2 bg-black overflow-x-auto">
          {media.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setCurrentIndex(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                i === currentIndex ? 'border-pink-500' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {m.type === 'IMAGE' ? (
                <img src={isLocked ? (m.blurUrl || '') : (m.url || '')} alt="" className={`w-full h-full object-cover ${isLocked ? 'blur-sm' : ''}`} />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <Play className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen modal */}
      <AnimatePresence>
        {isFullscreen && !isLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            onClick={() => setIsFullscreen(false)}
          >
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 z-10"
              onClick={() => setIsFullscreen(false)}
            >
              ✕
            </button>
            {current.type === 'IMAGE' ? (
              <img src={current.url || ''} alt="" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
            ) : (
              <video src={current.url || ''} controls autoPlay className="max-w-full max-h-full" onClick={e => e.stopPropagation()} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
