import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  success: string;
  warning: string;
  error: string;
}

export interface Typography {
  headingFont: string;
  bodyFont: string;
  headingSizes: {
    h1: string;
    h2: string;
    h3: string;
    h4: string;
  };
  bodySize: string;
  lineHeight: number;
  letterSpacing: string;
}

export interface LogoAsset {
  id: string;
  type: 'primary' | 'secondary' | 'icon' | 'wordmark';
  url: string;
  darkModeUrl?: string;
  width: number;
  height: number;
  format: 'svg' | 'png' | 'webp';
}

export interface BrandKit {
  id: string;
  name: string;
  description?: string;
  organizationId?: string;
  userId: string;
  isDefault: boolean;
  colors: ColorPalette;
  typography: Typography;
  logos: LogoAsset[];
  patterns?: string[];
  icons?: string[];
  customCss?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class BrandKitService {
  private readonly logger = new Logger(BrandKitService.name);

  constructor(private prisma: PrismaService) {}

  async createBrandKit(
    userId: string,
    data: {
      name: string;
      description?: string;
      organizationId?: string;
      colors?: Partial<ColorPalette>;
      typography?: Partial<Typography>;
    },
  ): Promise<BrandKit> {
    const defaultColors: ColorPalette = {
      primary: '#2563eb',
      secondary: '#7c3aed',
      accent: '#06b6d4',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#0f172a',
      textSecondary: '#64748b',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    };

    const defaultTypography: Typography = {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      headingSizes: {
        h1: '48px',
        h2: '36px',
        h3: '24px',
        h4: '18px',
      },
      bodySize: '16px',
      lineHeight: 1.6,
      letterSpacing: 'normal',
    };

    const brandKit: BrandKit = {
      id: `brand-${Date.now()}`,
      name: data.name,
      description: data.description,
      organizationId: data.organizationId,
      userId,
      isDefault: false,
      colors: { ...defaultColors, ...data.colors },
      typography: { ...defaultTypography, ...data.typography },
      logos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.logger.log(`Created brand kit ${brandKit.id} for user ${userId}`);
    return brandKit;
  }

  async getBrandKits(
    userId: string,
    organizationId?: string,
  ): Promise<BrandKit[]> {
    // In production, fetch from database
    return [
      {
        id: 'brand-1',
        name: 'Corporate Brand',
        description: 'Official company branding',
        userId,
        organizationId,
        isDefault: true,
        colors: {
          primary: '#2563eb',
          secondary: '#7c3aed',
          accent: '#06b6d4',
          background: '#ffffff',
          surface: '#f8fafc',
          text: '#0f172a',
          textSecondary: '#64748b',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
        },
        typography: {
          headingFont: 'Inter',
          bodyFont: 'Inter',
          headingSizes: { h1: '48px', h2: '36px', h3: '24px', h4: '18px' },
          bodySize: '16px',
          lineHeight: 1.6,
          letterSpacing: 'normal',
        },
        logos: [
          {
            id: 'logo-1',
            type: 'primary',
            url: '/logos/company-primary.svg',
            darkModeUrl: '/logos/company-primary-dark.svg',
            width: 200,
            height: 50,
            format: 'svg',
          },
        ],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-15'),
      },
    ];
  }

  async getBrandKitById(id: string): Promise<BrandKit> {
    const kits = await this.getBrandKits('');
    const kit = kits.find((k) => k.id === id);
    if (!kit) {
      throw new NotFoundException('Brand kit not found');
    }
    return kit;
  }

  async updateBrandKit(
    userId: string,
    brandKitId: string,
    updates: Partial<{
      name: string;
      description: string;
      colors: Partial<ColorPalette>;
      typography: Partial<Typography>;
      customCss: string;
    }>,
  ): Promise<BrandKit> {
    const existing = await this.getBrandKitById(brandKitId);

    if (existing.userId !== userId) {
      throw new ForbiddenException('Not authorized to update this brand kit');
    }

    const updated: BrandKit = {
      ...existing,
      ...updates,
      colors: { ...existing.colors, ...updates.colors },
      typography: { ...existing.typography, ...updates.typography },
      updatedAt: new Date(),
    };

    this.logger.log(`Updated brand kit ${brandKitId}`);
    return updated;
  }

  async deleteBrandKit(userId: string, brandKitId: string): Promise<void> {
    const existing = await this.getBrandKitById(brandKitId);

    if (existing.userId !== userId) {
      throw new ForbiddenException('Not authorized to delete this brand kit');
    }

    this.logger.log(`Deleted brand kit ${brandKitId}`);
  }

  async addLogo(
    userId: string,
    brandKitId: string,
    logo: Omit<LogoAsset, 'id'>,
  ): Promise<LogoAsset> {
    const logoAsset: LogoAsset = {
      id: `logo-${Date.now()}`,
      ...logo,
    };

    this.logger.log(`Added logo ${logoAsset.id} to brand kit ${brandKitId}`);
    return logoAsset;
  }

  async removeLogo(
    userId: string,
    brandKitId: string,
    logoId: string,
  ): Promise<void> {
    this.logger.log(`Removed logo ${logoId} from brand kit ${brandKitId}`);
  }

  async setDefaultBrandKit(userId: string, brandKitId: string): Promise<void> {
    this.logger.log(
      `Set brand kit ${brandKitId} as default for user ${userId}`,
    );
  }

  async applyBrandKitToProject(
    userId: string,
    projectId: string,
    brandKitId: string,
  ): Promise<void> {
    const brandKit = await this.getBrandKitById(brandKitId);

    // Apply colors and typography to project theme
    // In production, this would update the project's theme settings
    this.logger.log(`Applied brand kit ${brandKitId} to project ${projectId}`);
  }

  async extractColorsFromLogo(logoUrl: string): Promise<ColorPalette> {
    // In production, use color extraction library
    // For now, return a default palette
    return {
      primary: '#2563eb',
      secondary: '#7c3aed',
      accent: '#06b6d4',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#0f172a',
      textSecondary: '#64748b',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    };
  }

  async suggestFontPairings(primaryFont: string): Promise<
    Array<{
      heading: string;
      body: string;
      description: string;
    }>
  > {
    const pairings: Record<
      string,
      Array<{ heading: string; body: string; description: string }>
    > = {
      Inter: [
        { heading: 'Inter', body: 'Inter', description: 'Clean and modern' },
        {
          heading: 'Playfair Display',
          body: 'Inter',
          description: 'Elegant contrast',
        },
        {
          heading: 'Space Grotesk',
          body: 'Inter',
          description: 'Tech-forward',
        },
      ],
      Roboto: [
        {
          heading: 'Roboto',
          body: 'Roboto',
          description: 'Consistent and readable',
        },
        {
          heading: 'Roboto Slab',
          body: 'Roboto',
          description: 'Professional mix',
        },
        {
          heading: 'Poppins',
          body: 'Roboto',
          description: 'Friendly and modern',
        },
      ],
      'Open Sans': [
        {
          heading: 'Montserrat',
          body: 'Open Sans',
          description: 'Bold and clean',
        },
        {
          heading: 'Open Sans',
          body: 'Open Sans',
          description: 'Highly readable',
        },
        {
          heading: 'Raleway',
          body: 'Open Sans',
          description: 'Elegant simplicity',
        },
      ],
    };

    return (
      pairings[primaryFont] || [
        {
          heading: primaryFont,
          body: primaryFont,
          description: 'Unified style',
        },
        { heading: 'Inter', body: primaryFont, description: 'Modern headings' },
        {
          heading: 'Playfair Display',
          body: primaryFont,
          description: 'Classic touch',
        },
      ]
    );
  }

  generateCSS(brandKit: BrandKit): string {
    return `
:root {
  /* Colors */
  --color-primary: ${brandKit.colors.primary};
  --color-secondary: ${brandKit.colors.secondary};
  --color-accent: ${brandKit.colors.accent};
  --color-background: ${brandKit.colors.background};
  --color-surface: ${brandKit.colors.surface};
  --color-text: ${brandKit.colors.text};
  --color-text-secondary: ${brandKit.colors.textSecondary};
  --color-success: ${brandKit.colors.success};
  --color-warning: ${brandKit.colors.warning};
  --color-error: ${brandKit.colors.error};
  
  /* Typography */
  --font-heading: '${brandKit.typography.headingFont}', sans-serif;
  --font-body: '${brandKit.typography.bodyFont}', sans-serif;
  --font-size-h1: ${brandKit.typography.headingSizes.h1};
  --font-size-h2: ${brandKit.typography.headingSizes.h2};
  --font-size-h3: ${brandKit.typography.headingSizes.h3};
  --font-size-h4: ${brandKit.typography.headingSizes.h4};
  --font-size-body: ${brandKit.typography.bodySize};
  --line-height: ${brandKit.typography.lineHeight};
  --letter-spacing: ${brandKit.typography.letterSpacing};
}

.slide {
  background-color: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  line-height: var(--line-height);
}

h1 { font-family: var(--font-heading); font-size: var(--font-size-h1); }
h2 { font-family: var(--font-heading); font-size: var(--font-size-h2); }
h3 { font-family: var(--font-heading); font-size: var(--font-size-h3); }
h4 { font-family: var(--font-heading); font-size: var(--font-size-h4); }

${brandKit.customCss || ''}
    `.trim();
  }
}
