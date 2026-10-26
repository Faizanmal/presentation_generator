import {
  PLAN_LIMIT_CODES,
  generationFailureMessage,
  isPlanLimitError,
  parseApiError,
  planLimitUserMessage,
} from '@/lib/api-errors';

describe('api-errors', () => {
  it('parses Axios-style plan limit errors', () => {
    const error = {
      response: {
        status: 403,
        data: {
          code: PLAN_LIMIT_CODES.PRESENTATIONS,
          message: "You've used 3 of 3 presentations on the Free plan",
          details: { used: 3, limit: 3, plan: 'FREE' },
        },
      },
    };

    expect(parseApiError(error)).toEqual({
      status: 403,
      code: PLAN_LIMIT_CODES.PRESENTATIONS,
      message: "You've used 3 of 3 presentations on the Free plan",
      details: { used: 3, limit: 3, plan: 'FREE' },
    });
    expect(isPlanLimitError(error)).toBe(true);
  });

  it('builds presentation limit copy from details', () => {
    const error = {
      response: {
        data: {
          code: PLAN_LIMIT_CODES.PRESENTATIONS,
          message: 'Forbidden',
          details: { used: 3, limit: 3, plan: 'FREE' },
        },
      },
    };
    expect(planLimitUserMessage(error)).toBe(
      "You've used 3 of 3 presentations on the Free plan",
    );
  });

  it('builds AI limit copy from details', () => {
    const error = {
      response: {
        data: {
          code: PLAN_LIMIT_CODES.AI,
          message: 'Forbidden',
          details: { used: 10, limit: 10, plan: 'FREE' },
        },
      },
    };
    expect(planLimitUserMessage(error)).toBe(
      "You've used 10 of 10 AI credits on the Free plan",
    );
  });

  it('returns a retry-friendly message for other failures', () => {
    expect(generationFailureMessage(new Error('Network Error'))).toBe(
      'Network Error',
    );
    expect(generationFailureMessage({})).toBe(
      'Generation failed. Please try again in a moment.',
    );
  });
});
