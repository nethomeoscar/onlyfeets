'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { motion } from 'framer-motion';
import { X, Lock, Shield, Loader2, Image, Video } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);

interface PPVUnlockModalProps {
  postId?: string;
  messageId?: string;
  price: number;
  creatorName: string;
  mediaType?: 'IMAGE' | 'VIDEO' | 'MIXED';
  mediaCount?: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function PPVUnlockModal(props: PPVUnlockModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={props.onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full sm:max-w-sm bg-[hsl(230,18%,13%)] rounded-t-3xl sm:rounded-2xl border border-white/10 z-10 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <Elements stripe={stripePromise} options={{
          appearance: {
            theme: 'night',
            variables: { colorPrimary: '#ec4899', colorBackground: 'hsl(230, 20%, 10%)', colorText: '#ffffff' },
          },
        }}>
          <PPVUnlockForm {...props} />
        </Elements>
      </motion.div>
    </div>
  );
}

function PPVUnlockForm({ postId, messageId, price, creatorName, mediaType, mediaCount, onClose, onSuccess }: PPVUnlockModalProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardComplete, setCardComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUnlock = async () => {
    if (!stripe || !elements) return;
    setIsProcessing(true);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not found');

      const { paymentMethod, error } = await stripe.createPaymentMethod({ type: 'card', card: cardElement });
      if (error) throw new Error(error.message);

      const endpoint = postId ? `/posts/${postId}/unlock` : `/messages/${messageId}/unlock`;
      await api.post(endpoint, { paymentMethodId: paymentMethod!.id });

      toast.success('¡Contenido desbloqueado! 🔓');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Error al procesar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  const MediaIcon = mediaType === 'VIDEO' ? Video : Image;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold font-serif">Desbloquear contenido</h3>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content preview */}
      <div className="bg-gradient-to-br from-pink-500/10 to-rose-600/10 border border-pink-500/20 rounded-2xl p-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-600/20 flex items-center justify-center mx-auto mb-3">
          <Lock className="w-8 h-8 text-pink-400" />
        </div>
        <p className="font-semibold mb-0.5">{creatorName}</p>
        <p className="text-sm text-white/60 mb-3">
          {mediaCount ? `${mediaCount} archivo${mediaCount > 1 ? 's' : ''}` : 'Contenido exclusivo'}
          {mediaType && ` · ${mediaType === 'IMAGE' ? 'Foto' : mediaType === 'VIDEO' ? 'Video' : 'Multimedia'}`}
        </p>
        <div className="text-3xl font-bold text-gradient">${price}</div>
        <p className="text-xs text-white/40 mt-1">Pago único · Acceso permanente</p>
      </div>

      {/* Benefits */}
      <div className="space-y-2">
        {['Acceso inmediato tras el pago', 'Descarga disponible', 'Sin cargos adicionales'].map(b => (
          <div key={b} className="flex items-center gap-2 text-sm text-white/70">
            <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-green-400 text-[10px]">✓</span>
            </div>
            {b}
          </div>
        ))}
      </div>

      {/* Card input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Método de pago</label>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 focus-within:border-white/20 transition-colors">
          <CardElement
            onChange={e => setCardComplete(e.complete)}
            options={{
              style: {
                base: {
                  fontSize: '15px',
                  color: '#ffffff',
                  '::placeholder': { color: 'rgba(255,255,255,0.3)' },
                },
              },
              hidePostalCode: true,
            }}
          />
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <Shield className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
        Pago procesado de forma segura. No almacenamos datos de tu tarjeta.
      </div>

      {/* CTA */}
      <button
        onClick={handleUnlock}
        disabled={!stripe || !cardComplete || isProcessing}
        className="btn-primary w-full py-3 text-base"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Procesando...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            Pagar ${price} y desbloquear
          </span>
        )}
      </button>
    </div>
  );
}
