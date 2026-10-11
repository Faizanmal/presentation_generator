import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';
type SSOProvider = 'SAML' | 'OIDC' | 'AZURE_AD' | 'OKTA' | 'GOOGLE_WORKSPACE';

interface CreateOrganizationDto {
  name: string;
  slug: string;
  domain?: string;
}

interface UpdateOrganizationDto {
  name?: string;
  logo?: string;
  brandingEnabled?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  customCss?: string;
  customDomain?: string;
  settings?: Record<string, unknown>;
}

interface SSOConfigDto {
  provider: SSOProvider;
  // SAML
  entityId?: string;
  ssoUrl?: string;
  certificate?: string;
  // OIDC
  clientId?: string;
  clientSecret?: string;
  issuerUrl?: string;
}

interface InviteUserDto {
  email: string;
  role?: OrgRole | 'VIEWER';
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // ============================================
  // ORGANIZATION CRUD
  // ============================================

  /**
   * Create a new organization
   */
  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    // Check if slug is unique
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('Organization slug already taken');
    }

    // Create organization and add creator as owner
    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        domain: dto.domain,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: true,
      },
    });

    await this.logAuditEvent(
      organization.id,
      userId,
      'CREATE',
      'organization',
      organization.id,
    );

    return organization;
  }

  /**
   * Get organization by ID or slug
   */
  async getOrganization(idOrSlug: string) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        members: true,
        ssoConfigs: {
          select: {
            id: true,
            provider: true,
            isActive: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  /**
   * Get organizations for a user
   */
  async getUserOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
      },
    });

    return memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }));
  }

  /**
   * Primary organization for the signed-in user (owner first).
   */
  async getCurrentOrganization(userId: string) {
    const organizations = await this.getUserOrganizations(userId);
    if (organizations.length === 0) {
      throw new NotFoundException('You are not a member of any organization');
    }
    return (
      organizations.find((organization) => organization.role === 'OWNER') ||
      organizations[0]
    );
  }

  /**
   * Update organization settings
   */
  async updateOrganization(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationDto,
  ) {
    await this.ensureAdminAccess(organizationId, userId);

    const oldData = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...dto,
        settings: dto.settings as unknown as Prisma.InputJsonValue,
      },
    });

    await this.logAuditEvent(
      organizationId,
      userId,
      'UPDATE',
      'organization',
      organizationId,
      oldData as unknown as Prisma.InputJsonValue,
      dto as unknown as Prisma.InputJsonValue,
    );

    return organization;
  }

  /**
   * Delete organization
   */
  async deleteOrganization(organizationId: string, userId: string) {
    await this.ensureOwnerAccess(organizationId, userId);

    await this.logAuditEvent(
      organizationId,
      userId,
      'DELETE',
      'organization',
      organizationId,
    );

    return this.prisma.organization.delete({
      where: { id: organizationId },
    });
  }

  // ============================================
  // MEMBER MANAGEMENT
  // ============================================

  /**
   * Get organization members
   */
  async getMembers(organizationId: string, userId: string) {
    await this.ensureMemberAccess(organizationId, userId);

    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
    });

    // Get user details
    const userIds = members.map((m) => m.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, image: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return members.map((m) => ({
      ...m,
      user: userMap.get(m.userId),
    }));
  }

  private resolveInviteRole(role?: OrgRole | 'VIEWER'): OrgRole {
    if (role === 'VIEWER') {
      return 'MEMBER';
    }
    return role || 'MEMBER';
  }

  private invitationStatus(expiresAt: Date): 'PENDING' | 'EXPIRED' {
    return expiresAt < new Date() ? 'EXPIRED' : 'PENDING';
  }

  private buildInviteUrl(token: string) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    return `${frontendUrl}/invite/${token}`;
  }

  private async mapInvitation(invitation: {
    id: string;
    organizationId: string;
    email: string;
    role: OrgRole;
    token: string;
    invitedBy: string;
    createdAt: Date;
    expiresAt: Date;
  }) {
    const inviter = await this.prisma.user.findUnique({
      where: { id: invitation.invitedBy },
      select: { name: true, email: true },
    });

    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      status: this.invitationStatus(invitation.expiresAt),
      invitedById: invitation.invitedBy,
      invitedBy: {
        name: inviter?.name || null,
        email: inviter?.email || '',
      },
      token: invitation.token,
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString(),
      inviteUrl: this.buildInviteUrl(invitation.token),
    };
  }

  /**
   * Invite a user to the organization
   */
  async inviteUser(
    organizationId: string,
    invitedBy: string,
    dto: InviteUserDto,
  ) {
    await this.ensureAdminAccess(organizationId, invitedBy);

    const email = dto.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new BadRequestException('A valid email is required');
    }

    const role = this.resolveInviteRole(dto.role);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const existingMember = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: existingUser.id },
        },
      });

      if (existingMember) {
        throw new BadRequestException('User is already a member');
      }
    }

    const pending = await this.prisma.teamInvitation.findFirst({
      where: { organizationId, email },
    });
    if (pending && pending.expiresAt > new Date()) {
      throw new BadRequestException(
        'An invitation is already pending for this email',
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.teamInvitation.create({
      data: {
        organizationId,
        email,
        role,
        token,
        invitedBy,
        expiresAt,
      },
    });

    await this.logAuditEvent(
      organizationId,
      invitedBy,
      'INVITE',
      'member',
      invitation.id,
      null as unknown as Prisma.InputJsonValue,
      { email, role },
    );

    await this.sendInvitationEmail(
      organizationId,
      invitedBy,
      invitation.email,
      invitation.token,
    );

    return this.mapInvitation(invitation);
  }

  async listInvitations(organizationId: string, userId: string) {
    await this.ensureAdminAccess(organizationId, userId);
    const invitations = await this.prisma.teamInvitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      invitations.map((invitation) => this.mapInvitation(invitation)),
    );
  }

  async resendInvitation(
    organizationId: string,
    invitationId: string,
    userId: string,
  ) {
    await this.ensureAdminAccess(organizationId, userId);
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: { id: invitationId, organizationId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { token, expiresAt },
    });

    await this.sendInvitationEmail(
      organizationId,
      userId,
      updated.email,
      updated.token,
    );

    return this.mapInvitation(updated);
  }

  async cancelInvitation(
    organizationId: string,
    invitationId: string,
    userId: string,
  ) {
    await this.ensureAdminAccess(organizationId, userId);
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: { id: invitationId, organizationId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    await this.prisma.teamInvitation.delete({ where: { id: invitation.id } });
    return { success: true };
  }

  async bulkInvite(
    organizationId: string,
    invitedBy: string,
    emails: string[],
    role?: OrgRole | 'VIEWER',
  ) {
    const uniqueEmails = [
      ...new Set(
        emails.map((value) => value.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    let sent = 0;
    for (const email of uniqueEmails) {
      try {
        await this.inviteUser(organizationId, invitedBy, { email, role });
        sent += 1;
      } catch (error) {
        this.logger.warn(
          `Bulk invite skipped ${email}: ${(error as Error).message}`,
        );
      }
    }
    return { sent };
  }

  private async sendInvitationEmail(
    organizationId: string,
    invitedBy: string,
    email: string,
    token: string,
  ) {
    const [organization, inviter] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: invitedBy },
        select: { name: true, email: true },
      }),
    ]);

    try {
      await this.emailService.sendTeamInviteEmail(
        email,
        inviter?.name || inviter?.email || 'A teammate',
        organization?.name || 'the team',
        this.buildInviteUrl(token),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue team invite email: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    // Get user email and verify it matches
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.email !== invitation.email) {
      throw new ForbiddenException(
        'This invitation is for a different email address',
      );
    }

    // Add member
    await this.prisma.organizationMember.create({
      data: {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
      },
    });

    // Delete invitation
    await this.prisma.teamInvitation.delete({
      where: { id: invitation.id },
    });

    await this.logAuditEvent(
      invitation.organizationId,
      userId,
      'JOIN',
      'member',
      userId,
    );

    return { success: true };
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    role: OrgRole,
    updatedBy: string,
  ) {
    await this.ensureAdminAccess(organizationId, updatedBy);

    // Cannot demote the owner
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === 'OWNER' && role !== 'OWNER') {
      throw new BadRequestException('Cannot demote the owner');
    }

    const updated = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
    });

    await this.logAuditEvent(
      organizationId,
      updatedBy,
      'UPDATE',
      'member',
      memberId,
      { role: member.role },
      { role },
    );

    return updated;
  }

  /**
   * Remove a member
   */
  async removeMember(
    organizationId: string,
    memberId: string,
    removedBy: string,
  ) {
    await this.ensureAdminAccess(organizationId, removedBy);

    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === 'OWNER') {
      throw new BadRequestException('Cannot remove the owner');
    }

    await this.prisma.organizationMember.delete({
      where: { id: memberId },
    });

    await this.logAuditEvent(
      organizationId,
      removedBy,
      'REMOVE',
      'member',
      memberId,
    );

    return { success: true };
  }

  // ============================================
  // SSO CONFIGURATION
  // ============================================

  /**
   * Configure SSO for organization
   */
  async configureSso(
    organizationId: string,
    userId: string,
    dto: SSOConfigDto,
  ) {
    await this.ensureOwnerAccess(organizationId, userId);

    const ssoConfig = await this.prisma.sSOConfig.upsert({
      where: {
        organizationId_provider: { organizationId, provider: dto.provider },
      },
      update: {
        entityId: dto.entityId,
        ssoUrl: dto.ssoUrl,
        certificate: dto.certificate,
        clientId: dto.clientId,
        clientSecret: dto.clientSecret,
        issuerUrl: dto.issuerUrl,
      },
      create: {
        organizationId,
        provider: dto.provider,
        entityId: dto.entityId,
        ssoUrl: dto.ssoUrl,
        certificate: dto.certificate,
        clientId: dto.clientId,
        clientSecret: dto.clientSecret,
        issuerUrl: dto.issuerUrl,
      },
    });

    await this.logAuditEvent(
      organizationId,
      userId,
      'CONFIGURE',
      'sso',
      ssoConfig.id,
      null as unknown as Prisma.InputJsonValue,
      { provider: dto.provider },
    );

    return ssoConfig;
  }

  /**
   * Enable/disable SSO
   */
  async toggleSso(
    organizationId: string,
    ssoConfigId: string,
    isActive: boolean,
    userId: string,
  ) {
    await this.ensureOwnerAccess(organizationId, userId);

    const ssoConfig = await this.prisma.sSOConfig.update({
      where: { id: ssoConfigId },
      data: { isActive },
    });

    await this.logAuditEvent(
      organizationId,
      userId,
      isActive ? 'ENABLE' : 'DISABLE',
      'sso',
      ssoConfigId,
    );

    return ssoConfig;
  }

  /**
   * Get SSO configuration for domain
   */
  async getSsoConfigByDomain(domain: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { domain },
      include: {
        ssoConfigs: {
          where: { isActive: true },
        },
      },
    });

    if (!organization || organization.ssoConfigs.length === 0) {
      return null;
    }

    return organization.ssoConfigs[0];
  }

  // ============================================
  // WHITE-LABELING
  // ============================================

  /**
   * Get white-label configuration
   */
  async getWhiteLabelConfig(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        name: true,
        logo: true,
        brandingEnabled: true,
        primaryColor: true,
        secondaryColor: true,
        customCss: true,
        customDomain: true,
      },
    });

    if (!org || !org.brandingEnabled) {
      return null;
    }

    return org;
  }

  /**
   * Get organization by custom domain
   */
  async getOrganizationByCustomDomain(domain: string) {
    return this.prisma.organization.findUnique({
      where: { customDomain: domain },
    });
  }

  // ============================================
  // AUDIT LOGS
  // ============================================

  /**
   * Get audit logs for organization
   */
  async getAuditLogs(
    organizationId: string,
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    await this.ensureAdminAccess(organizationId, userId);

    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = { organizationId };

    if (options?.action) {
      where.action = options.action;
    }
    if (options?.resource) {
      where.resource = options.resource;
    }
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};

      if (options.startDate) where.createdAt.gte = options.startDate;

      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),

      this.prisma.auditLog.count({ where }),
    ]);

    // Get user details
    const userIds = [...new Set(logs.map((l) => l.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      logs: logs.map((l) => ({
        ...l,
        user: userMap.get(l.userId),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  private async logAuditEvent(
    organizationId: string | null,
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    oldValue?: Prisma.InputJsonValue,
    newValue?: Prisma.InputJsonValue,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        resource,
        resourceId,

        oldValue: oldValue ?? Prisma.DbNull,
        newValue: newValue ?? Prisma.DbNull,
        ipAddress,
        userAgent,
      },
    });
  }

  // ============================================
  // ACCESS CONTROL HELPERS
  // ============================================

  private async ensureMemberAccess(organizationId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    return member;
  }

  private async ensureAdminAccess(organizationId: string, userId: string) {
    const member = await this.ensureMemberAccess(organizationId, userId);

    if (member.role !== 'ADMIN' && member.role !== 'OWNER') {
      throw new ForbiddenException('Admin access required');
    }

    return member;
  }

  private async ensureOwnerAccess(organizationId: string, userId: string) {
    const member = await this.ensureMemberAccess(organizationId, userId);

    if (member.role !== 'OWNER') {
      throw new ForbiddenException('Owner access required');
    }

    return member;
  }
}
