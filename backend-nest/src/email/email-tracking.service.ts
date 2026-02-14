import { Injectable, Logger, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface EmailTrackingEvent {
  jobId: string;
  recipient: string;
  subject: string;
  type: string; // send-otp, send-welcome, etc.
  provider: string;
  status:
    | 'queued'
    | 'sent'
    | 'delivered'
    | 'opened'
    | 'clicked'
    | 'bounced'
    | 'failed';
  timestamp: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailStats {
  totalSent: number;
  totalFailed: number;
  totalBounced: number;
  totalOpened: number;
  totalClicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  byProvider: Record<string, { sent: number; failed: number }>;
  byType: Record<string, { sent: number; failed: number }>;
  recentEvents: EmailTrackingEvent[];
}

@Injectable()
export class EmailTrackingService {
  private readonly logger = new Logger(EmailTrackingService.name);

  // Redis key prefix
  private readonly PREFIX = 'email:tracking';
  private readonly STATS_PREFIX = 'email:stats';
  private readonly EVENT_TTL = 7 * 24 * 60 * 60; // 7 days

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  // ─── Track Email Event ─────────────────────────────────────
  async trackEvent(event: EmailTrackingEvent): Promise<void> {
    try {
      const eventKey = `${this.PREFIX}:event:${event.jobId}`;
      const eventData = JSON.stringify({
        ...event,
        timestamp: event.timestamp.toISOString(),
      });

      // Store individual event
      await this.redis.set(eventKey, eventData, 'EX', this.EVENT_TTL);

      // Add to recent events list (capped at 1000)
      await this.redis.lpush(`${this.PREFIX}:recent`, eventData);
      await this.redis.ltrim(`${this.PREFIX}:recent`, 0, 999);

      // Add to recipient history
      await this.redis.lpush(
        `${this.PREFIX}:recipient:${event.recipient}`,
        eventData,
      );
      await this.redis.ltrim(
        `${this.PREFIX}:recipient:${event.recipient}`,
        0,
        49,
      );
      await this.redis.expire(
        `${this.PREFIX}:recipient:${event.recipient}`,
        this.EVENT_TTL,
      );

      // Update aggregate stats
      await this.updateStats(event);

      this.logger.debug(
        `📊 Tracked email event: ${event.status} [${event.type}] → ${event.recipient}`,
      );
    } catch (error) {
      this.logger.error(`Failed to track email event: ${error.message}`);
    }
  }

  // ─── Update Aggregate Stats ────────────────────────────────
  private async updateStats(event: EmailTrackingEvent): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const statsKey = `${this.STATS_PREFIX}:daily:${today}`;

    const pipeline = this.redis.pipeline();

    // Overall stats
    pipeline.hincrby(statsKey, `total:${event.status}`, 1);

    // Provider stats
    pipeline.hincrby(statsKey, `provider:${event.provider}:${event.status}`, 1);

    // Type stats
    pipeline.hincrby(statsKey, `type:${event.type}:${event.status}`, 1);

    // Hourly stats for granular tracking
    const hour = new Date().getHours();
    pipeline.hincrby(statsKey, `hour:${hour}:${event.status}`, 1);

    // Set expiry on daily stats (keep 90 days)
    pipeline.expire(statsKey, 90 * 24 * 60 * 60);

    // Global counters (never expire)
    pipeline.hincrby(`${this.STATS_PREFIX}:global`, `total:${event.status}`, 1);
    pipeline.hincrby(
      `${this.STATS_PREFIX}:global`,
      `provider:${event.provider}:${event.status}`,
      1,
    );
    pipeline.hincrby(
      `${this.STATS_PREFIX}:global`,
      `type:${event.type}:${event.status}`,
      1,
    );

    await pipeline.exec();
  }

  // ─── Get Email Stats ───────────────────────────────────────
  async getStats(date?: string): Promise<EmailStats> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const globalKey = `${this.STATS_PREFIX}:global`;

    // Get daily stats
    const globalStats = await this.redis.hgetall(globalKey);

    // Parse stats
    const totalSent = parseInt(globalStats['total:sent'] || '0');
    const totalFailed = parseInt(globalStats['total:failed'] || '0');
    const totalBounced = parseInt(globalStats['total:bounced'] || '0');
    const totalOpened = parseInt(globalStats['total:opened'] || '0');
    const totalClicked = parseInt(globalStats['total:clicked'] || '0');
    const totalDelivered = parseInt(globalStats['total:delivered'] || '0');

    // By provider
    const byProvider: Record<string, { sent: number; failed: number }> = {};
    for (const [key, value] of Object.entries(globalStats)) {
      const match = key.match(/^provider:(.+):(sent|failed)$/);
      if (match) {
        const [, provider, status] = match;
        if (!byProvider[provider])
          byProvider[provider] = { sent: 0, failed: 0 };
        byProvider[provider][status as 'sent' | 'failed'] = parseInt(value);
      }
    }

    // By type
    const byType: Record<string, { sent: number; failed: number }> = {};
    for (const [key, value] of Object.entries(globalStats)) {
      const match = key.match(/^type:(.+):(sent|failed)$/);
      if (match) {
        const [, type, status] = match;
        if (!byType[type]) byType[type] = { sent: 0, failed: 0 };
        byType[type][status as 'sent' | 'failed'] = parseInt(value);
      }
    }

    // Recent events
    const recentRaw = await this.redis.lrange(`${this.PREFIX}:recent`, 0, 19);
    const recentEvents = recentRaw.map(
      (raw) => JSON.parse(raw) as EmailTrackingEvent,
    );

    return {
      totalSent,
      totalFailed,
      totalBounced,
      totalOpened,
      totalClicked,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      openRate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
      clickRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
      byProvider,
      byType,
      recentEvents,
    };
  }

  // ─── Get Daily Stats (for charts) ──────────────────────────
  async getDailyStats(days: number = 30): Promise<
    Array<{
      date: string;
      sent: number;
      failed: number;
      opened: number;
      bounced: number;
    }>
  > {
    const results: Array<{
      date: string;
      sent: number;
      failed: number;
      opened: number;
      bounced: number;
    }> = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const statsKey = `${this.STATS_PREFIX}:daily:${dateStr}`;

      const stats = await this.redis.hgetall(statsKey);

      results.push({
        date: dateStr,
        sent: parseInt(stats['total:sent'] || '0'),
        failed: parseInt(stats['total:failed'] || '0'),
        opened: parseInt(stats['total:opened'] || '0'),
        bounced: parseInt(stats['total:bounced'] || '0'),
      });
    }

    return results.reverse();
  }

  // ─── Get Recipient History ─────────────────────────────────
  async getRecipientHistory(
    email: string,
    limit: number = 20,
  ): Promise<EmailTrackingEvent[]> {
    const events = await this.redis.lrange(
      `${this.PREFIX}:recipient:${email}`,
      0,
      limit - 1,
    );
    return events.map((raw) => JSON.parse(raw) as EmailTrackingEvent);
  }

  // ─── Track Email Sent ──────────────────────────────────────
  async trackSent(
    jobId: string,
    recipient: string,
    subject: string,
    type: string,
    provider: string,
  ): Promise<void> {
    await this.trackEvent({
      jobId,
      recipient,
      subject,
      type,
      provider,
      status: 'sent',
      timestamp: new Date(),
    });
  }

  // ─── Track Email Failed ────────────────────────────────────
  async trackFailed(
    jobId: string,
    recipient: string,
    subject: string,
    type: string,
    provider: string,
    error: string,
  ): Promise<void> {
    await this.trackEvent({
      jobId,
      recipient,
      subject,
      type,
      provider,
      status: 'failed',
      timestamp: new Date(),
      error,
    });
  }

  // ─── Track Email Opened (Webhook) ──────────────────────────
  async trackOpened(jobId: string): Promise<void> {
    const eventKey = `${this.PREFIX}:event:${jobId}`;
    const eventRaw = await this.redis.get(eventKey);

    if (eventRaw) {
      const event: EmailTrackingEvent = JSON.parse(eventRaw);
      event.status = 'opened';
      event.timestamp = new Date();
      await this.trackEvent(event);
    }
  }

  // ─── Track Email Clicked (Webhook) ─────────────────────────
  async trackClicked(jobId: string): Promise<void> {
    const eventKey = `${this.PREFIX}:event:${jobId}`;
    const eventRaw = await this.redis.get(eventKey);

    if (eventRaw) {
      const event: EmailTrackingEvent = JSON.parse(eventRaw);
      event.status = 'clicked';
      event.timestamp = new Date();
      await this.trackEvent(event);
    }
  }
}
