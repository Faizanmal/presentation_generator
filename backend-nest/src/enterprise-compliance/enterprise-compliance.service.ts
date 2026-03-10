import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import { DataResidencyService } from './data-residency.service';
import {
  ComplianceReportService,
  ComplianceFramework,
  ComplianceReport,
} from './compliance-report.service';

export interface ComplianceDashboard {
  organizationId: string;
  overallHealthScore: number;
  frameworks: {
    framework: ComplianceFramework;
    enabled: boolean;
    lastScore: number;
    lastReportDate: Date | null;
    trend: 'improving' | 'stable' | 'declining';
  }[];
  recentActivity: {
    type: string;
    description: string;
    timestamp: Date;
  }[];
  upcomingDeadlines: {
    framework: ComplianceFramework;
    requirement: string;
    dueDate: Date;
  }[];
  alerts: {
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: Date;
  }[];
}

export interface ComplianceSettings {
  organizationId: string;
  enabledFrameworks: ComplianceFramework[];
  autoReportGeneration: boolean;
  reportFrequency: 'weekly' | 'monthly' | 'quarterly';
  notificationEmails: string[];
  dataRetentionDays: number;
  requireMFA: boolean;
  enforcePasswordPolicy: boolean;
  sessionTimeoutMinutes: number;
}

@Injectable()
export class EnterpriseComplianceService {
  private readonly logger = new Logger(EnterpriseComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly dataResidencyService: DataResidencyService,
    private readonly complianceReportService: ComplianceReportService,
  ) {}

  /**
   * Get compliance dashboard for organization
   */
  async getDashboard(organizationId: string): Promise<ComplianceDashboard> {
    const settings = await this.getSettings(organizationId);
    const frameworks = await this.getFrameworkStatus(
      organizationId,
      settings?.enabledFrameworks || [],
    );

    // Calculate overall health score
    const enabledFrameworks = frameworks.filter((f) => f.enabled);
    const overallHealthScore =
      enabledFrameworks.length > 0
        ? Math.round(
            enabledFrameworks.reduce((acc, f) => acc + f.lastScore, 0) /
              enabledFrameworks.length,
          )
        : 0;

    // Get recent audit activity
    const recentAuditLogs = await this.auditLogService.query(organizationId, {
      limit: 10,
    });

    const recentActivity = recentAuditLogs.logs.map((log) => ({
      type: log.action,
      description: `${log.action} by ${log.userId || 'system'}`,
      timestamp: log.timestamp,
    }));

    // Generate alerts
    const alerts = await this.generateAlerts(organizationId, frameworks);

    return {
      organizationId,
      overallHealthScore,
      frameworks,
      recentActivity,
      upcomingDeadlines: [], // Would be populated from scheduled tasks
      alerts,
    };
  }

  /**
   * Get compliance settings for organization
   */
  async getSettings(
    organizationId: string,
  ): Promise<ComplianceSettings | null> {
    const settings = await this.prisma.complianceSettings.findUnique({
      where: { organizationId },
    });

    if (!settings) return null;

    return {
      organizationId,
      enabledFrameworks: settings.enabledFrameworks as ComplianceFramework[],
      autoReportGeneration: settings.autoReportGeneration,
      reportFrequency: settings.reportFrequency as
        | 'weekly'
        | 'monthly'
        | 'quarterly',
      notificationEmails: settings.notificationEmails as string[],
      dataRetentionDays: settings.dataRetentionDays,
      requireMFA: settings.requireMFA,
      enforcePasswordPolicy: settings.enforcePasswordPolicy,
      sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    };
  }

