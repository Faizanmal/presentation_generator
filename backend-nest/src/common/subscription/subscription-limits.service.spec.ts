import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionLimitsService } from './subscription-limits.service';

describe('SubscriptionLimitsService', () => {
  let service: SubscriptionLimitsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubscriptionLimitsService],
    }).compile();

    service = module.get<SubscriptionLimitsService>(SubscriptionLimitsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLimits', () => {
    it('should return FREE tier limits', () => {
      const limits = service.getLimits('FREE');

      expect(limits.maxProjects).toBe(3);
      expect(limits.maxSlidesPerProject).toBe(10);
      expect(limits.maxAIGenerationsPerMonth).toBe(10);
      expect(limits.aiFeatures.enhanceContent).toBe(true);
      expect(limits.aiFeatures.generatePresentations).toBe(false);
      expect(limits.exportFormats.pdf).toBe(true);
      expect(limits.exportFormats.pptx).toBe(false);
    });

    it('should return PRO tier limits', () => {
      const limits = service.getLimits('PRO');

      expect(limits.maxProjects).toBe(50);
      expect(limits.maxSlidesPerProject).toBe(100);
      expect(limits.maxAIGenerationsPerMonth).toBe(500);
      expect(limits.aiFeatures.generatePresentations).toBe(true);
      expect(limits.exportFormats.pptx).toBe(true);
      expect(limits.customBranding).toBe(true);
    });

    it('should return ENTERPRISE tier limits', () => {
      const limits = service.getLimits('ENTERPRISE');

      expect(limits.maxProjects).toBe(-1); // Unlimited
      expect(limits.maxSlidesPerProject).toBe(-1);
      expect(limits.maxAIGenerationsPerMonth).toBe(-1);
      expect(limits.aiFeatures.videoNarration).toBe(true);
      expect(limits.exportFormats.video).toBe(true);
      expect(limits.customBranding).toBe(true);
      expect(limits.prioritySupport).toBe(true);
    });

    it('should default to FREE tier for unknown tiers', () => {
      const limits = service.getLimits('UNKNOWN' as any);

      expect(limits.maxProjects).toBe(3);
    });
  });

  describe('canPerformAction', () => {
    it('should allow action within limits', () => {
      const result = service.canPerformAction('FREE', 'createProject', 2);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('should deny action at limit', () => {
      const result = service.canPerformAction('FREE', 'createProject', 3);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.upgradeRequired).toBe(true);
    });

    it('should allow unlimited actions for enterprise', () => {
      const result = service.canPerformAction('ENTERPRISE', 'createProject', 1000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1); // Unlimited
    });

    it('should check AI generation limits', () => {
      const freeResult = service.canPerformAction('FREE', 'generateAI', 10);
      expect(freeResult.allowed).toBe(false);

      const proResult = service.canPerformAction('PRO', 'generateAI', 10);
      expect(proResult.allowed).toBe(true);
    });
  });

  describe('hasFeature', () => {
    it('should check FREE tier features', () => {
      expect(service.hasFeature('FREE', 'collaboration')).toBe(false);
      expect(service.hasFeature('FREE', 'customBranding')).toBe(false);
      expect(service.hasFeature('FREE', 'basicTemplates')).toBe(true);
    });

    it('should check PRO tier features', () => {
      expect(service.hasFeature('PRO', 'collaboration')).toBe(true);
      expect(service.hasFeature('PRO', 'customBranding')).toBe(true);
      expect(service.hasFeature('PRO', 'prioritySupport')).toBe(false);
    });

    it('should check ENTERPRISE tier features', () => {
      expect(service.hasFeature('ENTERPRISE', 'collaboration')).toBe(true);
      expect(service.hasFeature('ENTERPRISE', 'prioritySupport')).toBe(true);
      expect(service.hasFeature('ENTERPRISE', 'sso')).toBe(true);
    });
  });

  describe('canExport', () => {
    it('should check export format availability', () => {
      expect(service.canExport('FREE', 'pdf')).toBe(true);
      expect(service.canExport('FREE', 'pptx')).toBe(false);
      expect(service.canExport('FREE', 'video')).toBe(false);

      expect(service.canExport('PRO', 'pptx')).toBe(true);
      expect(service.canExport('PRO', 'video')).toBe(false);

      expect(service.canExport('ENTERPRISE', 'video')).toBe(true);
    });
  });

  describe('getStorageLimit', () => {
    it('should return storage limits in bytes', () => {
      const free = service.getStorageLimit('FREE');
      const pro = service.getStorageLimit('PRO');
      const enterprise = service.getStorageLimit('ENTERPRISE');

      expect(free).toBe(100 * 1024 * 1024); // 100MB
      expect(pro).toBe(10 * 1024 * 1024 * 1024); // 10GB
      expect(enterprise).toBe(-1); // Unlimited
    });
  });

  describe('formatLimit', () => {
    it('should format limits for display', () => {
      expect(service.formatLimit(10)).toBe('10');
      expect(service.formatLimit(-1)).toBe('Unlimited');
      expect(service.formatLimit(0)).toBe('0');
    });
  });

  describe('getTierComparison', () => {
    it('should return comparison of all tiers', () => {
      const comparison = service.getTierComparison();

      expect(comparison).toHaveProperty('FREE');
      expect(comparison).toHaveProperty('PRO');
      expect(comparison).toHaveProperty('ENTERPRISE');

      expect(comparison.FREE.maxProjects).toBe(3);
      expect(comparison.PRO.maxProjects).toBe(50);
      expect(comparison.ENTERPRISE.maxProjects).toBe('Unlimited');
    });
  });
});
