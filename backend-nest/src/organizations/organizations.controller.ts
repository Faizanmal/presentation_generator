import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // ============================================
  // ORGANIZATION CRUD
  // ============================================

  @Get()
  async getUserOrganizations(@Request() req: any) {
    return this.organizationsService.getUserOrganizations(req.user.id);
  }

  @Post()
  async createOrganization(
    @Request() req: any,
    @Body() body: { name: string; slug: string; domain?: string },
  ) {
    return this.organizationsService.createOrganization(req.user.id, body);
  }

  @Get(':id')
  async getOrganization(@Param('id') id: string) {
    return this.organizationsService.getOrganization(id);
  }

  @Patch(':id')
  async updateOrganization(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      logo?: string;
      brandingEnabled?: boolean;
      primaryColor?: string;
      secondaryColor?: string;
      customCss?: string;
      customDomain?: string;
      settings?: any;
    },
  ) {
    return this.organizationsService.updateOrganization(id, req.user.id, body);
  }

  @Delete(':id')
  async deleteOrganization(@Request() req: any, @Param('id') id: string) {
    return this.organizationsService.deleteOrganization(id, req.user.id);
  }

  // ============================================
  // MEMBER MANAGEMENT
  // ============================================

  @Get(':id/members')
  async getMembers(@Request() req: any, @Param('id') id: string) {
    return this.organizationsService.getMembers(id, req.user.id);
  }

  @Post(':id/members/invite')
  async inviteMember(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { email: string; role?: 'OWNER' | 'ADMIN' | 'MEMBER' },
  ) {
    return this.organizationsService.inviteUser(id, req.user.id, body);
  }

  @Patch(':id/members/:memberId')
  async updateMemberRole(
    @Request() req: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: { role: 'OWNER' | 'ADMIN' | 'MEMBER' },
  ) {
    return this.organizationsService.updateMemberRole(
      id,
      memberId,
      body.role,
      req.user.id,
    );
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Request() req: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.organizationsService.removeMember(id, memberId, req.user.id);
  }

  // ============================================
  // SSO CONFIGURATION
  // ============================================

  @Post(':id/sso')
  async configureSso(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      provider: 'SAML' | 'OIDC' | 'AZURE_AD' | 'OKTA' | 'GOOGLE_WORKSPACE';
      entityId?: string;
      ssoUrl?: string;
      certificate?: string;
      clientId?: string;
      clientSecret?: string;
      issuerUrl?: string;
    },
  ) {
    return this.organizationsService.configureSso(id, req.user.id, body);
  }

  @Patch(':id/sso/:ssoId/toggle')
  async toggleSso(
    @Request() req: any,
    @Param('id') id: string,
    @Param('ssoId') ssoId: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.organizationsService.toggleSso(
      id,
      ssoId,
      body.isActive,
      req.user.id,
    );
  }

  // ============================================
  // WHITE-LABELING
  // ============================================

  @Get(':id/branding')
  async getWhiteLabelConfig(@Param('id') id: string) {
    return this.organizationsService.getWhiteLabelConfig(id);
  }

  // ============================================
  // AUDIT LOGS
  // ============================================

  @Get(':id/audit-logs')
  async getAuditLogs(
    @Request() req: any,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.organizationsService.getAuditLogs(id, req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      action,
      resource,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }
}

// Separate controller for public invitation endpoint
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  async acceptInvitation(@Request() req: any, @Param('token') token: string) {
    return this.organizationsService.acceptInvitation(token, req.user.id);
  }
}
