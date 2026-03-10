import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface MobileDeviceInfo {
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  version: string;
  screenWidth: number;
  screenHeight: number;
  networkType?: 'wifi' | '4g' | '3g' | '2g' | 'offline';
}

export interface MobilePresentationSummary {
  id: string;
  title: string;
  thumbnailUrl: string;
  updatedAt: Date;
  slideCount: number;
  isOfflineAvailable: boolean;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

export interface MobileSlideData {
  id: string;
  order: number;
  thumbnailUrl: string;
  contentHash: string;
  lastModified: Date;
}

export interface MobileUserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  plan: string;
  storageUsed: number;
  storageLimit: number;
  presentationCount: number;
}

export interface MobileNotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  commentNotifications: boolean;
  viewNotifications: boolean;
  shareNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface MobileAppConfig {
  minSupportedVersion: string;
  latestVersion: string;
  forceUpdate: boolean;
  maintenanceMode: boolean;
  features: Record<string, boolean>;
  endpoints: Record<string, string>;
}

export interface MobilePresentation {
  id: string;
  title: string | null;
  description: string | null;
  themeId: string | null;
  brandKitId: string | null;
  slideCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MobileSlide {
  id: string;
  order: number;
  content: unknown;
  thumbnail: string;
  notes: string | null;
  updatedAt: Date;
}

// helper types used by syncChanges
export interface MobileSlideChange {
  slideId: string;
  content: unknown;
  localTimestamp: Date;
}

export interface MobileNewSlide {
  tempId: string;
  order: number;
  content: unknown;
}

export interface MobileAsset {
  id: string;
  type: string;
  url: string;
  originalUrl: string;
}

export interface MobileNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  data?: unknown;
}

export interface MobileSearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  matchedText?: string;
}

@Injectable()
export class MobileApiService {
  private readonly logger = new Logger(MobileApiService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get mobile app configuration
   */
  getAppConfig(platform: string, version: string): MobileAppConfig {
    const config: MobileAppConfig = {
      minSupportedVersion: '1.0.0',
      latestVersion: '2.0.0',
      forceUpdate: false,
      maintenanceMode: false,
      features: {
        offlineMode: true,
        voiceRecording: true,
        gestureEditing: true,
        biometricAuth: true,
        darkMode: true,
        liveCollaboration: true,
        aiSuggestions: true,
        videoExport: platform !== 'web',
        arPreview: platform === 'ios',
        widgets: true,
      },
      endpoints: {
        api: process.env.API_URL || 'https://api.presentationdesigner.com',
        cdn: process.env.CDN_URL || 'https://cdn.presentationdesigner.com',
        websocket: process.env.WS_URL || 'wss://ws.presentationdesigner.com',
        analytics:
          process.env.ANALYTICS_URL ||
          'https://analytics.presentationdesigner.com',
      },
    };

    // Check version compatibility
    if (this.compareVersions(version, config.minSupportedVersion) < 0) {
      config.forceUpdate = true;
    }

    return config;
  }

  /**
   * Get lightweight user profile for mobile
   */
  async getMobileUserProfile(userId: string): Promise<MobileUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { projects: true },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate storage used
    const storageUsed = await this.calculateStorageUsed(userId);
    const storageLimit = this.getStorageLimit(user.subscriptionTier || 'free');

    return {
      id: user.id,
      name: user.name || '',
      email: user.email,
      avatarUrl: user.image || '',
      plan: user.subscriptionTier || 'free',
      storageUsed,
      storageLimit,
      presentationCount: user._count.projects,
    };
  }

