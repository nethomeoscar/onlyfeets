import { Server as SocketIO, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { redis } from './redis';
import { logger } from './logger';

export const setupSocketIO = (io: SocketIO) => {
  // Auth middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication error'));

      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
      (socket as any).userId = payload.userId;
      (socket as any).role = payload.role;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId;
    logger.info(`Socket connected: ${userId}`);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Update online status
    await redis.setex(`online:${userId}`, 300, '1');
    io.emit('user_online', { userId });

    // ─── Events ─────────────────────────────────────────────────────────────

    // Join post room for real-time comments
    socket.on('join_post', (postId: string) => {
      socket.join(`post:${postId}`);
    });

    socket.on('leave_post', (postId: string) => {
      socket.leave(`post:${postId}`);
    });

    // Join live stream room
    socket.on('join_live', (streamId: string) => {
      socket.join(`live:${streamId}`);
      io.to(`live:${streamId}`).emit('viewer_joined', { userId, streamId });
    });

    socket.on('leave_live', (streamId: string) => {
      socket.leave(`live:${streamId}`);
      io.to(`live:${streamId}`).emit('viewer_left', { userId, streamId });
    });

    // Typing indicator
    socket.on('typing_start', ({ receiverId }: { receiverId: string }) => {
      io.to(`user:${receiverId}`).emit('typing', { userId, isTyping: true });
    });

    socket.on('typing_stop', ({ receiverId }: { receiverId: string }) => {
      io.to(`user:${receiverId}`).emit('typing', { userId, isTyping: false });
    });

    // Live stream chat message
    socket.on('live_chat', async ({ streamId, message }: { streamId: string; message: string }) => {
      io.to(`live:${streamId}`).emit('live_chat_message', {
        userId,
        message: message.substring(0, 200),
        timestamp: new Date().toISOString(),
      });
    });

    // Live stream tip
    socket.on('live_tip', async ({ streamId, amount }: { streamId: string; amount: number }) => {
      io.to(`live:${streamId}`).emit('live_tip_received', {
        userId,
        amount,
        timestamp: new Date().toISOString(),
      });
    });

    // Ping to keep online status
    socket.on('ping', async () => {
      await redis.setex(`online:${userId}`, 300, '1');
      socket.emit('pong');
    });

    // ─── Disconnect ──────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      logger.info(`Socket disconnected: ${userId}`);
      await redis.del(`online:${userId}`);
      io.emit('user_offline', { userId });
    });
  });
};

export const isUserOnline = async (userId: string): Promise<boolean> => {
  const online = await redis.get(`online:${userId}`);
  return !!online;
};
