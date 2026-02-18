import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

interface BrandingConfig {
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily?: string;
  customCss?: string;
  appName: string;
  hidePoweredBy?: boolean;
}

interface FeatureConfig {
  aiGeneration: boolean;
  collaboration: boolean;
  templates: boolean;
  export: boolean;
  analytics: boolean;
  customDomain: boolean;
}

type PlanType = 'starter' | 'professional' | 'enterprise';

@Injectable()
export class WhiteLabelSdkService {
  private readonly logger = new Logger(WhiteLabelSdkService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create SDK configuration for organization
   */
  async createSdkConfiguration(
    organizationId: string,
    config: {
      name: string;
      branding: BrandingConfig;
      features: FeatureConfig;
      allowedDomains: string[];
      plan?: PlanType;
    },
  ) {
    // Generate SDK key
    const sdkKey = `sdk_${crypto.randomBytes(24).toString('hex')}`;

    return this.prisma.sDKConfiguration.create({
      data: {
        organizationId,
        name: config.name,
        sdkKey,
        branding: config.branding as object,
        features: config.features as object,
        allowedDomains: config.allowedDomains,
        plan: config.plan || 'starter',
        status: 'active',
      },
    });
  }

  /**
   * Get SDK configuration
   */
  async getConfiguration(sdkKey: string) {
    const config = await this.prisma.sDKConfiguration.findFirst({
      where: { sdkKey, status: 'active' },
    });

    if (!config) {
      throw new NotFoundException('SDK configuration not found');
    }

    return config;
  }

  /**
   * Update SDK configuration
   */
  async updateConfiguration(
    configId: string,
    organizationId: string,
    updates: Partial<{
      name: string;
      branding: BrandingConfig;
      features: FeatureConfig;
      allowedDomains: string[];
    }>,
  ) {
    const existing = await this.prisma.sDKConfiguration.findUnique({
      where: { id: configId },
    });

    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundException('Configuration not found');
    }

    return this.prisma.sDKConfiguration.update({
      where: { id: configId },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.branding && { branding: updates.branding as object }),
        ...(updates.features && { features: updates.features as object }),
        ...(updates.allowedDomains && {
          allowedDomains: updates.allowedDomains,
        }),
      },
    });
  }

  /**
   * Create SDK instance for a client
   */
  async createInstance(
    sdkConfigId: string,
    clientInfo: {
      domain: string;
      clientName: string;
      customBranding?: Partial<BrandingConfig>;
    },
  ) {
    const config = await this.prisma.sDKConfiguration.findUnique({
      where: { id: sdkConfigId },
    });

    if (!config || config.status !== 'active') {
      throw new NotFoundException('SDK configuration not found');
    }

    // Check domain is allowed
    if (
      !config.allowedDomains.includes(clientInfo.domain) &&
      !config.allowedDomains.includes('*')
    ) {
      throw new BadRequestException('Domain not allowed');
    }

    const instanceKey = `inst_${crypto.randomBytes(16).toString('hex')}`;

    return this.prisma.sDKInstance.create({
      data: {
        configId: sdkConfigId,
        instanceKey,
        domain: clientInfo.domain,
        clientName: clientInfo.clientName,
        customBranding: clientInfo.customBranding as object,
        status: 'active',
      },
    });
  }

  /**
   * Get embed code for SDK
   */
  getEmbedCode(
    sdkKey: string,
    options?: {
      containerId?: string;
      theme?: 'light' | 'dark';
      locale?: string;
    },
  ) {
    const baseUrl = this.configService.get(
      'SDK_CDN_URL',
      'https://sdk.example.com',
    );
    const containerId = options?.containerId || 'presentation-editor';

    return {
      script: `<script src="${baseUrl}/v1/sdk.js" data-sdk-key="${sdkKey}"></script>`,
      container: `<div id="${containerId}"></div>`,
      initialization: `
<script>
  window.PresentationSDK.init({
    sdkKey: '${sdkKey}',
    container: '#${containerId}',
    theme: '${options?.theme || 'light'}',
    locale: '${options?.locale || 'en'}',
    onReady: function() {
      console.log('SDK ready');
    },
    onError: function(error) {
      console.error('SDK error:', error);
    }
  });
</script>`,
      fullExample: `
<!DOCTYPE html>
<html>
<head>
  <title>Embedded Presentation Editor</title>
  <script src="${baseUrl}/v1/sdk.js" data-sdk-key="${sdkKey}"></script>
</head>
<body>
  <div id="${containerId}" style="width: 100%; height: 600px;"></div>
  <script>
    window.PresentationSDK.init({
      sdkKey: '${sdkKey}',
      container: '#${containerId}',
      theme: '${options?.theme || 'light'}',
      locale: '${options?.locale || 'en'}'
    });
  </script>
</body>
</html>`,
    };
  }

  /**
   * Get React component code
   */
  getReactComponent(sdkKey: string) {
    return `
import { PresentationEditor } from '@presentation-sdk/react';

function MyPresentationEditor() {
  return (
    <PresentationEditor
      sdkKey="${sdkKey}"
      theme="light"
      onSave={(data) => console.log('Saved:', data)}
      onExport={(format, blob) => console.log('Exported:', format)}
      style={{ width: '100%', height: '600px' }}
    />
  );
}

export default MyPresentationEditor;
`;
  }

  /**
   * Track SDK usage
   */
  async trackUsage(
    instanceKey: string,
    event: {
      type: string;
      metadata?: object;
    },
  ) {
    const instance = await this.prisma.sDKInstance.findFirst({
      where: { instanceKey },
    });

    if (!instance) return;

    await this.prisma.sDKInstance.update({
      where: { id: instance.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    // In production, would also log detailed usage events
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(configId: string) {
    const instances = await this.prisma.sDKInstance.findMany({
      where: { configId },
    });

    const totalUsage = instances.reduce((sum, i) => sum + i.usageCount, 0);
    const activeInstances = instances.filter(
      (i) => i.status === 'active',
    ).length;

    return {
      totalInstances: instances.length,
      activeInstances,
      totalUsage,
      instancesByDomain: instances.map((i) => ({
        domain: i.domain,
        clientName: i.clientName,
        usage: i.usageCount,
        lastUsed: i.lastUsedAt,
      })),
    };
  }

  /**
   * List organization's SDK configurations
   */
  async listConfigurations(organizationId: string) {
    return this.prisma.sDKConfiguration.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { instances: true },
        },
      },
    });
  }

  /**
   * Revoke SDK configuration
   */
  async revokeConfiguration(configId: string, organizationId: string) {
    const config = await this.prisma.sDKConfiguration.findUnique({
      where: { id: configId },
    });

    if (!config || config.organizationId !== organizationId) {
      throw new NotFoundException('Configuration not found');
    }

    return this.prisma.sDKConfiguration.update({
      where: { id: configId },
      data: { status: 'revoked' },
    });
  }

  /**
   * Generate SDK documentation
   */
  getDocumentation() {
    return {
      overview:
        'The Presentation SDK allows you to embed our presentation editor into your application.',
      quickStart: {
        steps: [
          '1. Create an SDK configuration in your dashboard',
          '2. Add the SDK script to your HTML',
          '3. Initialize with your SDK key',
          '4. Optionally customize branding and features',
        ],
      },
      methods: [
        { name: 'init(config)', description: 'Initialize the SDK' },
        {
          name: 'createPresentation()',
          description: 'Create a new presentation',
        },
        {
          name: 'loadPresentation(id)',
          description: 'Load an existing presentation',
        },
        {
          name: 'exportPresentation(format)',
          description: 'Export to PDF, PPTX, etc.',
        },
        { name: 'destroy()', description: 'Clean up SDK instance' },
      ],
      events: [
        { name: 'onReady', description: 'Fired when SDK is ready' },
        { name: 'onSave', description: 'Fired when presentation is saved' },
        { name: 'onExport', description: 'Fired when export completes' },
        { name: 'onError', description: 'Fired on any error' },
      ],
    };
  }
}
