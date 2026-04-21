import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createNotification } from '../notifications/notifications.service';
import { checkSubscription } from '../subscriptions/subscriptions.service';
import { processPayment } from '../payments/payments.service';
import { generateBlurUrl } from '../config/media';
import { io } from '../main';
import { logger } from '../config/logger';

const router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createPostSchema = z.object({
  caption: z.string().max(2000).optional(),
  isPPV: z.boolean().default(false),
  ppvPrice: z.number().min(1).max(500).optional(),
  isFree: z.boolean().default(false),
  scheduledAt: z.string().datetime().optional(),
  mediaUrls: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['IMAGE', 'VIDEO', 'AUDIO']),
    thumbnailUrl: z.string().url().optional(),
    duration: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    fileSize: z.number().optional(),
    mimeType: z.string().optional(),
  })).min(1).max(20),
});

const commentSchema = z.object({
  content: z.string().min(1).max(500),
  parentId: z.string().optional(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/posts/feed
 * Get personalized feed for authenticated user
 */
router.get('/feed', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get creator IDs that user subscribes to
    const subscriptions = await prisma.subscription.findMany({
      where: { subscriberId: userId, status: 'ACTIVE' },
      select: { creatorId: true },
    });
    const creatorIds = subscriptions.map(s => s.creatorId);

    if (creatorIds.length === 0) {
      return res.json({ posts: [], total: 0, page, hasMore: false });
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: {
          creatorId: { in: creatorIds },
          isArchived: false,
          OR: [
            { scheduledAt: null },
            { scheduledAt: { lte: new Date() } },
          ],
        },
        include: {
          creator: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
          },
          media: { orderBy: { order: 'asc' } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.post.count({
        where: { creatorId: { in: creatorIds }, isArchived: false },
      }),
    ]);

    // Get user's likes and unlocked PPV
    const postIds = posts.map(p => p.id);
    const [userLikes, userUnlocks] = await Promise.all([
      prisma.like.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
      prisma.ppvUnlock.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
    ]);
    const likedPostIds = new Set(userLikes.map(l => l.postId));
    const unlockedPostIds = new Set(userUnlocks.map(u => u.postId));

    const processedPosts = posts.map(post => {
      const isLocked = post.isPPV && !unlockedPostIds.has(post.id);
      return {
        ...post,
        isLiked: likedPostIds.has(post.id),
        isUnlocked: unlockedPostIds.has(post.id),
        media: post.media.map(m => ({
          ...m,
          url: isLocked ? null : m.url,
          blurUrl: isLocked ? m.blurUrl : null,
        })),
      };
    });

    res.json({
      posts: processedPosts,
      total,
      page,
      hasMore: skip + posts.length < total,
    });
  } catch (error) {
    logger.error('Feed error', error);
    res.status(500).json({ error: 'Error al cargar el feed' });
  }
});

/**
 * POST /api/posts
 * Create a new post (Creator only)
 */
router.post('/', authenticate, validate(createPostSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const userRole = (req as any).role;

    if (userRole !== 'CREATOR') {
      return res.status(403).json({ error: 'Solo los creadores pueden publicar' });
    }

    const { caption, isPPV, ppvPrice, isFree, scheduledAt, mediaUrls } = req.body;

    if (isPPV && !ppvPrice) {
      return res.status(400).json({ error: 'El precio PPV es requerido para contenido de pago' });
    }

    const publishedAt = scheduledAt ? null : new Date();

    const post = await prisma.post.create({
      data: {
        creatorId: userId,
        caption,
        isPPV,
        ppvPrice: isPPV ? ppvPrice : null,
        isFree,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        publishedAt,
        media: {
          create: await Promise.all(mediaUrls.map(async (m: any, index: number) => ({
            type: m.type,
            url: m.url,
            blurUrl: m.type === 'IMAGE' ? await generateBlurUrl(m.url) : null,
            thumbnailUrl: m.thumbnailUrl,
            duration: m.duration,
            width: m.width,
            height: m.height,
            fileSize: m.fileSize,
            mimeType: m.mimeType,
            order: index,
          }))),
        },
      },
      include: {
        media: true,
        creator: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    // Update creator post count
    await prisma.creatorProfile.update({
      where: { userId },
      data: { totalPosts: { increment: 1 } },
    });

    // Notify subscribers if not scheduled
    if (!scheduledAt) {
      const subscribers = await prisma.subscription.findMany({
        where: { creatorId: userId, status: 'ACTIVE' },
        select: { subscriberId: true },
      });

      for (const sub of subscribers) {
        await createNotification({
          userId: sub.subscriberId,
          type: 'POST_SCHEDULED',
          title: 'Nueva publicación',
          body: `${post.creator.displayName} publicó nuevo contenido`,
          data: { postId: post.id, creatorId: userId },
        });
      }
    }

    res.status(201).json(post);
  } catch (error) {
    logger.error('Create post error', error);
    res.status(500).json({ error: 'Error al crear publicación' });
  }
});

/**
 * GET /api/posts/:id
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const post = await prisma.post.findUnique({
      where: { id, isArchived: false },
      include: {
        creator: {
          select: {
            id: true, username: true, displayName: true,
            avatarUrl: true, isVerified: true, creatorProfile: {
              select: { subscriptionPrice: true, subscriberCount: true },
            },
          },
        },
        media: { orderBy: { order: 'asc' } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

    let isSubscribed = false;
    let isUnlocked = false;
    let isLiked = false;

    if (userId) {
      [isSubscribed, isUnlocked, isLiked] = await Promise.all([
        checkSubscription(userId, post.creatorId),
        prisma.ppvUnlock.findFirst({ where: { userId, postId: id } }).then(Boolean),
        prisma.like.findFirst({ where: { userId, postId: id } }).then(Boolean),
      ]);
    }

    // Increment view count
    if (userId && userId !== post.creatorId) {
      await prisma.post.update({ where: { id }, data: { viewsCount: { increment: 1 } } });
    }

    const isLocked = post.isPPV && !isUnlocked && !post.isFree && userId !== post.creatorId;

    res.json({
      ...post,
      isLiked,
      isSubscribed,
      isUnlocked,
      media: post.media.map(m => ({
        ...m,
        url: isLocked ? null : m.url,
        blurUrl: isLocked ? m.blurUrl : null,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener publicación' });
  }
});

/**
 * PUT /api/posts/:id
 */
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { caption, isPinned, isArchived } = req.body;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
    if (post.creatorId !== userId) return res.status(403).json({ error: 'Sin permiso' });

    const updated = await prisma.post.update({
      where: { id },
      data: { caption, isPinned, isArchived },
      include: { media: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar publicación' });
  }
});

/**
 * DELETE /api/posts/:id
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
    if (post.creatorId !== userId) return res.status(403).json({ error: 'Sin permiso' });

    await prisma.post.update({ where: { id }, data: { isArchived: true } });
    await prisma.creatorProfile.update({
      where: { userId },
      data: { totalPosts: { decrement: 1 } },
    });

    res.json({ message: 'Publicación eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar publicación' });
  }
});

/**
 * POST /api/posts/:id/like
 */
router.post('/:id/like', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId: id, userId } },
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      await prisma.post.update({ where: { id }, data: { likesCount: { decrement: 1 } } });
      await prisma.creatorProfile.update({
        where: { userId: post.creatorId },
        data: { totalLikes: { decrement: 1 } },
      });
      return res.json({ liked: false });
    }

    await prisma.like.create({ data: { postId: id, userId } });
    await prisma.post.update({ where: { id }, data: { likesCount: { increment: 1 } } });
    await prisma.creatorProfile.update({
      where: { userId: post.creatorId },
      data: { totalLikes: { increment: 1 } },
    });

    if (post.creatorId !== userId) {
      await createNotification({
        userId: post.creatorId,
        type: 'NEW_LIKE',
        title: 'Nuevo me gusta',
        body: 'A alguien le gustó tu publicación',
        data: { postId: id, userId },
      });
    }

    res.json({ liked: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar me gusta' });
  }
});

