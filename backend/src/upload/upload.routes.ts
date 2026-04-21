import { Router, Request, Response } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { authenticate } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;
const CDN_URL = process.env.CDN_URL || `https://${BUCKET}.s3.amazonaws.com`;

// ─── Multer S3 Config ─────────────────────────────────────────────────────────

const upload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET,
    acl: 'private', // Always private - serve via signed URLs or CloudFront
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const userId = (req as any).userId;
      const ext = file.originalname.split('.').pop();
      const folder = file.mimetype.startsWith('video/') ? 'videos' :
                     file.mimetype.startsWith('audio/') ? 'audio' : 'images';
      cb(null, `content/${userId}/${folder}/${uuidv4()}.${ext}`);
    },
  }),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/mov', 'video/avi', 'video/webm',
      'audio/mp3', 'audio/wav', 'audio/aac',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  },
});

const avatarUpload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const userId = (req as any).userId;
      const ext = file.originalname.split('.').pop();
      cb(null, `avatars/${userId}/${uuidv4()}.${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/upload/media
 * Upload content media (images, videos)
 */
router.post('/media', authenticate, upload.array('files', 20), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.MulterS3.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron archivos' });
    }

    const uploadedFiles = files.map(file => ({
      url: `${CDN_URL}/${file.key}`,
      key: file.key,
      type: file.mimetype.startsWith('video/') ? 'VIDEO' :
            file.mimetype.startsWith('audio/') ? 'AUDIO' : 'IMAGE',
      mimeType: file.mimetype,
      fileSize: file.size,
      originalName: file.originalname,
    }));

    res.json({ files: uploadedFiles });
  } catch (error) {
    logger.error('Upload error', error);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
});

/**
 * POST /api/upload/avatar
 */
router.post('/avatar', authenticate, avatarUpload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.MulterS3.File;
    if (!file) return res.status(400).json({ error: 'No se recibió imagen' });

    const url = `https://${BUCKET}.s3.amazonaws.com/${file.key}`;
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Error al subir avatar' });
  }
});

/**
 * POST /api/upload/cover
 */
router.post('/cover', authenticate, avatarUpload.single('cover'), async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.MulterS3.File;
    if (!file) return res.status(400).json({ error: 'No se recibió imagen' });

    const url = `https://${BUCKET}.s3.amazonaws.com/${file.key}`;
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Error al subir portada' });
  }
});

/**
 * POST /api/upload/kyc
 * Upload KYC verification documents
 */
router.post('/kyc', authenticate, multer({
  storage: multerS3({
    s3,
    bucket: BUCKET,
    acl: 'private',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const userId = (req as any).userId;
      const ext = file.originalname.split('.').pop();
      cb(null, `kyc/${userId}/${uuidv4()}.${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formato no permitido para KYC'));
  },
}).fields([
  { name: 'id_front', maxCount: 1 },
  { name: 'id_back', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
]), async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.MulterS3.File[] };
    const userId = (req as any).userId;
    const { prisma } = await import('../config/database');

    const docs: { docType: string; url: string }[] = [];

    for (const [docType, fileArr] of Object.entries(files)) {
      const file = fileArr[0];
      const url = `${CDN_URL}/${file.key}`;

      await prisma.verificationDoc.create({
        data: { userId, docType, url },
      });

      docs.push({ docType, url });
    }

    await prisma.kycVerification.upsert({
      where: { userId },
      create: { userId, status: 'PENDING' },
      update: { status: 'PENDING', submittedAt: new Date() },
    });

    res.json({ message: 'Documentos enviados para verificación', docs });
  } catch (error) {
    res.status(500).json({ error: 'Error al subir documentos' });
  }
});

/**
 * GET /api/upload/signed-url/:key
 * Get signed URL for private content
 */
router.get('/signed-url/:key(*)', authenticate, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const userId = (req as any).userId;

    // Verify user has access to this content (subscription check)
    // This is simplified - in production you'd check subscription status

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.json({ url: signedUrl });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar URL' });
  }
});

/**
 * DELETE /api/upload/:key
 */
router.delete('/:key(*)', authenticate, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const userId = (req as any).userId;

    // Verify ownership
    if (!key.includes(`/${userId}/`)) {
      return res.status(403).json({ error: 'Sin permiso para eliminar este archivo' });
    }

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    res.json({ message: 'Archivo eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar archivo' });
  }
});

export const generateBlurUrl = async (imageUrl: string): Promise<string | null> => {
  // In production: generate a blurred/pixelated version of the image
  // Store it in S3 and return the URL
  // For now return a placeholder
  return `${imageUrl}?blur=30`;
};

export default router;
