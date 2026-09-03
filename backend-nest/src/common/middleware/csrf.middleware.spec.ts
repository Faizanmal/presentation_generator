import { shouldSkipCsrf } from './csrf.middleware';
import { Request } from 'express';

function req(partial: Partial<Request>): Request {
  return partial as Request;
}

describe('shouldSkipCsrf', () => {
  const originalFrontend = process.env.FRONTEND_URL;

  afterEach(() => {
    process.env.FRONTEND_URL = originalFrontend;
  });

  it('skips Bearer-authenticated requests', () => {
    expect(
      shouldSkipCsrf(
        req({
          path: '/api/projects/generate',
          headers: { authorization: 'Bearer abc.def' },
        }),
      ),
    ).toBe(true);
  });

  it('skips matching FRONTEND_URL origin', () => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    expect(
      shouldSkipCsrf(
        req({
          path: '/api/projects/generate',
          headers: { origin: 'https://app.example.com' },
        }),
      ),
    ).toBe(true);
  });

  it('does not skip unknown origin without Bearer', () => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    expect(
      shouldSkipCsrf(
        req({
          path: '/api/projects/generate',
          headers: { origin: 'https://evil.com' },
        }),
      ),
    ).toBe(false);
  });

  it('skips health checks', () => {
    expect(
      shouldSkipCsrf(req({ path: '/health/liveness', headers: {} })),
    ).toBe(true);
  });
});
