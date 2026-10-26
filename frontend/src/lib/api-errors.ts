/**
 * Typed API error helpers — keep PLAN_LIMIT_* in sync with
 * backend-nest/src/common/subscription/plan-limits.ts
 */

export const PLAN_LIMIT_CODES = {
  PRESENTATIONS: 'PLAN_LIMIT_PRESENTATIONS',
  AI: 'PLAN_LIMIT_AI',
} as const;

export type PlanLimitCode =
  (typeof PLAN_LIMIT_CODES)[keyof typeof PLAN_LIMIT_CODES];

export interface PlanLimitDetails {
  used?: number;
  limit?: number;
  plan?: string;
}

export interface ParsedApiError {
  status?: number;
  code?: string;
  message: string;
  details?: PlanLimitDetails;
}

function planDisplayName(plan: string | undefined): string {
  const key = (plan || 'FREE').toUpperCase();
  if (key === 'PRO') {
    return 'Pro';
  }
  if (key === 'ENTERPRISE') {
    return 'Enterprise';
  }
  return 'Free';
}

/** Extract status/code/message from Axios or fetch-style errors. */
export function parseApiError(error: unknown): ParsedApiError {
  const fallback: ParsedApiError = {
    message: 'Something went wrong. Please try again.',
  };

  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const err = error as {
    message?: string;
    response?: {
      status?: number;
      data?: {
        statusCode?: number;
        code?: string;
        message?: string | string[];
        details?: PlanLimitDetails;
      };
    };
  };

  const data = err.response?.data;
  const rawMessage = data?.message ?? err.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.join(', ')
    : typeof rawMessage === 'string' && rawMessage.trim()
      ? rawMessage
      : fallback.message;

  return {
    status: err.response?.status ?? data?.statusCode,
    code: typeof data?.code === 'string' ? data.code : undefined,
    message,
    details: data?.details,
  };
}

export function isPlanLimitError(error: unknown): boolean {
  const { code } = parseApiError(error);
  return (
    code === PLAN_LIMIT_CODES.PRESENTATIONS || code === PLAN_LIMIT_CODES.AI
  );
}

/**
 * Human-readable plan-limit copy. Prefers server message; builds one from details if needed.
 */
export function planLimitUserMessage(
  error: unknown,
  fallbacks?: {
    presentationsUsed?: number;
    presentationsLimit?: number;
    aiUsed?: number;
    aiLimit?: number;
    plan?: string;
  },
): string {
  const parsed = parseApiError(error);
  if (
    parsed.code === PLAN_LIMIT_CODES.PRESENTATIONS ||
    parsed.code === PLAN_LIMIT_CODES.AI
  ) {
    if (parsed.message && !parsed.message.toLowerCase().includes('forbidden')) {
      return parsed.message;
    }
  }

  if (parsed.code === PLAN_LIMIT_CODES.PRESENTATIONS) {
    const used = parsed.details?.used ?? fallbacks?.presentationsUsed ?? 0;
    const limit =
      parsed.details?.limit ?? fallbacks?.presentationsLimit ?? used;
    const plan = planDisplayName(parsed.details?.plan ?? fallbacks?.plan);
    return `You've used ${used} of ${limit} presentations on the ${plan} plan`;
  }

  if (parsed.code === PLAN_LIMIT_CODES.AI) {
    const used = parsed.details?.used ?? fallbacks?.aiUsed ?? 0;
    const limit = parsed.details?.limit ?? fallbacks?.aiLimit ?? used;
    const plan = planDisplayName(parsed.details?.plan ?? fallbacks?.plan);
    return `You've used ${used} of ${limit} AI credits on the ${plan} plan`;
  }

  return parsed.message;
}

/** Friendly message for non-limit generation failures. */
export function generationFailureMessage(error: unknown): string {
  const parsed = parseApiError(error);
  if (isPlanLimitError(error)) {
    return planLimitUserMessage(error);
  }
  if (
    parsed.message &&
    parsed.message !== 'Something went wrong. Please try again.' &&
    !/^failed to generate/i.test(parsed.message)
  ) {
    return parsed.message;
  }
  return 'Generation failed. Please try again in a moment.';
}
