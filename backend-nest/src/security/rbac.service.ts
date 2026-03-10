import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export enum Permission {
  // Project permissions
  PROJECT_CREATE = 'project:create',
  PROJECT_READ = 'project:read',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  PROJECT_SHARE = 'project:share',

  // User permissions
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // Organization permissions
  ORG_CREATE = 'org:create',
  ORG_READ = 'org:read',
  ORG_UPDATE = 'org:update',
  ORG_DELETE = 'org:delete',
  ORG_MANAGE_MEMBERS = 'org:manage_members',

  // Admin permissions
  ADMIN_ACCESS = 'admin:access',
  ADMIN_USERS = 'admin:users',
  ADMIN_SETTINGS = 'admin:settings',
  ADMIN_AUDIT_LOGS = 'admin:audit_logs',

  // Analytics permissions
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',

  // Billing permissions
  BILLING_VIEW = 'billing:view',
  BILLING_MANAGE = 'billing:manage',
}

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
  VIEWER = 'VIEWER',
  GUEST = 'GUEST',
}

/**
 * Role-Based Access Control (RBAC) Service
 * Implements fine-grained permissions and role management
 */
@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  // Role-Permission mapping
  private readonly rolePermissions: Map<Role, Set<Permission>> = new Map([
    [Role.SUPER_ADMIN, new Set(Object.values(Permission))],
    [
      Role.ADMIN,
      new Set([
        Permission.PROJECT_CREATE,
        Permission.PROJECT_READ,
        Permission.PROJECT_UPDATE,
        Permission.PROJECT_DELETE,
        Permission.PROJECT_SHARE,
        Permission.USER_READ,
        Permission.USER_UPDATE,
        Permission.ORG_READ,
        Permission.ORG_UPDATE,
        Permission.ORG_MANAGE_MEMBERS,
        Permission.ANALYTICS_VIEW,
        Permission.ANALYTICS_EXPORT,
        Permission.BILLING_VIEW,
        Permission.BILLING_MANAGE,
      ]),
    ],
    [
      Role.MANAGER,
      new Set([
        Permission.PROJECT_CREATE,
        Permission.PROJECT_READ,
        Permission.PROJECT_UPDATE,
        Permission.PROJECT_DELETE,
        Permission.PROJECT_SHARE,
        Permission.USER_READ,
        Permission.ORG_READ,
        Permission.ANALYTICS_VIEW,
        Permission.BILLING_VIEW,
      ]),
    ],
    [
      Role.USER,
      new Set([
        Permission.PROJECT_CREATE,
        Permission.PROJECT_READ,
        Permission.PROJECT_UPDATE,
        Permission.PROJECT_DELETE,
        Permission.PROJECT_SHARE,
        Permission.USER_READ,
        Permission.ORG_READ,
      ]),
    ],
    [
      Role.VIEWER,
      new Set([
        Permission.PROJECT_READ,
        Permission.USER_READ,
        Permission.ORG_READ,
      ]),
    ],
    [Role.GUEST, new Set([Permission.PROJECT_READ])],
  ]);

  constructor(private readonly prisma: PrismaService) {
    this.logger.log('✓ RBAC service initialized');
  }

  /**
   * Check if role has permission
   */
  hasPermission(role: Role, permission: Permission): boolean {
    const permissions = this.rolePermissions.get(role);
    if (!permissions) {
      return false;
    }
    return permissions.has(permission);
  }

  /**
   * Check if user has permission
   */
  async userHasPermission(
    userId: string,
    permission: Permission,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || !user.role) {
      return false;
    }

    return this.hasPermission(user.role as Role, permission);
  }

  /**
   * Require permission (throws ForbiddenException if not authorized)
   */
  async requirePermission(
    userId: string,
    permission: Permission,
  ): Promise<void> {
    const hasPermission = await this.userHasPermission(userId, permission);

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing required permission: ${permission}`,
      );
    }
  }

  /**
   * Check if user can access resource
   */
  async canAccessResource(
    userId: string,
    resourceType: 'project' | 'organization',
    resourceId: string,
  ): Promise<boolean> {
    if (resourceType === 'project') {
      return this.canAccessProject(userId, resourceId);
    } else if (resourceType === 'organization') {
      return this.canAccessOrganization(userId, resourceId);
    }
    return false;
  }

  /**
   * Check if user can access project
   */
  private async canAccessProject(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          {
            collaborators: {
              some: { userId },
            },
          },
        ],
      },
    });

    return !!project;
  }

  /**
   * Check if user can access organization
   */
  private async canAccessOrganization(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    return !!member;
  }

  /**
   * Get user's effective permissions
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || !user.role) {
      return [];
    }

    const permissions = this.rolePermissions.get(user.role as Role);
    return permissions ? Array.from(permissions) : [];
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, role: Role): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    this.logger.log(`Role ${role} assigned to user: ${userId}`);
  }

  /**
   * Get user's role
   */
  async getUserRole(userId: string): Promise<Role | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return user?.role as Role | null;
  }

  /**
   * Check if user is admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === Role.ADMIN || role === Role.SUPER_ADMIN;
  }

  /**
   * Check if user is super admin
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === Role.SUPER_ADMIN;
  }

  /**
   * Get all roles
   */
  getAllRoles(): Role[] {
    return Object.values(Role);
  }

  /**
   * Get all permissions
   */
  getAllPermissions(): Permission[] {
    return Object.values(Permission);
  }

  /**
   * Get permissions for role
   */
  getRolePermissions(role: Role): Permission[] {
    const permissions = this.rolePermissions.get(role);
    return permissions ? Array.from(permissions) : [];
  }
}
