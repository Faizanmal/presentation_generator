import { applyDecorators, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagGuard } from '../guards/feature-flag.guard';

// Custom decorator to apply guards to specific routes
export function Feature(name: string) {
  return applyDecorators(
    UseGuards(new FeatureFlagGuard(name, new ConfigService())),
  );
}
