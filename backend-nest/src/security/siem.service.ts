import { Injectable, Logger, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

export interface SiemEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  source: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  result: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}

export interface SiemAlert {
  id: string;
  timestamp: Date;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  events: SiemEvent[];
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
}

/**
 * SIEM (Security Information and Event Management) Service
 * Centralized logging, monitoring, and analysis of security events
 */
@Injectable()
export class SiemService {
  private readonly logger = new Logger(SiemService.name);
  private readonly eventRetentionDays = 90;
  private readonly alertRules: Map<string, (event: SiemEvent) => boolean> =
    new Map();

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {
    this.initializeAlertRules();
    this.logger.log('✓ SIEM service initialized');
  }

  /**
   * Initialize alert rules
   */
  private initializeAlertRules(): void {
    // Multiple failed login attempts
    this.alertRules.set('multiple_failed_logins', (event) => {
      return (
        event.eventType === 'authentication' &&
        event.result === 'failure' &&
        (event.metadata?.consecutiveFailures as number) >= 5
      );
    });

    // Privilege escalation attempt
    this.alertRules.set('privilege_escalation', (event) => {
      return (
        event.eventType === 'authorization' &&
        event.result === 'failure' &&
        (event.metadata?.attemptedRole as string) === 'ADMIN'
      );
    });

    // Unusual data access
    this.alertRules.set('unusual_data_access', (event) => {
      return (
        event.eventType === 'data_access' &&
        (event.metadata?.recordsAccessed as number) > 1000
      );
    });

    // After-hours access
    this.alertRules.set('after_hours_access', (event) => {
      const hour = event.timestamp.getHours();
      return hour < 6 || hour > 22;
    });
  }

  /**
   * Log security event
   */
  async logEvent(
    event: Omit<SiemEvent, 'id' | 'timestamp'>,
  ): Promise<SiemEvent> {
    const siemEvent: SiemEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      ...event,
    };

    // Store in Redis for fast access
    const key = `siem:events:${siemEvent.id}`;
    await this.redis.set(
      key,
      JSON.stringify(siemEvent),
      'EX',
      60 * 60 * 24 * this.eventRetentionDays,
    );

    // Add to time-series index
    const tsKey = `siem:timeline:${this.getDateKey(siemEvent.timestamp)}`;
    await this.redis.rpush(tsKey, siemEvent.id);
    await this.redis.expire(tsKey, 60 * 60 * 24 * this.eventRetentionDays);

    // Check alert rules
    await this.checkAlertRules(siemEvent);

    this.logger.log(
      `SIEM Event: ${siemEvent.eventType} | ${siemEvent.action} | ${siemEvent.result}`,
    );

