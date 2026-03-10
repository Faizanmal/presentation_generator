import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push');

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  renotify?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

export type NotificationType =
  | 'PRESENTATION_SHARED'
  | 'COLLABORATION_REQUEST'
  | 'COMMENT_ADDED'
  | 'MENTION'
  | 'EXPORT_COMPLETE'
  | 'AI_GENERATION_COMPLETE'
  | 'TEAM_INVITE'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'SYSTEM_UPDATE';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('push-notifications') private pushQueue: Queue,
  ) {
    // Initialize web-push with VAPID keys
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject =
      process.env.VAPID_SUBJECT || 'mailto:support@example.com';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    }
  }

  /**
   * Register a push subscription for a user
   */
  async registerSubscription(
    userId: string,
    subscription: PushSubscription,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      platform?: string;
      userAgent?: string;
    },
  ): Promise<{ id: string }> {
    // Store subscription in database
    const record = await this.prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId,
          endpoint: subscription.endpoint,
        },
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        deviceId: deviceInfo?.deviceId,
        deviceName: deviceInfo?.deviceName,
        platform: deviceInfo?.platform,
        userAgent: deviceInfo?.userAgent,
        isActive: true,
      },
      update: {
        keys: subscription.keys,
        deviceId: deviceInfo?.deviceId,
        deviceName: deviceInfo?.deviceName,
        platform: deviceInfo?.platform,
        userAgent: deviceInfo?.userAgent,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Push subscription registered for user ${userId}`);
    return { id: record.id };
  }

  /**
   * Unregister a push subscription
   */
  async unregisterSubscription(
    userId: string,
    endpoint: string,
  ): Promise<void> {
    await this.prisma.pushSubscription.updateMany({
      where: { userId, endpoint },
      data: { isActive: false },
    });
    this.logger.log(`Push subscription unregistered for user ${userId}`);
  }

  /**
   * Get all active subscriptions for a user
   */
  async getUserSubscriptions(userId: string) {
    return this.prisma.pushSubscription.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        deviceName: true,
        platform: true,
        createdAt: true,
      },
    });
  }

  /**
   * Send notification to a specific user
   */
  async sendToUser(
    userId: string,
    notification: PushNotification,
    options: {
      type?: NotificationType;
      priority?: 'high' | 'normal' | 'low';
      ttl?: number;
    } = {},
  ): Promise<{ sent: number; failed: number }> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId, isActive: true },
    });

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // Queue the notifications
    await this.pushQueue.add('send-notification', {
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        endpoint: s.endpoint,
        keys: s.keys,
      })),
      notification,
      type: options.type,
      priority: options.priority || 'normal',
      ttl: options.ttl || 86400, // 24 hours default
    });

    // Also store notification in DB for in-app display
    await this.prisma.notification.create({
      data: {
        userId,
        type: options.type || 'SYSTEM_UPDATE',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        isRead: false,
      },
    });

    return { sent: subscriptions.length, failed: 0 };
  }

  /**
   * Send notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    notification: PushNotification,
    type?: NotificationType,
  ): Promise<{ totalSent: number; totalFailed: number }> {
    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of userIds) {
      const result = await this.sendToUser(userId, notification, { type });
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return { totalSent, totalFailed };
  }

  /**
   * Send notification to all members of an organization
   */
  async sendToOrganization(
    organizationId: string,
    notification: PushNotification,
    options: {
      type?: NotificationType;
      excludeUserIds?: string[];
    } = {},
  ): Promise<{ totalSent: number }> {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });

    const userIds = members
      .map((m) => m.userId)
      .filter((id) => !options.excludeUserIds?.includes(id));

    const result = await this.sendToUsers(userIds, notification, options.type);
    return { totalSent: result.totalSent };
  }

  /**
   * Actually send the push notification (called by worker)
   */
  async sendPushNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    notification: PushNotification,
    options: { ttl?: number } = {},
  ): Promise<boolean> {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        JSON.stringify(notification),
        {
          TTL: options.ttl || 86400,
        },
      );
      return true;
    } catch (error) {
      this.logger.error(`Push notification failed: ${error.message}`);

      // Handle expired subscriptions
      if (error.statusCode === 410 || error.statusCode === 404) {
        await this.prisma.pushSubscription.updateMany({
          where: { endpoint: subscription.endpoint },
          data: { isActive: false },
        });
      }

      return false;
    }
  }

  /**
   * Get notification preferences for a user
   */
  async getPreferences(userId: string) {
    let prefs = await this.prisma.notificationPreferences.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Return defaults
      prefs = await this.prisma.notificationPreferences.create({
        data: {
          userId,
          pushEnabled: true,
          emailEnabled: true,
          collaboration: true,
          comments: true,
          mentions: true,
          exports: true,
          aiGeneration: true,
          teamInvites: true,
          payments: true,
          marketing: false,
          quietHoursStart: null,
          quietHoursEnd: null,
        },
      });
    }

    return prefs;
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: string,
    updates: {
      pushEnabled?: boolean;
      emailEnabled?: boolean;
      collaboration?: boolean;
      comments?: boolean;
      mentions?: boolean;
      exports?: boolean;
      aiGeneration?: boolean;
      teamInvites?: boolean;
      payments?: boolean;
      marketing?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
    },
  ) {
    return this.prisma.notificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        pushEnabled: updates.pushEnabled ?? true,
        emailEnabled: updates.emailEnabled ?? true,
        collaboration: updates.collaboration ?? true,
        comments: updates.comments ?? true,
        mentions: updates.mentions ?? true,
        exports: updates.exports ?? true,
        aiGeneration: updates.aiGeneration ?? true,
        teamInvites: updates.teamInvites ?? true,
        payments: updates.payments ?? true,
        marketing: updates.marketing ?? false,
        quietHoursStart: updates.quietHoursStart,
        quietHoursEnd: updates.quietHoursEnd,
      },
      update: updates,
    });
  }

  /**
   * Check if notification should be sent based on preferences
   */
  async shouldSendNotification(
    userId: string,
    type: NotificationType,
  ): Promise<boolean> {
    const prefs = await this.getPreferences(userId);

    if (!prefs.pushEnabled) return false;

    // Check quiet hours
    if (prefs.quietHoursStart && prefs.quietHoursEnd) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const [startH, startM] = prefs.quietHoursStart.split(':').map(Number);
      const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number);
      const quietStart = startH * 60 + startM;
      const quietEnd = endH * 60 + endM;

      if (quietStart < quietEnd) {
        if (currentTime >= quietStart && currentTime < quietEnd) return false;
      } else {
        // Overnight quiet hours
        if (currentTime >= quietStart || currentTime < quietEnd) return false;
      }
    }

    // Check type-specific preferences
    const typePrefsMap: Record<NotificationType, keyof typeof prefs> = {
      PRESENTATION_SHARED: 'collaboration',
      COLLABORATION_REQUEST: 'collaboration',
      COMMENT_ADDED: 'comments',
      MENTION: 'mentions',
      EXPORT_COMPLETE: 'exports',
      AI_GENERATION_COMPLETE: 'aiGeneration',
      TEAM_INVITE: 'teamInvites',
      PAYMENT_SUCCESS: 'payments',
      PAYMENT_FAILED: 'payments',
      SYSTEM_UPDATE: 'pushEnabled',
    };

    const prefKey = typePrefsMap[type];
    return prefKey ? !!prefs[prefKey] : true;
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 20,
      skip: options.offset || 0,
    });
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(userId: string, notificationIds: string[]) {
    await this.prisma.notification.updateMany({
      where: { id: { in: notificationIds }, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