  /**
   * Get presentations list optimized for mobile
   */
  async getMobilePresentations(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'recent' | 'name' | 'created';
      filter?: 'all' | 'owned' | 'shared' | 'favorites';
    } = {},
  ): Promise<{
    presentations: MobilePresentationSummary[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      limit = 20,
      offset = 0,
      sortBy = 'recent',
      filter = 'all',
    } = options;

    const where: Record<string, unknown> = {};

    switch (filter) {
      case 'owned':
        where.userId = userId;
        break;
      case 'shared':
        where.sharedWith = { some: { userId } };
        break;
      case 'favorites':
        where.favorites = { some: { userId } };
        break;
      default:
        where.OR = [{ userId }, { sharedWith: { some: { userId } } }];
    }

    const orderBy: Record<string, unknown> = {};
    switch (sortBy) {
      case 'name':
        orderBy.title = 'asc';
        break;
      case 'created':
        orderBy.createdAt = 'desc';
        break;
      default:
        orderBy.updatedAt = 'desc';
    }

    const [presentations, total] = await Promise.all([
      this.prisma.presentation.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          thumbnail: true,
          updatedAt: true,
          _count: {
            select: { slides: true },
          },
        },
      }),
      this.prisma.presentation.count({ where }),
    ]);

    // Get offline availability status
    const offlineStatus = await this.getOfflineStatus(
      userId,
      presentations.map((p) => p.id),
    );

    const mobilePresentations: MobilePresentationSummary[] = presentations.map(
      (p) => ({
        id: p.id,
        title: p.title ?? 'Untitled',
        thumbnailUrl: p.thumbnail || '',
        updatedAt: p.updatedAt,
        slideCount: p._count.slides,
        isOfflineAvailable: offlineStatus[p.id]?.available || false,
        syncStatus:
          (offlineStatus[p.id]
            ?.status as MobilePresentationSummary['syncStatus']) || 'synced',
      }),
    );

    return {
      presentations: mobilePresentations,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get single presentation optimized for mobile viewing
   */
  async getMobilePresentation(
    presentationId: string,
    userId: string,
    options: {
      includeSlideContent?: boolean;
      quality?: 'low' | 'medium' | 'high';
    } = {},
  ): Promise<{
    presentation: MobilePresentation;
    slides: MobileSlideData[];
    permissions: string[];
  }> {
    const { includeSlideContent = false } = options;

    const presentation = await this.prisma.presentation.findUnique({
      where: { id: presentationId },
      include: {
        slides: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            content: includeSlideContent,
            updatedAt: true,
          },
        },
      },
    });

    if (!presentation) {
      throw new Error('Presentation not found');
    }

    // Check permissions
    const permissions = await this.getPermissions(presentationId, userId);

    // Optimize slide data for mobile
    const slides: MobileSlideData[] = presentation.slides.map((slide) => ({
      id: slide.id,
      order: slide.position,
      thumbnailUrl: '',
      contentHash: this.generateContentHash(slide.content),
      lastModified: slide.updatedAt,
    }));

    return {
      presentation: {
        id: presentation.id,
        title: presentation.title,
        description: null,
        themeId: null,
        brandKitId: null,
        slideCount: slides.length,
        createdAt: presentation.createdAt,
        updatedAt: presentation.updatedAt,
      },
      slides,
      permissions,
    };
  }

  /**
   * Get slide content optimized for mobile
   */
  async getMobileSlide(
    slideId: string,
    _userId: string,
    options: {
      quality?: 'low' | 'medium' | 'high';
      includeAssets?: boolean;
    } = {},
  ): Promise<{
    slide: MobileSlide;
    assets: MobileAsset[];
  }> {
    const { quality = 'medium', includeAssets = true } = options;

    const slide = await this.prisma.slide.findUnique({
      where: { id: slideId },
      include: {
        project: {
          select: { ownerId: true },
        },
      },
    });

    if (!slide) {
      throw new Error('Slide not found');
    }

    // Optimize content for mobile
    const optimizedContent = this.optimizeContentForMobile(
      slide.content as unknown,
      quality,
    );

    // Extract and optimize assets
    const assets = includeAssets
      ? this.getOptimizedAssets(slide.content as unknown, quality)
      : [];

    return {
      slide: {
        id: slide.id,
        order: slide.order,
        content: optimizedContent,
        thumbnail: this.getThumbnailUrl(slide.thumbnailUrl, quality),
        notes: slide.speakerNotes,
        updatedAt: slide.updatedAt,
      },
      assets,
    };
  }

  /**
   * Batch fetch slides for offline caching
   */
  async batchFetchSlides(
    presentationId: string,
    _userId: string,
    options: {
      slideIds?: string[];
      quality?: 'low' | 'medium' | 'high';
    } = {},
  ): Promise<{
    slides: MobileSlide[];
    totalSize: number;
    downloadUrl?: string;
  }> {
    const { slideIds, quality = 'medium' } = options;

    const where: Record<string, unknown> = { presentationId };
    if (slideIds?.length) {
      where.id = { in: slideIds };
    }

    const slides = await this.prisma.slide.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    // Optimize for offline use
    const optimizedSlides = slides.map((slide) => ({
      id: slide.id,
      order: slide.order,
      content: this.optimizeContentForMobile(slide.content as unknown, quality),
      thumbnail: this.getThumbnailUrl(slide.thumbnailUrl, quality),
      notes: slide.speakerNotes,
      updatedAt: slide.updatedAt,
      assets: this.getOptimizedAssets(slide.content as unknown, quality),
    }));

    // Calculate total size for download estimation
    const totalSize = this.calculateDataSize(optimizedSlides);

    return {
      slides: optimizedSlides,
      totalSize,
    };
  }

  /**
   * Record mobile device for push notifications
   */
  async registerDevice(
    userId: string,
    deviceInfo: MobileDeviceInfo,
    pushToken?: string,
  ): Promise<{ deviceId: string; registered: boolean }> {
    const device = await this.prisma.mobileDevice.upsert({
      where: {
        userId_deviceId: {
          userId,
          deviceId: deviceInfo.deviceId,
        },
      },
      create: {
        userId,
        deviceId: deviceInfo.deviceId,
        platform: deviceInfo.platform,
        appVersion: deviceInfo.version,
        pushToken,
        screenWidth: deviceInfo.screenWidth,
        screenHeight: deviceInfo.screenHeight,
        lastActive: new Date(),
      },
      update: {
        appVersion: deviceInfo.version,
        pushToken,
        screenWidth: deviceInfo.screenWidth,
        screenHeight: deviceInfo.screenHeight,
        lastActive: new Date(),
      },
    });

    return {
      deviceId: device.deviceId,
      registered: !!pushToken,
    };
  }

  /**
   * Update notification settings for mobile
   */
  async updateNotificationSettings(
    userId: string,
    settings: Partial<MobileNotificationSettings>,
  ): Promise<MobileNotificationSettings> {
    const updated = await this.prisma.notificationSettings.upsert({
      where: { userId },
      create: {
        userId,
        pushEnabled: settings.pushEnabled ?? true,
        emailEnabled: settings.emailEnabled ?? true,
        commentNotifications: settings.commentNotifications ?? true,
        viewNotifications: settings.viewNotifications ?? false,
        shareNotifications: settings.shareNotifications ?? true,
        quietHoursEnabled: settings.quietHoursEnabled ?? false,
        quietHoursStart: settings.quietHoursStart,
        quietHoursEnd: settings.quietHoursEnd,
      },
      update: settings,
    });

    return {
      pushEnabled: updated.pushEnabled,
      emailEnabled: updated.emailEnabled,
      commentNotifications: updated.commentNotifications,
      viewNotifications: updated.viewNotifications,
      shareNotifications: updated.shareNotifications,
      quietHoursEnabled: updated.quietHoursEnabled,
      quietHoursStart: updated.quietHoursStart ?? undefined,
      quietHoursEnd: updated.quietHoursEnd ?? undefined,
    };
  }

  /**
   * Get mobile dashboard data in single request
   */
  async getMobileDashboard(userId: string): Promise<{
    profile: MobileUserProfile;
    recentPresentations: MobilePresentationSummary[];
    notifications: MobileNotification[];
    quickStats: {
      totalViews: number;
      totalPresentations: number;
      activeShares: number;
      pendingComments: number;
    };
  }> {
    const [profile, presentations, notifications, stats] = await Promise.all([
      this.getMobileUserProfile(userId),
      this.getMobilePresentations(userId, { limit: 5 }),
      this.getRecentNotifications(userId, 10),
      this.getQuickStats(userId),
    ]);

    return {
      profile,
      recentPresentations: presentations.presentations,
      notifications,
      quickStats: stats,
    };
  }

  /**
   * Sync local changes from mobile
   */
  async syncChanges(
    userId: string,
    changes: {
      presentationId: string;
      slideChanges: MobileSlideChange[];
      deletedSlides?: string[];
      newSlides?: MobileNewSlide[];
    },
  ): Promise<{
    success: boolean;
    conflicts: Array<{
      slideId: string;
      localTimestamp: Date;
      serverTimestamp: Date;
      resolution: 'server' | 'client' | 'merge';
    }>;
    syncedSlides: string[];
    newSlideMapping: Record<string, string>;
  }> {
    const {
      presentationId,
      slideChanges,
      deletedSlides = [],
      newSlides = [],
    } = changes;

    const conflicts: Array<{
      slideId: string;
      localTimestamp: Date;
      serverTimestamp: Date;
      resolution: 'server' | 'client' | 'merge';
    }> = [];
    const syncedSlides: string[] = [];
    const newSlideMapping: Record<string, string> = {};

    // Process slide changes
    for (const change of slideChanges) {
      const serverSlide = await this.prisma.slide.findUnique({
        where: { id: change.slideId },
      });

      if (!serverSlide) {
        continue;
      }

      // Check for conflicts
      if (serverSlide.updatedAt > change.localTimestamp) {
        conflicts.push({
          slideId: change.slideId,
          localTimestamp: change.localTimestamp,
          serverTimestamp: serverSlide.updatedAt,
          resolution: 'server', // Default to server version
        });
      } else {
        // Apply change
        await this.prisma.slide.update({
          where: { id: change.slideId },
          data: { content: change.content as Prisma.InputJsonValue },
        });
        syncedSlides.push(change.slideId);
      }
    }

    // Process deletions
    if (deletedSlides.length) {
      await this.prisma.slide.deleteMany({
        where: {
          id: { in: deletedSlides },
          project: { ownerId: userId },
        },
      });
    }

    // Get projectId from existing slides for this presentation
    let projectId: string | undefined;
    if (newSlides.length > 0) {
      const existingSlide = await this.prisma.slide.findFirst({
        where: { presentationId },
        select: { projectId: true },
      });
      projectId = existingSlide?.projectId;
    }

    // Process new slides
    for (const newSlide of newSlides) {
      const created = await this.prisma.slide.create({
        data: {
          project: { connect: { id: projectId || presentationId } },
          presentationId,
          order: newSlide.order,
          content: newSlide.content as Prisma.InputJsonValue,
        },
      });
      newSlideMapping[newSlide.tempId] = created.id;
    }

    return {
      success: conflicts.length === 0,
      conflicts,
      syncedSlides,
      newSlideMapping,
    };
  }

  /**
   * Mobile-optimized search
   */
  async mobileSearch(
    userId: string,
    query: string,
    options: {
      type?: 'all' | 'presentations' | 'slides' | 'templates';
      limit?: number;
    } = {},
  ): Promise<{
    results: MobileSearchResult[];
  }> {
    const { type = 'all', limit = 20 } = options;
    const results: MobileSearchResult[] = [];

    // Search presentations
    if (type === 'all' || type === 'presentations') {
      const presentations = await this.prisma.presentation.findMany({
        where: {
          userId,
          title: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        select: {
          id: true,
          title: true,
          thumbnail: true,
          updatedAt: true,
        },
      });

      results.push(
        ...presentations.map((p) => ({
          type: 'presentation',
          id: p.id,
          title: p.title || 'Untitled Presentation',
          subtitle: `Updated ${this.formatRelativeTime(p.updatedAt)}`,
          thumbnailUrl: p.thumbnail || undefined,
        })),
      );
    }

    // Search templates
    if (type === 'all' || type === 'templates') {
      const templates = await this.prisma.template.findMany({
        where: {
          OR: [{ isPublic: true }, { userId }],
          name: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        select: {
          id: true,
          name: true,
          thumbnail: true,
          category: true,
        },
      });

      results.push(
        ...templates.map((t) => ({
          type: 'template',
          id: t.id,
          title: t.name || 'Untitled Template',
          subtitle: t.category || undefined,
          thumbnailUrl: t.thumbnail || undefined,
        })),
      );
    }

    return { results: results.slice(0, limit) };
  }

  /**
   * Handle mobile analytics events
   */
  async trackMobileEvent(
    userId: string,
    event: {
      eventType: string;
      eventData?: Record<string, unknown>;
      deviceInfo?: MobileDeviceInfo;
      timestamp?: Date;
    },
  ): Promise<void> {
    await this.prisma.analyticsEvent.create({
      data: {
        userId,
        eventType: event.eventType,
        eventData: (event.eventData || {}) as Prisma.InputJsonValue,
        deviceType: event.deviceInfo?.platform || 'unknown',
        appVersion: event.deviceInfo?.version,
        timestamp: event.timestamp || new Date(),
      },
    });
  }

  // Helper methods

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  private async calculateStorageUsed(userId: string): Promise<number> {
    // Calculate total storage from uploads
    const result = await this.prisma.upload.aggregate({
      where: { userId },
      _sum: { size: true },
    });
    return result._sum.size || 0;
  }

  private getStorageLimit(plan: string): number {
    const limits: Record<string, number> = {
      free: 500 * 1024 * 1024, // 500 MB
      starter: 5 * 1024 * 1024 * 1024, // 5 GB
      pro: 50 * 1024 * 1024 * 1024, // 50 GB
      business: 500 * 1024 * 1024 * 1024, // 500 GB
      enterprise: -1, // Unlimited
    };
    return limits[plan] || limits.free;
  }

  private async getOfflineStatus(
    userId: string,
    presentationIds: string[],
  ): Promise<Record<string, { available: boolean; status: string }>> {
    // Check offline sync status from mobile sync records
    const syncRecords = await this.prisma.offlineSync.findMany({
      where: {
        userId,
        presentationId: { in: presentationIds },
      },
    });

    const statusMap: Record<string, { available: boolean; status: string }> =
      {};
    for (const record of syncRecords) {
      if (record.presentationId) {
        statusMap[record.presentationId] = {
          available: record.isAvailable,
          status: record.syncStatus || 'synced',
        };
      }
    }

    return statusMap;
  }

  private async getPermissions(
    presentationId: string,
    userId: string,
  ): Promise<string[]> {
    const presentation = await this.prisma.presentation.findUnique({
      where: { id: presentationId },
    });

    if (!presentation) return [];

    if (presentation.userId === userId) {
      return ['view', 'edit', 'share', 'delete', 'export'];
    }

    return ['view'];
  }

  private getThumbnailUrl(thumbnail: string | null, quality: string): string {
    if (!thumbnail) return '';

    const qualitySuffix: Record<string, string> = {
      low: '_low',
      medium: '_med',
      high: '',
    };

    // Add quality suffix before extension
    const ext = thumbnail.split('.').pop();
    const base = thumbnail.replace(`.${ext}`, '');
    return `${base}${qualitySuffix[quality]}.${ext}`;
  }

  private generateContentHash(content: unknown): string {
    const str = JSON.stringify(content);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private optimizeContentForMobile(content: unknown, quality: string): unknown {
    if (!content) return content;

    // Reduce image quality for mobile
    // This is a simplified version - real implementation would process actual images
    return {
      ...content,
      _mobileOptimized: true,
      _quality: quality,
    };
  }

  private getOptimizedAssets(content: unknown, quality: string): MobileAsset[] {
    // Extract and return optimized assets from content
    const assets: MobileAsset[] = [];

    if (!content || typeof content !== 'object' || !('elements' in content))
      return assets;

    const elements = (content as { elements?: unknown }).elements;
    if (!Array.isArray(elements)) return assets;

    for (const element of elements as Array<
      Partial<{ type: string; src: string; id: string }>
    >) {
      if (element.type === 'image' && element.src) {
        assets.push({
          id: element.id || '',
          type: 'image',
          url: this.getThumbnailUrl(element.src, quality),
          originalUrl: element.src,
        });
      }
    }

    return assets;
  }

  private calculateDataSize(data: unknown): number {
    return JSON.stringify(data).length;
  }

  private async getRecentNotifications(
    userId: string,
    limit: number,
  ): Promise<MobileNotification[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return notifications.map((n) => ({
      id: n.id,
      type: n.type || 'info',
      title: n.title || 'Notification',
      message: n.body || '',
      read: n.read,
      createdAt: n.createdAt,
      data: n.data,
    }));
  }

  private async getQuickStats(userId: string): Promise<{
    totalViews: number;
    totalPresentations: number;
    activeShares: number;
    pendingComments: number;
  }> {
    const [totalPresentations, activeShares, pendingComments] =
      await Promise.all([
        this.prisma.presentation.count({ where: { userId } }),
        this.prisma.presentationShare.count({
          where: {
            presentationId: { not: null },
          },
        }),
        this.prisma.comment.count({
          where: {
            userId: { not: userId },
            resolved: false,
          },
        }),
      ]);

    // Aggregate views
    const viewsResult = await this.prisma.presentationView.aggregate({
      where: {
        project: { ownerId: userId },
      },
      _count: true,
    });

    return {
      totalViews: viewsResult._count ?? 0,
      totalPresentations,
      activeShares,
      pendingComments,
    };
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }
}
