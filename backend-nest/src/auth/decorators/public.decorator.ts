import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark an endpoint as public (no authentication required).
 * Use with a global JwtAuthGuard that checks for this metadata.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
