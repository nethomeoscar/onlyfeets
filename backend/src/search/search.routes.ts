import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/search/creators
 */
router.get('/creators', optionalAuth, async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string || '';
    const category = req.query.category as string || 'all';
    const minPrice = parseFloat(req.query.minPrice as string) || 0;
    const maxPrice = parseFloat(req.query.maxPrice as string) || 9999;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const where: any = {
      role: 'CREATOR',
      isBanned: false,
      isActive: true,
      creatorProfile: {
        isPublic: true,
        subscriptionPrice: { gte: minPrice, lte: maxPrice },
      },
    };

    if (q) {
      where.OR = [
        { username: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { bio: { contains: q, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { creatorProfile: { subscriberCount: 'desc' } };

    switch (category) {
      case 'trending':
        orderBy = { creatorProfile: { totalLikes: 'desc' } };
        break;
      case 'new':
        orderBy = { createdAt: 'desc' };
        break;
      case 'top':
        orderBy = { creatorProfile: { totalEarnings: 'desc' } };
        break;
      case 'price_low':
        orderBy = { creatorProfile: { subscriptionPrice: 'asc' } };
        break;
      case 'free_trial':
        where.creatorProfile = { ...where.creatorProfile, trialDays: { gt: 0 } };
        break;
    }

    const [creators, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          creatorProfile: {
            select: {
              subscriptionPrice: true,
              subscriberCount: true,
              totalPosts: true,
              totalLikes: true,
              trialDays: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const safeCreators = creators.map(({ passwordHash, twoFactorSecret, ...c }) => c);

    res.json({ creators: safeCreators, total, page, hasMore: page * limit < total });
  } catch (error) {
    res.status(500).json({ error: 'Error en la búsqueda' });
  }
});

/**
 * GET /api/search/posts
 */
router.get('/posts', optionalAuth, async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string || '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    if (!q) return res.json({ posts: [], total: 0 });

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: {
          isArchived: false,
          isFree: true,
          caption: { contains: q, mode: 'insensitive' },
        },
        include: {
          creator: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
          },
          media: { take: 1 },
          _count: { select: { likes: true } },
        },
        orderBy: { viewsCount: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({
        where: { isArchived: false, isFree: true, caption: { contains: q, mode: 'insensitive' } },
      }),
    ]);

    res.json({ posts, total, page });
  } catch (error) {
    res.status(500).json({ error: 'Error en la búsqueda' });
  }
});

/**
 * GET /api/search/suggest
 * Autocomplete suggestions
 */
router.get('/suggest', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string || '';
    if (q.length < 2) return res.json({ suggestions: [] });

    const users = await prisma.user.findMany({
      where: {
        role: 'CREATOR',
        isBanned: false,
        OR: [
          { username: { startsWith: q, mode: 'insensitive' } },
          { displayName: { startsWith: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
      take: 5,
    });

    res.json({ suggestions: users });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener sugerencias' });
  }
});

export default router;
