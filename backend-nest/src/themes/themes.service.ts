import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Default theme configurations
const DEFAULT_THEMES = [
  {
    name: 'Modern Light',
    description: 'Clean and professional light theme',
    isDefault: true,
    isPremium: false,
    colors: {
      primary: '#3B82F6',
      secondary: '#8B5CF6',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#1E293B',
      textMuted: '#64748B',
      accent: '#F59E0B',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
    spacing: {
      base: 16,
      scale: 1.5,
    },
  },
  {
    name: 'Modern Dark',
    description: 'Sleek dark theme for impactful presentations',
    isDefault: false,
    isPremium: false,
    colors: {
      primary: '#60A5FA',
      secondary: '#A78BFA',
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F8FAFC',
      textMuted: '#94A3B8',
      accent: '#FBBF24',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
    spacing: {
      base: 16,
      scale: 1.5,
    },
  },
  {
    name: 'Corporate Blue',
    description: 'Professional corporate theme',
    isDefault: false,
    isPremium: false,
    colors: {
      primary: '#1E40AF',
      secondary: '#3730A3',
      background: '#FFFFFF',
      surface: '#EFF6FF',
      text: '#1E3A5F',
      textMuted: '#6B7280',
      accent: '#DC2626',
    },
    fonts: {
      heading: 'Roboto',
      body: 'Roboto',
    },
    spacing: {
      base: 18,
      scale: 1.4,
    },
  },
  {
    name: 'Minimal',
    description: 'Clean minimalist design',
    isDefault: false,
    isPremium: false,
    colors: {
      primary: '#18181B',
      secondary: '#52525B',
      background: '#FAFAFA',
      surface: '#FFFFFF',
      text: '#18181B',
      textMuted: '#71717A',
      accent: '#18181B',
    },
    fonts: {
      heading: 'Playfair Display',
      body: 'Source Sans Pro',
    },
    spacing: {
      base: 20,
      scale: 1.6,
    },
  },
  {
    name: 'Vibrant Gradient',
    description: 'Bold and colorful modern theme',
    isDefault: false,
    isPremium: true,
    colors: {
      primary: '#EC4899',
      secondary: '#8B5CF6',
      background: '#18181B',
      surface: '#27272A',
      text: '#FAFAFA',
      textMuted: '#A1A1AA',
      accent: '#22D3EE',
    },
    fonts: {
      heading: 'Poppins',
      body: 'Poppins',
    },
    spacing: {
      base: 16,
      scale: 1.5,
    },
  },
  {
    name: 'Nature',
    description: 'Calm and organic green theme',
    isDefault: false,
    isPremium: true,
    colors: {
      primary: '#059669',
      secondary: '#0D9488',
      background: '#F0FDF4',
      surface: '#FFFFFF',
      text: '#14532D',
      textMuted: '#4B5563',
      accent: '#D97706',
    },
    fonts: {
      heading: 'Merriweather',
      body: 'Open Sans',
    },
    spacing: {
      base: 18,
      scale: 1.5,
    },
  },
];

@Injectable()
export class ThemesService {
  private readonly logger = new Logger(ThemesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seed default themes into database
   */
  async seedThemes() {
    for (const theme of DEFAULT_THEMES) {
      const existing = await this.prisma.theme.findFirst({
        where: { name: theme.name },
      });

      if (!existing) {
        await this.prisma.theme.create({
          data: {
            name: theme.name,
            description: theme.description,
            isDefault: theme.isDefault,
            isPremium: theme.isPremium,
            colors: theme.colors,
            fonts: theme.fonts,
            spacing: theme.spacing,
          },
        });
        this.logger.log(`Theme seeded: ${theme.name}`);
      }
    }
  }

  /**
   * Get all available themes
   */
  async findAll(includePremium = true) {
    const where = includePremium ? {} : { isPremium: false };

    return this.prisma.theme.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { isPremium: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get a single theme by ID
   */
  async findOne(id: string) {
    const theme = await this.prisma.theme.findUnique({
      where: { id },
    });

    if (!theme) {
      throw new NotFoundException('Theme not found');
    }

    return theme;
  }

  /**
   * Get the default theme
   */
  async getDefault() {
    const theme = await this.prisma.theme.findFirst({
      where: { isDefault: true },
    });

    if (!theme) {
      // Fallback to first theme
      return this.prisma.theme.findFirst();
    }

    return theme;
  }

  /**
   * Check if user can use a theme based on subscription
   */
  async canUseTheme(themeId: string, isPremiumUser: boolean): Promise<boolean> {
    const theme = await this.findOne(themeId);

    if (!theme.isPremium) {
      return true;
    }

    return isPremiumUser;
  }
}
