import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../../common/types/user.types';

export const ROLES_KEY = 'roles';

/**
 * Roles decorator to specify required roles for an endpoint
 */
export const Roles = (...roles: string[]) => {
  return (
    target: object,
    _key?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (descriptor) {
      Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value as object);
      return descriptor;
    }
    Reflect.defineMetadata(ROLES_KEY, roles, target);
    return target;
  };
};

/**
 * Guard that checks if user has required roles
 * Must be used after JwtAuthGuard
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
  private readonly DEMO_MODE = process.env.DEMO_MODE === 'true';

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userRole = user.role || 'USER';

    // DEMO MODE: Allow ADMIN role for demo user
    if (this.DEMO_MODE && userRole === 'ADMIN') {
      this.logger.debug(`[RolesGuard] DEMO MODE - Allowing ADMIN access`);
      return true;
    }

    const hasRole = requiredRoles.some((role) => userRole === role);

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

/**
 * Convenience guard that requires ADMIN role
 * Must be used after JwtAuthGuard
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);
  private readonly DEMO_MODE = process.env.DEMO_MODE === 'true';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // DEMO MODE: Allow ADMIN access for demo user
    if (this.DEMO_MODE && user.role === 'ADMIN') {
      this.logger.debug(`[AdminGuard] DEMO MODE - Allowing ADMIN access`);
      return true;
    }

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