/**
 * POST /api/posts/:id/unlock
 * Unlock PPV post
 */
router.post('/:id/unlock', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { paymentMethodId } = req.body;

    const post = await prisma.post.findUnique({
      where: { id },
      include: { creator: { select: { username: true, displayName: true } } },
    });

    if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
    if (!post.isPPV) return res.status(400).json({ error: 'Esta publicación no es PPV' });
    if (post.creatorId === userId) return res.status(400).json({ error: 'No puedes comprar tu propio contenido' });

    const existing = await prisma.ppvUnlock.findFirst({ where: { userId, postId: id } });
    if (existing) return res.status(400).json({ error: 'Ya tienes acceso a esta publicación' });

    // Process payment
    const payment = await processPayment({
      userId,
      amount: post.ppvPrice!.toNumber(),
      description: `PPV: ${post.creator.displayName}`,
      paymentMethodId,
      metadata: { type: 'PPV_POST', postId: id, creatorId: post.creatorId },
    });

    await prisma.$transaction(async (tx) => {
      await tx.ppvUnlock.create({ data: { userId, postId: id, amountPaid: post.ppvPrice! } });

      const platformFee = post.ppvPrice!.toNumber() * 0.2;
      const creatorAmount = post.ppvPrice!.toNumber() - platformFee;

      await tx.wallet.update({
        where: { userId: post.creatorId },
        data: {
          pendingBalance: { increment: creatorAmount },
          totalEarned: { increment: creatorAmount },
        },
      });

      await tx.transaction.create({
        data: {
          userId: post.creatorId,
          type: 'PPV_POST',
          status: 'COMPLETED',
          amount: post.ppvPrice!,
          netAmount: creatorAmount,
          platformFee,
          description: `PPV desbloqueado`,
          stripePaymentId: payment.id,
        },
      });
    });

    await createNotification({
      userId: post.creatorId,
      type: 'PPV_UNLOCK',
      title: 'Contenido desbloqueado',
      body: `Alguien compró tu publicación por $${post.ppvPrice}`,
      data: { postId: id, amount: post.ppvPrice },
    });

    res.json({ message: 'Contenido desbloqueado exitosamente', unlocked: true });
  } catch (error) {
    logger.error('PPV unlock error', error);
    res.status(500).json({ error: 'Error al desbloquear contenido' });
  }
});

