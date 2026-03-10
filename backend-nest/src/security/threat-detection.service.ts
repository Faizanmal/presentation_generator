import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export interface ThreatEvent {
  userId?: string;
  ip: string;
  userAgent?: string;
  eventType: ThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  metadata?: Record<string, unknown>;
  // optional human-readable details for alerts
  details?: string;
}

export enum ThreatType {
  BRUTE_FORCE = 'brute_force',
  SQL_INJECTION = 'sql_injection',
  XSS_ATTACK = 'xss_attack',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  ACCOUNT_TAKEOVER = 'account_takeover',
  DATA_EXFILTRATION = 'data_exfiltration',
  MALWARE_DETECTED = 'malware_detected',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
}

/**
 * Threat Detection Service
 * Monitors and detects security threats in real-time
 */
@Injectable()
export class ThreatDetectionService {
  private readonly logger = new Logger(ThreatDetectionService.name);
  private readonly suspiciousPatterns = {
    sqlInjection: [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(-{2}|\/\*|\*\/|;--)/,
      /(\b(OR|AND)\b.*=.*)/i,
    ],
    xss: [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
    ],
    pathTraversal: [/\.\.\//g, /\.\.\\/g, /%2e%2e%2f/gi, /%2e%2e\\/gi],
  };

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('✓ Threat detection service initialized');
  }

  /**
   * Detect brute force attack
   */
  async detectBruteForce(
    identifier: string,
    ip: string,
  ): Promise<{ isAttack: boolean; attempts: number }> {
    const key = `security:brute_force:${identifier}:${ip}`;
    const attempts = await this.redis.incr(key);

    // Set expiry on first attempt
    if (attempts === 1) {
      await this.redis.expire(key, 900); // 15 minutes
    }

    const threshold = 5; // Max 5 attempts in 15 minutes
    const isAttack = attempts > threshold;

    if (isAttack && attempts === threshold + 1) {
      await this.logThreat({
        ip,
        eventType: ThreatType.BRUTE_FORCE,
        severity: 'high',
        timestamp: new Date(),
        metadata: { identifier, attempts },
      });
    }

    return { isAttack, attempts };
  }

  /**
   * Detect SQL injection attempt
   */
  detectSqlInjection(input: string): boolean {
    for (const pattern of this.suspiciousPatterns.sqlInjection) {
      if (pattern.test(input)) {
        void this.logThreat({
          ip: 'unknown',
          eventType: ThreatType.SQL_INJECTION,
          severity: 'critical',
          timestamp: new Date(),
          metadata: { input: input.substring(0, 100) },
        });
        return true;
      }
    }
    return false;
  }

  /**
   * Detect XSS attack
   */
  detectXss(input: string): boolean {
    for (const pattern of this.suspiciousPatterns.xss) {
      if (pattern.test(input)) {
        void this.logThreat({
          ip: 'unknown',
          eventType: ThreatType.XSS_ATTACK,
          severity: 'critical',
          timestamp: new Date(),
          metadata: { input: input.substring(0, 100) },
        });
        return true;
      }
    }
    return false;
  }

  /**
   * Detect path traversal attempt
   */
  detectPathTraversal(path: string): boolean {
    for (const pattern of this.suspiciousPatterns.pathTraversal) {
      if (pattern.test(path)) {
        void this.logThreat({
          ip: 'unknown',
          eventType: ThreatType.SUSPICIOUS_ACTIVITY,
          severity: 'high',
          timestamp: new Date(),
          metadata: { path },
        });
        return true;
      }
    }
    return false;
  }

