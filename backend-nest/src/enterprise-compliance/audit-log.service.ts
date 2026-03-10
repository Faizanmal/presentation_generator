import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface AuditEvent {
  userId: string;
  organizationId?: string;
  action: AuditAction;
  resource?: string;
  resourceType: ResourceType;
  resourceId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  outcome: 'success' | 'failure' | 'partial';
}

export type AuditAction =
  // Authentication
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_change'
  | 'password_reset'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'session_revoked'
  // User management
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'role_assigned'
  | 'role_removed'
  // Organization
  | 'org_created'
  | 'org_updated'
  | 'org_deleted'
  | 'member_added'
  | 'member_removed'
  | 'member_role_changed'
  // Projects
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'project_shared'
  | 'project_unshared'
  | 'project_exported'
  | 'project_published'
  // Data access
  | 'data_accessed'
  | 'data_exported'
  | 'data_imported'
  | 'bulk_download'
  // Settings
  | 'settings_changed'
  | 'integration_connected'
  | 'integration_disconnected'
  | 'api_key_created'
  | 'api_key_revoked'
  // Compliance
  | 'gdpr_export_requested'
  | 'gdpr_deletion_requested'
  | 'data_retention_applied'
  | 'compliance_policy_updated';

export type ResourceType =
  | 'user'
  | 'organization'
  | 'project'
  | 'slide'
  | 'block'
  | 'template'
  | 'integration'
  | 'api_key'
  | 'setting'
  | 'report';

export interface AuditLogQuery {
  organizationId?: string;
  userId?: string;
  action?: AuditAction | AuditAction[];
  resourceType?: ResourceType;
  resourceId?: string;
  severity?: AuditEvent['severity'] | AuditEvent['severity'][];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly retentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.retentionDays =
      this.configService.get<number>('AUDIT_LOG_RETENTION_DAYS') || 365;
  }

  /**
   * Log an audit event
   */
  async log(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: event.userId,
          organizationId: event.organizationId,
          action: event.action,
          resource: event.resource || '',
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          details: event.details as object,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          sessionId: event.sessionId,
          severity: event.severity,
          outcome: event.outcome,
          timestamp: new Date(),
        },
      });

      // Log high-severity events
      if (event.severity === 'high' || event.severity === 'critical') {
        this.logger.warn(
          `[AUDIT] ${event.severity.toUpperCase()}: ${event.action} on ${event.resourceType}:${event.resourceId} by ${event.userId}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to create audit log', error);
    }
  }

  /**
   * Query audit logs
   */
  async query(
    organizationId: string,
    options: {
      action?: AuditAction | AuditAction[];
      userId?: string;
      resource?: string;
      resourceType?: ResourceType;
      resourceId?: string;
      severity?: AuditEvent['severity'] | AuditEvent['severity'][];
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const where: Record<string, unknown> = { organizationId };

    if (options.userId) {
      where.userId = options.userId;
    }

    if (options.action) {
      where.action = Array.isArray(options.action)
        ? { in: options.action }
        : options.action;
    }

    if (options.resourceType) {
      where.resourceType = options.resourceType;
    }

    if (options.resourceId) {
      where.resourceId = options.resourceId;
    }

    if (options.resource) {
      where.resource = options.resource;
    }

    if (options.severity) {
      where.severity = Array.isArray(options.severity)
        ? { in: options.severity }
        : options.severity;
    }

    if (options.startDate || options.endDate) {
      where.timestamp = {};
      if (options.startDate) {
        (where.timestamp as Record<string, Date>).gte = options.startDate;
      }
      if (options.endDate) {
        (where.timestamp as Record<string, Date>).lte = options.endDate;
      }
    }

    const offset =
      options.offset ??
      (options.page ? (options.page - 1) * (options.limit || 50) : 0);

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: options.limit || 50,
        skip: offset,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      hasMore: offset + logs.length < total,
    };
  }

  /**
   * Get audit log by ID
   */
  async getById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Get audit summary for dashboard
   */
  async getSummary(organizationId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalEvents, bySeverity, byAction, byUser, recentHighSeverity] =
      await Promise.all([
        // Total events
        this.prisma.auditLog.count({
          where: { organizationId, timestamp: { gte: startDate } },
        }),

        // Events by severity
        this.prisma.auditLog.groupBy({
          by: ['severity'],
          where: { organizationId, timestamp: { gte: startDate } },
          _count: { id: true },
        }),

        // Events by action (top 10)
        this.prisma.auditLog.groupBy({
          by: ['action'],
          where: { organizationId, timestamp: { gte: startDate } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),

        // Events by user (top 10)
        this.prisma.auditLog.groupBy({
          by: ['userId'],
          where: { organizationId, timestamp: { gte: startDate } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),

        // Recent high/critical severity events
        this.prisma.auditLog.findMany({
          where: {
            organizationId,
            severity: { in: ['high', 'critical'] },
            timestamp: { gte: startDate },
          },
          orderBy: { timestamp: 'desc' },
          take: 10,
          include: {
            user: { select: { name: true, email: true } },
          },
        }),
      ]);

    return {
      totalEvents,
      bySeverity: bySeverity.reduce(
        (acc, s) => ({ ...acc, [s.severity || 'unknown']: s._count.id }),
        {},
      ),
      topActions: byAction.map((a) => ({
        action: a.action,
        count: a._count.id,
      })),
      topUsers: byUser.map((u) => ({ userId: u.userId, count: u._count.id })),
      recentHighSeverity,
    };
  }

  /**
   * Export audit logs
   */
  async export(
    organizationId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      format: 'json' | 'csv';
    },
  ): Promise<{ data: string; filename: string }> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(options.startDate && { timestamp: { gte: options.startDate } }),
        ...(options.endDate && { timestamp: { lte: options.endDate } }),
      },
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `audit-logs-${organizationId}-${timestamp}.${options.format}`;

    if (options.format === 'json') {
      return { data: JSON.stringify(logs, null, 2), filename };
    }

    // CSV format
    const headers = [
      'ID',
      'Timestamp',
      'User Email',
      'Action',
      'Resource Type',
      'Resource ID',
      'Severity',
      'Outcome',
      'IP Address',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.timestamp.toISOString(),
      log.user?.email || '',
      log.action,
      log.resourceType,
      log.resourceId,
      log.severity,
      log.outcome,
      log.ipAddress || '',
    ]);

    const csv =
      headers.join(',') +
      '\n' +
      rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    return { data: csv, filename };
  }

  /**
   * Apply data retention policy
   */
  async applyRetentionPolicy(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: { timestamp: { lt: cutoffDate } },
    });

    this.logger.log(
      `Deleted ${result.count} audit logs older than ${this.retentionDays} days`,
    );

    return result.count;
  }
}
