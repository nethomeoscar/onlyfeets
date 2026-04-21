import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { createNotification } from '../notifications/notifications.service';
import { logger } from '../config/logger';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

// ─── Helper ───────────────────────────────────────────────────────────────────

export const checkSubscription = async (userId: string, creatorId: string): Promise<boolean> => {
  if (userId === creatorId) return true;
  const sub = await prisma.subscription.findUnique({
    where: {
      subscriberId_creatorId: { subscriberId: userId, creatorId },
    },
  });
  return sub?.status === 'ACTIVE' || sub?.status === 'TRIAL';
};

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/subscriptions
 * Subscribe to a creator
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { creatorId, paymentMethodId, promotionId, bundleMonths } = req.body;

    if (userId === creatorId) {
      return res.status(400).json({ error: 'No puedes suscribirte a ti mismo' });
    }

    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      include: { creatorProfile: { include: { promotions: true, bundles: true } } },
    });

    if (!creator?.creatorProfile) {
      return res.status(404).json({ error: 'Creador no encontrado' });
    }

    const existing = await prisma.subscription.findUnique({
      where: { subscriberId_creatorId: { subscriberId: userId, creatorId } },
    });

    if (existing?.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Ya estás suscrito a este creador' });
    }

    const subscriber = await prisma.user.findUnique({ where: { id: userId } });
    if (!subscriber) return res.status(404).json({ error: 'Usuario no encontrado' });

    let price = creator.creatorProfile.subscriptionPrice.toNumber();
    let discountPercent = 0;

    // Apply promotion
    if (promotionId) {
      const promo = creator.creatorProfile.promotions.find(p => p.id === promotionId && p.isActive);
      if (promo) {
        discountPercent = promo.discountPercent;
        price = price * (1 - discountPercent / 100);
      }
    }

    // Apply bundle discount
    if (bundleMonths) {
      const bundle = creator.creatorProfile.bundles.find(b => b.months === bundleMonths && b.isActive);
      if (bundle) {
        discountPercent = Math.max(discountPercent, bundle.discountPercent);
        price = creator.creatorProfile.subscriptionPrice.toNumber() * bundleMonths * (1 - bundle.discountPercent / 100);
      }
    }

    // Handle trial
    const isTrial = creator.creatorProfile.trialDays > 0 && !existing;

    // Get or create Stripe customer
    const customers = await stripe.customers.list({ email: subscriber.email, limit: 1 });
    let customerId = customers.data[0]?.id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: subscriber.email,
        metadata: { userId },
      });
      customerId = customer.id;
    }

    // Attach payment method
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    // Create Stripe subscription
    let stripePrice: Stripe.Price;
    if (bundleMonths) {
      // One-time payment for bundle
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(price * 100),
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        description: `Suscripción ${bundleMonths} meses - ${creator.displayName}`,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { type: 'SUBSCRIPTION', subscriberId: userId, creatorId },
      });

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ error: 'Pago fallido' });
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + bundleMonths);

      const subscription = await prisma.$transaction(async (tx) => {
        const sub = await tx.subscription.upsert({
          where: { subscriberId_creatorId: { subscriberId: userId, creatorId } },
          create: {
            subscriberId: userId,
            creatorId,
            status: 'ACTIVE',
            price,
            expiresAt,
            isRenewing: false,
            promotionId: promotionId || null,
          },
          update: {
            status: 'ACTIVE',
            price,
            expiresAt,
            isRenewing: false,
            cancelledAt: null,
          },
        });

        await tx.creatorProfile.update({
          where: { userId: creatorId },
          data: { subscriberCount: { increment: 1 } },
        });

        const platformFee = price * 0.2;
        const creatorAmount = price - platformFee;
        await tx.wallet.update({
          where: { userId: creatorId },
          data: {
            pendingBalance: { increment: creatorAmount },
            totalEarned: { increment: creatorAmount },
          },
        });

        await tx.transaction.create({
          data: {
            userId: creatorId,
            type: 'SUBSCRIPTION',
            status: 'COMPLETED',
            amount: price,
            netAmount: creatorAmount,
            platformFee,
            stripePaymentId: paymentIntent.id,
            description: `Suscripción ${bundleMonths} meses`,
          },
        });

        return sub;
      });

      await createNotification({
        userId: creatorId,
        type: 'NEW_SUBSCRIBER',
        title: 'Nuevo suscriptor',
        body: `${subscriber.displayName || subscriber.username} se suscribió por ${bundleMonths} meses`,
        data: { subscriberId: userId },
      });

      return res.status(201).json({ subscription, message: 'Suscripción creada exitosamente' });
    }

    // Recurring subscription
    const stripePriceData = await stripe.prices.create({
      unit_amount: Math.round(price * 100),
      currency: 'usd',
      recurring: { interval: 'month' },
      product_data: { name: `Suscripción - ${creator.displayName}` },
    });

    const stripeSub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: stripePriceData.id }],
      trial_period_days: isTrial ? creator.creatorProfile.trialDays : undefined,
      metadata: { subscriberId: userId, creatorId },
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
    });

    const expiresAt = new Date(stripeSub.current_period_end * 1000);

    const subscription = await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.upsert({
        where: { subscriberId_creatorId: { subscriberId: userId, creatorId } },
        create: {
          subscriberId: userId,
          creatorId,
          status: isTrial ? 'TRIAL' : 'ACTIVE',
          price,
          expiresAt,
          stripeSubscriptionId: stripeSub.id,
          promotionId: promotionId || null,
        },
        update: {
          status: isTrial ? 'TRIAL' : 'ACTIVE',
          price,
          expiresAt,
          stripeSubscriptionId: stripeSub.id,
          cancelledAt: null,
        },
      });

      if (!isTrial) {
        await tx.creatorProfile.update({
          where: { userId: creatorId },
          data: { subscriberCount: { increment: 1 } },
        });
      }

      return sub;
    });

    // Send welcome message if creator has one
    const profile = creator.creatorProfile;
    if (profile.welcomeMessage) {
      await prisma.message.create({
        data: {
          senderId: creatorId,
          receiverId: userId,
          content: profile.welcomeMessage,
          isMassDM: false,
        },
      });
    }

    await createNotification({
      userId: creatorId,
      type: 'NEW_SUBSCRIBER',
      title: 'Nuevo suscriptor',
      body: `${subscriber.displayName || subscriber.username} se suscribió${isTrial ? ' (prueba gratuita)' : ''}`,
      data: { subscriberId: userId },
    });

    res.status(201).json({ subscription, message: 'Suscripción creada exitosamente' });
  } catch (error) {
    logger.error('Subscribe error', error);
    res.status(500).json({ error: 'Error al procesar suscripción' });
  }
});

