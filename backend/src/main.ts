import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import { prisma } from './config/database';
import { logger } from './config/logger';
import { redis } from './config/redis';
import { setupSocketIO } from './config/socket';

// Routes
import authRoutes from './auth/auth.routes';
import userRoutes from './users/users.routes';
import creatorRoutes from './creators/creators.routes';
import postRoutes from './posts/posts.routes';
import subscriptionRoutes from './subscriptions/subscriptions.routes';
import paymentRoutes from './payments/payments.routes';
import messageRoutes from './messages/messages.routes';
import notificationRoutes from './notifications/notifications.routes';
import searchRoutes from './search/search.routes';
import liveRoutes from './live/live.routes';
import uploadRoutes from './upload/upload.routes';
import adminRoutes from './admin/admin.routes';

const app = express();
const httpServer = createServer(app);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});
setupSocketIO(io);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(compression());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Stripe webhook needs raw body
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Auth endpoints stricter limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos, intenta de nuevo en 15 minutos' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'error', error: String(error) });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, async () => {
  logger.info(`🚀 OnlyFeets API running on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
  
  // Connect to DB
  try {
    await prisma.$connect();
    logger.info('✅ PostgreSQL connected');
  } catch (e) {
    logger.error('❌ PostgreSQL connection failed', e);
    process.exit(1);
  }
});

export { io };
export default app;
