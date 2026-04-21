import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

// ─── Payment Processing Helper ────────────────────────────────────────────────

export const processPayment = async ({
  userId,
  amount,
  description,
  paymentMethodId,
  metadata,
}: {
  userId: string;
  amount: number;
  description: string;
  paymentMethodId: string;
  metadata: Record<string, string>;
}) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Usuario no encontrado');

  let customerId = await getOrCreateStripeCustomer(userId, user.email);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    customer: customerId,
    payment_method: paymentMethodId,
    confirm: true,
    description,
    metadata: { userId, ...metadata },
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  });

  if (paymentIntent.status !== 'succeeded') {
    throw new Error('Pago fallido');
  }

  return paymentIntent;
};

const getOrCreateStripeCustomer = async (userId: string, email: string): Promise<string> => {
  const cacheKey = `stripe_customer:${userId}`;
  
  // Check in transactions
  const existingTx = await prisma.transaction.findFirst({
    where: { userId, stripePaymentId: { not: null } },
    orderBy: { createdAt: 'desc' },
  });

  // Look up by email in Stripe
  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length > 0) return customers.data[0].id;

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });
  return customer.id;
};

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/payments/setup-intent
 * Get setup intent to save card
 */
router.post('/setup-intent', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const customerId = await getOrCreateStripeCustomer(userId, user.email);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    logger.error('Setup intent error', error);
    res.status(500).json({ error: 'Error al configurar método de pago' });
  }
});

/**
 * GET /api/payments/methods
 * Get saved payment methods
 */
router.get('/methods', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) return res.json({ methods: [] });

    const methods = await stripe.paymentMethods.list({
      customer: customers.data[0].id,
      type: 'card',
    });

    res.json({
      methods: methods.data.map(m => ({
        id: m.id,
        brand: m.card?.brand,
        last4: m.card?.last4,
        expMonth: m.card?.exp_month,
        expYear: m.card?.exp_year,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener métodos de pago' });
  }
});

/**
 * DELETE /api/payments/methods/:id
 */
router.delete('/methods/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await stripe.paymentMethods.detach(req.params.id);
    res.json({ message: 'Método de pago eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar método de pago' });
  }
});

/**
 * GET /api/payments/balance
 */
router.get('/balance', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return res.status(404).json({ error: 'Billetera no encontrada' });
    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener balance' });
  }
});

/**
 * GET /api/payments/history
 */
router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);

    res.json({ transactions, total, page, hasMore: page * limit < total });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

/**
 * POST /api/payments/withdraw
 */
router.post('/withdraw', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { amount, method, accountDetails } = req.body;

    if (!amount || amount < 20) {
      return res.status(400).json({ error: 'Monto mínimo de retiro: $20' });
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return res.status(404).json({ error: 'Billetera no encontrada' });

    if (wallet.availableBalance.toNumber() < amount) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // Check KYC
    const kyc = await prisma.kycVerification.findUnique({ where: { userId } });
    if (!kyc || kyc.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Debes completar la verificación de identidad para retirar fondos' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId },
        data: {
          availableBalance: { decrement: amount },
          totalWithdrawn: { increment: amount },
        },
      });

      await tx.withdrawal.create({
        data: {
          userId,
          amount,
          method,
          accountDetails: accountDetails, // Should be encrypted
          status: 'PENDING',
        },
      });
    });

    res.json({ message: 'Solicitud de retiro enviada. Se procesará en 3-5 días hábiles.' });
  } catch (error) {
    logger.error('Withdrawal error', error);
    res.status(500).json({ error: 'Error al procesar retiro' });
  }
});

/**
 * POST /api/payments/webhook
 * Stripe webhook handler
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    logger.error('Webhook signature error', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await handleSubscriptionPayment(invoice);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: String(invoice.subscription) },
            data: { status: 'PAST_DUE' },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status === 'active' ? 'ACTIVE' : 
                       sub.status === 'canceled' ? 'CANCELLED' :
                       sub.status === 'past_due' ? 'PAST_DUE' : 'ACTIVE';
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status: status as any,
            expiresAt: new Date(sub.current_period_end * 1000),
          },
        });
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing error', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

const handleSubscriptionPayment = async (invoice: Stripe.Invoice) => {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: String(invoice.subscription) },
  });
  if (!subscription) return;

  const amount = invoice.amount_paid / 100;
  const platformFee = amount * 0.2;
  const creatorAmount = amount - platformFee;

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId: subscription.creatorId },
      data: {
        pendingBalance: { increment: creatorAmount },
        totalEarned: { increment: creatorAmount },
      },
    });

    await tx.transaction.create({
      data: {
        userId: subscription.creatorId,
        type: 'SUBSCRIPTION',
        status: 'COMPLETED',
        amount,
        netAmount: creatorAmount,
        platformFee,
        stripePaymentId: invoice.payment_intent as string,
        description: 'Pago de suscripción',
      },
    });

    // Handle referral commissions
    const referral = await tx.referral.findFirst({
      where: { referredId: subscription.creatorId },
    });
    if (referral) {
      const commission = creatorAmount * (referral.commissionRate.toNumber() / 100);
      await tx.wallet.update({
        where: { userId: referral.referrerId },
        data: {
          availableBalance: { increment: commission },
          totalEarned: { increment: commission },
        },
      });
      await tx.referral.update({
        where: { id: referral.id },
        data: { totalEarned: { increment: commission } },
      });
    }
  });
};

export default router;
