import { PLAN_LIMITS, canExportFormat, getPlanLimits } from './plan-limits';

describe('plan-limits', () => {
  describe('getPlanLimits', () => {
    it('defaults unknown plans to FREE', () => {
      expect(getPlanLimits('unknown').presentations).toBe(
        PLAN_LIMITS.FREE.presentations,
      );
    });

    it('exposes aligned presentation counts', () => {
      expect(PLAN_LIMITS.FREE.presentations).toBe(3);
      expect(PLAN_LIMITS.PRO.presentations).toBe(100);
      expect(PLAN_LIMITS.ENTERPRISE.presentations).toBe(1000);
    });
  });

  describe('canExportFormat', () => {
    it('allows FREE html/json and blocks pdf/pptx', () => {
      expect(canExportFormat('FREE', 'html')).toBe(true);
      expect(canExportFormat('FREE', 'json')).toBe(true);
      expect(canExportFormat('FREE', 'pdf')).toBe(false);
      expect(canExportFormat('FREE', 'pptx')).toBe(false);
    });

    it('allows PRO all export formats', () => {
      expect(canExportFormat('PRO', 'pdf')).toBe(true);
      expect(canExportFormat('PRO', 'pptx')).toBe(true);
    });
  });
});
