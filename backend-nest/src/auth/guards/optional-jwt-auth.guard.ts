import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that allows both authenticated and unauthenticated access
 * If user is authenticated, user object is attached to request
 * If not authenticated, request proceeds without user
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    // Don't throw error if no token provided

    return (user || null) as TUser;
  }
}
