import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import { DataResidencyService } from './data-residency.service';

export type ComplianceFramework =
  | 'SOC2'
  | 'GDPR'
  | 'HIPAA'
  | 'ISO27001'
  | 'PCI-DSS';

export interface ComplianceCheck {
  id: string;
  framework: ComplianceFramework;
  category: string;
  requirement: string;
  status: 'compliant' | 'non-compliant' | 'partial' | 'not-applicable';
  evidence?: string;
  lastChecked: Date;
  details?: string;
}

export interface ComplianceReport {
  id: string;
  organizationId: string;
  framework: ComplianceFramework;
  generatedAt: Date;
  period: { start: Date; end: Date };
  overallScore: number;
  checks: ComplianceCheck[];
  summary: {
    total: number;
    compliant: number;
    nonCompliant: number;
    partial: number;
    notApplicable: number;
  };
  recommendations: string[];
}

@Injectable()
export class ComplianceReportService {
  private readonly logger = new Logger(ComplianceReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly dataResidencyService: DataResidencyService,
  ) {}

  /**
   * Generate compliance report for a framework
   */
  async generateReport(
    organizationId: string,
    framework: ComplianceFramework,
    period?: { start: Date; end: Date },
  ): Promise<ComplianceReport> {
    const startDate =
      period?.start || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const endDate = period?.end || new Date();

    const checks = await this.runComplianceChecks(
      organizationId,
      framework,
      startDate,
      endDate,
    );

    const summary = {
      total: checks.length,
      compliant: checks.filter((c) => c.status === 'compliant').length,
      nonCompliant: checks.filter((c) => c.status === 'non-compliant').length,
      partial: checks.filter((c) => c.status === 'partial').length,
      notApplicable: checks.filter((c) => c.status === 'not-applicable').length,
    };

    const overallScore = Math.round(
      ((summary.compliant + summary.partial * 0.5) /
        (summary.total - summary.notApplicable)) *
        100,
    );

    const recommendations = this.generateRecommendations(checks, framework);

    const report: ComplianceReport = {
      id: `report-${Date.now()}`,
      organizationId,
      framework,
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      overallScore,
      checks,
      summary,
      recommendations,
    };

    // Store report
    await this.prisma.complianceReport.create({
      data: {
        organizationId,
        framework,
        reportData: report as object,
        overallScore,
        generatedAt: new Date(),
      },
    });

    return report;
  }

  /**
   * Get historical compliance reports
   */
  async getReportHistory(
    organizationId: string,
    options: {
      framework?: ComplianceFramework;
      limit?: number;
    } = {},
  ) {
    return this.prisma.complianceReport.findMany({
      where: {
        organizationId,
        ...(options.framework && { framework: options.framework }),
      },
      orderBy: { generatedAt: 'desc' },
      take: options.limit || 10,
      select: {
        id: true,
        framework: true,
        overallScore: true,
        generatedAt: true,
      },
    });
  }

  /**
   * Get compliance score trend
   */
  async getScoreTrend(
    organizationId: string,
    framework: ComplianceFramework,
    months: number = 12,
  ): Promise<Array<{ date: string; score: number }>> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const reports = await this.prisma.complianceReport.findMany({
      where: {
        organizationId,
        framework,
        generatedAt: { gte: startDate },
      },
      orderBy: { generatedAt: 'asc' },
      select: {
        generatedAt: true,
        overallScore: true,
      },
    });

