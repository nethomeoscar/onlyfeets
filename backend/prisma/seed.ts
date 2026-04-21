// prisma/seed.ts
// Run with: npx ts-node prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Admin user ───────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@onlyfeets.com' },
    update: {},
    create: {
      email: 'admin@onlyfeets.com',
      username: 'admin',
      passwordHash: adminHash,
      displayName: 'Administrador',
      role: 'ADMIN',
      isEmailVerified: true,
      isVerified: true,
    },
  });
  await prisma.wallet.upsert({ where: { userId: admin.id }, update: {}, create: { userId: admin.id } });
  console.log('✅ Admin created:', admin.email);

  // ─── Demo creator ─────────────────────────────────────────────────────────
  const creatorHash = await bcrypt.hash('Creator123!', 12);
  const creator = await prisma.user.upsert({
    where: { email: 'sofia@onlyfeets.com' },
    update: {},
    create: {
      email: 'sofia@onlyfeets.com',
      username: 'sofia_feets',
      passwordHash: creatorHash,
      displayName: 'Sofía García',
      role: 'CREATOR',
      bio: '✨ Modelo artística · 🌸 Contenido exclusivo · 💅 Solo para verdaderos fanáticos',
      isEmailVerified: true,
      isVerified: true,
      avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=sofia',
    },
  });

  await prisma.wallet.upsert({
    where: { userId: creator.id },
    update: {},
    create: { userId: creator.id, availableBalance: 450.00, pendingBalance: 120.00, totalEarned: 2800.00, totalWithdrawn: 2230.00 },
  });

  const creatorProfile = await prisma.creatorProfile.upsert({
    where: { userId: creator.id },
    update: {},
    create: {
      userId: creator.id,
      subscriptionPrice: 12.99,
      trialDays: 3,
      subscriberCount: 347,
      totalPosts: 89,
      totalLikes: 4231,
      totalEarnings: 2800.00,
      availableBalance: 450.00,
      pendingBalance: 120.00,
      welcomeMessage: '¡Gracias por suscribirte! 💖 Aquí encontrarás mi contenido más exclusivo.',
      isPublic: true,
    },
  });

  // Tip menu
  const tipItems = [
    { description: 'Un café ☕', amount: 5, emoji: '☕', order: 0 },
    { description: 'Foto dedicada 📸', amount: 15, emoji: '📸', order: 1 },
    { description: 'Video exclusivo 🎬', amount: 30, emoji: '🎬', order: 2 },
    { description: 'Fan del mes 👑', amount: 100, emoji: '👑', order: 3 },
  ];

  await prisma.tipMenuItem.deleteMany({ where: { creatorProfileId: creatorProfile.id } });
  await prisma.tipMenuItem.createMany({
    data: tipItems.map(item => ({ creatorProfileId: creatorProfile.id, ...item, isActive: true })),
  });

  // Bundles
  await prisma.bundle.deleteMany({ where: { creatorProfileId: creatorProfile.id } });
  await prisma.bundle.createMany({
    data: [
      { creatorProfileId: creatorProfile.id, months: 3, discountPercent: 15, isActive: true },
      { creatorProfileId: creatorProfile.id, months: 6, discountPercent: 25, isActive: true },
      { creatorProfileId: creatorProfile.id, months: 12, discountPercent: 40, isActive: true },
    ],
  });

  console.log('✅ Creator created:', creator.email);

  // ─── Demo fan ─────────────────────────────────────────────────────────────
  const fanHash = await bcrypt.hash('Fan123!', 12);
  const fan = await prisma.user.upsert({
    where: { email: 'fan@onlyfeets.com' },
    update: {},
    create: {
      email: 'fan@onlyfeets.com',
      username: 'fan_demo',
      passwordHash: fanHash,
      displayName: 'Fan Demo',
      role: 'FAN',
      isEmailVerified: true,
      avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=fan',
    },
  });
  await prisma.wallet.upsert({ where: { userId: fan.id }, update: {}, create: { userId: fan.id } });
  console.log('✅ Fan created:', fan.email);

  // ─── Demo posts ───────────────────────────────────────────────────────────
  const posts = [
    {
      caption: '✨ Nuevas fotos del estudio. ¿Cuál es tu favorita? 💕',
      isPPV: false,
      isFree: false,
      isPinned: true,
      publishedAt: new Date(),
      likesCount: 128,
      commentsCount: 23,
    },
    {
      caption: '🔒 Contenido exclusivo PPV — solo para las más atrevidas 👀',
      isPPV: true,
      ppvPrice: 9.99,
      isFree: false,
      publishedAt: new Date(Date.now() - 86400000),
      likesCount: 89,
      commentsCount: 12,
    },
    {
      caption: '💌 Una pequeña muestra de lo que recibirás con tu suscripción',
      isPPV: false,
      isFree: true,
      publishedAt: new Date(Date.now() - 172800000),
      likesCount: 234,
      commentsCount: 45,
    },
  ];

  for (const postData of posts) {
    const existing = await prisma.post.findFirst({
      where: { creatorId: creator.id, caption: postData.caption },
    });
    if (!existing) {
      await prisma.post.create({
        data: {
          creatorId: creator.id,
          ...postData,
          media: {
            create: [{
              type: 'IMAGE',
              url: `https://picsum.photos/seed/${Math.random()}/800/600`,
              blurUrl: `https://picsum.photos/seed/${Math.random()}/20/15`,
              width: 800,
              height: 600,
              order: 0,
            }],
          },
        },
      });
    }
  }

  // ─── KYC (approved) ──────────────────────────────────────────────────────
  await prisma.kycVerification.upsert({
    where: { userId: creator.id },
    update: {},
    create: {
      userId: creator.id,
      status: 'APPROVED',
      fullName: 'Sofía García López',
      dateOfBirth: new Date('1995-03-15'),
      country: 'MX',
      reviewedAt: new Date(),
    },
  });

  console.log('✅ Posts and KYC created');
  console.log('\n🎉 Seed completado!\n');
  console.log('Credenciales de prueba:');
  console.log('  Admin:   admin@onlyfeets.com   / Admin123!');
  console.log('  Creadora: sofia@onlyfeets.com  / Creator123!');
  console.log('  Fan:      fan@onlyfeets.com    / Fan123!');
  console.log('\nAccede a:');
  console.log('  App:   http://localhost:3000');
  console.log('  API:   http://localhost:4000');
  console.log('  Admin: http://localhost:3000/admin');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