    return siemEvent;
  }

  /**
   * Check alert rules and trigger alerts
   */
  private async checkAlertRules(event: SiemEvent): Promise<void> {
    for (const [alertType, rule] of this.alertRules.entries()) {
      if (rule(event)) {
        const alertSeverity =
          event.severity === 'info' ? 'low' : event.severity;
        await this.createAlert({
          alertType,
          severity: alertSeverity,
          description: `Alert triggered: ${alertType}`,
          events: [event],
        });
      }
    }
  }

  /**
   * Create security alert
   */
  private async createAlert(
    alert: Omit<SiemAlert, 'id' | 'timestamp' | 'status'>,
  ): Promise<SiemAlert> {
    const siemAlert: SiemAlert = {
      id: this.generateId(),
      timestamp: new Date(),
      status: 'open',
      ...alert,
    };

    const key = `siem:alerts:${siemAlert.id}`;
    await this.redis.set(key, JSON.stringify(siemAlert));

    // Add to alerts index
    await this.redis.rpush('siem:alerts:index', siemAlert.id);

    this.logger.warn(
      `🚨 SIEM Alert Created: ${siemAlert.alertType} | Severity: ${siemAlert.severity}`,
    );

    return siemAlert;
  }

  /**
   * Get events by time range
   */
  async getEvents(
    startDate: Date,
    endDate: Date,
    filters?: {
      eventType?: string;
      userId?: string;
      severity?: string;
      result?: string;
    },
  ): Promise<SiemEvent[]> {
    const events: SiemEvent[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = this.getDateKey(currentDate);
      const eventIds = await this.redis.lrange(
        `siem:timeline:${dateKey}`,
        0,
        -1,
      );

      for (const eventId of eventIds) {
        const data = await this.redis.get(`siem:events:${eventId}`);
        if (data) {
          const event: SiemEvent = JSON.parse(data);

          // Apply filters
          if (filters) {
            if (filters.eventType && event.eventType !== filters.eventType)
              continue;
            if (filters.userId && event.userId !== filters.userId) continue;
            if (filters.severity && event.severity !== filters.severity)
              continue;
            if (filters.result && event.result !== filters.result) continue;
          }

          events.push(event);
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get alerts
   */
  async getAlerts(
    status?: 'open' | 'investigating' | 'resolved' | 'false_positive',
  ): Promise<SiemAlert[]> {
    const alertIds = await this.redis.lrange('siem:alerts:index', 0, -1);
    const alerts: SiemAlert[] = [];

    for (const alertId of alertIds) {
      const data = await this.redis.get(`siem:alerts:${alertId}`);
      if (data) {
        const alert: SiemAlert = JSON.parse(data);

        if (!status || alert.status === status) {
          alerts.push(alert);
        }
      }
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Update alert status
   */
  async updateAlertStatus(
    alertId: string,
    status: 'open' | 'investigating' | 'resolved' | 'false_positive',
  ): Promise<void> {
    const key = `siem:alerts:${alertId}`;
    const data = await this.redis.get(key);

    if (data) {
      const alert: SiemAlert = JSON.parse(data);
      alert.status = status;
      await this.redis.set(key, JSON.stringify(alert));

      this.logger.log(`Alert ${alertId} status updated to: ${status}`);
    }
  }

  /**
   * Get security dashboard metrics
   */
  async getDashboardMetrics(days = 7): Promise<{
    totalEvents: number;
    criticalEvents: number;
    openAlerts: number;
    failedLogins: number;
    uniqueUsers: number;
    topEvents: { eventType: string; count: number }[];
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.getEvents(startDate, endDate);
    const alerts = await this.getAlerts('open');

    const eventTypes: Record<string, number> = {};
    const uniqueUsers = new Set<string>();

    let criticalEvents = 0;
    let failedLogins = 0;

    for (const event of events) {
      eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;

      if (event.severity === 'critical') criticalEvents++;
      if (event.eventType === 'authentication' && event.result === 'failure') {
        failedLogins++;
      }
      if (event.userId) uniqueUsers.add(event.userId);
    }

    const topEvents = Object.entries(eventTypes)
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents: events.length,
      criticalEvents,
      openAlerts: alerts.length,
      failedLogins,
      uniqueUsers: uniqueUsers.size,
      topEvents,
    };
  }

  /**
   * Search events
   */
  async searchEvents(query: string): Promise<SiemEvent[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    const events = await this.getEvents(startDate, endDate);

    return events.filter((event) => {
      const searchableText = JSON.stringify(event).toLowerCase();
      return searchableText.includes(query.toLowerCase());
    });
  }

  /**
   * Export events to JSON
   */
  async exportEvents(startDate: Date, endDate: Date): Promise<string> {
    const events = await this.getEvents(startDate, endDate);
    return JSON.stringify(events, null, 2);
  }

  /**
   * Generate event ID
   */
  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get date key for timeline indexing
   */
  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(
    userId: string | undefined,
    action: string,
    result: 'success' | 'failure',
    ip?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent({
      eventType: 'authentication',
      severity: result === 'failure' ? 'medium' : 'info',
      source: 'auth_service',
      userId,
      ip,
      userAgent,
      action,
      result,
      metadata,
    });
  }

  /**
   * Log data access event
   */
  async logDataAccessEvent(
    userId: string,
    resource: string,
    resourceId: string,
    action: string,
    ip?: string,
  ): Promise<void> {
    await this.logEvent({
      eventType: 'data_access',
      severity: 'info',
      source: 'data_service',
      userId,
      ip,
      action,
      resource,
      resourceId,
      result: 'success',
    });
  }

  /**
   * Log authorization event
   */
  async logAuthorizationEvent(
    userId: string,
    action: string,
    resource: string,
    result: 'success' | 'failure',
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.logEvent({
      eventType: 'authorization',
      severity: result === 'failure' ? 'high' : 'info',
      source: 'rbac_service',
      userId,
      action,
      resource,
      result,
      metadata,
    });
  }
}
