import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that allows both authenticated and unauthenticated access
 * If user is authenticated, user object is attached to request
 * If not authenticated, request proceeds without user
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  // ⚠️ DEMO MODE: Set to true to auto-attach mock user
  private readonly DEMO_MODE = process.env.DEMO_MODE === 'true';

  canActivate(context: ExecutionContext) {
    // DEMO MODE: Always attach mock user
    if (this.DEMO_MODE) {
      const request = context.switchToHttp().getRequest();
      const mockUser = {
        sub: 'demo-user-123',
        id: 'demo-user-123',
        userId: 'demo-user-123',
        email: 'demo@example.com',
        name: 'Demo User',
        role: 'ADMIN',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      request.user = mockUser;
      this.logger.debug(
        `[OptionalJwtAuthGuard] DEMO MODE ACTIVE - Mock user attached`,
      );
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    // DEMO MODE: Return mock user if not provided
    if (this.DEMO_MODE && !user) {
      return {
        sub: 'demo-user-123',
        id: 'demo-user-123',
        userId: 'demo-user-123',
        email: 'demo@example.com',
        name: 'Demo User',
        role: 'ADMIN',
      } as TUser;
    }

    // Don't throw error if no token provided
    return (user || null) as TUser;
  }
}
