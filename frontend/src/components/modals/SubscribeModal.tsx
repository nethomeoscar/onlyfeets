'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Shield, Star, Check, Loader2, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);

interface SubscribeModalProps {
  creator: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function SubscribeModal({ creator, onClose, onSuccess }: SubscribeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full sm:max-w-md bg-[hsl(230,18%,13%)] rounded-t-3xl sm:rounded-2xl border border-white/10 overflow-hidden z-10"
        onClick={e => e.stopPropagation()}
      >
        <Elements stripe={stripePromise} options={{
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#ec4899',
              colorBackground: 'hsl(230, 20%, 10%)',
              colorText: '#ffffff',
              colorDanger: '#f87171',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              borderRadius: '12px',
            },
          },
        }}>
          <SubscribeForm creator={creator} onClose={onClose} onSuccess={onSuccess} />
        </Elements>
      </motion.div>
    </div>
  );
}

function SubscribeForm({ creator, onClose, onSuccess }: SubscribeModalProps) {
  const stripe = useStripe();
  const elements = useElements();
  const queryClient = useQueryClient();
  const [selectedBundle, setSelectedBundle] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [step, setStep] = useState<'plan' | 'payment'>('plan');

  const price = creator.creatorProfile?.subscriptionPrice ?? 9.99;
  const bundles = creator.creatorProfile?.bundles?.filter((b: any) => b.isActive) ?? [];
  const trialDays = creator.creatorProfile?.trialDays ?? 0;

  const getPrice = () => {
    if (!selectedBundle) return price;
    return (price * selectedBundle.months * (1 - selectedBundle.discountPercent / 100)).toFixed(2);
  };

  const getMonthlyPrice = () => {
    if (!selectedBundle) return price;
    return (price * (1 - selectedBundle.discountPercent / 100)).toFixed(2);
  };

  const handleSubscribe = async () => {
    if (!stripe || !elements) return;
    setIsProcessing(true);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not found');

      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) throw new Error(error.message);

      await api.post('/subscriptions', {
        creatorId: creator.id,
        paymentMethodId: paymentMethod!.id,
        bundleMonths: selectedBundle?.months,
      });

      toast.success('¡Suscripción activada! Bienvenida 🎉');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="relative p-5 border-b border-white/10">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          {creator.avatarUrl ? (
            <img src={creator.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center font-bold">
              {creator.displayName[0]}
            </div>
          )}
          <div>
            <h3 className="font-bold font-serif">Suscribirse a {creator.displayName}</h3>
            <p className="text-muted text-xs">@{creator.username}</p>
          </div>
        </div>
      </div>

      {step === 'plan' ? (
        <div className="p-5 space-y-4">
          {/* Trial badge */}
          {trialDays > 0 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
              <p className="text-green-400 text-sm font-medium">🎁 {trialDays} días GRATIS</p>
              <p className="text-xs text-muted mt-0.5">Cancela cuando quieras durante el período de prueba</p>
            </div>
          )}

          {/* Monthly plan */}
          <button
            onClick={() => setSelectedBundle(null)}
            className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
              !selectedBundle ? 'border-pink-500 bg-pink-500/10' : 'border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Mensual</p>
                <p className="text-sm text-muted">Se renueva cada mes</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">${price}</p>
                <p className="text-xs text-muted">/mes</p>
              </div>
            </div>
            {!selectedBundle && (
              <div className="mt-2 flex items-center gap-1.5 text-pink-400 text-xs">
                <Check className="w-3.5 h-3.5" />
                Seleccionado
              </div>
            )}
          </button>

          {/* Bundle plans */}
          {bundles.map((bundle: any) => (
            <button
              key={bundle.id}
              onClick={() => setSelectedBundle(bundle)}
              className={`w-full p-4 rounded-2xl border-2 transition-all text-left relative ${
                selectedBundle?.id === bundle.id ? 'border-pink-500 bg-pink-500/10' : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="absolute -top-2.5 left-4">
                <span className="bg-gradient-to-r from-pink-500 to-rose-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {bundle.discountPercent}% DESCUENTO
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{bundle.months} meses</p>
                  <p className="text-sm text-muted">${getMonthlyPrice()}/mes × {bundle.months}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted line-through">${(price * bundle.months).toFixed(2)}</p>
                  <p className="text-xl font-bold text-gradient">${(price * bundle.months * (1 - bundle.discountPercent / 100)).toFixed(2)}</p>
                </div>
              </div>
              {selectedBundle?.id === bundle.id && (
                <div className="mt-2 flex items-center gap-1.5 text-pink-400 text-xs">
                  <Check className="w-3.5 h-3.5" />
                  Seleccionado
                </div>
              )}
            </button>
          ))}

          {/* Benefits */}
          <div className="space-y-2 pt-2">
            {[
              'Acceso a todo el contenido exclusivo',
              'Mensajes directos con la creadora',
              'Contenido nuevo cada semana',
              'Cancela cuando quieras',
            ].map(benefit => (
              <div key={benefit} className="flex items-center gap-2 text-sm text-white/70">
                <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                {benefit}
              </div>
            ))}
          </div>

          <button onClick={() => setStep('payment')} className="btn-primary w-full py-3 text-base">
            Continuar · ${getPrice()}{selectedBundle ? '' : '/mes'}
          </button>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted mb-4">
              <button onClick={() => setStep('plan')} className="hover:text-white transition-colors">← Cambiar plan</button>
            </div>

            <div className="bg-white/5 rounded-xl p-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-muted">Total a pagar</span>
              <span className="font-bold">${getPrice()}{!selectedBundle && '/mes'}</span>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium">Información de pago</label>
              <div className="input p-0 overflow-hidden">
                <div className="p-3">
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
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted">
            <Shield className="w-3.5 h-3.5 text-green-400" />
            Pago procesado de forma segura por Stripe. No almacenamos tu tarjeta.
          </div>

          <button
            onClick={handleSubscribe}
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
                Suscribirse · ${getPrice()}{!selectedBundle && '/mes'}
              </span>
            )}
          </button>

          <p className="text-xs text-center text-muted">
            Al suscribirte aceptas nuestros <a href="/terms" className="text-pink-400 hover:underline">Términos de servicio</a> y <a href="/privacy" className="text-pink-400 hover:underline">Política de privacidad</a>
          </p>
        </div>
      )}
    </div>
  );
}