/**
 * DELETE /api/subscriptions/:creatorId
 * Cancel subscription
 */
router.delete('/:creatorId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { creatorId } = req.params;

    const subscription = await prisma.subscription.findUnique({
      where: { subscriberId_creatorId: { subscriberId: userId, creatorId } },
    });

    if (!subscription) return res.status(404).json({ error: 'Suscripción no encontrada' });
    if (subscription.status === 'CANCELLED') {
      return res.status(400).json({ error: 'La suscripción ya está cancelada' });
    }

    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), isRenewing: false },
    });

    await prisma.creatorProfile.update({
      where: { userId: creatorId },
      data: { subscriberCount: { decrement: 1 } },
    });

    res.json({
      message: 'Suscripción cancelada. Mantendrás el acceso hasta que expire el período actual.',
      expiresAt: subscription.expiresAt,
    });
  } catch (error) {
    logger.error('Cancel subscription error', error);
    res.status(500).json({ error: 'Error al cancelar suscripción' });
  }
});

/**
 * GET /api/subscriptions/mine
 * Get current user's subscriptions
 */
router.get('/mine', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const subscriptions = await prisma.subscription.findMany({
      where: { subscriberId: userId },
      include: {
        creator: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true,
            isVerified: true, creatorProfile: { select: { subscriberCount: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ subscriptions });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener suscripciones' });
  }
});

/**
 * GET /api/subscriptions/subscribers
 * Get creator's subscribers
 */
router.get('/subscribers', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const search = req.query.search as string;

    const [subscribers, total] = await Promise.all([
      prisma.subscription.findMany({
        where: {
          creatorId: userId,
          status: { in: ['ACTIVE', 'TRIAL'] },
          ...(search ? {
            subscriber: {
              OR: [
                { username: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
              ],
            },
          } : {}),
        },
        include: {
          subscriber: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, lastSeenAt: true },
          },
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.subscription.count({
        where: { creatorId: userId, status: { in: ['ACTIVE', 'TRIAL'] } },
      }),
    ]);

    res.json({ subscribers, total, page, hasMore: page * limit < total });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener suscriptores' });
  }
});

export default router;