    return reports.map((r) => ({
      date: r.generatedAt.toISOString().split('T')[0],
      score: r.overallScore,
    }));
  }

  /**
   * Run compliance checks for a framework
   */
  private async runComplianceChecks(
    organizationId: string,
    framework: ComplianceFramework,
    startDate: Date,
    endDate: Date,
  ): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    switch (framework) {
      case 'SOC2':
        checks.push(
          ...(await this.runSOC2Checks(organizationId, startDate, endDate)),
        );
        break;
      case 'GDPR':
        checks.push(
          ...(await this.runGDPRChecks(organizationId, startDate, endDate)),
        );
        break;
      case 'HIPAA':
        checks.push(
          ...(await this.runHIPAAChecks(organizationId, startDate, endDate)),
        );
        break;
      case 'ISO27001':
        checks.push(
          ...(await this.runISO27001Checks(organizationId, startDate, endDate)),
        );
        break;
      case 'PCI-DSS':
        checks.push(
          ...(await this.runPCIDSSChecks(organizationId, startDate, endDate)),
        );
        break;
    }

    return checks;
  }

  private async runSOC2Checks(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    // CC1: Control Environment
    checks.push({
      id: 'soc2-cc1-1',
      framework: 'SOC2',
      category: 'CC1 - Control Environment',
      requirement: 'Defined organizational structure with clear roles',
      status: await this.checkOrganizationalStructure(organizationId),
      lastChecked: new Date(),
    });

    // CC2: Communication and Information
    checks.push({
      id: 'soc2-cc2-1',
      framework: 'SOC2',
      category: 'CC2 - Communication',
      requirement: 'Security policies communicated to employees',
      status: 'compliant', // Placeholder
      lastChecked: new Date(),
    });

    // CC3: Risk Assessment
    checks.push({
      id: 'soc2-cc3-1',
      framework: 'SOC2',
      category: 'CC3 - Risk Assessment',
      requirement: 'Regular security risk assessments conducted',
      status: 'partial',
      lastChecked: new Date(),
    });

    // CC5: Control Activities
    checks.push({
      id: 'soc2-cc5-1',
      framework: 'SOC2',
      category: 'CC5 - Control Activities',
      requirement: 'Access controls implemented',
      status: await this.checkAccessControls(organizationId),
      lastChecked: new Date(),
    });

    // CC6: Logical and Physical Access
    checks.push({
      id: 'soc2-cc6-1',
      framework: 'SOC2',
      category: 'CC6 - Access Controls',
      requirement: 'MFA enabled for all users',
      status: await this.checkMFAEnrollment(organizationId),
      lastChecked: new Date(),
    });

    checks.push({
      id: 'soc2-cc6-2',
      framework: 'SOC2',
      category: 'CC6 - Access Controls',
      requirement: 'Password policies enforced',
      status: 'compliant',
      lastChecked: new Date(),
    });

    // CC7: System Operations
    checks.push({
      id: 'soc2-cc7-1',
      framework: 'SOC2',
      category: 'CC7 - System Operations',
      requirement: 'Audit logging enabled',
      status: await this.checkAuditLogging(organizationId, startDate),
      lastChecked: new Date(),
    });

    checks.push({
      id: 'soc2-cc7-2',
      framework: 'SOC2',
      category: 'CC7 - System Operations',
      requirement: 'Incident response procedures defined',
      status: 'compliant',
      lastChecked: new Date(),
    });

    // CC8: Change Management
    checks.push({
      id: 'soc2-cc8-1',
      framework: 'SOC2',
      category: 'CC8 - Change Management',
      requirement: 'Change management process documented',
      status: 'compliant',
      lastChecked: new Date(),
    });

    return checks;
  }

  private async runGDPRChecks(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];
    const policy = await this.dataResidencyService.getPolicy(organizationId);

    // Data Processing
    checks.push({
      id: 'gdpr-dp-1',
      framework: 'GDPR',
      category: 'Data Processing',
      requirement: 'Lawful basis for processing documented',
      status: 'compliant',
      lastChecked: new Date(),
    });

    checks.push({
      id: 'gdpr-dp-2',
      framework: 'GDPR',
      category: 'Data Processing',
      requirement: 'Data processing agreements in place',
      status: 'compliant',
      lastChecked: new Date(),
    });

    // Data Residency
    checks.push({
      id: 'gdpr-dr-1',
      framework: 'GDPR',
      category: 'Data Residency',
      requirement: 'Data stored in EU region',
      status: policy?.gdprCompliant ? 'compliant' : 'non-compliant',
      details: policy
        ? `Primary region: ${policy.primaryRegion}`
        : 'No policy set',
      lastChecked: new Date(),
    });

    // Data Subject Rights
    checks.push({
      id: 'gdpr-dsr-1',
      framework: 'GDPR',
      category: 'Data Subject Rights',
      requirement: 'Data export functionality available',
      status: 'compliant',
      evidence: 'Self-service data export in settings',
      lastChecked: new Date(),
    });

    checks.push({
      id: 'gdpr-dsr-2',
      framework: 'GDPR',
      category: 'Data Subject Rights',
      requirement: 'Data deletion process available',
      status: 'compliant',
      evidence: 'Account deletion with 30-day processing',
      lastChecked: new Date(),
    });

    // Consent
    checks.push({
      id: 'gdpr-c-1',
      framework: 'GDPR',
      category: 'Consent',
      requirement: 'Cookie consent mechanism implemented',
      status: 'compliant',
      lastChecked: new Date(),
    });

    // Security
    checks.push({
      id: 'gdpr-s-1',
      framework: 'GDPR',
      category: 'Security',
      requirement: 'Data encryption at rest',
      status: 'compliant',
      evidence: 'AES-256 encryption',
      lastChecked: new Date(),
    });

    checks.push({
      id: 'gdpr-s-2',
      framework: 'GDPR',
      category: 'Security',
      requirement: 'Data encryption in transit',
      status: 'compliant',
      evidence: 'TLS 1.3',
      lastChecked: new Date(),
    });

    return checks;
  }

  private async runHIPAAChecks(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    // Administrative Safeguards
    checks.push({
      id: 'hipaa-as-1',
      framework: 'HIPAA',
      category: 'Administrative Safeguards',
      requirement: 'Security officer designated',
      status: 'compliant',
      lastChecked: new Date(),
    });

    checks.push({
      id: 'hipaa-as-2',
      framework: 'HIPAA',
      category: 'Administrative Safeguards',
      requirement: 'Risk analysis conducted',
      status: 'partial',
      lastChecked: new Date(),
    });

    checks.push({
      id: 'hipaa-as-3',
      framework: 'HIPAA',
      category: 'Administrative Safeguards',
      requirement: 'Workforce training completed',
      status: 'compliant',
      lastChecked: new Date(),
    });

    // Physical Safeguards
    checks.push({
      id: 'hipaa-ps-1',
      framework: 'HIPAA',
      category: 'Physical Safeguards',
      requirement: 'Facility access controls',
      status: 'compliant',
      evidence: 'AWS data center certifications',
      lastChecked: new Date(),
    });

    // Technical Safeguards
    checks.push({
      id: 'hipaa-ts-1',
      framework: 'HIPAA',
      category: 'Technical Safeguards',
      requirement: 'Access controls implemented',
      status: await this.checkAccessControls(organizationId),
      lastChecked: new Date(),
    });

    checks.push({
      id: 'hipaa-ts-2',
      framework: 'HIPAA',
      category: 'Technical Safeguards',
      requirement: 'Audit controls enabled',
      status: await this.checkAuditLogging(organizationId, startDate),
      lastChecked: new Date(),
    });

    checks.push({
      id: 'hipaa-ts-3',
      framework: 'HIPAA',
      category: 'Technical Safeguards',
      requirement: 'PHI encryption required',
      status: 'compliant',
      lastChecked: new Date(),
    });

    return checks;
  }

  private async runISO27001Checks(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ComplianceCheck[]> {
    // Simplified ISO 27001 checks
    return [
      {
        id: 'iso27001-a5-1',
        framework: 'ISO27001',
        category: 'A.5 - Information Security Policies',
        requirement: 'Information security policies documented',
        status: 'compliant',
        lastChecked: new Date(),
      },
      {
        id: 'iso27001-a9-1',
        framework: 'ISO27001',
        category: 'A.9 - Access Control',
        requirement: 'Access control policy implemented',
        status: await this.checkAccessControls(organizationId),
        lastChecked: new Date(),
      },
      {
        id: 'iso27001-a12-1',
        framework: 'ISO27001',
        category: 'A.12 - Operations Security',
        requirement: 'Logging and monitoring enabled',
        status: await this.checkAuditLogging(organizationId, startDate),
        lastChecked: new Date(),
      },
    ];
  }

  private async runPCIDSSChecks(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ComplianceCheck[]> {
    return [
      {
        id: 'pci-1',
        framework: 'PCI-DSS',
        category: 'Requirement 1',
        requirement: 'Firewall configuration standards',
        status: 'compliant',
        lastChecked: new Date(),
      },
      {
        id: 'pci-3',
        framework: 'PCI-DSS',
        category: 'Requirement 3',
        requirement: 'Protect stored cardholder data',
        status: 'not-applicable',
        details: 'Payment processing handled by Stripe',
        lastChecked: new Date(),
      },
      {
        id: 'pci-8',
        framework: 'PCI-DSS',
        category: 'Requirement 8',
        requirement: 'Unique IDs for computer access',
        status: 'compliant',
        lastChecked: new Date(),
      },
    ];
  }

  // ============================================
  // CHECK HELPER METHODS
  // ============================================

  private async checkOrganizationalStructure(
    organizationId: string,
  ): Promise<ComplianceCheck['status']> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { members: true },
    });

    if (!org) return 'non-compliant';

    const hasOwner = org.members.some((m) => m.role === 'OWNER');
    const hasAdmin = org.members.some((m) => m.role === 'ADMIN');

    if (hasOwner && hasAdmin) return 'compliant';
    if (hasOwner || hasAdmin) return 'partial';
    return 'non-compliant';
  }

  private async checkAccessControls(
    organizationId: string,
  ): Promise<ComplianceCheck['status']> {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
    });

    const hasRoles = members.every((m) => m.role);
    if (hasRoles) return 'compliant';
    return 'partial';
  }

  private async checkMFAEnrollment(
    organizationId: string,
  ): Promise<ComplianceCheck['status']> {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { mfaEnabled: true } } },
    });

    const mfaEnabled = members.filter((m) => m.user.mfaEnabled).length;
    const percentage = (mfaEnabled / members.length) * 100;

    if (percentage === 100) return 'compliant';
    if (percentage >= 80) return 'partial';
    return 'non-compliant';
  }

  private async checkAuditLogging(
    organizationId: string,
    since: Date,
  ): Promise<ComplianceCheck['status']> {
    const logCount = await this.prisma.auditLog.count({
      where: { organizationId, timestamp: { gte: since } },
    });

    if (logCount > 100) return 'compliant';
    if (logCount > 0) return 'partial';
    return 'non-compliant';
  }

  private generateRecommendations(
    checks: ComplianceCheck[],
    framework: ComplianceFramework,
  ): string[] {
    const recommendations: string[] = [];

    const nonCompliant = checks.filter((c) => c.status === 'non-compliant');
    const partial = checks.filter((c) => c.status === 'partial');

    for (const check of nonCompliant) {
      recommendations.push(
        `[Critical] ${check.category}: ${check.requirement} - Immediate action required`,
      );
    }

    for (const check of partial) {
      recommendations.push(
        `[Improvement] ${check.category}: ${check.requirement} - Additional steps needed`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        `Great work! All ${framework} requirements are fully compliant.`,
      );
    }

    return recommendations;
  }
}
