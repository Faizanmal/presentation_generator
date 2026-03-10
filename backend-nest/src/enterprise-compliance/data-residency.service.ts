import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export type DataRegion =
  | 'us-east'
  | 'us-west'
  | 'eu-west'
  | 'eu-central'
  | 'ap-southeast'
  | 'ap-northeast';

export interface RegionConfig {
  id: DataRegion;
  name: string;
  location: string;
  storageEndpoint: string;
  databaseEndpoint: string;
  cdnEndpoint: string;
  complianceFrameworks: string[];
  isActive: boolean;
}

export interface DataResidencyPolicy {
  organizationId: string;
  primaryRegion: DataRegion;
  allowedRegions: DataRegion[];
  dataReplication: boolean;
  replicationRegions?: DataRegion[];
  enforceGeoRestriction: boolean;
  gdprCompliant: boolean;
  hipaaCompliant: boolean;
  socCompliant: boolean;
}

export interface DataLocation {
  resourceType: string;
  resourceId: string;
  region: DataRegion;
  storageType: 'database' | 'blob' | 'cache';
  createdAt: Date;
  lastAccessed?: Date;
}

@Injectable()
export class DataResidencyService {
  private readonly logger = new Logger(DataResidencyService.name);

  private readonly regions: RegionConfig[] = [
    {
      id: 'us-east',
      name: 'US East (Virginia)',
      location: 'Virginia, USA',
      storageEndpoint: 's3.us-east-1.amazonaws.com',
      databaseEndpoint: 'us-east-1.rds.amazonaws.com',
      cdnEndpoint: 'us-east-1.cloudfront.net',
      complianceFrameworks: ['SOC2', 'HIPAA'],
      isActive: true,
    },
    {
      id: 'us-west',
      name: 'US West (Oregon)',
      location: 'Oregon, USA',
      storageEndpoint: 's3.us-west-2.amazonaws.com',
      databaseEndpoint: 'us-west-2.rds.amazonaws.com',
      cdnEndpoint: 'us-west-2.cloudfront.net',
      complianceFrameworks: ['SOC2', 'HIPAA'],
      isActive: true,
    },
    {
      id: 'eu-west',
      name: 'EU West (Ireland)',
      location: 'Dublin, Ireland',
      storageEndpoint: 's3.eu-west-1.amazonaws.com',
      databaseEndpoint: 'eu-west-1.rds.amazonaws.com',
      cdnEndpoint: 'eu-west-1.cloudfront.net',
      complianceFrameworks: ['GDPR', 'SOC2'],
      isActive: true,
    },
    {
      id: 'eu-central',
      name: 'EU Central (Frankfurt)',
      location: 'Frankfurt, Germany',
      storageEndpoint: 's3.eu-central-1.amazonaws.com',
      databaseEndpoint: 'eu-central-1.rds.amazonaws.com',
      cdnEndpoint: 'eu-central-1.cloudfront.net',
      complianceFrameworks: ['GDPR', 'SOC2'],
      isActive: true,
    },
    {
      id: 'ap-southeast',
      name: 'Asia Pacific (Singapore)',
      location: 'Singapore',
      storageEndpoint: 's3.ap-southeast-1.amazonaws.com',
      databaseEndpoint: 'ap-southeast-1.rds.amazonaws.com',
      cdnEndpoint: 'ap-southeast-1.cloudfront.net',
      complianceFrameworks: ['SOC2'],
      isActive: true,
    },
    {
      id: 'ap-northeast',
      name: 'Asia Pacific (Tokyo)',
      location: 'Tokyo, Japan',
      storageEndpoint: 's3.ap-northeast-1.amazonaws.com',
      databaseEndpoint: 'ap-northeast-1.rds.amazonaws.com',
      cdnEndpoint: 'ap-northeast-1.cloudfront.net',
      complianceFrameworks: ['SOC2'],
      isActive: true,
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get available regions
   */
  getAvailableRegions(): RegionConfig[] {
    return this.regions.filter((r) => r.isActive);
  }

  /**
   * Get region by ID
   */
  getRegion(regionId: DataRegion): RegionConfig | undefined {
    return this.regions.find((r) => r.id === regionId);
  }

  /**
   * Get regions by compliance framework
   */
  getRegionsByCompliance(framework: string): RegionConfig[] {
    return this.regions.filter(
      (r) => r.isActive && r.complianceFrameworks.includes(framework),
    );
  }

  /**
   * Set data residency policy for organization
   */
  async setPolicy(
    organizationId: string,
    policy: Omit<DataResidencyPolicy, 'organizationId'>,
  ): Promise<DataResidencyPolicy> {
    // Validate regions
    const primaryRegion = this.getRegion(policy.primaryRegion);
    if (!primaryRegion) {
      throw new BadRequestException('Invalid primary region');
    }

    for (const region of policy.allowedRegions) {
      if (!this.getRegion(region)) {
        throw new BadRequestException(`Invalid region: ${region}`);
      }
    }

    // Check compliance requirements
    if (
      policy.gdprCompliant &&
      !primaryRegion.complianceFrameworks.includes('GDPR')
    ) {
      throw new BadRequestException(
        'Selected primary region does not support GDPR compliance. Please select EU West or EU Central.',
      );
    }

    if (
      policy.hipaaCompliant &&
      !primaryRegion.complianceFrameworks.includes('HIPAA')
    ) {
      throw new BadRequestException(
        'Selected primary region does not support HIPAA compliance. Please select a US region.',
      );
    }

    await this.prisma.dataResidencyPolicy.upsert({
      where: { organizationId },
      update: {
        primaryRegion: policy.primaryRegion,
        allowedRegions: policy.allowedRegions,
        dataReplication: policy.dataReplication,
        replicationRegions: policy.replicationRegions || [],
        enforceGeoRestriction: policy.enforceGeoRestriction,
        gdprCompliant: policy.gdprCompliant,
        hipaaCompliant: policy.hipaaCompliant,
        socCompliant: policy.socCompliant,
      },
      create: {
        organizationId,
        primaryRegion: policy.primaryRegion,
        allowedRegions: policy.allowedRegions,
        dataReplication: policy.dataReplication,
        replicationRegions: policy.replicationRegions || [],
        enforceGeoRestriction: policy.enforceGeoRestriction,
        gdprCompliant: policy.gdprCompliant,
        hipaaCompliant: policy.hipaaCompliant,
        socCompliant: policy.socCompliant,
      },
    });

    this.logger.log(
      `Data residency policy updated for organization ${organizationId}`,
    );

    return { organizationId, ...policy };
  }

  /**
   * Get data residency policy for organization
   */
  async getPolicy(organizationId: string): Promise<DataResidencyPolicy | null> {
    const policy = await this.prisma.dataResidencyPolicy.findUnique({
      where: { organizationId },
    });

    if (!policy) {
      return null;
    }

    return {
      organizationId: policy.organizationId,
      primaryRegion: policy.primaryRegion as DataRegion,
      allowedRegions: policy.allowedRegions as DataRegion[],
      dataReplication: policy.dataReplication,
      replicationRegions: policy.replicationRegions as DataRegion[],
      enforceGeoRestriction: policy.enforceGeoRestriction,
      gdprCompliant: policy.gdprCompliant,
      hipaaCompliant: policy.hipaaCompliant,
      socCompliant: policy.socCompliant,
    };
  }

  /**
   * Check if data access is allowed from a region
   */
  async isAccessAllowed(
    organizationId: string,
    accessRegion: DataRegion,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const policy = await this.getPolicy(organizationId);

    if (!policy) {
      return { allowed: true }; // No policy = no restrictions
    }

    if (!policy.enforceGeoRestriction) {
      return { allowed: true };
    }

    if (policy.allowedRegions.includes(accessRegion)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `Access from region ${accessRegion} is not allowed. Allowed regions: ${policy.allowedRegions.join(', ')}`,
    };
  }

  /**
   * Get data location map for organization
   */
  async getDataLocationMap(organizationId: string): Promise<{
    summary: Record<DataRegion, { count: number; sizeBytes: number }>;
    byType: Record<string, DataRegion[]>;
  }> {
    const locations = await this.prisma.dataLocation.findMany({
      where: { organizationId },
    });

    const summary: Record<DataRegion, { count: number; sizeBytes: number }> =
      {} as Record<DataRegion, { count: number; sizeBytes: number }>;
    const byType: Record<string, DataRegion[]> = {};

    for (const loc of locations) {
      const region = loc.region as DataRegion;

      if (!summary[region]) {
        summary[region] = { count: 0, sizeBytes: 0 };
      }
      summary[region].count++;
      summary[region].sizeBytes += loc.sizeBytes || 0;

      if (!byType[loc.resourceType]) {
        byType[loc.resourceType] = [];
      }
      if (!byType[loc.resourceType].includes(region)) {
        byType[loc.resourceType].push(region);
      }
    }

    return { summary, byType };
  }

  /**
   * Request data migration to new region
   */
  async requestDataMigration(
    organizationId: string,
    targetRegion: DataRegion,
    options: {
      migrateProjects?: boolean;
      migrateAssets?: boolean;
      migrateBackups?: boolean;
      scheduledAt?: Date;
    } = {},
  ): Promise<{ migrationId: string; estimatedDuration: string }> {
    const region = this.getRegion(targetRegion);
    if (!region) {
      throw new BadRequestException('Invalid target region');
    }

    // Create migration job
    const migration = await this.prisma.dataMigration.create({
      data: {
        organizationId,
        targetRegion,
        status: 'pending',
        migrateProjects: options.migrateProjects ?? true,
        migrateAssets: options.migrateAssets ?? true,
        migrateBackups: options.migrateBackups ?? false,
        scheduledAt: options.scheduledAt,
      },
    });

    // Estimate duration based on data size
    const dataSize = await this.getOrganizationDataSize(organizationId);
    const estimatedHours = Math.ceil(dataSize / (100 * 1024 * 1024)); // ~100MB/hour
    const estimatedDuration =
      estimatedHours > 24
        ? `${Math.ceil(estimatedHours / 24)} days`
        : `${estimatedHours} hours`;

    this.logger.log(
      `Data migration requested for org ${organizationId} to ${targetRegion}`,
    );

    return { migrationId: migration.id, estimatedDuration };
  }

  /**
   * Get GDPR-compliant data export
   */
  async exportUserData(
    userId: string,
    organizationId: string,
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    // Collect all user data
    const userData = await this.collectUserData(userId, organizationId);

    // Generate export file
    const exportData = JSON.stringify(userData, null, 2);
    const exportKey = `gdpr-exports/${organizationId}/${userId}/${Date.now()}.json`;

    // TODO: Upload to S3 in the correct region

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiration

    // Log the export request
    await this.prisma.gdprRequest.create({
      data: {
        userId,
        organizationId,
        type: 'export',
        status: 'completed',
        completedAt: new Date(),
        exportKey,
      },
    });

    return {
      downloadUrl: `https://storage.example.com/${exportKey}`,
      expiresAt,
    };
  }

  /**
   * Request GDPR data deletion
   */
  async requestDataDeletion(
    userId: string,
    organizationId: string,
    options: {
      deleteProjects?: boolean;
      deleteComments?: boolean;
      deleteAnalytics?: boolean;
      retainAuditLogs?: boolean;
    } = {},
  ): Promise<{ requestId: string; estimatedCompletion: Date }> {
    const request = await this.prisma.gdprRequest.create({
      data: {
        userId,
        organizationId,
        type: 'deletion',
        status: 'pending',
        options: options as object,
      },
    });

    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + 30); // 30-day processing

    this.logger.log(`GDPR deletion request created: ${request.id}`);

    return { requestId: request.id, estimatedCompletion };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async getOrganizationDataSize(
    organizationId: string,
  ): Promise<number> {
    const locations = await this.prisma.dataLocation.aggregate({
      where: { organizationId },
      _sum: { sizeBytes: true },
    });

    return locations._sum.sizeBytes || 0;
  }

  private async collectUserData(
    userId: string,
    organizationId: string,
  ): Promise<object> {
    const [user, projects, activities] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          settings: true,
        },
      }),
      this.prisma.project.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.activityLog.findMany({
        where: { userId },
        select: {
          id: true,
          action: true,
          createdAt: true,
        },
        take: 1000,
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      user,
      projects,
      activities,
    };
  }
}
