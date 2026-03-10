import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Guard that validates the user belongs to the specified organization.
 * Expects organizationId to be in route params or body.
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const organizationId =
      request.params?.organizationId ||
      request.body?.organizationId ||
      request.query?.organizationId;

    if (!organizationId) {
      // If no organizationId is specified, allow access (handled by controller logic)
      return true;
    }

    // Check if user is a member of the organization
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: user.id || user.sub,
        organizationId,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    // Attach organization membership to request for downstream use
    request.organizationMembership = membership;
    return true;
  }
}
