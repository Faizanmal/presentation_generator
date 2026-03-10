import { SetMetadata } from '@nestjs/common';
import { Permission } from '../rbac.service';

/**
 * Decorator to require specific permission
 * Usage: @RequirePermission(Permission.ADMIN_USERS)
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata('permission', permission);
