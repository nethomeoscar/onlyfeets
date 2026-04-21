import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createNotification } from '../notifications/notifications.service';
import { processPayment } from '../payments/payments.service';
import { io } from '../main';
import { logger } from '../config/logger';

const router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  receiverId: z.string(),
  content: z.string().max(2000).optional(),
  isPPV: z.boolean().default(false),
  ppvPrice: z.number().min(1).max(500).optional(),
  mediaUrls: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['IMAGE', 'VIDEO', 'AUDIO']),
    thumbnailUrl: z.string().url().optional(),
    duration: z.number().optional(),
  })).max(10).optional(),
});

const massDMSchema = z.object({
  content: z.string().max(2000).optional(),
  isPPV: z.boolean().default(false),
  ppvPrice: z.number().min(1).max(500).optional(),
  mediaUrls: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['IMAGE', 'VIDEO', 'AUDIO']),
  })).max(10).optional(),
  targetAll: z.boolean().default(true),
  targetSubscriberIds: z.array(z.string()).optional(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/messages/conversations
 */
router.get('/conversations', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    // Get all unique conversations
    const conversations = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT
        CASE WHEN m.sender_id = ${userId} THEN m.receiver_id ELSE m.sender_id END as other_user_id,
        MAX(m.created_at) as last_message_at,
        COUNT(CASE WHEN m.receiver_id = ${userId} AND m.is_read = false THEN 1 END) as unread_count
      FROM messages m
      WHERE m.sender_id = ${userId} OR m.receiver_id = ${userId}
      GROUP BY other_user_id
      ORDER BY last_message_at DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;

    const otherUserIds = conversations.map((c: any) => c.other_user_id);
    const users = await prisma.user.findMany({
      where: { id: { in: otherUserIds } },
      select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true, lastSeenAt: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    // Get last message for each conversation
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv: any) => {
        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: conv.other_user_id },
              { senderId: conv.other_user_id, receiverId: userId },
            ],
          },
          orderBy: { createdAt: 'desc' },
          include: { media: { take: 1 } },
        });

        return {
          otherUser: userMap.get(conv.other_user_id),
          lastMessage,
          unreadCount: Number(conv.unread_count),
          lastMessageAt: conv.last_message_at,
        };
      })
    );

    res.json({ conversations: enrichedConversations, page });
  } catch (error) {
    logger.error('Conversations error', error);
    res.status(500).json({ error: 'Error al cargar conversaciones' });
  }
});

/**
 * GET /api/messages/:userId
 * Get messages with a specific user
 */
