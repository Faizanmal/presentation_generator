import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationService } from './push-notification.service';
import { OfflineSyncService } from './offline-sync.service';

export interface DeviceInfo {
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  appVersion: string;
  osVersion?: string;
  deviceModel?: string;
  screenWidth?: number;
  screenHeight?: number;
  isOfflineCapable: boolean;
  pushEnabled: boolean;
}

export interface AppManifest {
  name: string;
  shortName: string;
  description: string;
  startUrl: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  backgroundColor: string;
  themeColor: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }>;
  shortcuts?: Array<{
    name: string;
    shortName: string;
    description: string;
    url: string;
    icons?: Array<{ src: string; sizes: string }>;
  }>;
  screenshots?: Array<{
    src: string;
    sizes: string;
    type: string;
  }>;
  relatedApplications?: Array<{
    platform: string;
    url: string;
    id?: string;
  }>;
  preferRelatedApplications?: boolean;
}

@Injectable()
export class MobilePwaService {
  private readonly logger = new Logger(MobilePwaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushNotificationService,
    private readonly offlineService: OfflineSyncService,
  ) {}

  /**
   * Register a device for the user
   */
  async registerDevice(
    userId: string,
    deviceInfo: DeviceInfo,
  ): Promise<{ deviceId: string }> {
    const device = await this.prisma.userDevice.upsert({
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
        appVersion: deviceInfo.appVersion,
        osVersion: deviceInfo.osVersion,
        deviceModel: deviceInfo.deviceModel,
        screenWidth: deviceInfo.screenWidth,
        screenHeight: deviceInfo.screenHeight,
        isOfflineCapable: deviceInfo.isOfflineCapable,
        pushEnabled: deviceInfo.pushEnabled,
        lastActive: new Date(),
      },
      update: {
        platform: deviceInfo.platform,
        appVersion: deviceInfo.appVersion,
        osVersion: deviceInfo.osVersion,
        deviceModel: deviceInfo.deviceModel,
        screenWidth: deviceInfo.screenWidth,
        screenHeight: deviceInfo.screenHeight,
        isOfflineCapable: deviceInfo.isOfflineCapable,
        pushEnabled: deviceInfo.pushEnabled,
        lastActive: new Date(),
      },
    });