/**
 * GET /api/posts/:id/comments
 */
router.get('/:id/comments', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const comments = await prisma.comment.findMany({
      where: { postId: id, parentId: null, isDeleted: false },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        replies: {
          where: { isDeleted: false },
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({ comments, page });
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar comentarios' });
  }
});

/**
 * POST /api/posts/:id/comments
 */
router.post('/:id/comments', authenticate, validate(commentSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { content, parentId } = req.body;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

    const isSubscribed = await checkSubscription(userId, post.creatorId);
    if (!isSubscribed && post.creatorId !== userId) {
      return res.status(403).json({ error: 'Suscríbete para comentar' });
    }

    const comment = await prisma.comment.create({
      data: { postId: id, userId, content, parentId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    await prisma.post.update({ where: { id }, data: { commentsCount: { increment: 1 } } });

    if (post.creatorId !== userId) {
      await createNotification({
        userId: post.creatorId,
        type: 'NEW_COMMENT',
        title: 'Nuevo comentario',
        body: `${comment.user.displayName}: ${content.substring(0, 50)}`,
        data: { postId: id, commentId: comment.id },
      });
    }

    // Real-time emit
    io.to(`post:${id}`).emit('new_comment', comment);

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Error al comentar' });
  }
});

/**
 * POST /api/posts/:id/tip
 */
router.post('/:id/tip', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { amount, message, paymentMethodId } = req.body;

    if (!amount || amount < 1) return res.status(400).json({ error: 'Monto mínimo: $1' });

    const post = await prisma.post.findUnique({
      where: { id },
      include: { creator: true },
    });
    if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

    const payment = await processPayment({
      userId,
      amount,
      description: `Propina para ${post.creator.displayName}`,
      paymentMethodId,
      metadata: { type: 'TIP', postId: id, creatorId: post.creatorId },
    });

    await prisma.$transaction(async (tx) => {
      await tx.tip.create({
        data: { senderId: userId, creatorId: post.creatorId, postId: id, amount, message },
      });

      const platformFee = amount * 0.2;
      const creatorAmount = amount - platformFee;

      await tx.wallet.update({
        where: { userId: post.creatorId },
        data: {
          pendingBalance: { increment: creatorAmount },
          totalEarned: { increment: creatorAmount },
        },
      });

      await tx.post.update({ where: { id }, data: { tipsCount: { increment: 1 } } });
    });

    await createNotification({
      userId: post.creatorId,
      type: 'NEW_TIP',
      title: `¡Recibiste una propina de $${amount}!`,
      body: message || 'Sin mensaje',
      data: { postId: id, amount, senderId: userId },
    });

    res.json({ message: 'Propina enviada exitosamente' });
  } catch (error) {
    logger.error('Tip error', error);
    res.status(500).json({ error: 'Error al enviar propina' });
  }
});

/**
 * POST /api/posts/:id/save
 */
router.post('/:id/save', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const existing = await prisma.savedPost.findUnique({
      where: { userId_postId: { userId, postId: id } },
    });

    if (existing) {
      await prisma.savedPost.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }

    await prisma.savedPost.create({ data: { userId, postId: id } });
    res.json({ saved: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar' });
  }
});

export default router;
