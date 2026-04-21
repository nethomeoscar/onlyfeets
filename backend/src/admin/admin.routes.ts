import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate, requireRole('ADMIN'));

/**
 * GET /api/admin/stats
 * Platform-wide statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, totalCreators, totalPosts, totalSubscriptions,
      activeSubscriptions, newUsersThisMonth, revenue30d,
      pendingWithdrawals, pendingKyc,
    ] = await Promise.all([
      prisma.user.count({ where: { isBanned: false } }),
      prisma.user.count({ where: { role: 'CREATOR', isBanned: false } }),
      prisma.post.count({ where: { isArchived: false } }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.transaction.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
        _sum: { platformFee: true },
      }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      prisma.kycVerification.count({ where: { status: 'PENDING' } }),
    ]);

    const platformRevenue = revenue30d._sum.platformFee?.toNumber() ?? 0;

    res.json({
      users: { total: totalUsers, creators: totalCreators, newThisMonth: newUsersThisMonth },
      content: { totalPosts },
      subscriptions: { total: totalSubscriptions, active: activeSubscriptions },
      revenue: { platformLast30Days: platformRevenue },
      pending: { withdrawals: pendingWithdrawals, kyc: pendingKyc },
    });
  } catch (error) {
    logger.error('Admin stats error', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

/**
 * GET /api/admin/users
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const search = req.query.search as string;
    const role = req.query.role as string;

    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, username: true, displayName: true,
          role: true, isVerified: true, isBanned: true, banReason: true,
          isEmailVerified: true, createdAt: true, lastSeenAt: true,
          _count: { select: { subscriptions: true, posts: true } },
          creatorProfile: { select: { totalEarnings: true, subscriberCount: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, hasMore: page * limit < total });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

/**
 * PATCH /api/admin/users/:id/ban
 */
router.patch('/users/:id/ban', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { isBanned: true, banReason: reason || 'Violación de términos de servicio' },
    });

    // Cancel all active subscriptions
    await prisma.subscription.updateMany({
      where: { OR: [{ subscriberId: id }, { creatorId: id }], status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    res.json({ message: `Usuario @${user.username} suspendido` });
  } catch (error) {
    res.status(500).json({ error: 'Error al suspender usuario' });
  }
});

/**
 * PATCH /api/admin/users/:id/unban
 */
router.patch('/users/:id/unban', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({
      where: { id },
      data: { isBanned: false, banReason: null },
    });
    res.json({ message: `Usuario @${user.username} reactivado` });
  } catch (error) {
    res.status(500).json({ error: 'Error al reactivar usuario' });
  }
});

/**
 * PATCH /api/admin/users/:id/verify
 */
router.patch('/users/:id/verify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({ where: { id }, data: { isVerified: true } });
    res.json({ message: `@${user.username} verificada` });
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar usuario' });
  }
});

/**
 * GET /api/admin/kyc
 * Pending KYC verifications
 */
router.get('/kyc', async (req: Request, res: Response) => {
  try {
    const { status = 'PENDING' } = req.query;

    const verifications = await prisma.kycVerification.findMany({
      where: { status: String(status) },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, email: true, avatarUrl: true, createdAt: true },
          include: { verificationDocs: true },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    res.json({ verifications });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener KYC' });
  }
});

/**
 * PATCH /api/admin/kyc/:id/approve
 */
router.patch('/kyc/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const kyc = await prisma.kycVerification.update({
      where: { id },
      data: { status: 'APPROVED', reviewedAt: new Date() },
      include: { user: true },
    });

    await prisma.user.update({
      where: { id: kyc.userId },
      data: { isVerified: true },
    });

    res.json({ message: `KYC aprobado para @${kyc.user.username}` });
  } catch (error) {
    res.status(500).json({ error: 'Error al aprobar KYC' });
  }
});

/**
 * PATCH /api/admin/kyc/:id/reject
 */
router.patch('/kyc/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ error: 'Razón de rechazo requerida' });

    await prisma.kycVerification.update({
      where: { id },
      data: { status: 'REJECTED', reviewedAt: new Date(), rejectionReason: reason },
    });

    res.json({ message: 'KYC rechazado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al rechazar KYC' });
  }
});

/**
 * GET /api/admin/withdrawals
 */
router.get('/withdrawals', async (req: Request, res: Response) => {
  try {
    const { status = 'PENDING' } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { status: String(status) as any },
        include: {
          user: { select: { id: true, username: true, displayName: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.withdrawal.count({ where: { status: String(status) as any } }),
    ]);

    res.json({ withdrawals, total, page });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener retiros' });
  }
});

/**
 * PATCH /api/admin/withdrawals/:id/process
 */
router.patch('/withdrawals/:id/process', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.withdrawal.update({
      where: { id },
      data: { status: 'COMPLETED', processedAt: new Date() },
    });

    res.json({ message: 'Retiro marcado como procesado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar retiro' });
  }
});

/**
 * PATCH /api/admin/withdrawals/:id/reject
 */
router.patch('/withdrawals/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const withdrawal = await prisma.withdrawal.update({
      where: { id },
      data: { status: 'REJECTED', rejectedReason: reason },
    });

    // Refund to wallet
    await prisma.wallet.update({
      where: { userId: withdrawal.userId },
      data: {
        availableBalance: { increment: withdrawal.amount },
        totalWithdrawn: { decrement: withdrawal.amount },
      },
    });

    res.json({ message: 'Retiro rechazado y monto reembolsado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al rechazar retiro' });
  }
});

/**
 * GET /api/admin/posts
 * Reported/flagged content moderation
 */
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        include: {
          creator: { select: { id: true, username: true, displayName: true } },
          media: { take: 1 },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count(),
    ]);

    res.json({ posts, total, page });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

/**
 * DELETE /api/admin/posts/:id
 */
router.delete('/posts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await prisma.post.update({
      where: { id },
      data: { isArchived: true },
    });

    res.json({ message: 'Publicación eliminada por moderación' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar publicación' });
  }
});

/**
 * GET /api/admin/revenue
 * Revenue analytics
 */
router.get('/revenue', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await prisma.transaction.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: startDate } },
      select: { amount: true, platformFee: true, type: true, createdAt: true },
    });

    const byDay = new Map<string, number>();
    let totalRevenue = 0;

    for (const tx of transactions) {
      const day = tx.createdAt.toISOString().split('T')[0];
      const fee = tx.platformFee?.toNumber() ?? 0;
      byDay.set(day, (byDay.get(day) ?? 0) + fee);
      totalRevenue += fee;
    }

    const chartData = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));

    const byType = transactions.reduce((acc, tx) => {
      acc[tx.type] = (acc[tx.type] ?? 0) + (tx.platformFee?.toNumber() ?? 0);
      return acc;
    }, {} as Record<string, number>);

    res.json({ chartData, totalRevenue, byType, days });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener revenue' });
  }
});

export default router;