  /**
   * Detect rate limit abuse
   */
  async detectRateLimitAbuse(
    userId: string,
    ip: string,
    endpoint: string,
  ): Promise<{ exceeded: boolean; remaining: number }> {
    const key = `security:rate_limit:${userId}:${ip}:${endpoint}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }

    const limit = 100; // 100 requests per minute
    const exceeded = count > limit;

    if (exceeded && count === limit + 1) {
      await this.logThreat({
        userId,
        ip,
        eventType: ThreatType.RATE_LIMIT_EXCEEDED,
        severity: 'medium',
        timestamp: new Date(),
        metadata: { endpoint, requests: count },
      });
    }

    return { exceeded, remaining: Math.max(0, limit - count) };
  }

  /**
   * Detect suspicious login pattern
   */
  async detectSuspiciousLogin(
    userId: string,
    ip: string,
    userAgent: string,
  ): Promise<boolean> {
    const key = `security:login_locations:${userId}`;
    const recentIps = await this.redis.lrange(key, 0, -1);

    // Check for login from new location
    if (!recentIps.includes(ip)) {
      await this.redis.lpush(key, ip);
      await this.redis.ltrim(key, 0, 9); // Keep last 10 IPs
      await this.redis.expire(key, 60 * 60 * 24 * 30); // 30 days

      // If there are multiple IPs in short time, it's suspicious
      if (recentIps.length > 3) {
        await this.logThreat({
          userId,
          ip,
          userAgent,
          eventType: ThreatType.SUSPICIOUS_ACTIVITY,
          severity: 'medium',
          timestamp: new Date(),
          metadata: { recentIps },
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Detect account takeover attempt
   */
  async detectAccountTakeover(
    userId: string,
    ip: string,
    failedAttempts: number,
  ): Promise<boolean> {
    if (failedAttempts >= 3) {
      await this.logThreat({
        userId,
        ip,
        eventType: ThreatType.ACCOUNT_TAKEOVER,
        severity: 'critical',
        timestamp: new Date(),
        metadata: { failedAttempts },
      });
      return true;
    }
    return false;
  }

  /**
   * Detect data exfiltration (unusual download patterns)
   */
  async detectDataExfiltration(
    userId: string,
    ip: string,
    downloadSize: number,
  ): Promise<boolean> {
    const key = `security:downloads:${userId}`;
    const totalDownloads = await this.redis.incrby(key, downloadSize);

    if ((await this.redis.ttl(key)) === -1) {
      await this.redis.expire(key, 3600); // 1 hour window
    }

    const threshold = 100 * 1024 * 1024; // 100MB per hour

    if (totalDownloads > threshold) {
      await this.logThreat({
        userId,
        ip,
        eventType: ThreatType.DATA_EXFILTRATION,
        severity: 'critical',
        timestamp: new Date(),
        metadata: { totalDownloads, threshold },
      });
      return true;
    }

    return false;
  }

  /**
   * Log threat event
   */
  private async logThreat(event: ThreatEvent): Promise<void> {
    const key = `security:threats:${Date.now()}`;
    await this.redis.set(key, JSON.stringify(event), 'EX', 60 * 60 * 24 * 30); // Keep for 30 days

    this.logger.warn(
      `🚨 THREAT DETECTED: ${event.eventType} | Severity: ${event.severity} | IP: ${event.ip}`,
    );

    // Trigger alert for critical threats
    if (event.severity === 'critical') {
      void this.triggerSecurityAlert(event);
    }
  }

  /**
   * Trigger security alert via configured channels (Slack, PagerDuty, email)
   */
  private async triggerSecurityAlert(event: ThreatEvent): Promise<void> {
    this.logger.error(`🚨 CRITICAL THREAT ALERT: ${JSON.stringify(event)}`);

    // Send Slack alert if configured
    const slackWebhook = this.configService.get<string>(
      'SECURITY_SLACK_WEBHOOK_URL',
    );
    if (slackWebhook) {
      try {
        const fetch = (await import('node-fetch')).default;
        await fetch(slackWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 *CRITICAL SECURITY THREAT*`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Type:* ${event.eventType}\n*Severity:* ${event.severity}\n*IP:* ${event.ip}\n*Details:* ${event.details || 'N/A'}\n*Time:* ${new Date(event.timestamp).toISOString()}`,
                },
              },
            ],
          }),
        });
        this.logger.log('Security alert sent to Slack');
      } catch (err) {
        this.logger.error('Failed to send Slack security alert', err);
      }
    }

    // Send PagerDuty alert if configured
    const pagerDutyKey = this.configService.get<string>(
      'PAGERDUTY_ROUTING_KEY',
    );
    if (pagerDutyKey) {
      try {
        const fetch = (await import('node-fetch')).default;
        await fetch('https://events.pagerduty.com/v2/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routing_key: pagerDutyKey,
            event_action: 'trigger',
            payload: {
              summary: `Critical security threat: ${event.eventType} from ${event.ip}`,
              severity: 'critical',
              source: 'PresentationDesigner',
              custom_details: event,
            },
          }),
        });
        this.logger.log('Security alert sent to PagerDuty');
      } catch (err) {
        this.logger.error('Failed to send PagerDuty security alert', err);
      }
    }
  }

  /**
   * Get recent threats
   */
  async getRecentThreats(limit = 100): Promise<ThreatEvent[]> {
    const keys = await this.redis.keys('security:threats:*');
    const recentKeys = keys.slice(-limit);

    const threats: ThreatEvent[] = [];

    for (const key of recentKeys) {
      const data = await this.redis.get(key);
      if (data) {
        threats.push(JSON.parse(data));
      }
    }

    return threats.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  /**
   * Get threat statistics
   */
  async getThreatStats(): Promise<Record<string, number>> {
    const threats = await this.getRecentThreats(1000);

    const stats: Record<string, number> = {};

    for (const threat of threats) {
      stats[threat.eventType] = (stats[threat.eventType] || 0) + 1;
    }

    return stats;
  }

  /**
   * Block IP address
   */
  async blockIp(ip: string, durationSeconds = 3600): Promise<void> {
    await this.redis.set(`security:blocked:${ip}`, '1', 'EX', durationSeconds);
    this.logger.warn(`IP blocked: ${ip} for ${durationSeconds}s`);
  }

  /**
   * Check if IP is blocked
   */
  async isIpBlocked(ip: string): Promise<boolean> {
    const blocked = await this.redis.get(`security:blocked:${ip}`);
    return !!blocked;
  }

  /**
   * Unblock IP address
   */
  async unblockIp(ip: string): Promise<void> {
    await this.redis.del(`security:blocked:${ip}`);
    this.logger.log(`IP unblocked: ${ip}`);
  }

  /**
   * Get blocked IPs
   */
  async getBlockedIps(): Promise<string[]> {
    const keys = await this.redis.keys('security:blocked:*');
    return keys.map((key) => key.replace('security:blocked:', ''));
  }
}
