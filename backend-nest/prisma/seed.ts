import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean up existing data (optional - comment out in production)
  // await prisma.user.deleteMany();
  // await prisma.project.deleteMany();

  // Seed Users
  console.log('📝 Seeding users...');
  const hashedPassword = await bcrypt.hash('Password123!', 10);

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
      userId: adminUser.id,
      visibility: 'PRIVATE',
      slides: {
        create: [
          {
            title: 'Q4 Performance Overview',
            content: JSON.stringify({
              blocks: [
                {
                  id: '1',
                  type: 'heading',
                  content: 'Q4 2025 Business Review',
                  level: 1,
                },
                {
                  id: '2',
                  type: 'paragraph',
                  content: 'Annual performance summary and 2026 outlook',
                },
              ],
            }),
            order: 0,
          },
          {
            title: 'Key Metrics',
            content: JSON.stringify({
              blocks: [
                {
                  id: '1',
                  type: 'heading',
                  content: 'Key Performance Indicators',
                  level: 2,
                },
                {
                  id: '2',
                  type: 'list',
                  items: [
                    'Revenue Growth: 45%',
                    'Customer Acquisition: 10,000+',
                    'User Engagement: 85%',
                    'Customer Satisfaction: 4.8/5',
                  ],
                },
              ],
            }),
            order: 1,
          },
          {
            title: 'Strategic Priorities',
            content: JSON.stringify({
              blocks: [
                {
                  id: '1',
                  type: 'heading',
                  content: '2026 Strategic Focus',
                  level: 2,
                },
                {
                  id: '2',
                  type: 'paragraph',
                  content:
                    'Focus on enterprise expansion, AI capabilities, and global market penetration',
                },
              ],
            }),
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
      userId: proUser.id,
      visibility: 'PUBLIC',
      slides: {
        create: [
          {
            title: 'Revolutionary AI Platform',
            content: JSON.stringify({
              blocks: [
                {
                  id: '1',
                  type: 'heading',
                  content: 'Introducing Our AI-Powered Platform',
                  level: 1,
                },
                {
                  id: '2',
                  type: 'paragraph',
                  content:
                    'Transform how teams create and collaborate on presentations',
                },
              ],
            }),
            order: 0,
          },
          {
            title: 'Market Opportunity',
            content: JSON.stringify({
              blocks: [
                {
                  id: '1',
                  type: 'heading',
                  content: '$10B Market Opportunity',
                  level: 2,
                },
                {
                  id: '2',
                  type: 'paragraph',
                  content:
                    'The presentation software market continues to grow at 15% annually',
                },
              ],
            }),
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
      userId: freeUser.id,
      visibility: 'PRIVATE',
      slides: {
        create: [
          {
            title: 'Welcome to the Team',
            content: JSON.stringify({
              blocks: [
                {
                  id: '1',
                  type: 'heading',
                  content: 'Welcome Aboard!',
                  level: 1,
                },
                {
                  id: '2',
                  type: 'paragraph',
                  content: "We're excited to have you join our team",
                },
              ],
            }),
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
      { name: 'Business', color: '#3B82F6' },
      { name: 'Marketing', color: '#10B981' },
      { name: 'Sales', color: '#F59E0B' },
      { name: 'Product', color: '#8B5CF6' },
      { name: 'Design', color: '#EC4899' },
      { name: 'Engineering', color: '#6366F1' },
      { name: 'HR', color: '#14B8A6' },
      { name: 'Finance', color: '#EF4444' },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${tags.count} tags`);

  // Seed Organization
  console.log('🏢 Seeding sample organization...');
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Corporation',
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
        viewedAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        duration: 300, // 5 minutes
        completionRate: 80,
      },
      {
        projectId: project1.id,
        viewedAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
        duration: 450,
        completionRate: 100,
      },
      {
        projectId: project2.id,
        viewedAt: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
        duration: 240,
        completionRate: 60,
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
      typographyTokens: {
        fontFamily: 'Inter, sans-serif',
        fontSize: {
          small: '14px',
          medium: '16px',
          large: '20px',
          xlarge: '32px',
        },
      },
      spacingTokens: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
      isPublic: true,
    },
  });

  console.log('✅ Created design system');

  console.log('\n🎉 Database seeding completed successfully!\n');
  console.log('Test accounts:');
  console.log('  Admin: admin@presentation.com / Password123!');
  console.log('  Pro:   pro@presentation.com / Password123!');
  console.log('  Free:  user@presentation.com / Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
