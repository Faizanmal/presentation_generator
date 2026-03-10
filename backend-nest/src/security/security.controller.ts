import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Delete,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MfaService } from './mfa.service';
import { RbacService, Permission } from './rbac.service';
import { SamlService } from './saml.service';
import { ComplianceService, ComplianceStandard } from './compliance.service';
import { BackupService } from './backup.service';
import { SiemService } from './siem.service';
import { ThreatDetectionService } from './threat-detection.service';
import { RequirePermission } from './guards/permission.decorator';

@ApiTags('Security')
@Controller('api/security')
export class SecurityController {
  constructor(
    private readonly mfaService: MfaService,
    private readonly rbacService: RbacService,
    private readonly samlService: SamlService,
    private readonly complianceService: ComplianceService,
    private readonly backupService: BackupService,
    private readonly siemService: SiemService,
    private readonly threatDetectionService: ThreatDetectionService,
  ) {}

  // ==================== MFA Endpoints ====================

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup MFA for user' })
  async setupMfa(@Request() req: { user: { userId: string; email: string } }) {
    return this.mfaService.setupMfa(req.user.userId, req.user.email);
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify MFA code' })
  async verifyMfa(
    @Request() req: { user: { userId: string; mfaSecret: string } },
    @Body() body: { code: string },
  ) {
    return this.mfaService.verifyMfa(
      req.user.userId,
      req.user.mfaSecret,
      body.code,
    );
  }

  @Post('mfa/backup-codes/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate backup codes' })
  async regenerateBackupCodes(@Request() req: { user: { userId: string } }) {
    return this.mfaService.regenerateBackupCodes(req.user.userId);
  }

