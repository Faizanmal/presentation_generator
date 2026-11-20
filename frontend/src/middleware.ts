import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware
 * Runs before any page is rendered. If a signed-in user visits '/',
 * immediately redirect to '/dashboard' on the server with 307 so there
 * is zero flash of the homepage or "Opening dashboard...".
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    const token =
      request.cookies.get('auth-token')?.value ||
      request.cookies.get('token')?.value;

    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
