'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Gift, Users, Heart, Mic, MicOff, Camera, CameraOff, PhoneOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { socketService } from '@/lib/socket';
import toast from 'react-hot-toast';

interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: string;
  type: 'message' | 'tip' | 'join';
  amount?: number;
}

export default function LivePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const router = useRouter();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { data: streamData, isLoading } = useQuery({
    queryKey: ['live-stream', id],
    queryFn: async () => {
      const { data } = await api.get(`/live/${id}`);
      return data;
    },
  });

  const stream = streamData?.stream;
  const isCreator = user?.id === stream?.creatorId;
  const canWatch = streamData?.canWatch;

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !id) return;

    socket.emit('join_live', id);
    setViewerCount(stream?.viewerCount || 0);

    const onChatMessage = (msg: any) => {
      setChatMessages(prev => [...prev.slice(-99), msg]);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const onViewerJoined = (data: any) => {
      setViewerCount(prev => prev + 1);
      setChatMessages(prev => [...prev, {
        userId: data.userId,
        username: '•••',
        message: 'se unió al stream',
        timestamp: new Date().toISOString(),
        type: 'join',
      }]);
    };

    const onViewerLeft = () => setViewerCount(prev => Math.max(0, prev - 1));

    const onLiveTip = (data: any) => {
      setChatMessages(prev => [...prev, {
        userId: data.userId,
        username: data.username || '•••',
        message: `envió una propina`,
        timestamp: data.timestamp,
        type: 'tip',
        amount: data.amount,
      }]);
    };

    const onLiveEnded = () => {
      toast.success('El stream ha terminado');
      router.push(`/${stream?.creator?.username}`);
    };

    socket.on('live_chat_message', onChatMessage);
    socket.on('viewer_joined', onViewerJoined);
    socket.on('viewer_left', onViewerLeft);
    socket.on('live_tip_received', onLiveTip);
    socket.on('live_ended', onLiveEnded);

    return () => {
      socket.emit('leave_live', id);
      socket.off('live_chat_message', onChatMessage);
      socket.off('viewer_joined', onViewerJoined);
      socket.off('viewer_left', onViewerLeft);
      socket.off('live_tip_received', onLiveTip);
      socket.off('live_ended', onLiveEnded);
    };
  }, [id, stream?.creatorId]);

  const endStreamMutation = useMutation({
    mutationFn: () => api.post(`/live/${id}/end`),
    onSuccess: () => {
      toast.success('Stream terminado');
      router.push('/creator/dashboard');
    },
  });

  const sendChat = () => {
    if (!chatInput.trim() || !user) return;
    const socket = socketService.getSocket();
    socket?.emit('live_chat', { streamId: id, message: chatInput });
    setChatMessages(prev => [...prev, {
      userId: user.id,
      username: user.username,
      message: chatInput,
      timestamp: new Date().toISOString(),
      type: 'message',
    }]);
    setChatInput('');
  };

  if (isLoading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!canWatch && !isCreator) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-pink-500/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h2 className="text-xl font-bold mb-2">Suscríbete para ver el live</h2>
        <button onClick={() => router.push(`/${stream?.creator?.username}`)} className="btn-primary mt-4">
          Ver perfil
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-black flex flex-col lg:flex-row overflow-hidden">
      {/* Video area */}
      <div className="relative flex-1 bg-black">
        {/* Video placeholder - Agora SDK renders here */}
        <div className="w-full h-full flex items-center justify-center">
          <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline muted={isMuted} />
          {!stream?.agoraToken && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">📹</div>
                <p className="text-white/60 text-sm">Conectando al stream...</p>
                <p className="text-white/30 text-xs mt-1">Agora SDK requerido en producción</p>
              </div>
            </div>
          )}
        </div>

        {/* Live badge + viewers */}
        <div className="absolute top-4 left-4 flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            EN VIVO
          </div>
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
            <Users className="w-3 h-3" />
            {viewerCount}
          </div>
        </div>

        {/* Creator info */}
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
          {stream?.creator?.avatarUrl ? (
            <img src={stream.creator.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xs font-bold">
              {stream?.creator?.displayName?.[0]}
            </div>
          )}
          <span className="text-white text-xs font-medium">{stream?.creator?.displayName}</span>
        </div>

        {/* Stream title */}
        <div className="absolute bottom-20 left-4 right-4">
          <p className="text-white font-semibold text-shadow">{stream?.title}</p>
        </div>

        {/* Creator controls */}
        {isCreator && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
            </button>
            <button
              onClick={() => endStreamMutation.mutate()}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={() => setIsCameraOff(!isCameraOff)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isCameraOff ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isCameraOff ? <CameraOff className="w-5 h-5 text-white" /> : <Camera className="w-5 h-5 text-white" />}
            </button>
          </div>
        )}
      </div>

      {/* Chat sidebar */}
      <div className="w-full lg:w-80 bg-[hsl(230,18%,13%)] border-l border-white/5 flex flex-col h-48 lg:h-full">
        <div className="p-3 border-b border-white/5 flex items-center gap-2">
          <span className="text-sm font-semibold">Chat en vivo</span>
          <span className="text-xs text-muted">({chatMessages.length} mensajes)</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <AnimatePresence initial={false}>
            {chatMessages.map((msg, i) => (
              <motion.div
                key={`${msg.timestamp}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-xs ${
                  msg.type === 'tip' ? 'bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2' :
                  msg.type === 'join' ? 'text-white/30' : ''
                }`}
              >
                {msg.type === 'tip' ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-yellow-400">🎁</span>
                    <span className="font-semibold text-yellow-300">@{msg.username}</span>
                    <span className="text-white/70">envió ${msg.amount}</span>
                  </div>
                ) : msg.type === 'join' ? (
                  <span>👤 {msg.message}</span>
                ) : (
                  <>
                    <span className="font-semibold text-pink-400">@{msg.username}</span>
                    <span className="text-white/80 ml-1">{msg.message}</span>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="p-3 border-t border-white/5 space-y-2">
          {!isCreator && (
            <button
              onClick={() => {
                const amount = window.prompt('Monto de propina ($):');
                if (amount && !isNaN(Number(amount))) {
                  const socket = socketService.getSocket();
                  socket?.emit('live_tip', { streamId: id, amount: Number(amount) });
                  toast.success(`Propina de $${amount} enviada 💖`);
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium hover:bg-yellow-500/20 transition-colors"
            >
              <Gift className="w-3.5 h-3.5" />
              Enviar propina
            </button>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
              maxLength={200}
            />
            <button onClick={sendChat} disabled={!chatInput.trim()} className="p-2 text-pink-400 hover:text-pink-300 disabled:text-white/20">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
