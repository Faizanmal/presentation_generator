import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnterpriseComplianceService } from './enterprise-compliance.service';
import { EnterpriseComplianceController } from './enterprise-compliance.controller';
import { AuditLogService } from './audit-log.service';
import { DataResidencyService } from './data-residency.service';
import { ComplianceReportService } from './compliance-report.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [EnterpriseComplianceController],
  providers: [
    EnterpriseComplianceService,
    AuditLogService,
    DataResidencyService,
    ComplianceReportService,
  ],
  exports: [
    EnterpriseComplianceService,
    AuditLogService,
    DataResidencyService,
    ComplianceReportService,
  ],
})
export class EnterpriseComplianceModule {}
