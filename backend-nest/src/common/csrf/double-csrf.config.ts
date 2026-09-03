import { doubleCsrf } from 'csrf-csrf';
import { CookieOptions, Request } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

const {
  generateCsrfToken: _generateCsrfToken,
  doubleCsrfProtection: _doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () =>
    process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
  // Do not key HMAC on req.ip: Render sits behind a proxy and the value
  // can change between the token GET and the mutation POST.
  getSessionIdentifier: () => 'anonymous',
  // `__Host-` cookies are first-party only. The SPA on Vercel cannot store
  // or send them to the Render API (third-party cookie blocking).
  cookieName: 'psifi.x-csrf-token',
  cookieOptions: {
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    secure: isProduction,
    httpOnly: true,
    // CHIPS: allow the cookie on the Vercel → Render cross-site fetch.
    partitioned: isProduction,
  } as CookieOptions,

  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req: Request) => {
    return req.headers['x-csrf-token'];
  },
});

export const generateCsrfToken = _generateCsrfToken;
export const doubleCsrfProtection = _doubleCsrfProtection;