router.get('/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).userId;
    const { userId: otherUserId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 30;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId },
        ],
        isDeleted: false,
      },
      include: {
        media: true,
        sender: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get PPV unlock status
    const ppvMessageIds = messages.filter(m => m.isPPV).map(m => m.id);
    const unlocks = await prisma.ppvUnlock.findMany({
      where: { userId: currentUserId, messageId: { in: ppvMessageIds } },
      select: { messageId: true },
    });
    const unlockedMessageIds = new Set(unlocks.map(u => u.messageId));

    // Mark messages as read
    await prisma.message.updateMany({
      where: { senderId: otherUserId, receiverId: currentUserId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    // Emit read receipts
    io.to(`user:${otherUserId}`).emit('messages_read', { byUserId: currentUserId });

    const processedMessages = messages.reverse().map(msg => {
      const isLocked = msg.isPPV && !unlockedMessageIds.has(msg.id) && msg.senderId !== currentUserId;
      return {
        ...msg,
        isUnlocked: unlockedMessageIds.has(msg.id),
        media: msg.media.map(m => ({
          ...m,
          url: isLocked ? null : m.url,
          blurUrl: isLocked ? m.blurUrl : null,
        })),
        content: isLocked ? null : msg.content,
      };
    });

    res.json({ messages: processedMessages, page });
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar mensajes' });
  }
});

/**
 * POST /api/messages/send
 */
router.post('/send', authenticate, validate(sendMessageSchema), async (req: Request, res: Response) => {
  try {
    const senderId = (req as any).userId;
    const { receiverId, content, isPPV, ppvPrice, mediaUrls } = req.body;

    if (senderId === receiverId) {
      return res.status(400).json({ error: 'No puedes enviarte mensajes a ti mismo' });
    }

    // Check if blocked
    const isBlocked = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: receiverId, blockedId: senderId },
          { blockerId: senderId, blockedId: receiverId },
        ],
      },
    });
    if (isBlocked) return res.status(403).json({ error: 'No puedes enviar mensajes a este usuario' });

    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content,
        isPPV,
        ppvPrice: isPPV ? ppvPrice : null,
        media: mediaUrls ? {
          create: mediaUrls.map((m: any, i: number) => ({
            type: m.type,
            url: m.url,
            thumbnailUrl: m.thumbnailUrl,
            duration: m.duration,
            order: i,
          })),
        } : undefined,
      },
      include: {
        media: true,
        sender: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    // Emit real-time
    io.to(`user:${receiverId}`).emit('new_message', {
      ...message,
      media: message.isPPV ? message.media.map(m => ({ ...m, url: null })) : message.media,
      content: message.isPPV ? null : message.content,
    });

    // Notification
    await createNotification({
      userId: receiverId,
      type: 'NEW_MESSAGE',
      title: 'Nuevo mensaje',
      body: isPPV ? `Mensaje PPV - $${ppvPrice}` : (content?.substring(0, 50) || 'Nuevo medio'),
      data: { senderId, messageId: message.id },
    });

    res.status(201).json(message);
  } catch (error) {
    logger.error('Send message error', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

/**
 * POST /api/messages/:id/unlock
 * Unlock PPV message
 */
router.post('/:id/unlock', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { paymentMethodId } = req.body;

    const message = await prisma.message.findUnique({
      where: { id },
      include: { sender: { select: { displayName: true } } },
    });

    if (!message) return res.status(404).json({ error: 'Mensaje no encontrado' });
    if (!message.isPPV) return res.status(400).json({ error: 'Este mensaje no es PPV' });
    if (message.receiverId !== userId) return res.status(403).json({ error: 'Sin permiso' });

    const existing = await prisma.ppvUnlock.findFirst({ where: { userId, messageId: id } });
    if (existing) return res.status(400).json({ error: 'Ya desbloqueaste este mensaje' });

    await processPayment({
      userId,
      amount: message.ppvPrice!.toNumber(),
      description: `DM PPV: ${message.sender.displayName}`,
      paymentMethodId,
      metadata: { type: 'PPV_MESSAGE', messageId: id, creatorId: message.senderId },
    });

    await prisma.$transaction(async (tx) => {
      await tx.ppvUnlock.create({ data: { userId, messageId: id, amountPaid: message.ppvPrice! } });

      const platformFee = message.ppvPrice!.toNumber() * 0.2;
      const creatorAmount = message.ppvPrice!.toNumber() - platformFee;

      await tx.wallet.update({
        where: { userId: message.senderId },
        data: {
          pendingBalance: { increment: creatorAmount },
          totalEarned: { increment: creatorAmount },
        },
      });

      await tx.transaction.create({
        data: {
          userId: message.senderId,
          type: 'PPV_MESSAGE',
          status: 'COMPLETED',
          amount: message.ppvPrice!,
          netAmount: creatorAmount,
          platformFee,
          description: 'DM PPV desbloqueado',
        },
      });
    });

    // Return full message with media
    const fullMessage = await prisma.message.findUnique({
      where: { id },
      include: { media: true },
    });

    await createNotification({
      userId: message.senderId,
      type: 'PPV_UNLOCK',
      title: `Mensaje desbloqueado - $${message.ppvPrice}`,
      body: 'Un fan desbloqueó tu mensaje privado',
      data: { messageId: id, amount: message.ppvPrice },
    });

    res.json({ message: 'Mensaje desbloqueado', data: fullMessage });
  } catch (error) {
    logger.error('Message unlock error', error);
    res.status(500).json({ error: 'Error al desbloquear mensaje' });
  }
});

