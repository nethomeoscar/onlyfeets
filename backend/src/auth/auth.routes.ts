import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { z } from 'zod';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { sendEmail } from '../config/email';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { logger } from '../config/logger';

const router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['FAN', 'CREATOR']).default('FAN'),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  twoFactorCode: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateTokens = (userId: string, role: string) => {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '30d' }
  );
  return { accessToken, refreshToken };
};

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, username, password, role, referralCode } = req.body;

    // Check if user exists
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      const field = existing.email === email ? 'email' : 'username';
      return res.status(400).json({ error: `El ${field} ya está en uso` });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const emailVerificationToken = crypto.randomUUID();

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          role: role as any,
          displayName: username,
        },
      });

      // Create wallet
      await tx.wallet.create({ data: { userId: newUser.id } });

      // Creator profile
      if (role === 'CREATOR') {
        await tx.creatorProfile.create({ data: { userId: newUser.id } });
      }

      // Handle referral
      if (referralCode) {
        const referrer = await tx.user.findUnique({
          where: { username: referralCode },
        });
        if (referrer) {
          await tx.referral.create({
            data: { referrerId: referrer.id, referredId: newUser.id },
          });
        }
      }

      return newUser;
    });

    // Store email verification token
    await redis.setex(`email_verify:${emailVerificationToken}`, 86400, user.id);

    // Send verification email
    await sendEmail({
      to: email,
      subject: '¡Bienvenido a OnlyFeets! Verifica tu email',
      template: 'email-verification',
      data: {
        username,
        verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`,
      },
    });

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({
      message: 'Cuenta creada exitosamente. Revisa tu email para verificar tu cuenta.',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error('Register error', error);
    res.status(500).json({ error: 'Error al crear la cuenta' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, twoFactorCode } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { creatorProfile: true },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: `Cuenta suspendida: ${user.banReason}` });
    }

    // 2FA check
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(200).json({ requiresTwoFactor: true });
      }
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: 'base32',
        token: twoFactorCode,
        window: 2,
      });
      if (!isValid) {
        return res.status(401).json({ error: 'Código 2FA inválido' });
      }
    }

    // Update last seen
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isVerified: user.isVerified,
        isEmailVerified: user.isEmailVerified,
        creatorProfile: user.creatorProfile,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error('Login error', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Token requerido' });

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.userId !== payload.userId) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      return res.status(401).json({ error: 'Token expirado' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { userId: (req as any).userId, token: refreshToken },
      });
    }
    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

/**
 * GET /api/auth/verify-email
 */
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    const userId = await redis.get(`email_verify:${token}`);
    if (!userId) return res.status(400).json({ error: 'Token inválido o expirado' });

    await prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });
    await redis.del(`email_verify:${token}`);

    res.json({ message: 'Email verificado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar email' });
  }
});

/**
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', validate(forgotPasswordSchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (user) {
      const resetToken = crypto.randomUUID();
      await redis.setex(`password_reset:${resetToken}`, 3600, user.id); // 1 hour

      await sendEmail({
        to: email,
        subject: 'Restablecer contraseña - OnlyFeets',
        template: 'password-reset',
        data: {
          username: user.username,
          resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
        },
      });
    }

    res.json({ message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña' });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar solicitud' });
  }
});

/**
 * POST /api/auth/reset-password
 */
router.post('/reset-password', validate(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    const userId = await redis.get(`password_reset:${token}`);
    if (!userId) return res.status(400).json({ error: 'Token inválido o expirado' });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await redis.del(`password_reset:${token}`);

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
});

/**
 * POST /api/auth/2fa/setup
 */
router.post('/2fa/setup', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const secret = speakeasy.generateSecret({ name: `OnlyFeets:${userId}` });

    await redis.setex(`2fa_setup:${userId}`, 300, secret.base32);

    res.json({
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al configurar 2FA' });
  }
});

/**
 * POST /api/auth/2fa/enable
 */
router.post('/2fa/enable', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { code } = req.body;

    const secret = await redis.get(`2fa_setup:${userId}`);
    if (!secret) return res.status(400).json({ error: 'Sesión de configuración expirada' });

    const isValid = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 2 });
    if (!isValid) return res.status(400).json({ error: 'Código inválido' });

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret, twoFactorEnabled: true },
    });
    await redis.del(`2fa_setup:${userId}`);

    res.json({ message: '2FA activado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al activar 2FA' });
  }
});

/**
 * POST /api/auth/2fa/disable
 */
router.post('/2fa/disable', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { code, password } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) return res.status(401).json({ error: 'Contraseña incorrecta' });

    const codeValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: 'base32',
      token: code,
      window: 2,
    });
    if (!codeValid) return res.status(401).json({ error: 'Código 2FA inválido' });

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: null, twoFactorEnabled: false },
    });

    res.json({ message: '2FA desactivado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al desactivar 2FA' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: (req as any).userId },
      include: {
        creatorProfile: {
          include: { tipMenuItems: true, promotions: true, bundles: true },
        },
        wallet: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { passwordHash, twoFactorSecret, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

export default router;
