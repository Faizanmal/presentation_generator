import { NextResponse } from 'next/server';

/**
 * Lightweight proxy so an external cron (cron-job.org, UptimeRobot, etc.)
 * can hit the Vercel frontend and wake the Render backend.
 *
 * Example: GET https://your-app.vercel.app/api/keepalive every 10–12 minutes
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const backend =
    process.env.KEEPALIVE_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ||
    '';

  if (!backend) {
    return NextResponse.json(
      { ok: false, error: 'KEEPALIVE_BACKEND_URL or NEXT_PUBLIC_API_URL not set' },
      { status: 500 },
    );
  }

  // Optional shared secret so random traffic cannot spam wake-ups
  const expected = process.env.KEEPALIVE_SECRET;
  if (expected) {
    const got = new URL(request.url).searchParams.get('secret');
    if (got !== expected) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const target = `${backend.replace(/\/$/, '')}/health/liveness`;

  try {
    const res = await fetch(target, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(55_000),
    });

    const body = await res.text();
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      target,
      body: body.slice(0, 200),
      at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        target,
        error: error instanceof Error ? error.message : 'Ping failed',
        at: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}
