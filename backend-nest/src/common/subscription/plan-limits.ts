/**
 * Single source of truth for plan limits (backend).
 * Keep in sync with frontend/src/lib/plans.ts
 */

export type PlanId = 'FREE' | 'PRO' | 'ENTERPRISE';

export type ExportFormat = 'html' | 'json' | 'pdf' | 'pptx';

export interface PlanLimitsConfig {
  id: PlanId;
  name: string;
  priceMonthly: number;
  presentations: number;
  aiGenerationsPerMonth: number;
  thinkingCreditsPerMonth: number;
  exports: Record<ExportFormat, boolean>;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimitsConfig> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    priceMonthly: 0,
    presentations: 3,
    aiGenerationsPerMonth: 10,
    thinkingCreditsPerMonth: 0,
    exports: {
      html: true,
      json: true,
      pdf: false,
      pptx: false,
    },
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    priceMonthly: 29,
    presentations: 100,
    aiGenerationsPerMonth: 1000,
    thinkingCreditsPerMonth: 5,
    exports: {
      html: true,
      json: true,
      pdf: true,
      pptx: true,
    },
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    priceMonthly: 199,
    presentations: 1000,
    aiGenerationsPerMonth: 50000,
    thinkingCreditsPerMonth: 250,
    exports: {
      html: true,
      json: true,
      pdf: true,
      pptx: true,
    },
  },
};

export function getPlanLimits(
  plan: string | null | undefined,
): PlanLimitsConfig {
  const key = (plan || 'FREE').toUpperCase() as PlanId;
  return PLAN_LIMITS[key] ?? PLAN_LIMITS.FREE;
}

export function canExportFormat(
  plan: string | null | undefined,
  format: ExportFormat,
): boolean {
  const normalized = format.toLowerCase() as ExportFormat;
  return getPlanLimits(plan).exports[normalized] === true;
}
