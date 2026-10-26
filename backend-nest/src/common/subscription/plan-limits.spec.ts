import { ForbiddenException } from '@nestjs/common';
import {
  PLAN_LIMITS,
  PLAN_LIMIT_CODES,
  aiLimitMessage,
  canExportFormat,
  getPlanLimits,
  planLimitForbidden,
  presentationsLimitMessage,
} from './plan-limits';

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

  describe('planLimitForbidden', () => {
    it('embeds a stable code and details for the UI', () => {
      const err = planLimitForbidden(
        PLAN_LIMIT_CODES.PRESENTATIONS,
        presentationsLimitMessage(3, 3, 'FREE'),
        { used: 3, limit: 3, plan: 'FREE' },
      );
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = err.getResponse() as Record<string, unknown>;
      expect(body.code).toBe(PLAN_LIMIT_CODES.PRESENTATIONS);
      expect(body.message).toBe(
        "You've used 3 of 3 presentations on the Free plan",
      );
      expect(body.details).toEqual({ used: 3, limit: 3, plan: 'FREE' });
    });

    it('formats AI limit messages', () => {
      expect(aiLimitMessage(10, 10, 'FREE')).toBe(
        "You've used 10 of 10 AI credits on the Free plan",
      );
    });
  });
});
