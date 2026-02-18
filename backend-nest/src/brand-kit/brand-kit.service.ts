import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BrandKitDto {
  name: string;
  isDefault?: boolean;

  // Colors
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  colorPalette?: string[];

  // Typography
  headingFont?: string;
  bodyFont?: string;
  fontSizes?: {
    xs?: string;
    sm?: string;
    base?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
    '3xl'?: string;
    '4xl'?: string;
  };

  // Logo & Images
  logoUrl?: string;
  logoLight?: string;
  logoDark?: string;
  favicon?: string;
  coverImages?: string[];

  // Assets
  icons?: string[];
  patterns?: string[];
  watermark?: string;
  watermarkOpacity?: number;

  // Voice & Tone
  voiceDescription?: string;
  toneKeywords?: string[];

  // Guidelines
  doList?: string[];
  dontList?: string[];
  styleGuideUrl?: string;
}

@Injectable()
export class BrandKitService {
  private readonly logger = new Logger(BrandKitService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a new brand kit
   */
  async create(data: BrandKitDto, userId: string, organizationId?: string) {
    this.logger.log(`Creating brand kit "${data.name}" for user ${userId}`);

    // If this is set as default, unset other defaults for this user/org
    if (data.isDefault) {
      await this.unsetDefaultBrandKits(userId, organizationId);
    }

    const brandKit = await this.prisma.brandKit.create({
      data: {
        name: data.name,
        isDefault: data.isDefault ?? false,
        userId: organizationId ? null : userId,
        organizationId,

        // Colors
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        backgroundColor: data.backgroundColor,
        textColor: data.textColor,
        colorPalette: data.colorPalette,

        // Typography
        headingFont: data.headingFont,
        bodyFont: data.bodyFont,
        fontSizes: data.fontSizes,

        // Logo & Images
        logoUrl: data.logoUrl,
        logoLight: data.logoLight,
        logoDark: data.logoDark,
        favicon: data.favicon,
        coverImages: data.coverImages,

        // Assets
        icons: data.icons,
        patterns: data.patterns,
        watermark: data.watermark,
        watermarkOpacity: data.watermarkOpacity,

        // Voice & Tone
        voiceDescription: data.voiceDescription,
        toneKeywords: data.toneKeywords,

        // Guidelines
        doList: data.doList,
        dontList: data.dontList,
        styleGuideUrl: data.styleGuideUrl,
      },
    });

    this.logger.log(`Created brand kit ${brandKit.id}`);
    return brandKit;
  }

  /**
   * Get all brand kits for a user (including org brand kits)
   */
  async findAll(userId: string, organizationId?: string) {
    return this.prisma.brandKit.findMany({
      where: {
        OR: [{ userId }, { organizationId: organizationId || undefined }],
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get a specific brand kit
   */
  async findOne(id: string, userId: string) {
    const brandKit = await this.prisma.brandKit.findUnique({
      where: { id },
    });

    if (!brandKit) {
      throw new NotFoundException(`Brand kit ${id} not found`);
    }

    // Check access - user owns it or belongs to the org
    if (brandKit.userId !== userId && brandKit.organizationId) {
      const isMember = await this.prisma.organizationMember.findFirst({
        where: {
          organizationId: brandKit.organizationId,
          userId,
        },
      });
      if (!isMember) {
        throw new ForbiddenException(
          'You do not have access to this brand kit',
        );
      }
    } else if (brandKit.userId !== userId) {
      throw new ForbiddenException('You do not have access to this brand kit');
    }

    return brandKit;
  }

  /**
   * Get the default brand kit for a user/org
   */
  async getDefault(userId: string, organizationId?: string) {
    return this.prisma.brandKit.findFirst({
      where: {
        OR: [
          { userId, isDefault: true },
          { organizationId: organizationId || undefined, isDefault: true },
        ],
      },
      orderBy: {
        // Org defaults take precedence
        organizationId: 'desc',
      },
    });
  }

  /**
   * Update a brand kit
   */
  async update(id: string, data: Partial<BrandKitDto>, userId: string) {
    // Verify access
    await this.findOne(id, userId);

    // If setting as default, unset others
    if (data.isDefault) {
      const existing = await this.prisma.brandKit.findUnique({ where: { id } });
      await this.unsetDefaultBrandKits(
        existing?.userId || userId,
        existing?.organizationId || undefined,
      );
    }

    return this.prisma.brandKit.update({
      where: { id },
      data: {
        name: data.name,
        isDefault: data.isDefault,

        // Colors
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        backgroundColor: data.backgroundColor,
        textColor: data.textColor,
        colorPalette: data.colorPalette,

        // Typography
        headingFont: data.headingFont,
        bodyFont: data.bodyFont,
        fontSizes: data.fontSizes,

        // Logo & Images
        logoUrl: data.logoUrl,
        logoLight: data.logoLight,
        logoDark: data.logoDark,
        favicon: data.favicon,
        coverImages: data.coverImages,

        // Assets
        icons: data.icons,
        patterns: data.patterns,
        watermark: data.watermark,
        watermarkOpacity: data.watermarkOpacity,

        // Voice & Tone
        voiceDescription: data.voiceDescription,
        toneKeywords: data.toneKeywords,

        // Guidelines
        doList: data.doList,
        dontList: data.dontList,
        styleGuideUrl: data.styleGuideUrl,
      },
    });
  }

  /**
   * Delete a brand kit
   */
  async delete(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.brandKit.delete({ where: { id } });
  }

  /**
   * Set a brand kit as default
   */
  async setDefault(id: string, userId: string) {
    const brandKit = await this.findOne(id, userId);

    await this.unsetDefaultBrandKits(
      brandKit.userId || userId,
      brandKit.organizationId || undefined,
    );

    return this.prisma.brandKit.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  /**
   * Duplicate a brand kit
   */
  async duplicate(id: string, userId: string, newName?: string) {
    const original = await this.findOne(id, userId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _, createdAt, updatedAt, ...data } = original;

    return this.prisma.brandKit.create({
      data: {
        ...data,
        name: newName || `${original.name} (Copy)`,
        isDefault: false,
        userId,
      },
    });
  }

  /**
   * Apply brand kit colors to generate a theme-compatible object
   */
  async toTheme(id: string, userId: string) {
    const brandKit = await this.findOne(id, userId);

    return {
      primaryColor: brandKit.primaryColor || '#3b82f6',
      secondaryColor: brandKit.secondaryColor || '#64748b',
      accentColor: brandKit.accentColor || '#f59e0b',
      backgroundColor: brandKit.backgroundColor || '#ffffff',
      textColor: brandKit.textColor || '#1e293b',
      headingFont: brandKit.headingFont || 'Inter',
      bodyFont: brandKit.bodyFont || 'Inter',
      logoUrl: brandKit.logoUrl,
    };
  }

  /**
   * Unset default flag on all brand kits for a user/org
   */
  private async unsetDefaultBrandKits(userId: string, organizationId?: string) {
    await this.prisma.brandKit.updateMany({
      where: {
        OR: [{ userId }, { organizationId: organizationId || undefined }],
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }
}
