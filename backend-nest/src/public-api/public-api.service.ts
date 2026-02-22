import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
}

export interface UsageStats {
  today: number;
  thisMonth: number;
  total: number;
  endpoints: Record<string, number>;
}

@Injectable()
export class PublicApiService {
  private readonly logger = new Logger(PublicApiService.name);
  private rateLimitCache = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Generate API key for user/organization
   */
  async generateApiKey(
    userId: string,
    options: {
      name: string;
      scopes?: string[];
      rateLimits?: RateLimitConfig;
      expiresAt?: Date;
    },
  ) {
    // Generate secure API key
    const keyPrefix = 'pk_';
    const keyValue = crypto.randomBytes(32).toString('hex');
    const fullKey = `${keyPrefix}${keyValue}`;
    const hashedKey = this.hashApiKey(fullKey);

    const apiKey = await this.prisma.aPIKey.create({
      data: {
        userId,
        name: options.name,
        key: fullKey,
        keyHash: hashedKey,
        keyPrefix: fullKey.substring(0, 8),
        scopes: options.scopes || ['read:projects', 'read:slides'],
        rateLimits: (options.rateLimits || {
          requestsPerMinute: 60,
          requestsPerDay: 10000,
        }) as object,
        expiresAt: options.expiresAt,
        status: 'active',
      },
    });

    // Return full key only once (won't be retrievable later)
    return {
      id: apiKey.id,
      name: apiKey.name,
      key: fullKey,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      message: 'Save this key securely. It will not be shown again.',
    };
  }

  /**
   * Hash API key for storage
   */
  private hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Validate API key
   */
  async validateApiKey(key: string): Promise<{
    valid: boolean;
    userId?: string;
    scopes?: string[];
    keyId?: string;
  }> {
    const hashedKey = this.hashApiKey(key);

    const apiKey = await this.prisma.aPIKey.findFirst({
      where: {
        keyHash: hashedKey,
        status: 'active',
      },
    });

    if (!apiKey) {
      return { valid: false };
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      await this.prisma.aPIKey.update({
        where: { id: apiKey.id },
        data: { status: 'expired' },
      });
      return { valid: false };
    }

    // Update last used
    await this.prisma.aPIKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      valid: true,
      userId: apiKey.userId,
      scopes: apiKey.scopes,
      keyId: apiKey.id,
    };
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(
    keyId: string,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const apiKey = await this.prisma.aPIKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const limits = (apiKey.rateLimits as unknown as RateLimitConfig) || {
      requestsPerMinute: 60,
    };
    const now = Date.now();
    const cacheKey = `rate_${keyId}`;

    let cached = this.rateLimitCache.get(cacheKey);

    if (!cached || cached.resetAt < now) {
      cached = { count: 0, resetAt: now + 60000 }; // 1 minute window
    }

    if (cached.count >= limits.requestsPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: cached.resetAt,
      };
    }

    cached.count++;
    this.rateLimitCache.set(cacheKey, cached);

    return {
      allowed: true,
      remaining: limits.requestsPerMinute - cached.count,
      resetAt: cached.resetAt,
    };
  }

  /**
   * Log API usage
   */
  async logUsage(
    keyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
  ) {
    return this.prisma.aPIUsageLog.create({
      data: {
        apiKeyId: keyId,
        endpoint,
        method,
        statusCode,
        latency: responseTime,
      },
    });
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(keyId: string): Promise<UsageStats> {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, thisMonth, total, endpoints] = await Promise.all([
      this.prisma.aPIUsageLog.count({
        where: { apiKeyId: keyId, createdAt: { gte: todayStart } },
      }),
      this.prisma.aPIUsageLog.count({
        where: { apiKeyId: keyId, createdAt: { gte: monthStart } },
      }),
      this.prisma.aPIUsageLog.count({
        where: { apiKeyId: keyId },
      }),
      this.prisma.aPIUsageLog.groupBy({
        by: ['endpoint'],
        where: { apiKeyId: keyId },
        _count: true,
      }),
    ]);

    const endpointStats: Record<string, number> = {};
    endpoints.forEach((e) => {
      endpointStats[e.endpoint] = e._count;
    });

    return {
      today,
      thisMonth,
      total,
      endpoints: endpointStats,
    };
  }

  /**
   * List user's API keys
   */
  async listApiKeys(userId: string) {
    return this.prisma.aPIKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        status: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(keyId: string, userId: string) {
    const apiKey = await this.prisma.aPIKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey || apiKey.userId !== userId) {
      throw new NotFoundException('API key not found');
    }

    return this.prisma.aPIKey.update({
      where: { id: keyId },
      data: { status: 'revoked' },
    });
  }

  /**
   * Update API key scopes
   */
  async updateScopes(keyId: string, userId: string, scopes: string[]) {
    const apiKey = await this.prisma.aPIKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey || apiKey.userId !== userId) {
      throw new NotFoundException('API key not found');
    }

    return this.prisma.aPIKey.update({
      where: { id: keyId },
      data: { scopes },
    });
  }

  /**
   * Get available scopes
   */
  getAvailableScopes() {
    return [
      { scope: 'read:projects', description: 'Read project data' },
      { scope: 'write:projects', description: 'Create and update projects' },
      { scope: 'delete:projects', description: 'Delete projects' },
      { scope: 'read:slides', description: 'Read slide content' },
      { scope: 'write:slides', description: 'Create and update slides' },
      { scope: 'read:analytics', description: 'View analytics data' },
      { scope: 'export:pdf', description: 'Export to PDF' },
      { scope: 'export:pptx', description: 'Export to PowerPoint' },
      { scope: 'ai:generate', description: 'Use AI generation features' },
      { scope: 'webhooks:manage', description: 'Manage webhooks' },
    ];
  }

  /**
   * Check if scope is allowed
   */
  hasScope(allowedScopes: string[], requiredScope: string): boolean {
    return allowedScopes.includes(requiredScope) || allowedScopes.includes('*');
  }
}
