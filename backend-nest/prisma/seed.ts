import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

// Create Prisma client with the same configuration as PrismaService
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean up existing data (optional - comment out in production)
  // await prisma.user.deleteMany();
  // await prisma.project.deleteMany();

  // Seed Users
  console.log('📝 Seeding users...');
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || 'Password123!';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@presentation.com' },
    update: {},
    create: {
      email: 'admin@presentation.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
      emailVerified: new Date(),
      subscriptionTier: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
    },
  });

  const proUser = await prisma.user.upsert({
    where: { email: 'pro@presentation.com' },
    update: {},
    create: {
      email: 'pro@presentation.com',
      name: 'Pro User',
      password: hashedPassword,
      role: 'USER',
      emailVerified: new Date(),
      subscriptionTier: 'PRO',
      subscriptionStatus: 'ACTIVE',
    },
  });

  const freeUser = await prisma.user.upsert({
    where: { email: 'user@presentation.com' },
    update: {},
    create: {
      email: 'user@presentation.com',
      name: 'Free User',
      password: hashedPassword,
      role: 'USER',
      emailVerified: new Date(),
      subscriptionTier: 'FREE',
      subscriptionStatus: 'ACTIVE',
    },
  });

  console.log(`✅ Created ${3} users`);

  // Seed Themes (check if themes are already seeded by the service)
  console.log('🎨 Checking themes...');
  const existingThemes = await prisma.theme.count();
  console.log(`ℹ️  Found ${existingThemes} existing themes (managed by ThemesService)`);

  // Seed Sample Projects
  console.log('📊 Seeding sample projects...');

  const project1 = await prisma.project.create({
    data: {
      title: 'Q4 Business Review',
      description: 'Quarterly business review presentation for stakeholders',
      ownerId: adminUser.id,
      isPublic: false,
      slides: {
        create: [
          {
            title: 'Q4 Performance Overview',
            order: 0,

          },
          {
            title: 'Key Metrics',
            order: 1,
          },
          {
            title: 'Strategic Priorities',
            order: 2,
          },
        ],
      },
    },
  });

  const project2 = await prisma.project.create({
    data: {
      title: 'Product Launch Deck',
      description: 'New product launch presentation for investors',
      ownerId: proUser.id,
      isPublic: true,
      slides: {
        create: [
          {
            title: 'Revolutionary AI Platform',
            order: 0,
          },
          {
            title: 'Market Opportunity',
            order: 1,
          },
        ],
      },
    },
  });

  const project3 = await prisma.project.create({
    data: {
      title: 'Team Training Materials',
      description: 'Onboarding and training presentation for new team members',
      ownerId: freeUser.id,
      isPublic: false,
      slides: {
        create: [
          {
            title: 'Welcome to the Team',
            order: 0,
          },
        ],
      },
    },
  });

  console.log(`✅ Created ${3} sample projects with slides`);

  // Seed Tags
  console.log('🏷️  Seeding tags...');
  const tags = await prisma.tag.createMany({
    data: [
      { userId: adminUser.id, name: 'Business', color: '#3B82F6' },
      { userId: adminUser.id, name: 'Marketing', color: '#10B981' },
      { userId: adminUser.id, name: 'Sales', color: '#F59E0B' },
      { userId: adminUser.id, name: 'Product', color: '#8B5CF6' },
      { userId: adminUser.id, name: 'Design', color: '#EC4899' },
      { userId: adminUser.id, name: 'Engineering', color: '#6366F1' },
      { userId: adminUser.id, name: 'HR', color: '#14B8A6' },
      { userId: adminUser.id, name: 'Finance', color: '#EF4444' },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${tags.count} tags`);

  // Seed Organization
  console.log('🏢 Seeding sample organization...');
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Corporation',
      slug: 'acme-corporation',
      domain: 'acme.com',
      plan: 'ENTERPRISE',
      members: {
        create: [
          {
            userId: adminUser.id,
            role: 'OWNER',
          },
          {
            userId: proUser.id,
            role: 'ADMIN',
          },
        ],
      },
    },
  });

  console.log(`✅ Created organization: ${org.name}`);

  // Seed Analytics Data
  console.log('📈 Seeding analytics data...');
  await prisma.presentationView.createMany({
    data: [
      {
        projectId: project1.id,
        sessionId: 'session-1',
        viewedAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        totalDuration: 300, // 5 minutes
      },
      {
        projectId: project1.id,
        sessionId: 'session-2',
        viewedAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
        totalDuration: 450,
      },
      {
        projectId: project2.id,
        sessionId: 'session-3',
        viewedAt: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
        totalDuration: 240,
      },
    ],
  });

  console.log('✅ Created analytics data');

  // Seed Design System
  console.log('🎨 Seeding design system...');
  await prisma.designSystem.create({
    data: {
      name: 'Default Design System',
      userId: adminUser.id,
      colorTokens: {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
        accent: '#10B981',
        background: '#FFFFFF',
        text: '#1F2937',
      },
      colors: {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
        accent: '#10B981',
        background: '#FFFFFF',
        text: '#1F2937',
      },
      typography: {
        fontFamily: 'Inter, sans-serif',
        fontSize: {
          small: '14px',
          medium: '16px',
          large: '20px',
          xlarge: '32px',
        },
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
    },
  });

  console.log('✅ Created design system');

  console.log('\n🎉 Database seeding completed successfully!\n');
  console.log('Test accounts:');
  console.log('  Admin: admin@presentation.com / (use SEED_DEFAULT_PASSWORD env var)');
  console.log('  Pro:   pro@presentation.com / (use SEED_DEFAULT_PASSWORD env var)');
  console.log('  Free:  user@presentation.com / (use SEED_DEFAULT_PASSWORD env var)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