    this.logger.log(`Device registered: ${device.deviceId} for user ${userId}`);
    return { deviceId: device.deviceId };
  }

  /**
   * Update device activity
   */
  async updateDeviceActivity(userId: string, deviceId: string): Promise<void> {
    await this.prisma.userDevice.update({
      where: { userId_deviceId: { userId, deviceId } },
      data: { lastActive: new Date() },
    });
  }

  /**
   * Get user's devices
   */
  async getUserDevices(userId: string) {
    return this.prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastActive: 'desc' },
    });
  }

  /**
   * Remove a device
   */
  async removeDevice(userId: string, deviceId: string): Promise<void> {
    await this.prisma.userDevice.delete({
      where: { userId_deviceId: { userId, deviceId } },
    });

    // Also remove push subscriptions for this device
    await this.prisma.pushSubscription.updateMany({
      where: { userId, deviceId },
      data: { isActive: false },
    });
  }

  /**
   * Generate PWA manifest for user/organization
   */
  async getManifest(options?: {
    organizationId?: string;
    themeColor?: string;
    backgroundColor?: string;
  }): Promise<AppManifest> {
    let brandKit: {
      backgroundColor?: string | null;
      primaryColor?: string | null;
    } | null = null;

    if (options?.organizationId) {
      brandKit = await this.prisma.brandKit.findFirst({
        where: { organizationId: options.organizationId },
      });
    }

    const manifest: AppManifest = {
      name: 'Presentation Designer',
      shortName: 'Presenter',
      description: 'AI-powered presentation design platform',
      startUrl: '/',
      display: 'standalone',
      backgroundColor:
        options?.backgroundColor || brandKit?.backgroundColor || '#ffffff',
      themeColor: options?.themeColor || brandKit?.primaryColor || '#3B82F6',
      icons: [
        { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
        { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
        { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
        { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
        { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
      shortcuts: [
        {
          name: 'New Presentation',
          shortName: 'New',
          description: 'Create a new presentation',
          url: '/presentations/new',
          icons: [{ src: '/icons/shortcut-new.png', sizes: '96x96' }],
        },
        {
          name: 'AI Generate',
          shortName: 'AI',
          description: 'Generate presentation with AI',
          url: '/ai/generate',
          icons: [{ src: '/icons/shortcut-ai.png', sizes: '96x96' }],
        },
        {
          name: 'Recent',
          shortName: 'Recent',
          description: 'View recent presentations',
          url: '/presentations?filter=recent',
          icons: [{ src: '/icons/shortcut-recent.png', sizes: '96x96' }],
        },
      ],
      screenshots: [
        {
          src: '/screenshots/desktop-1.png',
          sizes: '1280x720',
          type: 'image/png',
        },
        {
          src: '/screenshots/mobile-1.png',
          sizes: '750x1334',
          type: 'image/png',
        },
      ],
    };

    return manifest;
  }

  /**
   * Get service worker configuration
   */
  getServiceWorkerConfig() {
    return {
      version: '2.0.0',
      cacheStrategies: {
        // Network first for API calls
        api: {
          pattern: '/api/**',
          strategy: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            networkTimeoutSeconds: 10,
            expiration: { maxAgeSeconds: 300 },
          },
        },
        // Cache first for static assets
        assets: {
          pattern: '/static/**',
          strategy: 'CacheFirst',
          options: {
            cacheName: 'static-cache',
            expiration: { maxAgeSeconds: 86400 * 30 },
          },
        },
        // Stale while revalidate for fonts
        fonts: {
          pattern: '/fonts/**',
          strategy: 'StaleWhileRevalidate',
          options: {
            cacheName: 'font-cache',
            expiration: { maxAgeSeconds: 86400 * 365 },
          },
        },
        // Cache first for images
        images: {
          pattern: '*.{png,jpg,jpeg,gif,svg,webp}',
          strategy: 'CacheFirst',
          options: {
            cacheName: 'image-cache',
            expiration: { maxAgeSeconds: 86400 * 7 },
          },
        },
      },
      offlinePages: ['/', '/offline', '/presentations', '/editor/offline'],
      backgroundSync: {
        enabled: true,
        queueName: 'sync-queue',
        maxRetention: 86400 * 7, // 7 days
      },
      periodicSync: {
        minInterval: 3600, // 1 hour minimum
        tags: ['content-sync', 'notifications-sync'],
      },
    };
  }

  /**
   * Get app update info
   */
  async getAppUpdateInfo(currentVersion: string): Promise<{
    updateAvailable: boolean;
    latestVersion: string;
    releaseNotes?: string;
    forceUpdate: boolean;
  }> {
    const latestVersion = '2.0.0'; // Would come from config/database
    const minSupportedVersion = '1.5.0';

    const currentParts = currentVersion.split('.').map(Number);
    const latestParts = latestVersion.split('.').map(Number);
    const minParts = minSupportedVersion.split('.').map(Number);

    const isOlderThanLatest =
      this.compareVersions(currentParts, latestParts) < 0;
    const isOlderThanMin = this.compareVersions(currentParts, minParts) < 0;

    return {
      updateAvailable: isOlderThanLatest,
      latestVersion,
      releaseNotes: isOlderThanLatest
        ? 'New features and bug fixes'
        : undefined,
      forceUpdate: isOlderThanMin,
    };
  }

  private compareVersions(a: number[], b: number[]): number {
    for (let i = 0; i < 3; i++) {
      if (a[i] > b[i]) return 1;
      if (a[i] < b[i]) return -1;
    }
    return 0;
  }

  /**
   * Get mobile-optimized presentation data
   */
  async getMobilePresentation(
    userId: string,
    presentationId: string,
    options: {
      quality?: 'low' | 'medium' | 'high';
      includeAssets?: boolean;
    } = {},
  ) {
    const presentation = await this.prisma.presentation.findUnique({
      where: { id: presentationId },
      include: {
        slides: {
          include: {
            blocks: true,
            speakerNotes: true,
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!presentation) {
      return null;
    }

    // Optimize for mobile
    const quality = options.quality || 'medium';
    const optimizedSlides = presentation.slides.map((slide) => ({
      ...slide,
      blocks: slide.blocks.map((block) =>
        this.optimizeBlockForMobile(block, quality),
      ),
    }));

    return {
      ...presentation,
      slides: optimizedSlides,
      mobileOptimized: true,
      quality,
    };
  }

  private optimizeBlockForMobile(
    block: any,
    quality: 'low' | 'medium' | 'high',
  ) {
    const optimized = { ...block };

    // Optimize image URLs based on quality
    if (block.type === 'IMAGE' && block.content?.url) {
      const sizeMap = { low: 480, medium: 720, high: 1080 };
      optimized.content = {
        ...block.content,
        mobileUrl: `${block.content.url}?w=${sizeMap[quality]}`,
      };
    }

    // Optimize video blocks
    if (block.type === 'VIDEO' && block.content?.url) {
      const qualityMap = { low: '360p', medium: '720p', high: '1080p' };
      optimized.content = {
        ...block.content,
        mobileQuality: qualityMap[quality],
      };
    }

    return optimized;
  }

  /**
   * Get mobile analytics
   */
  async getMobileAnalytics(
    userId: string,
    period: 'day' | 'week' | 'month' = 'week',
  ) {
    const daysMap = { day: 1, week: 7, month: 30 };
    const startDate = new Date(
      Date.now() - daysMap[period] * 24 * 60 * 60 * 1000,
    );

    // Get device usage
    const devices = await this.prisma.userDevice.findMany({
      where: { userId },
    });

    const platformCounts = devices.reduce(
      (acc, d) => {
        const platform = d.platform ?? 'unknown';
        acc[platform] = (acc[platform] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Get sync stats
    const syncSessions = await this.prisma.syncSession.findMany({
      where: {
        userId,
        completedAt: { gte: startDate },
      },
    });

    const syncStats = {
      totalSyncs: syncSessions.length,
      totalOperations: syncSessions.reduce(
        (acc, s) => acc + s.operationCount,
        0,
      ),
      conflicts: syncSessions.reduce((acc, s) => acc + s.conflictCount, 0),
    };

    return {
      devices: devices.length,
      platformDistribution: platformCounts,
      syncStats,
      offlineUsage: await this.getOfflineUsageStats(userId, startDate),
    };
  }

  private async getOfflineUsageStats(userId: string, since: Date) {
    const offlineCreated = await this.prisma.presentation.count({
      where: {
        userId,
        isOfflineCreated: true,
        createdAt: { gte: since },
      },
    });

    return {
      presentationsCreatedOffline: offlineCreated,
    };
  }

  /**
   * Get quick action data for mobile
   */
  async getQuickActions(userId: string) {
    // Recent presentations
    const recentPresentations = await this.prisma.presentation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        updatedAt: true,
      },
    });

    // Templates
    const templates = await this.prisma.template.findMany({
      where: { OR: [{ userId }, { isPublic: true }] },
      orderBy: { usageCount: 'desc' },
      take: 6,
      select: {
        id: true,
        name: true,
        thumbnailUrl: true,
      },
    });

    return {
      recentPresentations,
      quickTemplates: templates,
      actions: [
        {
          id: 'new-blank',
          label: 'Blank Presentation',
          icon: 'plus',
          url: '/presentations/new',
        },
        {
          id: 'ai-generate',
          label: 'AI Generate',
          icon: 'sparkles',
          url: '/ai/generate',
        },
        { id: 'import', label: 'Import', icon: 'upload', url: '/import' },
        { id: 'scan', label: 'Scan Document', icon: 'camera', url: '/scan' },
      ],
    };
  }
}
