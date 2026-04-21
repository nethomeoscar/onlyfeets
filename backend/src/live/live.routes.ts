import { Router, Request, Response } from 'express';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { prisma } from '../config/database';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { createNotification } from '../notifications/notifications.routes';
import { io } from '../main';
import { logger } from '../config/logger';

const router = Router();

const AGORA_APP_ID = process.env.AGORA_APP_ID!;
const AGORA_APP_CERT = process.env.AGORA_APP_CERTIFICATE!;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateAgoraToken = (channelName: string, uid: number, role: RtcRole) => {
  const expireTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  return RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID, AGORA_APP_CERT, channelName, uid, role, expireTime, expireTime
  );
};

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/live/start
 * Creator starts a live stream
 */
router.post('/start', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const userRole = (req as any).role;

    if (userRole !== 'CREATOR') return res.status(403).json({ error: 'Solo creadores pueden iniciar streams' });

    const { title, description, thumbnailUrl, isTicketed, ticketPrice } = req.body;

    if (!title) return res.status(400).json({ error: 'Título requerido' });

    // Check no active stream
    const activeStream = await prisma.liveStream.findFirst({
      where: { creatorId: userId, status: 'LIVE' },
    });
    if (activeStream) return res.status(400).json({ error: 'Ya tienes un stream activo' });

    const channelName = `live_${userId}_${Date.now()}`;
    const agoraToken = AGORA_APP_CERT
      ? generateAgoraToken(channelName, 0, RtcRole.PUBLISHER)
      : 'dev_token';

    const stream = await prisma.liveStream.create({
      data: {
        creatorId: userId,
        title,
        description,
        thumbnailUrl,
        status: 'LIVE',
        isTicketed: isTicketed || false,
        ticketPrice: isTicketed ? ticketPrice : null,
        agoraChannel: channelName,
        startedAt: new Date(),
      },
      include: { creator: { select: { displayName: true, username: true, avatarUrl: true } } },
    });

    // Notify all subscribers
    const subscribers = await prisma.subscription.findMany({
      where: { creatorId: userId, status: 'ACTIVE' },
      select: { subscriberId: true },
    });

    for (const sub of subscribers) {
      await createNotification({
        userId: sub.subscriberId,
        type: 'LIVE_STARTED',
        title: `${stream.creator.displayName} está en vivo! 🔴`,
        body: title,
        data: { streamId: stream.id, creatorId: userId },
      });
    }

    // Emit socket event
    io.emit('live_started', {
      streamId: stream.id,
      creatorId: userId,
      creatorName: stream.creator.displayName,
      title,
    });

    res.status(201).json({
      stream,
      agoraToken,
      agoraAppId: AGORA_APP_ID,
      channelName,
    });
  } catch (error) {
    logger.error('Start live error', error);
    res.status(500).json({ error: 'Error al iniciar stream' });
  }
});

/**
 * POST /api/live/:id/end
 */
router.post('/:id/end', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const stream = await prisma.liveStream.findUnique({ where: { id } });
    if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });
    if (stream.creatorId !== userId) return res.status(403).json({ error: 'Sin permiso' });

    const updated = await prisma.liveStream.update({
      where: { id },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    io.to(`live:${id}`).emit('live_ended', { streamId: id });

    res.json({ stream: updated });
  } catch (error) {
    res.status(500).json({ error: 'Error al terminar stream' });
  }
});

/**
 * GET /api/live/active
 * Get active streams from subscribed creators
 */
router.get('/active', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const where: any = { status: 'LIVE' };

    if (userId) {
      const subs = await prisma.subscription.findMany({
        where: { subscriberId: userId, status: 'ACTIVE' },
        select: { creatorId: true },
      });
      if (subs.length > 0) {
        where.creatorId = { in: subs.map(s => s.creatorId) };
      }
    }

    const streams = await prisma.liveStream.findMany({
      where,
      include: {
        creator: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
        },
      },
      orderBy: { viewerCount: 'desc' },
      take: 20,
    });

    res.json({ streams });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener streams activos' });
  }
});

/**
 * GET /api/live/:id
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const stream = await prisma.liveStream.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
        },
      },
    });

    if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });

    let agoraToken: string | null = null;
    let canWatch = !stream.isTicketed;

    if (userId) {
      const isSubscribed = await prisma.subscription.findUnique({
        where: { subscriberId_creatorId: { subscriberId: userId, creatorId: stream.creatorId } },
      });
      canWatch = !!isSubscribed?.status;

      if (canWatch && AGORA_APP_CERT) {
        const uid = Math.floor(Math.random() * 1000000);
        agoraToken = generateAgoraToken(stream.agoraChannel!, uid, RtcRole.SUBSCRIBER);
      }

      // Increment viewer count
      if (canWatch && userId !== stream.creatorId) {
        await prisma.liveStream.update({
          where: { id },
          data: { viewerCount: { increment: 1 } },
        });
      }
    }

    res.json({
      stream,
      canWatch,
      agoraToken,
      agoraAppId: AGORA_APP_ID,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener stream' });
  }
});

/**
 * GET /api/live/past
 * Past streams (recordings)
 */
router.get('/:username/past', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const creator = await prisma.user.findUnique({ where: { username } });
    if (!creator) return res.status(404).json({ error: 'Creadora no encontrada' });

    const streams = await prisma.liveStream.findMany({
      where: { creatorId: creator.id, status: 'ENDED', recordingUrl: { not: null } },
      orderBy: { endedAt: 'desc' },
      take: 20,
    });

    res.json({ streams });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
