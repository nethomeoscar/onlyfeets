import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { checkSubscription } from '../subscriptions/subscriptions.service';
import { logger } from '../config/logger';

const router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal('')),
  location: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
  coverUrl: z.string().url().optional(),
  subscriptionPrice: z.number().min(3).max(500).optional(),
  trialDays: z.number().min(0).max(30).optional(),
  welcomeMessage: z.string().max(500).optional(),
  thankYouMessage: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  showSubscriberCount: z.boolean().optional(),
  showPostCount: z.boolean().optional(),
  blockedCountries: z.array(z.string()).optional(),
});

const tipMenuSchema = z.object({
  items: z.array(z.object({
    id: z.string().optional(),
    description: z.string().min(1).max(100),
    amount: z.number().min(1).max(500),
    emoji: z.string().max(4).optional(),
    isActive: z.boolean().default(true),
    order: z.number().default(0),
  })).max(20),
});

const promotionSchema = z.object({
  discountPercent: z.number().min(1).max(80),
  durationMonths: z.number().min(1).max(12),
  maxUses: z.number().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

const bundleSchema = z.object({
  months: z.number().min(2).max(12),
  discountPercent: z.number().min(1).max(80),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/creators/:username
 * Get creator public profile
 */
router.get('/:username', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const currentUserId = (req as any).userId;

    const creator = await prisma.user.findUnique({
      where: { username, role: 'CREATOR' },
      include: {
        creatorProfile: {
          include: {
            tipMenuItems: { where: { isActive: true }, orderBy: { order: 'asc' } },
            promotions: { where: { isActive: true, expiresAt: { gt: new Date() } } },
            bundles: { where: { isActive: true } },
          },
        },
      },
    });

    if (!creator || creator.isBanned) {
      return res.status(404).json({ error: 'Creadora no encontrada' });
    }

    // Check block
    if (currentUserId) {
      const blocked = await prisma.blockedUser.findFirst({
        where: {
          OR: [
            { blockerId: creator.id, blockedId: currentUserId },
            { blockerId: currentUserId, blockedId: creator.id },
          ],
        },
      });
      if (blocked) return res.status(403).json({ error: 'No puedes ver este perfil' });
    }

    // Check blocked country
    if (creator.creatorProfile?.blockedCountries?.length && req.headers['cf-ipcountry']) {
      const userCountry = req.headers['cf-ipcountry'] as string;
      if (creator.creatorProfile.blockedCountries.includes(userCountry)) {
        return res.status(403).json({ error: 'Este contenido no está disponible en tu región' });
      }
    }

    let isSubscribed = false;
    if (currentUserId) {
      isSubscribed = await checkSubscription(currentUserId, creator.id);
    }

    const { passwordHash, twoFactorSecret, ...safeCreator } = creator;

    res.json({
      ...safeCreator,
      isSubscribed,
      isOwner: currentUserId === creator.id,
    });
  } catch (error) {
    logger.error('Get creator error', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

/**
 * GET /api/creators/:username/posts
 */
router.get('/:username/posts', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const currentUserId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const tab = req.query.tab as string || 'posts';
    const limit = 12;

    const creator = await prisma.user.findUnique({
      where: { username, role: 'CREATOR' },
    });
    if (!creator) return res.status(404).json({ error: 'Creadora no encontrada' });

    const isOwner = currentUserId === creator.id;
    const isSubscribed = currentUserId ? await checkSubscription(currentUserId, creator.id) : false;
    const canView = isOwner || isSubscribed;

    const where: any = {
      creatorId: creator.id,
      isArchived: false,
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    };

    if (tab === 'media') where.media = { some: {} };
    if (tab === 'locked') where.isPPV = true;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          creator: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
          },
          media: { take: 1, orderBy: { order: 'asc' } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    // Get user interactions
    const postIds = posts.map(p => p.id);
    const [likes, unlocks] = currentUserId ? await Promise.all([
      prisma.like.findMany({ where: { userId: currentUserId, postId: { in: postIds } }, select: { postId: true } }),
      prisma.ppvUnlock.findMany({ where: { userId: currentUserId, postId: { in: postIds } }, select: { postId: true } }),
    ]) : [[], []];

    const likedSet = new Set(likes.map(l => l.postId));
    const unlockedSet = new Set(unlocks.map(u => u.postId));

    const processedPosts = posts.map(post => {
      const isLocked = post.isPPV && !unlockedSet.has(post.id) && !post.isFree && !isOwner;
      return {
        ...post,
        isLiked: likedSet.has(post.id),
        isUnlocked: unlockedSet.has(post.id),
        isSubscribed,
        media: post.media.map(m => ({
          ...m,
          url: isLocked ? null : m.url,
          blurUrl: isLocked ? m.blurUrl : null,
        })),
      };
    });

    res.json({ posts: processedPosts, total, page, hasMore: page * limit < total });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

/**
 * PUT /api/creators/profile
 * Update creator profile
 */
router.put('/profile', authenticate, validate(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const data = req.body;

    const { subscriptionPrice, trialDays, welcomeMessage, thankYouMessage,
            isPublic, showSubscriberCount, showPostCount, blockedCountries,
            ...userFields } = data;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(userFields).length > 0) {
        await tx.user.update({ where: { id: userId }, data: userFields });
      }

      const profileData: any = {};
      if (subscriptionPrice !== undefined) profileData.subscriptionPrice = subscriptionPrice;
      if (trialDays !== undefined) profileData.trialDays = trialDays;
      if (welcomeMessage !== undefined) profileData.welcomeMessage = welcomeMessage;
      if (thankYouMessage !== undefined) profileData.thankYouMessage = thankYouMessage;
      if (isPublic !== undefined) profileData.isPublic = isPublic;
      if (showSubscriberCount !== undefined) profileData.showSubscriberCount = showSubscriberCount;
      if (showPostCount !== undefined) profileData.showPostCount = showPostCount;
      if (blockedCountries !== undefined) profileData.blockedCountries = blockedCountries;

      if (Object.keys(profileData).length > 0) {
        await tx.creatorProfile.update({ where: { userId }, data: profileData });
      }
    });

    const updated = await prisma.user.findUnique({
      where: { id: userId },
      include: { creatorProfile: true },
    });

    const { passwordHash, twoFactorSecret, ...safe } = updated!;
    res.json(safe);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

/**
 * GET /api/creators/stats
 * Creator dashboard statistics
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
      profile, wallet,
      subscribersThisMonth, subscribersLastMonth,
      earningsThisMonth, earningsLastMonth,
      totalLikesThisMonth, totalViews,
    ] = await Promise.all([
      prisma.creatorProfile.findUnique({ where: { userId } }),
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.subscription.count({ where: { creatorId: userId, startedAt: { gte: thirtyDaysAgo } } }),
      prisma.subscription.count({ where: { creatorId: userId, startedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.transaction.aggregate({
        where: { userId, status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
        _sum: { netAmount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, status: 'COMPLETED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
        _sum: { netAmount: true },
      }),
      prisma.like.count({
        where: { post: { creatorId: userId }, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.post.aggregate({
        where: { creatorId: userId },
        _sum: { viewsCount: true },
      }),
    ]);

    const monthlyEarnings = earningsThisMonth._sum.netAmount?.toNumber() ?? 0;
    const lastMonthEarnings = earningsLastMonth._sum.netAmount?.toNumber() ?? 0;

    const calcGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    res.json({
      subscriberCount: profile?.subscriberCount ?? 0,
      subscriberGrowth: calcGrowth(subscribersThisMonth, subscribersLastMonth),
      totalPosts: profile?.totalPosts ?? 0,
      totalLikes: profile?.totalLikes ?? 0,
      totalViews: totalViews._sum.viewsCount ?? 0,
      likesGrowth: 0,
      monthlyEarnings,
      earningsGrowth: calcGrowth(monthlyEarnings, lastMonthEarnings),
      availableBalance: wallet?.availableBalance?.toNumber() ?? 0,
      pendingBalance: wallet?.pendingBalance?.toNumber() ?? 0,
      totalEarned: wallet?.totalEarned?.toNumber() ?? 0,
      totalWithdrawn: wallet?.totalWithdrawn?.toNumber() ?? 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

/**
 * GET /api/creators/earnings/chart
 */
router.get('/earnings/chart', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const days = parseInt(req.query.days as string?.replace('d', '') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [transactions, newSubs] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, status: 'COMPLETED', createdAt: { gte: startDate } },
        select: { netAmount: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.subscription.findMany({
        where: { creatorId: userId, startedAt: { gte: startDate } },
        select: { startedAt: true },
        orderBy: { startedAt: 'asc' },
      }),
    ]);

    // Group by day
    const earningsByDay = new Map<string, number>();
    const subsByDay = new Map<string, number>();

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      earningsByDay.set(key, 0);
      subsByDay.set(key, 0);
    }

    transactions.forEach(tx => {
      const key = tx.createdAt.toISOString().split('T')[0];
      earningsByDay.set(key, (earningsByDay.get(key) ?? 0) + (tx.netAmount?.toNumber() ?? 0));
    });

    newSubs.forEach(sub => {
      const key = sub.startedAt.toISOString().split('T')[0];
      subsByDay.set(key, (subsByDay.get(key) ?? 0) + 1);
    });

    res.json({
      data: Array.from(earningsByDay.entries()).map(([date, amount]) => ({ date, amount })),
      subscribers: Array.from(subsByDay.entries()).map(([date, count]) => ({ date, count })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener gráficas' });
  }
});

/**
 * GET /api/creators/activity
 */
router.get('/activity', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const limit = parseInt(req.query.limit as string) || 20;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({ activities: notifications });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener actividad' });
  }
});

/**
 * PUT /api/creators/tip-menu
 */
router.put('/tip-menu', authenticate, validate(tipMenuSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { items } = req.body;

    const profile = await prisma.creatorProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    // Delete existing and recreate
    await prisma.$transaction(async (tx) => {
      await tx.tipMenuItem.deleteMany({ where: { creatorProfileId: profile.id } });
      await tx.tipMenuItem.createMany({
        data: items.map((item: any, i: number) => ({
          creatorProfileId: profile.id,
          description: item.description,
          amount: item.amount,
          emoji: item.emoji,
          isActive: item.isActive,
          order: i,
        })),
      });
    });

    const updated = await prisma.tipMenuItem.findMany({
      where: { creatorProfileId: profile.id },
      orderBy: { order: 'asc' },
    });

    res.json({ tipMenuItems: updated });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar menú de propinas' });
  }
});

/**
 * POST /api/creators/promotions
 */
router.post('/promotions', authenticate, validate(promotionSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const profile = await prisma.creatorProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    const promotion = await prisma.promotion.create({
      data: {
        creatorProfileId: profile.id,
        ...req.body,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      },
    });

    res.status(201).json(promotion);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear promoción' });
  }
});

/**
 * DELETE /api/creators/promotions/:id
 */
router.delete('/promotions/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const profile = await prisma.creatorProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    await prisma.promotion.update({
      where: { id, creatorProfileId: profile.id },
      data: { isActive: false },
    });

    res.json({ message: 'Promoción desactivada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar promoción' });
  }
});

