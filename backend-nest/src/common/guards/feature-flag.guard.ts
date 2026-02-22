import { CanActivate } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class FeatureFlagGuard implements CanActivate {
  constructor(
    private featureName: string,
    private configService: ConfigService,
  ) {}

  canActivate(): boolean {
    const isEnabled = this.configService.get<boolean>(
      `features.${this.featureName}`,
    );
    return isEnabled !== false; // Default allows access if not set or set to true
  }
}
