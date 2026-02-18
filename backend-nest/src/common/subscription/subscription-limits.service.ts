import {
  Injectable,
  Logger,
  ForbiddenException,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

export type SubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface SubscriptionLimits {
  maxProjects: number;
  maxSlidesPerProject: number;
  maxBlocksPerSlide: number;
  maxCollaboratorsPerProject: number;
  maxStorageMB: number;
  aiGenerationsPerMonth: number;
  imageGenerationsPerMonth: number;
  exportsPerMonth: number;
  maxFileSizeMB: number;
  features: {
    customBranding: boolean;
    analytics: boolean;
    advancedExport: boolean;
    videoExport: boolean;
    prioritySupport: boolean;
    sso: boolean;
    auditLogs: boolean;
    whiteLabeling: boolean;
    apiAccess: boolean;
  };
}

export const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, SubscriptionLimits> =
  {
    FREE: {
      maxProjects: 5,
      maxSlidesPerProject: 15,
      maxBlocksPerSlide: 20,
      maxCollaboratorsPerProject: 2,
      maxStorageMB: 100,
      aiGenerationsPerMonth: 10,
      imageGenerationsPerMonth: 5,
      exportsPerMonth: 10,
      maxFileSizeMB: 5,
      features: {
        customBranding: false,
        analytics: false,
        advancedExport: false,
        videoExport: false,
        prioritySupport: false,
        sso: false,
        auditLogs: false,
        whiteLabeling: false,
        apiAccess: false,
      },
    },
    PRO: {
      maxProjects: 50,
      maxSlidesPerProject: 100,
      maxBlocksPerSlide: 50,
      maxCollaboratorsPerProject: 10,
      maxStorageMB: 5000,
      aiGenerationsPerMonth: 200,
      imageGenerationsPerMonth: 100,
      exportsPerMonth: 100,
      maxFileSizeMB: 50,
      features: {
        customBranding: true,
        analytics: true,
        advancedExport: true,
        videoExport: true,
        prioritySupport: true,
        sso: false,
        auditLogs: false,
        whiteLabeling: false,
        apiAccess: true,
      },
    },
    ENTERPRISE: {
      maxProjects: -1, // unlimited
      maxSlidesPerProject: -1,
      maxBlocksPerSlide: -1,
      maxCollaboratorsPerProject: -1,
      maxStorageMB: -1,
      aiGenerationsPerMonth: -1,
      imageGenerationsPerMonth: -1,
      exportsPerMonth: -1,
      maxFileSizeMB: 200,
      features: {
        customBranding: true,
        analytics: true,
        advancedExport: true,
        videoExport: true,
        prioritySupport: true,
        sso: true,
        auditLogs: true,
        whiteLabeling: true,
        apiAccess: true,
      },
    },
  };

export const QUOTA_KEY = 'subscription_quota';

/**
 * Decorator to specify which quota to check
 */
export const RequireQuota = (quotaType: keyof UsageQuotas) => {
  return (
    target: object,
    key?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (descriptor) {
      Reflect.defineMetadata(QUOTA_KEY, quotaType, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(QUOTA_KEY, quotaType, target);
    return target;
  };
};

export interface UsageQuotas {
  projectCount: number;
  aiGenerations: number;
  imageGenerations: number;
  exports: number;
  storageUsedMB: number;
}

@Injectable()
export class SubscriptionLimitsService {
  private readonly logger = new Logger(SubscriptionLimitsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get subscription limits for a user
   */
  getLimits(tier: SubscriptionTier): SubscriptionLimits {
    return SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.FREE;
  }

  /**
   * Check if a limit is unlimited (-1)
   */
  isUnlimited(limit: number): boolean {
    return limit === -1;
  }

  /**
   * Get user's subscription tier
   */
  async getUserTier(userId: string): Promise<SubscriptionTier> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      return 'FREE';
    }

    return (subscription.plan as SubscriptionTier) || 'FREE';
  }

  /**
   * Get current usage quotas for a user
   */
  async getCurrentUsage(userId: string): Promise<UsageQuotas> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Count projects
    const projectCount = await this.prisma.project.count({
      where: { ownerId: userId, deletedAt: null },
    });

    // Count AI generations this month
    const aiGenerations = await this.prisma.activityLog.count({
      where: {
        userId,
        action: { in: ['AI_GENERATION', 'THINKING_GENERATION'] },
        createdAt: { gte: startOfMonth },
      },
    });

    // Count image generations this month
    const imageGenerations = await this.prisma.activityLog.count({
      where: {
        userId,
        action: 'IMAGE_GENERATION',
        createdAt: { gte: startOfMonth },
      },
    });

    // Count exports this month
    const exports = await this.prisma.activityLog.count({
      where: {
        userId,
        action: 'EXPORT',
        createdAt: { gte: startOfMonth },
      },
    });

    // Calculate storage usage
    const uploads = await this.prisma.upload.aggregate({
      where: { userId },
      _sum: { size: true },
    });
    const storageUsedMB = Math.ceil((uploads._sum.size || 0) / (1024 * 1024));

    return {
      projectCount,
      aiGenerations,
      imageGenerations,
      exports,
      storageUsedMB,
    };
  }

  /**
   * Check if user can perform an action based on their subscription
   */
  async canPerformAction(
    userId: string,
    action: keyof UsageQuotas,
  ): Promise<{
    allowed: boolean;
    reason?: string;
    current: number;
    limit: number;
  }> {
    const tier = await this.getUserTier(userId);
    const limits = this.getLimits(tier);
    const usage = await this.getCurrentUsage(userId);

    let current: number;
    let limit: number;

    switch (action) {
      case 'projectCount':
        current = usage.projectCount;
        limit = limits.maxProjects;
        break;
      case 'aiGenerations':
        current = usage.aiGenerations;
        limit = limits.aiGenerationsPerMonth;
        break;
      case 'imageGenerations':
        current = usage.imageGenerations;
        limit = limits.imageGenerationsPerMonth;
        break;
      case 'exports':
        current = usage.exports;
        limit = limits.exportsPerMonth;
        break;
      case 'storageUsedMB':
        current = usage.storageUsedMB;
        limit = limits.maxStorageMB;
        break;
      default:
        return { allowed: true, current: 0, limit: -1 };
    }

    if (this.isUnlimited(limit)) {
      return { allowed: true, current, limit };
    }

    if (current >= limit) {
      return {
        allowed: false,
        reason: `You have reached your ${action} limit (${current}/${limit}). Upgrade to continue.`,
        current,
        limit,
      };
    }

    return { allowed: true, current, limit };
  }

  /**
   * Check if user can add more slides to a project
   */
  async canAddSlide(userId: string, projectId: string): Promise<boolean> {
    const tier = await this.getUserTier(userId);
    const limits = this.getLimits(tier);

    if (this.isUnlimited(limits.maxSlidesPerProject)) {
      return true;
    }

    const slideCount = await this.prisma.slide.count({
      where: { projectId },
    });

    return slideCount < limits.maxSlidesPerProject;
  }

  /**
   * Check if user can add more collaborators
   */
  async canAddCollaborator(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    const tier = await this.getUserTier(userId);
    const limits = this.getLimits(tier);

    if (this.isUnlimited(limits.maxCollaboratorsPerProject)) {
      return true;
    }

    const collaboratorCount = await this.prisma.collaborationSession.count({
      where: { projectId, isActive: true },
    });

    return collaboratorCount < limits.maxCollaboratorsPerProject;
  }

  /**
   * Check if a feature is available for the user
   */
  async hasFeature(
    userId: string,
    feature: keyof SubscriptionLimits['features'],
  ): Promise<boolean> {
    const tier = await this.getUserTier(userId);
    const limits = this.getLimits(tier);
    return limits.features[feature];
  }

  /**
   * Log usage for tracking
   */
  async logUsage(
    userId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        userId,
        action,
        metadata: (metadata || {}) as any,
      } as any,
    });
  }
}

/**
 * Guard to check subscription quotas before allowing actions
 */
@Injectable()
export class SubscriptionQuotaGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptionLimitsService: SubscriptionLimitsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const quotaType = this.reflector.get<keyof UsageQuotas>(
      QUOTA_KEY,
      context.getHandler(),
    );

    if (!quotaType) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const result = await this.subscriptionLimitsService.canPerformAction(
      user.id,
      quotaType,
    );

    if (!result.allowed) {
      throw new ForbiddenException(result.reason);
    }

    return true;
  }
}
