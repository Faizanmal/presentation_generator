import { doubleCsrf } from 'csrf-csrf';
import { Request } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

const {
  generateCsrfToken: _generateCsrfToken,
  doubleCsrfProtection: _doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () =>
    process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
  getSessionIdentifier: (req: Request) => {
    // DO NOT use Authorization header as identifier if it can change between token fetch and use.
    // Using a consistent identifier like IP is safer for stateless APIs,
    // though still has limitations. For better security, a stable session cookie would be ideal.
    return req.ip || 'anonymous';
  },
  cookieName: isProduction ? '__Host-psifi.x-csrf-token' : 'psifi.x-csrf-token',
  cookieOptions: {
    sameSite: 'strict',
    path: '/',
    secure: isProduction,
    httpOnly: true,
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req: Request) => {
    return req.headers['x-csrf-token'] as string;
  },
});

export const generateCsrfToken = _generateCsrfToken;
export const doubleCsrfProtection = _doubleCsrfProtection;
