import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import admin from 'firebase-admin';
import { logger } from '../config/logger';

const router = Router();

// ─── Firebase init ────────────────────────────────────────────────────────────

let firebaseApp: admin.app.App | null = null;

const getFirebaseApp = () => {
  if (!firebaseApp && process.env.FIREBASE_PROJECT_ID) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  }
  return firebaseApp;
};

// ─── Notification Service ─────────────────────────────────────────────────────

export const createNotification = async ({
  userId,
  type,
  title,
  body,
  data,
}: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: type as any,
        title,
        body,
        data: data ?? {},
      },
    });

    // Send push notification
    await sendPushNotification(userId, title, body, data);

    return notification;
  } catch (error) {
    logger.error('Create notification error', error);
  }
};

export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
) => {
  try {
    const app = getFirebaseApp();
    if (!app) return;

    const deviceTokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true, platform: true },
    });

    if (deviceTokens.length === 0) return;

    const tokens = deviceTokens.map(d => d.token);
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
      android: { priority: 'high', notification: { sound: 'default', clickAction: 'FLUTTER_NOTIFICATION_CLICK' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    };

    const response = await admin.messaging(app).sendEachForMulticast(message);

    // Remove invalid tokens
    const invalidTokens = response.responses
      .map((r, i) => (!r.success && tokens[i]) ? tokens[i] : null)
      .filter(Boolean);

    if (invalidTokens.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens as string[] } } });
    }
  } catch (error) {
    logger.error('Push notification error', error);
  }
};

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/notifications
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    res.json({ notifications, total, page, hasMore: page * limit < total });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

/**
 * GET /api/notifications/unread-count
 */
router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const count = await prisma.notification.count({ where: { userId, isRead: false } });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 */
router.patch('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    await prisma.notification.update({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

/**
 * PATCH /api/notifications/read-all
 */
router.patch('/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

/**
 * DELETE /api/notifications/:id
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    await prisma.notification.delete({ where: { id: req.params.id, userId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

/**
 * POST /api/notifications/device-token
 * Register push notification device token
 */
router.post('/device-token', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { token, platform } = req.body;

    if (!token || !platform) return res.status(400).json({ error: 'Token y plataforma requeridos' });

    await prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar token' });
  }
});

/**
 * DELETE /api/notifications/device-token
 */
router.delete('/device-token', authenticate, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });
    await prisma.deviceToken.delete({ where: { token } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
