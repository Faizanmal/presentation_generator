import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EnterpriseComplianceService } from './enterprise-compliance.service';
import type { ComplianceSettings } from './enterprise-compliance.service';
import { AuditLogService } from './audit-log.service';
import type { AuditAction } from './audit-log.service';
import { DataResidencyService } from './data-residency.service';
import type { DataRegion } from './data-residency.service';
import { ComplianceReportService } from './compliance-report.service';
import type { ComplianceFramework } from './compliance-report.service';

@ApiTags('Enterprise Compliance')
@ApiBearerAuth()
@Controller('api/compliance')
@UseGuards(JwtAuthGuard)
export class EnterpriseComplianceController {
  constructor(
    private readonly complianceService: EnterpriseComplianceService,
    private readonly auditLogService: AuditLogService,
    private readonly dataResidencyService: DataResidencyService,
    private readonly reportService: ComplianceReportService,
  ) {}

  // ============================================
  // DASHBOARD & SETTINGS
  // ============================================

  @Get('organizations/:organizationId/dashboard')
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: 'Get compliance dashboard' })
  @ApiParam({ name: 'organizationId', description: 'Organization ID' })
  async getDashboard(@Param('organizationId') organizationId: string) {
    return this.complianceService.getDashboard(organizationId);
  }

  @Get('organizations/:organizationId/settings')
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: 'Get compliance settings' })
  async getSettings(@Param('organizationId') organizationId: string) {
    return this.complianceService.getSettings(organizationId);
  }

  @Put('organizations/:organizationId/settings')
  @UseGuards(OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update compliance settings' })
  async updateSettings(
    @Param('organizationId') organizationId: string,
    @Body() updates: Partial<ComplianceSettings>,
    @Request() req,
  ) {
    return this.complianceService.updateSettings(
      organizationId,
      req.user.id,
      updates,
    );
  }

  // ============================================
  // COMPLIANCE REPORTS
  // ============================================

  @Post('organizations/:organizationId/reports/generate')
  @UseGuards(OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Generate compliance report' })
  @HttpCode(HttpStatus.OK)
  async generateReport(
    @Param('organizationId') organizationId: string,
    @Body()
    body: {
      framework: ComplianceFramework;
      period?: { start: string; end: string };
    },
  ) {
    const period = body.period
      ? { start: new Date(body.period.start), end: new Date(body.period.end) }
      : undefined;

    return this.reportService.generateReport(
      organizationId,
      body.framework,
      period,
    );
  }

  @Post('organizations/:organizationId/reports/generate-all')
  @UseGuards(OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Generate reports for all enabled frameworks' })
  @HttpCode(HttpStatus.OK)
  async generateAllReports(@Param('organizationId') organizationId: string) {
    return this.complianceService.generateAllReports(organizationId);
  }

  @Get('organizations/:organizationId/reports')
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: 'Get report history' })
  @ApiQuery({
    name: 'framework',
    required: false,
    enum: ['SOC2', 'GDPR', 'HIPAA', 'ISO27001', 'PCI-DSS'],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getReportHistory(
    @Param('organizationId') organizationId: string,
    @Query('framework') framework?: ComplianceFramework,
    @Query('limit') limit?: string,
  ) {
    return this.reportService.getReportHistory(organizationId, {
      framework,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('organizations/:organizationId/reports/trend')
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: 'Get compliance score trend' })
  @ApiQuery({
    name: 'framework',
    required: true,
    enum: ['SOC2', 'GDPR', 'HIPAA', 'ISO27001', 'PCI-DSS'],
  })
  @ApiQuery({ name: 'months', required: false, type: Number })
  async getScoreTrend(
    @Param('organizationId') organizationId: string,
    @Query('framework') framework: ComplianceFramework,
    @Query('months') months?: string,
  ) {
    return this.reportService.getScoreTrend(
      organizationId,
      framework,
      months ? parseInt(months) : 12,
    );
  }

  @Post('organizations/:organizationId/reports/export')
  @UseGuards(OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Export audit package for external auditors' })
  @HttpCode(HttpStatus.OK)
  async exportAuditPackage(
    @Param('organizationId') organizationId: string,
    @Body()
    options: {
      frameworks?: ComplianceFramework[];
      includeAuditLogs?: boolean;
      includePolicies?: boolean;
      period?: { start: string; end: string };
    },
  ) {
    const period = options.period
      ? {
          start: new Date(options.period.start),
          end: new Date(options.period.end),
        }
      : undefined;

    return this.complianceService.exportAuditPackage(organizationId, {
      ...options,
      period,
    });
  }

  // ============================================
  // AUDIT LOGS
  // ============================================

  @Get('organizations/:organizationId/audit-logs')
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: 'Query audit logs' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'resource', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async queryAuditLogs(
    @Param('organizationId') organizationId: string,
    @Query('action') action?: AuditAction,
    @Query('userId') userId?: string,
    @Query('resource') resource?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.query(organizationId, {
      action,
      userId,
      resource,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get('organizations/:organizationId/audit-logs/summary')
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: 'Get audit log summary statistics' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to summarize',
  })
  async getAuditLogSummary(
    @Param('organizationId') organizationId: string,
    @Query('days') days?: string,
  ) {
    return this.auditLogService.getSummary(
      organizationId,
      days ? parseInt(days) : 30,
    );
  }

  @Post('organizations/:organizationId/audit-logs/export')
  @UseGuards(OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Export audit logs' })
  @HttpCode(HttpStatus.OK)
  async exportAuditLogs(
    @Param('organizationId') organizationId: string,
    @Body()
    options: {
      format: 'csv' | 'json';
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.auditLogService.export(organizationId, {
      format: options.format,
      startDate: options.startDate ? new Date(options.startDate) : undefined,
      endDate: options.endDate ? new Date(options.endDate) : undefined,
    });
  }

  // ============================================
  // DATA RESIDENCY
  // ============================================

  @Get('organizations/:organizationId/data-residency')
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: 'Get data residency policy' })
  async getDataResidencyPolicy(
    @Param('organizationId') organizationId: string,
  ) {
    return this.dataResidencyService.getPolicy(organizationId);
  }

  @Put('organizations/:organizationId/data-residency')
  @UseGuards(OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Set data residency policy' })
  async setDataResidencyPolicy(
    @Param('organizationId') organizationId: string,
    @Body()
    policy: {
      primaryRegion: DataRegion;
      allowedRegions: DataRegion[];
      gdprCompliant: boolean;
    },
  ) {
    return this.dataResidencyService.setPolicy(organizationId, {
      primaryRegion: policy.primaryRegion,
      allowedRegions: policy.allowedRegions,
      gdprCompliant: policy.gdprCompliant,
      dataReplication: false,
      enforceGeoRestriction: false,
      hipaaCompliant: false,
      socCompliant: false,
    });
  }

  @Get('regions')
  @ApiOperation({ summary: 'Get available data regions' })
  async getAvailableRegions() {
    return this.dataResidencyService.getAvailableRegions();
  }

  @Post('organizations/:organizationId/data-residency/migrate')
  @UseGuards(OrganizationGuard)
  @Roles('OWNER')
  @ApiOperation({ summary: 'Request data migration to new region' })
  @HttpCode(HttpStatus.ACCEPTED)
  async requestDataMigration(
    @Param('organizationId') organizationId: string,
    @Body() body: { targetRegion: DataRegion },
  ) {
    return this.dataResidencyService.requestDataMigration(
      organizationId,
      body.targetRegion,
    );
  }

  // ============================================
  // GDPR DATA SUBJECT RIGHTS
  // ============================================

  @Post('users/data-export')
  @ApiOperation({ summary: 'Request personal data export (GDPR)' })
  @HttpCode(HttpStatus.ACCEPTED)
  async requestDataExport(
    @Body() body: { organizationId: string },
    @Request() req,
  ) {
    return this.dataResidencyService.exportUserData(
      req.user.id,
      body.organizationId,
    );
  }

  @Post('users/data-deletion')
  @ApiOperation({ summary: 'Request account and data deletion (GDPR)' })
  @HttpCode(HttpStatus.ACCEPTED)
  async requestDataDeletion(
    @Body() body: { reason?: string; organizationId: string },
    @Request() req,
  ) {
    return this.dataResidencyService.requestDataDeletion(
      req.user.id,
      body.organizationId,
    );
  }

  // ============================================
  // POLICY ENFORCEMENT
  // ============================================

  @Post('organizations/:organizationId/enforce/:policy')
  @UseGuards(OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Enforce a compliance policy' })
  @ApiParam({ name: 'policy', enum: ['mfa', 'password', 'session'] })
  @HttpCode(HttpStatus.OK)
  async enforcePolicy(
    @Param('organizationId') organizationId: string,
    @Param('policy') policy: 'mfa' | 'password' | 'session',
  ) {
    return this.complianceService.enforcePolicy(organizationId, policy);
  }
}
