import { Injectable, Logger, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface OtpMetricEvent {
  event:
    | 'requested'
    | 'sent'
    | 'verified'
    | 'failed'
    | 'expired'
    | 'locked_out'
    | 'rate_limited';
  identifier: string;
  channel: 'email' | 'sms';
  purpose: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface OtpMetrics {
  totalRequested: number;
  totalSent: number;
  totalVerified: number;
  totalFailed: number;
  totalExpired: number;
  totalLockedOut: number;
  totalRateLimited: number;
  verificationRate: number;
  failureRate: number;
  averageVerifyTimeMs: number;
  byChannel: Record<
    string,
    {
      requested: number;
      verified: number;
      failed: number;
    }
  >;
  byPurpose: Record<
    string,
    {
      requested: number;
      verified: number;
      failed: number;
    }
  >;
  hourlyDistribution: Array<{ hour: number; count: number }>;
}

@Injectable()
export class OtpMetricsService {
  private readonly logger = new Logger(OtpMetricsService.name);
  private readonly PREFIX = 'otp:metrics';

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  // ─── Track OTP Event ───────────────────────────────────────
  async trackEvent(event: OtpMetricEvent): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();
      const statsKey = `${this.PREFIX}:daily:${today}`;

      const pipeline = this.redis.pipeline();

      // Daily counters
      pipeline.hincrby(statsKey, `total:${event.event}`, 1);
      pipeline.hincrby(statsKey, `channel:${event.channel}:${event.event}`, 1);
      pipeline.hincrby(statsKey, `purpose:${event.purpose}:${event.event}`, 1);
      pipeline.hincrby(statsKey, `hour:${hour}:${event.event}`, 1);
      pipeline.expire(statsKey, 90 * 24 * 60 * 60); // 90 days

      // Global counters
      pipeline.hincrby(`${this.PREFIX}:global`, `total:${event.event}`, 1);
      pipeline.hincrby(
        `${this.PREFIX}:global`,
        `channel:${event.channel}:${event.event}`,
        1,
      );
      pipeline.hincrby(
        `${this.PREFIX}:global`,
        `purpose:${event.purpose}:${event.event}`,
        1,
      );

      // Track verification times
      if (event.event === 'verified' && event.metadata?.requestedAt) {
        const verifyTime =
          event.timestamp.getTime() -
          new Date(
            event.metadata.requestedAt as string | number | Date,
          ).getTime();
        pipeline.lpush(`${this.PREFIX}:verify_times`, verifyTime.toString());
        pipeline.ltrim(`${this.PREFIX}:verify_times`, 0, 999); // Keep last 1000
      }

      // Recent events log
      const eventData = JSON.stringify({
        ...event,
        identifier: this.maskIdentifier(event.identifier),
        timestamp: event.timestamp.toISOString(),
      });
      pipeline.lpush(`${this.PREFIX}:recent`, eventData);
      pipeline.ltrim(`${this.PREFIX}:recent`, 0, 499);

      await pipeline.exec();

      this.logger.debug(
        `📊 OTP metric: ${event.event} [${event.channel}/${event.purpose}]`,
      );
    } catch (error) {
      this.logger.error(`Failed to track OTP metric: ${error.message}`);
    }
  }

  // ─── Get OTP Metrics ───────────────────────────────────────
  async getMetrics(): Promise<OtpMetrics> {
    const globalKey = `${this.PREFIX}:global`;
    const globalStats = await this.redis.hgetall(globalKey);

    const totalRequested = parseInt(globalStats['total:requested'] || '0');
    const totalSent = parseInt(globalStats['total:sent'] || '0');
    const totalVerified = parseInt(globalStats['total:verified'] || '0');
    const totalFailed = parseInt(globalStats['total:failed'] || '0');
    const totalExpired = parseInt(globalStats['total:expired'] || '0');
    const totalLockedOut = parseInt(globalStats['total:locked_out'] || '0');
    const totalRateLimited = parseInt(globalStats['total:rate_limited'] || '0');

    // By channel
    const byChannel: Record<
      string,
      { requested: number; verified: number; failed: number }
    > = {};
    for (const channel of ['email', 'sms']) {
      byChannel[channel] = {
        requested: parseInt(globalStats[`channel:${channel}:requested`] || '0'),
        verified: parseInt(globalStats[`channel:${channel}:verified`] || '0'),
        failed: parseInt(globalStats[`channel:${channel}:failed`] || '0'),
      };
    }

    // By purpose
    const byPurpose: Record<
      string,
      { requested: number; verified: number; failed: number }
    > = {};
    const purposes = [
      'login',
      'registration',
      'password_reset',
      'email_verification',
      'phone_verification',
      'two_factor',
      'generic',
    ];
    for (const purpose of purposes) {
      const req = parseInt(globalStats[`purpose:${purpose}:requested`] || '0');
      const ver = parseInt(globalStats[`purpose:${purpose}:verified`] || '0');
      const fail = parseInt(globalStats[`purpose:${purpose}:failed`] || '0');
      if (req > 0 || ver > 0 || fail > 0) {
        byPurpose[purpose] = { requested: req, verified: ver, failed: fail };
      }
    }

    // Average verification time
    const verifyTimes = await this.redis.lrange(
      `${this.PREFIX}:verify_times`,
      0,
      -1,
    );
    const avgVerifyTime =
      verifyTimes.length > 0
        ? verifyTimes.reduce((sum, t) => sum + parseInt(t), 0) /
          verifyTimes.length
        : 0;

    // Hourly distribution for today
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = await this.redis.hgetall(
      `${this.PREFIX}:daily:${today}`,
    );
    const hourlyDistribution: Array<{ hour: number; count: number }> = [];
    for (let h = 0; h < 24; h++) {
      hourlyDistribution.push({
        hour: h,
        count: parseInt(dailyStats[`hour:${h}:requested`] || '0'),
      });
    }

    return {
      totalRequested,
      totalSent,
      totalVerified,
      totalFailed,
      totalExpired,
      totalLockedOut,
      totalRateLimited,
      verificationRate:
        totalRequested > 0 ? (totalVerified / totalRequested) * 100 : 0,
      failureRate:
        totalRequested > 0 ? (totalFailed / totalRequested) * 100 : 0,
      averageVerifyTimeMs: Math.round(avgVerifyTime),
      byChannel,
      byPurpose,
      hourlyDistribution,
    };
  }

  // ─── Get Daily OTP Stats ───────────────────────────────────
  async getDailyStats(days: number = 30): Promise<
    Array<{
      date: string;
      requested: number;
      verified: number;
      failed: number;
      rateLimited: number;
    }>
  > {
    const results: Array<{
      date: string;
      requested: number;
      verified: number;
      failed: number;
      rateLimited: number;
    }> = [];

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const statsKey = `${this.PREFIX}:daily:${dateStr}`;

      const stats = await this.redis.hgetall(statsKey);
      results.push({
        date: dateStr,
        requested: parseInt(stats['total:requested'] || '0'),
        verified: parseInt(stats['total:verified'] || '0'),
        failed: parseInt(stats['total:failed'] || '0'),
        rateLimited: parseInt(stats['total:rate_limited'] || '0'),
      });
    }

    return results.reverse();
  }

  // ─── Get Recent Events ─────────────────────────────────────
  async getRecentEvents(limit: number = 20): Promise<OtpMetricEvent[]> {
    const events = await this.redis.lrange(
      `${this.PREFIX}:recent`,
      0,
      limit - 1,
    );
    return events.map((raw) => JSON.parse(raw) as OtpMetricEvent);
  }

  // ─── Convenience Methods ────────────────────────────────────
  async trackRequested(
    identifier: string,
    channel: 'email' | 'sms',
    purpose: string,
  ): Promise<void> {
    await this.trackEvent({
      event: 'requested',
      identifier,
      channel,
      purpose,
      timestamp: new Date(),
    });
  }

  async trackVerified(
    identifier: string,
    channel: 'email' | 'sms',
    purpose: string,
    requestedAt?: Date,
  ): Promise<void> {
    await this.trackEvent({
      event: 'verified',
      identifier,
      channel,
      purpose,
      timestamp: new Date(),
      metadata: requestedAt
        ? { requestedAt: requestedAt.toISOString() }
        : undefined,
    });
  }

  async trackFailed(
    identifier: string,
    channel: 'email' | 'sms',
    purpose: string,
  ): Promise<void> {
    await this.trackEvent({
      event: 'failed',
      identifier,
      channel,
      purpose,
      timestamp: new Date(),
    });
  }

  async trackLockedOut(
    identifier: string,
    channel: 'email' | 'sms',
    purpose: string,
  ): Promise<void> {
    await this.trackEvent({
      event: 'locked_out',
      identifier,
      channel,
      purpose,
      timestamp: new Date(),
    });
  }

  async trackRateLimited(
    identifier: string,
    channel: 'email' | 'sms',
    purpose: string,
  ): Promise<void> {
    await this.trackEvent({
      event: 'rate_limited',
      identifier,
      channel,
      purpose,
      timestamp: new Date(),
    });
  }

  // ─── Helpers ───────────────────────────────────────────────
  private maskIdentifier(identifier: string): string {
    if (identifier.includes('@')) {
      const [local, domain] = identifier.split('@');
      return local.length <= 2
        ? local[0] + '***@' + domain
        : local[0] + '***' + local[local.length - 1] + '@' + domain;
    }
    return '****' + identifier.slice(-4);
  }
}
