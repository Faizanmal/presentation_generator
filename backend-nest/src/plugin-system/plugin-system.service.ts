import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email: string;
    url?: string;
  };
  homepage?: string;
  repository?: string;
  license: string;
  main: string;
  permissions: PluginPermission[];
  hooks: PluginHook[];
  blocks?: CustomBlockDefinition[];
  themes?: CustomThemeDefinition[];
  actions?: CustomActionDefinition[];
  settings?: PluginSettingDefinition[];
  dependencies?: Record<string, string>;
  engines: {
    presentationDesigner: string;
  };
}

export type PluginPermission =
  | 'read:projects'
  | 'write:projects'
  | 'read:slides'
  | 'write:slides'
  | 'read:blocks'
  | 'write:blocks'
  | 'read:user'
  | 'write:user'
  | 'read:analytics'
  | 'network:fetch'
  | 'storage:local'
  | 'ui:modal'
  | 'ui:sidebar'
  | 'ui:toolbar';

export type PluginHook =
  | 'onProjectCreate'
  | 'onProjectOpen'
  | 'onProjectSave'
  | 'onSlideCreate'
  | 'onSlideDelete'
  | 'onBlockCreate'
  | 'onBlockUpdate'
  | 'onExport'
  | 'onPresent'
  | 'onAIGenerate'
  | 'onCollaboratorJoin'
  | 'onCollaboratorLeave';

export interface CustomBlockDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  defaultContent: object;
  schema: object; // JSON Schema for validation
  renderer: string; // Path to renderer component
  editor?: string; // Path to editor component
  toolbar?: string[]; // Toolbar actions
}

export interface CustomThemeDefinition {
  id: string;
  name: string;
  preview: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;
    body: string;
    code?: string;
  };
  styles: object;
}

export interface CustomActionDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  shortcut?: string;
  context: 'project' | 'slide' | 'block' | 'global';
  handler: string;
}

export interface PluginSettingDefinition {
  key: string;
  label: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'color';
  default: unknown;
  options?: Array<{ value: unknown; label: string }>;
  required?: boolean;
}

export interface PluginInstallation {
  id: string;
  pluginId: string;
  userId: string;
  organizationId?: string;
  version: string;
  isEnabled: boolean;
  settings: Record<string, unknown>;
  installedAt: Date;
}