/**
 * POST /api/creators/bundles
 */
router.post('/bundles', authenticate, validate(bundleSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const profile = await prisma.creatorProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    const existing = await prisma.bundle.findFirst({
      where: { creatorProfileId: profile.id, months: req.body.months, isActive: true },
    });
    if (existing) return res.status(400).json({ error: 'Ya tienes un bundle para este período' });

    const bundle = await prisma.bundle.create({
      data: { creatorProfileId: profile.id, ...req.body },
    });

    res.status(201).json(bundle);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear bundle' });
  }
});

/**
 * GET /api/creators/vault
 * Creator's media vault
 */
router.get('/vault', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const type = req.query.type as string;
    const limit = 24;

    const mediaWhere: any = { post: { creatorId: userId } };
    if (type) mediaWhere.type = type.toUpperCase();

    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where: mediaWhere,
        include: { post: { select: { id: true, isPPV: true, ppvPrice: true, publishedAt: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.media.count({ where: mediaWhere }),
    ]);

    res.json({ media, total, page, hasMore: page * limit < total });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener vault' });
  }
});

/**
 * GET /api/creators/referral
 */
router.get('/referral', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, createdAt: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalCommission = referrals.reduce((sum, r) => sum + r.totalEarned.toNumber(), 0);

    res.json({
      referralCode: user?.username,
      referralUrl: `${process.env.FRONTEND_URL}/register?ref=${user?.username}`,
      referrals,
      totalReferrals: referrals.length,
      totalCommission,
      commissionRate: 5,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener referidos' });
  }
});

export default router;