  /**
   * Update compliance settings
   */
  async updateSettings(
    organizationId: string,
    userId: string,
    updates: Partial<ComplianceSettings>,
  ): Promise<ComplianceSettings> {
    const _updated = await this.prisma.complianceSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        enabledFrameworks: updates.enabledFrameworks || [],
        autoReportGeneration: updates.autoReportGeneration ?? true,
        reportFrequency: updates.reportFrequency || 'monthly',
        notificationEmails: updates.notificationEmails || [],
        dataRetentionDays: updates.dataRetentionDays || 365,
        requireMFA: updates.requireMFA ?? false,
        enforcePasswordPolicy: updates.enforcePasswordPolicy ?? true,
        sessionTimeoutMinutes: updates.sessionTimeoutMinutes || 60,
      },
      update: {
        ...(updates.enabledFrameworks && {
          enabledFrameworks: updates.enabledFrameworks,
        }),
        ...(updates.autoReportGeneration !== undefined && {
          autoReportGeneration: updates.autoReportGeneration,
        }),
        ...(updates.reportFrequency && {
          reportFrequency: updates.reportFrequency,
        }),
        ...(updates.notificationEmails && {
          notificationEmails: updates.notificationEmails,
        }),
        ...(updates.dataRetentionDays && {
          dataRetentionDays: updates.dataRetentionDays,
        }),
        ...(updates.requireMFA !== undefined && {
          requireMFA: updates.requireMFA,
        }),
        ...(updates.enforcePasswordPolicy !== undefined && {
          enforcePasswordPolicy: updates.enforcePasswordPolicy,
        }),
        ...(updates.sessionTimeoutMinutes && {
          sessionTimeoutMinutes: updates.sessionTimeoutMinutes,
        }),
      },
    });

    // Log the settings change
    await this.auditLogService.log({
      organizationId,
      userId,
      action: 'settings_changed',
      resource: 'compliance_settings',
      resourceType: 'setting',
      resourceId: organizationId,
      details: { updates },
      severity: 'low',
      outcome: 'success',
    });

    return this.getSettings(organizationId) as Promise<ComplianceSettings>;
  }

  /**
   * Generate compliance report for all enabled frameworks
   */
  async generateAllReports(
    organizationId: string,
  ): Promise<ComplianceReport[]> {
    const settings = await this.getSettings(organizationId);
    if (!settings || settings.enabledFrameworks.length === 0) {
      return [];
    }

    const reports: ComplianceReport[] = [];

    for (const framework of settings.enabledFrameworks) {
      try {
        const report = await this.complianceReportService.generateReport(
          organizationId,
          framework,
        );
        reports.push(report);
      } catch (error) {
        this.logger.error(
          `Failed to generate ${framework} report: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return reports;
  }

  /**
   * Export compliance data for auditors
   */
  async exportAuditPackage(
    organizationId: string,
    options: {
      frameworks?: ComplianceFramework[];
      includeAuditLogs?: boolean;
      includePolicies?: boolean;
      period?: { start: Date; end: Date };
    } = {},
  ): Promise<{
    reports: ComplianceReport[];
    auditLogs?: object;
    policies?: object;
    metadata: object;
  }> {
    const settings = await this.getSettings(organizationId);
    const frameworks = options.frameworks || settings?.enabledFrameworks || [];

    const reports: ComplianceReport[] = [];
    for (const framework of frameworks) {
      const report = await this.complianceReportService.generateReport(
        organizationId,
        framework,
        options.period,
      );
      reports.push(report);
    }

    const result: any = {
      reports,
      metadata: {
        organizationId,
        generatedAt: new Date(),
        frameworks,
        period: options.period,
      },
    };

    if (options.includeAuditLogs) {
      const startDate =
        options.period?.start ||
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const endDate = options.period?.end || new Date();

      const auditData = await this.auditLogService.query(organizationId, {
        startDate,
        endDate,
        limit: 10000,
      });
      result.auditLogs = auditData;
    }

    if (options.includePolicies) {
      const residencyPolicy =
        await this.dataResidencyService.getPolicy(organizationId);
      result.policies = {
        dataResidency: residencyPolicy,
        compliance: settings,
      };
    }

    return result;
  }

  /**
   * Get framework status with trends
   */
  private async getFrameworkStatus(
    organizationId: string,
    enabledFrameworks: ComplianceFramework[],
  ): Promise<ComplianceDashboard['frameworks']> {
    const allFrameworks: ComplianceFramework[] = [
      'SOC2',
      'GDPR',
      'HIPAA',
      'ISO27001',
      'PCI-DSS',
    ];

    const results = await Promise.all(
      allFrameworks.map(async (framework) => {
        const enabled = enabledFrameworks.includes(framework);
        const history = await this.complianceReportService.getReportHistory(
          organizationId,
          {
            framework,
            limit: 2,
          },
        );

        let lastScore = 0;
        let lastReportDate: Date | null = null;
        let trend: 'improving' | 'stable' | 'declining' = 'stable';

        if (history.length > 0) {
          lastScore = history[0].overallScore;
          lastReportDate = history[0].generatedAt;

          if (history.length > 1) {
            const diff = history[0].overallScore - history[1].overallScore;
            if (diff > 5) trend = 'improving';
            else if (diff < -5) trend = 'declining';
          }
        }

        return { framework, enabled, lastScore, lastReportDate, trend };
      }),
    );

    return results;
  }

  /**
   * Generate compliance alerts
   */
  private async generateAlerts(
    organizationId: string,
    frameworks: ComplianceDashboard['frameworks'],
  ): Promise<ComplianceDashboard['alerts']> {
    const alerts: ComplianceDashboard['alerts'] = [];

    // Check for low scores
    for (const fw of frameworks.filter((f) => f.enabled)) {
      if (fw.lastScore < 50) {
        alerts.push({
          severity: 'critical',
          message: `${fw.framework} compliance score is critically low (${fw.lastScore}%)`,
          timestamp: new Date(),
        });
      } else if (fw.lastScore < 75) {
        alerts.push({
          severity: 'warning',
          message: `${fw.framework} compliance needs attention (${fw.lastScore}%)`,
          timestamp: new Date(),
        });
      }

      if (fw.trend === 'declining') {
        alerts.push({
          severity: 'warning',
          message: `${fw.framework} compliance score is declining`,
          timestamp: new Date(),
        });
      }

      // Check for stale reports
      if (fw.lastReportDate) {
        const daysSinceReport = Math.floor(
          (Date.now() - fw.lastReportDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSinceReport > 30) {
          alerts.push({
            severity: 'info',
            message: `${fw.framework} report is ${daysSinceReport} days old`,
            timestamp: new Date(),
          });
        }
      }
    }

    // Check MFA enrollment
    const mfaCheck = await this.checkMFAStatus(organizationId);
    if (mfaCheck.percentage < 100) {
      alerts.push({
        severity: mfaCheck.percentage < 50 ? 'critical' : 'warning',
        message: `Only ${mfaCheck.percentage}% of users have MFA enabled`,
        timestamp: new Date(),
      });
    }

    return alerts;
  }

  private async checkMFAStatus(
    organizationId: string,
  ): Promise<{ percentage: number }> {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { mfaEnabled: true } } },
    });

    if (members.length === 0) return { percentage: 100 };

    const mfaEnabled = members.filter((m) => m.user.mfaEnabled).length;
    return { percentage: Math.round((mfaEnabled / members.length) * 100) };
  }

  /**
   * Check if organization has specific compliance requirement
   */
  async hasComplianceRequirement(
    organizationId: string,
    framework: ComplianceFramework,
  ): Promise<boolean> {
    const settings = await this.getSettings(organizationId);
    return settings?.enabledFrameworks.includes(framework) ?? false;
  }

  /**
   * Enforce compliance policies
   */
  async enforcePolicy(
    organizationId: string,
    policy: 'mfa' | 'password' | 'session',
  ): Promise<{ success: boolean; affectedUsers: number }> {
    const settings = await this.getSettings(organizationId);
    if (!settings) {
      return { success: false, affectedUsers: 0 };
    }

    switch (policy) {
      case 'mfa':
        if (settings.requireMFA) {
          // Count members who need MFA enforcement
          const result = await this.prisma.organizationMember.count({
            where: { organizationId },
          });
          return { success: true, affectedUsers: result };
        }
        break;

      case 'session': {
        // Invalidate sessions older than timeout
        const cutoff = new Date(
          Date.now() - settings.sessionTimeoutMinutes * 60 * 1000,
        );
        const sessions = await this.prisma.session.deleteMany({
          where: {
            user: { organizationMembers: { some: { organizationId } } },
            expires: { lt: cutoff },
          },
        });
        return { success: true, affectedUsers: sessions.count };
      }

      default:
        break;
    }

    return { success: true, affectedUsers: 0 };
  }
}
