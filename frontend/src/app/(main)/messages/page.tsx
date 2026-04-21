'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image, Lock, Gift, ChevronLeft, Search, MoreVertical, Smile, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { socketService } from '@/lib/socket';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import toast from 'react-hot-toast';

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isPPV, setIsPPV] = useState(false);
  const [ppvPrice, setPpvPrice] = useState(5);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobileShowChat, setIsMobileShowChat] = useState(false);
  const { uploadFiles, isUploading } = useMediaUpload();

  const { data: conversations, refetch: refetchConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data } = await api.get('/messages/conversations');
      return data;
    },
    refetchInterval: 5000,
  });

  const selectedConvUser = conversations?.conversations?.find(
    (c: any) => c.otherUser.id === selectedConversation
  )?.otherUser;

  const { data: messagesData, fetchNextPage, refetch: refetchMessages } = useInfiniteQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get(`/messages/${selectedConversation}?page=${pageParam}`);
      return data;
    },
    getNextPageParam: (last) => last.page > 1 ? last.page - 1 : undefined,
    initialPageParam: 1,
    enabled: !!selectedConversation,
  });

  const messages = messagesData?.pages.flatMap(p => p.messages).reverse() ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!user) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    const onNewMessage = (msg: any) => {
      if (msg.senderId === selectedConversation || msg.receiverId === selectedConversation) {
        refetchMessages();
      }
      refetchConversations();
    };

    const onTyping = ({ userId: typingUserId, isTyping: typing }: any) => {
      if (typingUserId === selectedConversation) {
        setOtherUserTyping(typing);
      }
    };

    socket.on('new_message', onNewMessage);
    socket.on('typing', onTyping);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('typing', onTyping);
    };
  }, [selectedConversation, refetchMessages, refetchConversations]);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content?: string; mediaUrls?: any[]; isPPV?: boolean; ppvPrice?: number }) => {
      const res = await api.post('/messages/send', {
        receiverId: selectedConversation,
        ...data,
      });
      return res.data;
    },
    onSuccess: () => {
      setMessageInput('');
      setIsPPV(false);
      refetchMessages();
      refetchConversations();
    },
    onError: () => toast.error('Error al enviar mensaje'),
  });

  const handleSend = () => {
    if (!messageInput.trim() && !isPPV) return;
    sendMessageMutation.mutate({
      content: messageInput.trim() || undefined,
      isPPV,
      ppvPrice: isPPV ? ppvPrice : undefined,
    });
  };

  const handleTyping = (value: string) => {
    setMessageInput(value);
    const socket = socketService.getSocket();
    if (!socket || !selectedConversation) return;

    socket.emit('typing_start', { receiverId: selectedConversation });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { receiverId: selectedConversation });
    }, 1500);
  };

  const handleFileUpload = async (files: FileList) => {
    try {
      const uploaded = await uploadFiles(Array.from(files));
      await sendMessageMutation.mutateAsync({
        mediaUrls: uploaded,
        isPPV,
        ppvPrice: isPPV ? ppvPrice : undefined,
        content: messageInput.trim() || undefined,
      });
    } catch {
      toast.error('Error al subir archivo');
    }
  };

  const formatMessageDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return `Ayer ${format(d, 'HH:mm')}`;
    return format(d, 'd MMM HH:mm', { locale: es });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* Conversations sidebar */}
      <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-white/5 flex flex-col
        ${isMobileShowChat ? 'hidden md:flex' : 'flex'}`}>
        
        <div className="p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold font-serif mb-3">Mensajes</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Buscar conversación..."
              className="input pl-9 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations?.conversations?.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted text-sm">No tienes mensajes aún</p>
            </div>
          ) : (
            conversations?.conversations?.map((conv: any) => (
              <button
                key={conv.otherUser.id}
                onClick={() => {
                  setSelectedConversation(conv.otherUser.id);
                  setIsMobileShowChat(true);
                }}
                className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left
                  ${selectedConversation === conv.otherUser.id ? 'bg-white/5' : ''}`}
              >
                <div className="relative flex-shrink-0">
                  {conv.otherUser.avatarUrl ? (
                    <img src={conv.otherUser.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center font-bold text-sm">
                      {conv.otherUser.displayName?.[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{conv.otherUser.displayName}</span>
                    <span className="text-xs text-muted">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), { locale: es, addSuffix: false })}
                    </span>
                  </div>
                  <p className="text-xs text-muted truncate mt-0.5">
                    {conv.lastMessage?.isPPV ? '🔒 Mensaje PPV' :
                     conv.lastMessage?.content || '📎 Archivo multimedia'}
                  </p>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="bg-pink-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      {selectedConversation && selectedConvUser ? (
        <div className={`flex-1 flex flex-col ${!isMobileShowChat ? 'hidden md:flex' : 'flex'}`}>
          {/* Chat header */}
          <div className="p-4 border-b border-white/5 flex items-center gap-3">
            <button
              onClick={() => setIsMobileShowChat(false)}
              className="md:hidden p-1.5 hover:bg-white/10 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {selectedConvUser.avatarUrl ? (
              <img src={selectedConvUser.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center font-bold text-xs">
                {selectedConvUser.displayName?.[0]}
              </div>
            )}
            <div>
              <p className="font-semibold text-sm">{selectedConvUser.displayName}</p>
              <p className="text-xs text-green-400">En línea</p>
            </div>
            <button className="ml-auto p-1.5 hover:bg-white/10 rounded-lg">
              <MoreVertical className="w-5 h-5 text-white/50" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg: any) => {
              const isMine = msg.senderId === user?.id;
              const isLocked = msg.isPPV && !msg.isUnlocked && !isMine;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    
                    {/* Media */}
                    {msg.media?.length > 0 && (
                      <div className={`rounded-2xl overflow-hidden ${isMine ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                        {isLocked ? (
                          <button
                            onClick={() => {/* open PPV unlock */}}
                            className="w-48 h-32 bg-gradient-to-br from-pink-500/20 to-rose-600/20 border border-pink-500/30 flex flex-col items-center justify-center gap-2 cursor-pointer hover:from-pink-500/30 transition-colors"
                          >
                            <Lock className="w-6 h-6 text-pink-400" />
                            <span className="text-sm text-white font-medium">Desbloquear ${msg.ppvPrice}</span>
                          </button>
                        ) : msg.media[0].type === 'IMAGE' ? (
                          <img src={msg.media[0].url} alt="" className="max-w-[240px] max-h-[320px] object-cover" />
                        ) : msg.media[0].type === 'VIDEO' ? (
                          <video src={msg.media[0].url} controls className="max-w-[240px]" />
                        ) : null}
                      </div>
                    )}

                    {/* Text */}
                    {msg.content && !isLocked && (
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMine
                          ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-br-sm'
                          : 'bg-white/8 text-white rounded-bl-sm'
                      }`}>
                        {msg.content}
                      </div>
                    )}

                    <span className="text-[10px] text-muted px-1">{formatMessageDate(msg.createdAt)}</span>
                  </div>
                </motion.div>
              );
            })}

            {/* Typing indicator */}
            {otherUserTyping && (
              <div className="flex items-center gap-2">
                <div className="bg-white/8 rounded-2xl px-4 py-2.5 flex gap-1 items-center">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 bg-white/40 rounded-full"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* PPV toggle */}
          {isPPV && (
            <div className="px-4 py-2 bg-pink-500/10 border-t border-pink-500/20 flex items-center gap-3">
              <Lock className="w-4 h-4 text-pink-400" />
              <span className="text-sm text-pink-300">Mensaje PPV - Precio:</span>
              <input
                type="number"
                value={ppvPrice}
                onChange={e => setPpvPrice(Number(e.target.value))}
                className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm text-center"
                min={1} max={500}
              />
              <span className="text-sm text-pink-300">USD</span>
              <button onClick={() => setIsPPV(false)} className="ml-auto text-xs text-muted hover:text-white">
                Cancelar
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-end gap-2">
              <div className="flex gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && handleFileUpload(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 hover:bg-white/10 rounded-xl transition-colors"
                  title="Adjuntar archivo"
                >
                  <Image className="w-5 h-5 text-white/50" />
                </button>
                <button
                  onClick={() => setIsPPV(!isPPV)}
                  className={`p-2.5 rounded-xl transition-colors ${isPPV ? 'bg-pink-500/20 text-pink-400' : 'hover:bg-white/10 text-white/50'}`}
                  title="Mensaje PPV"
                >
                  <Lock className="w-5 h-5" />
                </button>
              </div>

              <input
                type="text"
                value={messageInput}
                onChange={e => handleTyping(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Escribe un mensaje..."
                className="flex-1 input py-2.5 text-sm"
              />

              <button
                onClick={handleSend}
                disabled={sendMessageMutation.isPending || isUploading || (!messageInput.trim() && !isUploading)}
                className="btn-primary p-2.5 rounded-xl"
              >
                {sendMessageMutation.isPending || isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-600/20 flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-pink-400" />
            </div>
            <h3 className="font-semibold mb-1">Tus mensajes</h3>
            <p className="text-muted text-sm">Selecciona una conversación para empezar</p>
          </div>
        </div>
      )}
    </div>
  );
}
