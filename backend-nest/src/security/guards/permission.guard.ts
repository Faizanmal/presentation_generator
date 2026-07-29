import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService, Permission } from '../rbac.service';

/**
 * Permission Guard
 * Checks if user has required permission
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);
  private readonly DEMO_MODE = process.env.DEMO_MODE === 'true';

  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<Permission>(
      'permission',
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // DEMO MODE: Allow all permissions for demo user
    if (this.DEMO_MODE && user.role === 'ADMIN') {
      this.logger.debug(
        `[PermissionGuard] DEMO MODE - Allowing all permissions`,
      );
      return true;
    }

    const hasPermission = await this.rbacService.userHasPermission(
      user.userId,
      requiredPermission,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing required permission: ${requiredPermission}`,
      );
    }

    return true;
  }
}