@Injectable()
export class PluginSystemService {
  private readonly logger = new Logger(PluginSystemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================
  // PLUGIN DEVELOPMENT
  // ============================================

  /**
   * Register as a plugin developer
   */
  async registerDeveloper(
    userId: string,
    data: {
      companyName?: string;
      website?: string;
      acceptedTerms: boolean;
    },
  ): Promise<{ developerId: string; apiKey: string }> {
    if (!data.acceptedTerms) {
      throw new BadRequestException('Must accept developer terms');
    }

    const existingDeveloper = await this.prisma.pluginDeveloper.findFirst({
      where: { userId },
    });

    if (existingDeveloper) {
      throw new BadRequestException('Already registered as a developer');
    }

    const apiKey = this.generateApiKey();

    const developer = await this.prisma.pluginDeveloper.create({
      data: {
        userId,
        companyName: data.companyName,
        website: data.website,
        apiKey: this.hashApiKey(apiKey),
        apiKeyPrefix: apiKey.substring(0, 8),
        status: 'active',
      },
    });

    return {
      developerId: developer.id,
      apiKey,
    };
  }

  /**
   * Create a new plugin
   */
  async createPlugin(
    developerId: string,
    manifest: PluginManifest,
  ): Promise<{ pluginId: string }> {
    // Validate manifest
    this.validateManifest(manifest);

    // Check for duplicate plugin ID
    const existing = await this.prisma.plugin.findFirst({
      where: { pluginId: manifest.id },
    });

    if (existing) {
      throw new BadRequestException('Plugin ID already exists');
    }

    const plugin = await this.prisma.plugin.create({
      data: {
        pluginId: manifest.id,
        developerId,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        manifest: manifest as object,
        status: 'draft',
        permissions: manifest.permissions,
        hooks: manifest.hooks,
      },
    });

    return { pluginId: plugin.id };
  }

  /**
   * Upload plugin bundle
   */
  async uploadPluginBundle(
    pluginId: string,
    developerId: string,
    bundle: Buffer,
  ): Promise<{ bundleId: string; size: number }> {
    const plugin = await this.getPluginForDeveloper(pluginId, developerId);

    // Validate bundle (check for malicious code, size limits, etc.)
    await this.validateBundle(bundle);

    // Store bundle
    const bundleId = crypto.randomUUID();
    const bundleKey = `plugins/${plugin.pluginId}/${bundleId}.zip`;

    // TODO: Upload to S3

    // Update plugin
    await this.prisma.plugin.update({
      where: { id: pluginId },
      data: {
        bundleKey,
        bundleSize: bundle.length,
        bundleHash: crypto.createHash('sha256').update(bundle).digest('hex'),
      },
    });

    return { bundleId, size: bundle.length };
  }

  /**
   * Submit plugin for review
   */
  async submitForReview(
    pluginId: string,
    developerId: string,
  ): Promise<{ reviewId: string }> {
    const plugin = await this.getPluginForDeveloper(pluginId, developerId);

    if (!plugin.bundleKey) {
      throw new BadRequestException('Must upload bundle before submitting');
    }

    if (plugin.status === 'in_review') {
      throw new BadRequestException('Plugin is already in review');
    }

    const review = await this.prisma.pluginReview.create({
      data: {
        pluginId,
        status: 'pending',
        submittedAt: new Date(),
      },
    });

    await this.prisma.plugin.update({
      where: { id: pluginId },
      data: { status: 'in_review' },
    });

    return { reviewId: review.id };
  }

  /**
   * Publish plugin (after approval)
   */
  async publishPlugin(
    pluginId: string,
    developerId: string,
    version: string,
    releaseNotes: string,
  ): Promise<void> {
    const plugin = await this.getPluginForDeveloper(pluginId, developerId);

    if (plugin.status !== 'approved') {
      throw new BadRequestException(
        'Plugin must be approved before publishing',
      );
    }

    // Create version record
    await this.prisma.pluginVersion.create({
      data: {
        pluginId,
        version,
        releaseNotes,
        bundleKey: plugin.bundleKey!,
        manifest: plugin.manifest ?? undefined,
        publishedAt: new Date(),
      },
    });

    // Update plugin status
    await this.prisma.plugin.update({
      where: { id: pluginId },
      data: {
        status: 'published',
        version,
        publishedAt: new Date(),
      },
    });

    this.logger.log(`Plugin ${plugin.pluginId} v${version} published`);
  }

  // ============================================
  // PLUGIN DISCOVERY & INSTALLATION
  // ============================================

  /**
   * Search plugins in marketplace
   */
  async searchPlugins(
    query: string,
    options: {
      category?: string;
      sort?: 'popular' | 'recent' | 'rating';
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const where = {
      status: 'published',
      ...(query && {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } },
        ],
      }),
      ...(options.category && { category: options.category }),
    };

    const orderBy = {
      popular: { installCount: 'desc' as const },
      recent: { publishedAt: 'desc' as const },
      rating: { averageRating: 'desc' as const },
    }[options.sort || 'popular'];

    const [plugins, total] = await Promise.all([
      this.prisma.plugin.findMany({
        where,
        orderBy,
        take: options.limit || 20,
        skip: options.offset || 0,
        select: {
          id: true,
          pluginId: true,
          name: true,
          description: true,
          version: true,
          icon: true,
          category: true,
          installCount: true,
          averageRating: true,
          developer: {
            select: { companyName: true },
          },
        },
      }),
      this.prisma.plugin.count({ where }),
    ]);

