/**
 * Single source of truth for plan limits and entitlements (frontend).
 * Keep in sync with backend-nest/src/common/subscription/plan-limits.ts
 */

export type PlanId = 'FREE' | 'PRO' | 'ENTERPRISE';

export type ExportFormat = 'html' | 'json' | 'pdf' | 'pptx';

export interface PlanLimits {
  id: PlanId;
  name: string;
  priceMonthly: number;
  presentations: number;
  aiGenerationsPerMonth: number;
  thinkingCreditsPerMonth: number;
  exports: Record<ExportFormat, boolean>;
  features: string[];
  limitations?: string[];
  popular?: boolean;
  priceId?: string;
}

/** -1 means unlimited for display/enforcement helpers */
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
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
    features: [
      '3 presentations',
      '10 AI generations per month',
      'Basic themes',
      'Export to HTML/JSON',
      'Share with link',
    ],
    limitations: [
      'No PDF or PowerPoint export',
      'No premium themes',
      'Limited AI generations',
    ],
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
    popular: true,
    priceId: 'price_pro_monthly',
    features: [
      '100 presentations',
      '1,000 AI generations per month',
      '5 Thinking generations per month',
      'All themes including premium',
      'Export to PDF, PowerPoint, HTML, JSON',
      'Priority support',
    ],
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
    priceId: 'price_enterprise_monthly',
    features: [
      '1,000 presentations (expandable)',
      '50,000 AI generations per month',
      '250 Thinking generations per month',
      'All Pro features',
      'Team collaboration',
      'SSO & advanced security',
      'Dedicated support & onboarding',
    ],
  },
};

export const PLANS_LIST = Object.values(PLAN_LIMITS);

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  const key = (plan || 'FREE').toUpperCase() as PlanId;
  return PLAN_LIMITS[key] ?? PLAN_LIMITS.FREE;
}

export function canExportFormat(
  plan: string | null | undefined,
  format: ExportFormat,
): boolean {
  return getPlanLimits(plan).exports[format] === true;
}

export function presentationLimit(plan: string | null | undefined): number {
  return getPlanLimits(plan).presentations;
}

export function aiGenerationLimit(plan: string | null | undefined): number {
  return getPlanLimits(plan).aiGenerationsPerMonth;
}
