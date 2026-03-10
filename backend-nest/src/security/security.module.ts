import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { EncryptionService } from './encryption.service';
import { MfaService } from './mfa.service';
import { RbacService } from './rbac.service';
import { ThreatDetectionService } from './threat-detection.service';
import { ComplianceService } from './compliance.service';
import { DataMaskingService } from './data-masking.service';
import { TokenizationService } from './tokenization.service';
import { SiemService } from './siem.service';
import { BackupService } from './backup.service';
import { SamlService } from './saml.service';
import { SecurityController } from './security.controller';
import { PermissionGuard } from './guards/permission.guard';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Global Security Module
 * Provides comprehensive security services across the application
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(), // For automated backups
  ],
  controllers: [SecurityController],
  providers: [
    EncryptionService,
    MfaService,
    RbacService,
    ThreatDetectionService,
    ComplianceService,
    DataMaskingService,
    TokenizationService,
    SiemService,
    BackupService,
    SamlService,
    PermissionGuard,
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
  exports: [
    EncryptionService,
    MfaService,
    RbacService,
    ThreatDetectionService,
    ComplianceService,
    DataMaskingService,
    TokenizationService,
    SiemService,
    BackupService,
    SamlService,
  ],
})
export class SecurityModule {}