    return {
      plugins,
      total,
      hasMore: (options.offset || 0) + plugins.length < total,
    };
  }

  /**
   * Get plugin details
   */
  async getPluginDetails(pluginId: string) {
    const plugin = await this.prisma.plugin.findFirst({
      where: { pluginId, status: 'published' },
      include: {
        developer: {
          select: { companyName: true, website: true },
        },
        versions: {
          orderBy: { publishedAt: 'desc' },
          take: 5,
          select: { version: true, releaseNotes: true, publishedAt: true },
        },
        userReviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!plugin) {
      throw new NotFoundException('Plugin not found');
    }

    return plugin;
  }

  /**
   * Install plugin for user
   */
  async installPlugin(
    userId: string,
    pluginId: string,
    organizationId?: string,
  ): Promise<PluginInstallation> {
    const plugin = await this.prisma.plugin.findFirst({
      where: { pluginId, status: 'published' },
    });

    if (!plugin) {
      throw new NotFoundException('Plugin not found');
    }

    // Check if already installed
    const existing = await this.prisma.pluginInstallation.findFirst({
      where: { pluginId: plugin.id, userId },
    });

    if (existing) {
      throw new BadRequestException('Plugin is already installed');
    }

    // Check permissions for organization install
    if (organizationId) {
      await this.verifyOrganizationAdmin(userId, organizationId);
    }

    const installation = await this.prisma.pluginInstallation.create({
      data: {
        pluginId: plugin.id,
        userId,
        organizationId,
        version: plugin.version,
        isEnabled: true,
        settings: {},
      },
    });

    // Increment install count
    await this.prisma.plugin.update({
      where: { id: plugin.id },
      data: { installCount: { increment: 1 } },
    });

    return {
      id: installation.id,
      pluginId: plugin.pluginId ?? '',
      userId,
      organizationId: organizationId ?? undefined,
      version: plugin.version ?? '',
      isEnabled: true,
      settings: {},
      installedAt: installation.createdAt,
    };
  }

  /**
   * Uninstall plugin
   */
  async uninstallPlugin(userId: string, installationId: string): Promise<void> {
    const installation = await this.prisma.pluginInstallation.findFirst({
      where: { id: installationId, userId },
    });

    if (!installation) {
      throw new NotFoundException('Installation not found');
    }

    await this.prisma.pluginInstallation.delete({
      where: { id: installationId },
    });

    // Decrement install count
    if (installation.pluginId) {
      await this.prisma.plugin.update({
        where: { id: installation.pluginId },
        data: { installCount: { decrement: 1 } },
      });
    }
  }

  /**
   * Toggle plugin enabled state
   */
  async togglePluginEnabled(
    userId: string,
    installationId: string,
    enabled: boolean,
  ): Promise<void> {
    const installation = await this.prisma.pluginInstallation.findFirst({
      where: { id: installationId, userId },
    });

    if (!installation) {
      throw new NotFoundException('Installation not found');
    }

    await this.prisma.pluginInstallation.update({
      where: { id: installationId },
      data: { isEnabled: enabled },
    });
  }

  /**
   * Update plugin settings
   */
  async updatePluginSettings(
    userId: string,
    installationId: string,
    settings: Record<string, unknown>,
  ): Promise<void> {
    const installation = await this.prisma.pluginInstallation.findFirst({
      where: { id: installationId, userId },
      include: { plugin: true },
    });

    if (!installation) {
      throw new NotFoundException('Installation not found');
    }

    // Validate settings against plugin schema
    if (!installation.plugin) {
      throw new NotFoundException('Associated plugin not found');
    }
    const manifest = installation.plugin.manifest as unknown as PluginManifest;
    if (manifest?.settings) {
      this.validateSettings(settings, manifest.settings);
    }

    await this.prisma.pluginInstallation.update({
      where: { id: installationId },
      data: { settings: settings as object },
    });
  }

  /**
   * Get user's installed plugins
   */
  async getUserPlugins(userId: string): Promise<
    Array<{
      installation: PluginInstallation;
      plugin: {
        id: string;
        name: string;
        description: string;
        version: string;
        icon: string;
      };
    }>
  > {
    const installations = await this.prisma.pluginInstallation.findMany({
      where: { userId },
      include: {
        plugin: {
          select: {
            id: true,
            pluginId: true,
            name: true,
            description: true,
            version: true,
            icon: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return installations
      .filter((i) => i.plugin != null)
      .map((i) => {
        const plugin = i.plugin!;
        return {
          installation: {
            id: i.id,
            pluginId: plugin.pluginId ?? '',
            userId: i.userId ?? '',
            organizationId: i.organizationId ?? undefined,
            version: i.version ?? '',
            isEnabled: i.isEnabled,
            settings: (i.settings as Record<string, unknown>) ?? {},
            installedAt: i.createdAt,
          },
          plugin: {
            id: plugin.pluginId ?? '',
            name: plugin.name ?? '',
            description: plugin.description ?? '',
            version: plugin.version ?? '',
            icon: plugin.icon || '',
          },
        };
      });
  }

  // ============================================
  // PLUGIN REVIEWS & RATINGS
  // ============================================

  /**
   * Submit a review for a plugin
   */
  async submitReview(
    userId: string,
    pluginId: string,
    data: {
      rating: number;
      title?: string;
      content: string;
    },
  ): Promise<void> {
    const plugin = await this.prisma.plugin.findFirst({
      where: { pluginId, status: 'published' },
    });

    if (!plugin) {
      throw new NotFoundException('Plugin not found');
    }

    // Check if user has installed the plugin
    const installation = await this.prisma.pluginInstallation.findFirst({
      where: { pluginId: plugin.id, userId },
    });

    if (!installation) {
      throw new BadRequestException('Must install plugin before reviewing');
    }

    // Check for existing review
    const existingReview = await this.prisma.pluginUserReview.findFirst({
      where: { pluginId: plugin.id, userId },
    });

    if (existingReview) {
      // Update existing review
      await this.prisma.pluginUserReview.update({
        where: { id: existingReview.id },
        data: {
          rating: data.rating,
          title: data.title,
          content: data.content,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new review
      await this.prisma.pluginUserReview.create({
        data: {
          pluginId: plugin.id,
          userId,
          rating: data.rating,
          title: data.title,
          content: data.content,
        },
      });
    }

    // Update average rating
    const reviews = await this.prisma.pluginUserReview.findMany({
      where: { pluginId: plugin.id },
      select: { rating: true },
    });

    const averageRating =
      reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length;

    await this.prisma.plugin.update({
      where: { id: plugin.id },
      data: { averageRating, reviewCount: reviews.length },
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private generateApiKey(): string {
    return `pd_dev_${crypto.randomBytes(24).toString('hex')}`;
  }

  private hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private validateManifest(manifest: PluginManifest): void {
    const requiredFields = [
      'id',
      'name',
      'version',
      'description',
      'author',
      'license',
      'main',
      'permissions',
      'hooks',
      'engines',
    ];

    for (const field of requiredFields) {
      if (!(field in manifest)) {
        throw new BadRequestException(`Missing required field: ${field}`);
      }
    }

    // Validate plugin ID format
    if (!/^[a-z0-9-]+$/i.test(manifest.id)) {
      throw new BadRequestException(
        'Plugin ID must be alphanumeric with hyphens only',
      );
    }

    // Validate version format (semver)
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new BadRequestException('Version must follow semver format');
    }

    // Validate permissions
    const validPermissions: PluginPermission[] = [
      'read:projects',
      'write:projects',
      'read:slides',
      'write:slides',
      'read:blocks',
      'write:blocks',
      'read:user',
      'write:user',
      'read:analytics',
      'network:fetch',
      'storage:local',
      'ui:modal',
      'ui:sidebar',
      'ui:toolbar',
    ];

    for (const permission of manifest.permissions) {
      if (!validPermissions.includes(permission)) {
        throw new BadRequestException(`Invalid permission: ${permission}`);
      }
    }
  }

  private validateBundle(bundle: Buffer): Promise<void> {
    // Check size limit (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (bundle.length > maxSize) {
      throw new BadRequestException('Bundle size exceeds 10MB limit');
    }

    // TODO: Additional security validation
    // - Check for malicious code patterns
    // - Verify bundle structure
    // - Check dependencies

    return Promise.resolve();
  }

  private async getPluginForDeveloper(pluginId: string, developerId: string) {
    const plugin = await this.prisma.plugin.findFirst({
      where: { id: pluginId, developerId },
    });

    if (!plugin) {
      throw new NotFoundException('Plugin not found');
    }

    return plugin;
  }

  private validateSettings(
    settings: Record<string, unknown>,
    definitions: PluginSettingDefinition[],
  ): void {
    for (const def of definitions) {
      const value = settings[def.key];

      if (def.required && value === undefined) {
        throw new BadRequestException(`Missing required setting: ${def.key}`);
      }

      if (value !== undefined) {
        switch (def.type) {
          case 'string':
            if (typeof value !== 'string') {
              throw new BadRequestException(`${def.key} must be a string`);
            }
            break;
          case 'number':
            if (typeof value !== 'number') {
              throw new BadRequestException(`${def.key} must be a number`);
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              throw new BadRequestException(`${def.key} must be a boolean`);
            }
            break;
          case 'select':
            if (!def.options?.some((o) => o.value === value)) {
              throw new BadRequestException(`Invalid value for ${def.key}`);
            }
            break;
        }
      }
    }
  }

  private async verifyOrganizationAdmin(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!member) {
      throw new ForbiddenException('Must be organization admin');
    }
  }
}
