'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { motion } from 'framer-motion';
import { X, Gift, Loader2, Heart } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);

const QUICK_AMOUNTS = [5, 10, 20, 50, 100];

interface TipModalProps {
  postId?: string;
  creatorId?: string;
  creatorName: string;
  tipMenu?: Array<{ id: string; description: string; amount: number; emoji?: string }>;
  onClose: () => void;
}

export function TipModal(props: TipModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={props.onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full sm:max-w-md bg-[hsl(230,18%,13%)] rounded-t-3xl sm:rounded-2xl border border-white/10 z-10"
        onClick={e => e.stopPropagation()}
      >
        <Elements stripe={stripePromise} options={{
          appearance: { theme: 'night', variables: { colorPrimary: '#f59e0b' } },
        }}>
          <TipForm {...props} />
        </Elements>
      </motion.div>
    </div>
  );
}

function TipForm({ postId, creatorId, creatorName, tipMenu, onClose }: TipModalProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<any>(null);

  const finalAmount = selectedMenuItem?.amount ?? (customAmount ? parseFloat(customAmount) : amount);

  const handleTip = async () => {
    if (!stripe || !elements) return;
    setIsProcessing(true);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card required');

      const { paymentMethod, error } = await stripe.createPaymentMethod({ type: 'card', card: cardElement });
      if (error) throw new Error(error.message);

      if (postId) {
        await api.post(`/posts/${postId}/tip`, {
          amount: finalAmount,
          message: message || undefined,
          paymentMethodId: paymentMethod!.id,
        });
      } else if (creatorId) {
        await api.post('/payments/tip', {
          creatorId,
          amount: finalAmount,
          message: message || undefined,
          paymentMethodId: paymentMethod!.id,
        });
      }

      toast.success(`¡Enviaste $${finalAmount} a ${creatorName}! 💖`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar propina');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <Gift className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Enviar propina</h3>
            <p className="text-xs text-muted">a {creatorName}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tip menu */}
      {tipMenu && tipMenu.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted font-medium">Menú de propinas</p>
          <div className="grid grid-cols-2 gap-2">
            {tipMenu.filter(t => (t as any).isActive !== false).map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedMenuItem(item);
                  setCustomAmount('');
                }}
                className={`p-3 rounded-xl border transition-all text-left ${
                  selectedMenuItem?.id === item.id
                    ? 'border-yellow-400/50 bg-yellow-400/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{item.emoji || '🎁'}</span>
                  <div>
                    <p className="text-xs text-white/80">{item.description}</p>
                    <p className="font-bold text-yellow-400 text-sm">${item.amount}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-muted">o elige un monto</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </div>
      )}

      {/* Quick amounts */}
      {!selectedMenuItem && (
        <div>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {QUICK_AMOUNTS.map(a => (
              <button
                key={a}
                onClick={() => { setAmount(a); setCustomAmount(''); }}
                className={`py-2 rounded-xl text-sm font-medium transition-all ${
                  amount === a && !customAmount
                    ? 'bg-gradient-to-br from-yellow-500 to-amber-600 text-white'
                    : 'bg-white/5 hover:bg-white/10 text-white/70'
                }`}
              >
                ${a}
              </button>
            ))}
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
            <input
              type="number"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              placeholder="Otro monto"
              className="input pl-7 text-sm"
              min={1} max={1000}
            />
          </div>
        </div>
      )}

      {selectedMenuItem && (
        <button onClick={() => setSelectedMenuItem(null)} className="text-xs text-muted hover:text-white">
          ← Elegir monto diferente
        </button>
      )}

      {/* Message */}
      <div>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Mensaje opcional (máx. 200 caracteres)"
          className="input text-sm resize-none h-20"
          maxLength={200}
        />
      </div>

      {/* Amount summary */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-yellow-400">${finalAmount}</p>
        <p className="text-xs text-muted mt-0.5">Propina para {creatorName}</p>
      </div>

      {/* Card */}
      {!showCard ? (
        <button onClick={() => setShowCard(true)} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <Heart className="w-4 h-4" />
          Continuar con el pago
        </button>
      ) : (
        <div className="space-y-3">
          <div className="input p-3">
            <CardElement
              onChange={e => setCardComplete(e.complete)}
              options={{
                style: { base: { fontSize: '15px', color: '#fff', '::placeholder': { color: 'rgba(255,255,255,0.3)' } } },
                hidePostalCode: true,
              }}
            />
          </div>

          <button
            onClick={handleTip}
            disabled={!stripe || !cardComplete || isProcessing || finalAmount < 1}
            className="btn-primary w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </span>
            ) : (
              `Enviar $${finalAmount} 💖`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
