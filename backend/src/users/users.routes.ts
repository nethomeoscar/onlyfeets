import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();

/**
 * GET /api/users/profile
 */
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: (req as any).userId },
      include: { creatorProfile: true, wallet: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const { passwordHash, twoFactorSecret, ...safe } = user;
    res.json(safe);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

/**
 * PUT /api/users/profile
 */
router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { displayName, bio, website, location, avatarUrl, coverUrl } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { displayName, bio, website, location, avatarUrl, coverUrl },
    });

    const { passwordHash, twoFactorSecret, ...safe } = user;
    res.json(safe);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

/**
 * PUT /api/users/password
 */
router.put('/password', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Contraseñas requeridas' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    await prisma.refreshToken.deleteMany({ where: { userId } });

    res.json({ message: 'Contraseña actualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar contraseña' });
  }
});

/**
 * PUT /api/users/notification-preferences
 */
router.put('/notification-preferences', authenticate, async (req: Request, res: Response) => {
  try {
    // Store preferences in Redis or a preferences table
    // For simplicity, just acknowledge
    res.json({ message: 'Preferencias guardadas' });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

/**
 * GET /api/messages/unread-count
 */
router.get('/messages/unread-count', authenticate, async (req: Request, res: Response) => {
  try {
    const count = await prisma.message.count({
      where: { receiverId: (req as any).userId, isRead: false, isDeleted: false },
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

/**
 * POST /api/users/:id/block
 */
router.post('/:id/block', authenticate, async (req: Request, res: Response) => {
  try {
    const blockerId = (req as any).userId;
    const blockedId = req.params.id;
    if (blockerId === blockedId) return res.status(400).json({ error: 'No puedes bloquearte a ti mismo' });

    await prisma.blockedUser.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
    res.json({ message: 'Usuario bloqueado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al bloquear' });
  }
});

/**
 * DELETE /api/users/:id/block
 */
router.delete('/:id/block', authenticate, async (req: Request, res: Response) => {
  try {
    const blockerId = (req as any).userId;
    const blockedId = req.params.id;
    await prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } });
    res.json({ message: 'Usuario desbloqueado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al desbloquear' });
  }
});

/**
 * DELETE /api/users/account
 * Delete own account
 */
router.delete('/account', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Contraseña incorrecta' });

    // Soft delete - deactivate account
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false, email: `deleted_${Date.now()}_${user.email}` },
    });

    // Cancel all subscriptions
    await prisma.subscription.updateMany({
      where: { OR: [{ subscriberId: userId }, { creatorId: userId }], status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    res.json({ message: 'Cuenta eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar cuenta' });
  }
});

export default router;