/**
 * POST /api/messages/mass-dm
 * Send mass DM to all subscribers (Creator only)
 */
router.post('/mass-dm', authenticate, validate(massDMSchema), async (req: Request, res: Response) => {
  try {
    const senderId = (req as any).userId;
    const userRole = (req as any).role;

    if (userRole !== 'CREATOR') {
      return res.status(403).json({ error: 'Solo creadores pueden enviar Mass DM' });
    }

    const { content, isPPV, ppvPrice, mediaUrls, targetAll, targetSubscriberIds } = req.body;

    let subscriberIds: string[];
    if (targetAll) {
      const subs = await prisma.subscription.findMany({
        where: { creatorId: senderId, status: 'ACTIVE' },
        select: { subscriberId: true },
      });
      subscriberIds = subs.map(s => s.subscriberId);
    } else {
      subscriberIds = targetSubscriberIds || [];
    }

    // Queue mass DM (don't block response)
    const results = { sent: 0, failed: 0 };

    // Process in batches to avoid overloading
    const batchSize = 100;
    for (let i = 0; i < subscriberIds.length; i += batchSize) {
      const batch = subscriberIds.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (receiverId) => {
          try {
            const msg = await prisma.message.create({
              data: {
                senderId,
                receiverId,
                content,
                isPPV,
                ppvPrice: isPPV ? ppvPrice : null,
                isMassDM: true,
                media: mediaUrls ? {
                  create: mediaUrls.map((m: any, idx: number) => ({
                    type: m.type,
                    url: m.url,
                    order: idx,
                  })),
                } : undefined,
              },
            });

            io.to(`user:${receiverId}`).emit('new_message', { messageId: msg.id, isMassDM: true });
            results.sent++;
          } catch {
            results.failed++;
          }
        })
      );
    }

    res.json({
      message: 'Mass DM enviado',
      totalTargeted: subscriberIds.length,
      sent: results.sent,
      failed: results.failed,
    });
  } catch (error) {
    logger.error('Mass DM error', error);
    res.status(500).json({ error: 'Error al enviar Mass DM' });
  }
});

/**
 * DELETE /api/messages/:id
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) return res.status(404).json({ error: 'Mensaje no encontrado' });
    if (message.senderId !== userId) return res.status(403).json({ error: 'Sin permiso' });

    await prisma.message.update({ where: { id }, data: { isDeleted: true } });

    io.to(`user:${message.receiverId}`).emit('message_deleted', { messageId: id });

    res.json({ message: 'Mensaje eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar mensaje' });
  }
});

/**
 * POST /api/messages/:id/tip
 */
router.post('/:id/tip', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { amount, paymentMethodId } = req.body;

    const message = await prisma.message.findUnique({
      where: { id },
      include: { sender: true },
    });
    if (!message) return res.status(404).json({ error: 'Mensaje no encontrado' });

    await processPayment({
      userId,
      amount,
      description: `Propina en DM`,
      paymentMethodId,
      metadata: { type: 'TIP', messageId: id, creatorId: message.senderId },
    });

    await prisma.tip.create({
      data: { senderId: userId, creatorId: message.senderId, messageId: id, amount },
    });

    const platformFee = amount * 0.2;
    const creatorAmount = amount - platformFee;
    await prisma.wallet.update({
      where: { userId: message.senderId },
      data: {
        pendingBalance: { increment: creatorAmount },
        totalEarned: { increment: creatorAmount },
      },
    });

    await createNotification({
      userId: message.senderId,
      type: 'NEW_TIP',
      title: `Propina de $${amount} en DMs`,
      body: '',
      data: { messageId: id, amount, senderId: userId },
    });

    res.json({ message: 'Propina enviada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al enviar propina' });
  }
});

export default router;
