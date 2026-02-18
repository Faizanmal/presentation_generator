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

      expect(limits.maxProjects).toBe(5);
      expect(limits.maxSlidesPerProject).toBe(15);
      expect(limits.aiGenerationsPerMonth).toBe(10);
      expect(limits.features.customBranding).toBe(false);
      expect(limits.features.advancedExport).toBe(false);
    });

    it('should return PRO tier limits', () => {
      const limits = service.getLimits('PRO');

      expect(limits.maxProjects).toBe(50);
      expect(limits.maxSlidesPerProject).toBe(100);
      expect(limits.aiGenerationsPerMonth).toBe(500);
      expect(limits.features.customBranding).toBe(true);
      expect(limits.features.advancedExport).toBe(true);
    });

    it('should return ENTERPRISE tier limits', () => {
      const limits = service.getLimits('ENTERPRISE');

      expect(limits.maxProjects).toBe(-1); // Unlimited
      expect(limits.maxSlidesPerProject).toBe(-1);
      expect(limits.aiGenerationsPerMonth).toBe(-1);
      expect(limits.features.videoExport).toBe(true);
      expect(limits.features.customBranding).toBe(true);
      expect(limits.features.prioritySupport).toBe(true);
    });

    it('should default to FREE tier for unknown tiers', () => {
      const limits = service.getLimits('UNKNOWN' as any);

      expect(limits.maxProjects).toBe(5);
    });
  });

  describe('utility methods', () => {
    it('should report unlimited correctly', () => {
      expect(service.isUnlimited(-1)).toBe(true);
      expect(service.isUnlimited(0)).toBe(false);
    });

    it('should expose limits for all tiers', () => {
      const free = service.getLimits('FREE');
      const pro = service.getLimits('PRO');
      const enterprise = service.getLimits('ENTERPRISE');

      expect(free.maxProjects).toBe(5);
      expect(pro.maxProjects).toBe(50);
      expect(enterprise.maxProjects).toBe(-1);
    });
  });
});
