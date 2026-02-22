require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Use the same initialization pattern as the NestJS app
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set, cannot seed themes');
  process.exit(1);
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('🎨 Seeding themes...');

  // Delete existing themes first
  const deleted = await prisma.theme.deleteMany({});
  console.log(`Deleted ${deleted.count} existing themes\n`);

  const themes = [
    {
      name: 'Modern Blue',
      description: 'Clean and professional blue theme',
      isDefault: true,
      isPremium: false,
      colors: {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        text: '#1E293B',
        textMuted: '#64748B',
        accent: '#10B981',
      },
      fonts: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    },
    {
      name: 'Dark Pro',
      description: 'Sleek dark theme for modern presentations',
      isDefault: false,
      isPremium: false,
      colors: {
        primary: '#60A5FA',
        secondary: '#A78BFA',
        background: '#0F172A',
        surface: '#1E293B',
        text: '#F1F5F9',
        textMuted: '#94A3B8',
        accent: '#34D399',
      },
      fonts: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    },
    {
      name: 'Sunset Gradient',
      description: 'Warm gradient theme with orange and pink tones',
      isDefault: false,
      isPremium: false,
      colors: {
        primary: '#F97316',
        secondary: '#EC4899',
        background: '#FFF7ED',
        surface: '#FFFFFF',
        text: '#1C1917',
        textMuted: '#78716C',
        accent: '#EF4444',
      },
      fonts: {
        heading: 'Playfair Display, serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 18,
        scale: 1.6,
      },
    },
    {
      name: 'Mint Fresh',
      description: 'Fresh and energetic green theme',
      isDefault: false,
      isPremium: false,
      colors: {
        primary: '#10B981',
        secondary: '#14B8A6',
        background: '#F0FDF4',
        surface: '#FFFFFF',
        text: '#064E3B',
        textMuted: '#047857',
        accent: '#06B6D4',
      },
      fonts: {
        heading: 'Outfit, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    },
    {
      name: 'Corporate Gray',
      description: 'Professional neutral theme for business',
      isDefault: false,
      isPremium: false,
      colors: {
        primary: '#475569',
        secondary: '#64748B',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        text: '#0F172A',
        textMuted: '#64748B',
        accent: '#3B82F6',
      },
      fonts: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    },
    {
      name: 'Royal Purple',
      description: 'Elegant purple theme with luxury feel',
      isDefault: false,
      isPremium: true,
      colors: {
        primary: '#7C3AED',
        secondary: '#A855F7',
        background: '#FAF5FF',
        surface: '#FFFFFF',
        text: '#3B0764',
        textMuted: '#6B21A8',
        accent: '#EC4899',
      },
      fonts: {
        heading: 'Playfair Display, serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 18,
        scale: 1.6,
      },
    },
    {
      name: 'Ocean Depths',
      description: 'Deep blue theme inspired by the ocean',
      isDefault: false,
      isPremium: true,
      colors: {
        primary: '#0EA5E9',
        secondary: '#06B6D4',
        background: '#0C4A6E',
        surface: '#155E75',
        text: '#ECFEFF',
        textMuted: '#A5F3FC',
        accent: '#22D3EE',
      },
      fonts: {
        heading: 'Outfit, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    },
    {
      name: 'Warm Sand',
      description: 'Soft beige theme with earthy tones',
      isDefault: false,
      isPremium: false,
      colors: {
        primary: '#D97706',
        secondary: '#B45309',
        background: '#FFFBEB',
        surface: '#FFFFFF',
        text: '#451A03',
        textMuted: '#78350F',
        accent: '#F59E0B',
      },
      fonts: {
        heading: 'Playfair Display, serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 18,
        scale: 1.6,
      },
    },
    {
      name: 'Cherry Blossom',
      description: 'Soft pink theme with Japanese aesthetic',
      isDefault: false,
      isPremium: true,
      colors: {
        primary: '#EC4899',
        secondary: '#F472B6',
        background: '#FDF2F8',
        surface: '#FFFFFF',
        text: '#831843',
        textMuted: '#9D174D',
        accent: '#F43F5E',
      },
      fonts: {
        heading: 'Playfair Display, serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 18,
        scale: 1.6,
      },
    },
    {
      name: 'Forest Green',
      description: 'Nature-inspired dark green theme',
      isDefault: false,
      isPremium: false,
      colors: {
        primary: '#059669',
        secondary: '#10B981',
        background: '#064E3B',
        surface: '#065F46',
        text: '#D1FAE5',
        textMuted: '#6EE7B7',
        accent: '#34D399',
      },
      fonts: {
        heading: 'Outfit, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    },
    {
      name: 'Monochrome',
      description: 'Classic black and white theme',
      isDefault: false,
      isPremium: false,
      colors: {
        primary: '#000000',
        secondary: '#404040',
        background: '#FFFFFF',
        surface: '#F5F5F5',
        text: '#000000',
        textMuted: '#666666',
        accent: '#0066CC',
      },
      fonts: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    },
    {
      name: 'Neon Cyber',
      description: 'Futuristic theme with neon accents',
      isDefault: false,
      isPremium: true,
      colors: {
        primary: '#8B5CF6',
        secondary: '#EC4899',
        background: '#18181B',
        surface: '#27272A',
        text: '#FAFAFA',
        textMuted: '#A1A1AA',
        accent: '#06B6D4',
      },
      fonts: {
        heading: 'Outfit, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    },
    {
      name: 'Lavender Dreams',
      description: 'Soft purple theme with calming vibes',
      isDefault: false,
      isPremium: false,
      colors: {
        primary: '#A78BFA',
        secondary: '#C4B5FD',
        background: '#F5F3FF',
        surface: '#FFFFFF',
        text: '#5B21B6',
        textMuted: '#7C3AED',
        accent: '#EC4899',
      },
      fonts: {
        heading: 'Playfair Display, serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 17,
        scale: 1.55,
      },
    },
    {
      name: 'Midnight Blue',
      description: 'Deep professional blue for serious presentations',
      isDefault: false,
      isPremium: true,
      colors: {
        primary: '#1E3A8A',
        secondary: '#3B82F6',
        background: '#1E293B',
        surface: '#334155',
        text: '#F1F5F9',
        textMuted: '#CBD5E1',
        accent: '#60A5FA',
      },
      fonts: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    },
    {
      name: 'Terracotta Sunset',
      description: 'Earthy warm theme with Mediterranean vibes',
      isDefault: false,
      isPremium: false,
      colors: {
        primary: '#C2410C',
        secondary: '#EA580C',
        background: '#FFF7ED',
        surface: '#FFFFFF',
        text: '#7C2D12',
        textMuted: '#9A3412',
        accent: '#FB923C',
      },
      fonts: {
        heading: 'Playfair Display, serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 18,
        scale: 1.6,
      },
    },
    {
      name: 'Emerald Elegance',
      description: 'Luxurious green theme for premium content',
      isDefault: false,
      isPremium: true,
      colors: {
        primary: '#047857',
        secondary: '#059669',
        background: '#ECFDF5',
        surface: '#FFFFFF',
        text: '#065F46',
        textMuted: '#047857',
        accent: '#10B981',
      },
      fonts: {
        heading: 'Playfair Display, serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 18,
        scale: 1.6,
      },
    },
    {
      name: 'Crimson Bold',
      description: 'Strong red theme for impactful presentations',
      isDefault: false,
      isPremium: false,
      colors: {
        primary: '#DC2626',
        secondary: '#EF4444',
        background: '#FEF2F2',
        surface: '#FFFFFF',
        text: '#7F1D1D',
        textMuted: '#991B1B',
        accent: '#F87171',
      },
      fonts: {
        heading: 'Outfit, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    },
    {
      name: 'Arctic White',
      description: 'Minimal white theme with subtle accents',
      isDefault: false,
      isPremium: false,
      colors: {
        primary: '#64748B',
        secondary: '#94A3B8',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        text: '#0F172A',
        textMuted: '#475569',
        accent: '#3B82F6',
      },
      fonts: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 20,
        scale: 1.7,
      },
    },
    {
      name: 'Golden Hour',
      description: 'Warm gold theme inspired by sunset',
      isDefault: false,
      isPremium: true,
      colors: {
        primary: '#D97706',
        secondary: '#F59E0B',
        background: '#FFFBEB',
        surface: '#FFFFFF',
        text: '#78350F',
        textMuted: '#92400E',
        accent: '#FBBF24',
      },
      fonts: {
        heading: 'Playfair Display, serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 18,
        scale: 1.6,
      },
    },
    {
      name: 'Slate Modern',
      description: 'Cool gray theme for tech presentations',
      isDefault: false,
      isPremium: false,
      colors: {
        primary: '#334155',
        secondary: '#475569',
        background: '#F1F5F9',
        surface: '#FFFFFF',
        text: '#0F172A',
        textMuted: '#64748B',
        accent: '#06B6D4',
      },
      fonts: {
        heading: 'Outfit, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    },
    {
      name: 'Deep Ocean',
      description: 'Professional navy blue with aqua accents',
      isDefault: false,
      isPremium: true,
      colors: {
        primary: '#164E63',
        secondary: '#0E7490',
        background: '#ECFEFF',
        surface: '#FFFFFF',
        text: '#083344',
        textMuted: '#155E75',
        accent: '#22D3EE',
      },
      fonts: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    },
    {
      name: 'Pastel Rainbow',
      description: 'Soft multi-color theme for creative work',
      isDefault: false,
      isPremium: true,
      colors: {
        primary: '#A78BFA',
        secondary: '#F9A8D4',
        background: '#FEFCE8',
        surface: '#FFFFFF',
        text: '#422006',
        textMuted: '#713F12',
        accent: '#6EE7B7',
      },
      fonts: {
        heading: 'Outfit, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        base: 17,
        scale: 1.55,
      },
    },
  ];

  for (const theme of themes) {
    await prisma.theme.create({
      data: theme,
    });
    console.log(`✅ Created theme: ${theme.name}`);
  }

  console.log(`\n🎉 Successfully seeded ${themes.length} themes!`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding themes:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