  @Get('mfa/trusted-devices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get trusted devices' })
  async getTrustedDevices(@Request() req: { user: { userId: string } }) {
    return this.mfaService.getTrustedDevices(req.user.userId);
  }

  @Delete('mfa/trusted-devices/:deviceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove trusted device' })
  async forgetDevice(
    @Request() req: { user: { userId: string } },
    @Param('deviceId') deviceId: string,
  ) {
    await this.mfaService.forgetDevice(req.user.userId, deviceId);
    return { success: true };
  }

  // ==================== RBAC Endpoints ====================

  @Get('rbac/roles')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all roles' })
  getAllRoles() {
    return this.rbacService.getAllRoles();
  }

  @Get('rbac/permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all permissions' })
  getAllPermissions() {
    return this.rbacService.getAllPermissions();
  }

  @Get('rbac/my-permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user permissions' })
  async getMyPermissions(@Request() req: { user: { userId: string } }) {
    return this.rbacService.getUserPermissions(req.user.userId);
  }

  @Put('rbac/users/:userId/role')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_USERS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign role to user (Admin only)' })
  async assignRole(
    @Param('userId') userId: string,
    @Body() body: { role: string },
  ) {
    await this.rbacService.assignRole(userId, body.role as any);
    return { success: true };
  }

  // ==================== SAML/SSO Endpoints ====================

  @Post('saml/configure')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_SETTINGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configure SAML SSO for organization' })
  async configureSaml(
    @Body()
    body: {
      tenantId: string;
      entityId: string;
      ssoServiceUrl: string;
      certificate: string;
    },
  ) {
    this.samlService.registerIdentityProvider(body.tenantId, {
      entityId: body.entityId,
      ssoServiceUrl: body.ssoServiceUrl,
      certificate: body.certificate,
    });
    return { success: true };
  }

  @Get('saml/:tenantId/metadata')
  @ApiOperation({ summary: 'Get SAML metadata for tenant' })
  getSamlMetadata(@Param('tenantId') tenantId: string) {
    return {
      metadata: this.samlService.getIdentityProviderMetadata(tenantId),
    };
  }

  @Get('saml/sp/metadata')
  @ApiOperation({ summary: 'Get Service Provider metadata' })
  getSpMetadata() {
    return {
      metadata: this.samlService.getServiceProviderMetadata(),
    };
  }

  // ==================== Compliance Endpoints ====================

  @Get('compliance/report/:standard')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_SETTINGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate compliance report' })
  async getComplianceReport(@Param('standard') standard: string) {
    return this.complianceService.generateComplianceReport(
      standard as ComplianceStandard,
    );
  }

  @Get('compliance/data-retention-policy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get data retention policy' })
  getDataRetentionPolicy() {
    return this.complianceService.getDataRetentionPolicy();
  }

  @Post('compliance/data-subject-access-request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request copy of personal data (GDPR/CCPA)' })
  async dataSubjectAccessRequest(@Request() req: { user: { userId: string } }) {
    return this.complianceService.handleDataSubjectAccessRequest(
      req.user.userId,
    );
  }

  @Delete('compliance/right-to-erasure')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete all personal data (GDPR/CCPA)' })
  async rightToErasure(@Request() req: { user: { userId: string } }) {
    await this.complianceService.handleRightToErasure(req.user.userId);
    return { success: true, message: 'Account deletion scheduled' };
  }

  // ==================== Backup Endpoints ====================

  @Post('backup/create')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_SETTINGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create manual backup' })
  async createBackup(@Body() body: { type?: 'full' | 'incremental' }) {
    return this.backupService.createBackup(body.type || 'full');
  }

  @Get('backup/list')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_SETTINGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all backups' })
  async listBackups() {
    return this.backupService.listBackups();
  }

  @Get('backup/stats')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_SETTINGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get backup statistics' })
  async getBackupStats() {
    return this.backupService.getBackupStats();
  }

  @Post('backup/restore/:backupId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_SETTINGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore from backup' })
  async restoreBackup(@Param('backupId') backupId: string) {
    return this.backupService.restoreBackup(backupId);
  }

  @Post('backup/test-disaster-recovery')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_SETTINGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test disaster recovery procedures' })
  async testDisasterRecovery() {
    return this.backupService.testDisasterRecovery();
  }

  // ==================== SIEM Endpoints ====================

  @Get('siem/events')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_AUDIT_LOGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get security events' })
  async getSecurityEvents(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('eventType') eventType?: string,
    @Query('severity') severity?: string,
  ) {
    return this.siemService.getEvents(new Date(startDate), new Date(endDate), {
      eventType,
      severity,
    });
  }

  @Get('siem/alerts')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_AUDIT_LOGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get security alerts' })
  async getSecurityAlerts(@Query('status') status?: string) {
    return this.siemService.getAlerts(status as any);
  }

  @Put('siem/alerts/:alertId/status')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_AUDIT_LOGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update alert status' })
  async updateAlertStatus(
    @Param('alertId') alertId: string,
    @Body() body: { status: string },
  ) {
    await this.siemService.updateAlertStatus(alertId, body.status as any);
    return { success: true };
  }

  @Get('siem/dashboard')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_AUDIT_LOGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get security dashboard metrics' })
  async getSecurityDashboard(@Query('days') days?: string) {
    return this.siemService.getDashboardMetrics(
      days ? parseInt(days) : undefined,
    );
  }

  @Get('siem/search')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_AUDIT_LOGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search security events' })
  async searchEvents(@Query('q') query: string) {
    return this.siemService.searchEvents(query);
  }

  // ==================== Threat Detection Endpoints ====================

  @Get('threats/recent')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_AUDIT_LOGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recent threats' })
  async getRecentThreats(@Query('limit') limit?: string) {
    return this.threatDetectionService.getRecentThreats(
      limit ? parseInt(limit) : undefined,
    );
  }

  @Get('threats/stats')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_AUDIT_LOGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get threat statistics' })
  async getThreatStats() {
    return this.threatDetectionService.getThreatStats();
  }

  @Post('threats/block-ip')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_SETTINGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Block IP address' })
  async blockIp(@Body() body: { ip: string; durationSeconds?: number }) {
    await this.threatDetectionService.blockIp(body.ip, body.durationSeconds);
    return { success: true };
  }

  @Delete('threats/unblock-ip/:ip')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_SETTINGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unblock IP address' })
  async unblockIp(@Param('ip') ip: string) {
    await this.threatDetectionService.unblockIp(ip);
    return { success: true };
  }

  @Get('threats/blocked-ips')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(Permission.ADMIN_AUDIT_LOGS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get blocked IP addresses' })
  async getBlockedIps() {
    return this.threatDetectionService.getBlockedIps();
  }
}
