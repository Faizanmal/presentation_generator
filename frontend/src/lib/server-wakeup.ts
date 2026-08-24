/**
 * Handles Render Free cold starts (~15 min idle → ~60s spin-up).
 * Pings /health/liveness, notifies UI listeners, and serializes wake attempts.
 */

type WakeStatus = 'idle' | 'waking' | 'ready' | 'failed';

type WakeListener = (state: {
  status: WakeStatus;
  attempt: number;
  maxAttempts: number;
  message: string;
}) => void;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');
const LIVENESS_URL = `${API_ORIGIN}/health/liveness`;

/** Skip wake logic for local backends — cold start only applies to hosted Free tiers */
export function isColdStartHandlingEnabled(): boolean {
  if (typeof window === 'undefined') {return false;}
  if (process.env.NEXT_PUBLIC_SKIP_COLD_START === 'true') {return false;}
  try {
    const host = new URL(API_ORIGIN).hostname;
    return host !== 'localhost' && host !== '127.0.0.1';
  } catch {
    return false;
  }
}

/** Render cold start is ~60s; allow a bit of headroom */
const MAX_ATTEMPTS = 12;
const ATTEMPT_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 3_000;
const TOTAL_BUDGET_MS = 90_000;

let status: WakeStatus = 'idle';
let attempt = 0;
let wakePromise: Promise<boolean> | null = null;
const listeners = new Set<WakeListener>();

function emit() {
  const message =
    status === 'waking'
      ? 'Server is waking up — free hosting can take up to a minute…'
      : status === 'failed'
        ? 'Could not reach the server. Please try again.'
        : status === 'ready'
          ? 'Server is ready'
          : '';

  const snapshot = { status, attempt, maxAttempts: MAX_ATTEMPTS, message };
  listeners.forEach((fn) => fn(snapshot));
}

export function subscribeServerWake(listener: WakeListener): () => void {
  listeners.add(listener);
  listener({ status, attempt, maxAttempts: MAX_ATTEMPTS, message: '' });
  return () => listeners.delete(listener);
}

export function getServerWakeStatus(): WakeStatus {
  return status;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pingOnce(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

  try {
    const res = await fetch(LIVENESS_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      // Avoid sending cookies; this is a public health check
      credentials: 'omit',
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ensures the Render backend is awake. Concurrent callers share one attempt.
 */
export async function ensureServerAwake(): Promise<boolean> {
  if (typeof window === 'undefined') {return true;}
  if (!isColdStartHandlingEnabled()) {return true;}
  if (status === 'ready') {
    // Cheap re-check — if still up, return fast; if not, wake again
    const ok = await pingOnce();
    if (ok) {return true;}
    status = 'idle';
  }

  if (wakePromise) {return wakePromise;}

  wakePromise = (async () => {
    status = 'waking';
    attempt = 0;
    emit();

    const started = Date.now();

    while (attempt < MAX_ATTEMPTS && Date.now() - started < TOTAL_BUDGET_MS) {
      attempt += 1;
      emit();

      const ok = await pingOnce();
      if (ok) {
        status = 'ready';
        emit();
        return true;
      }

      await sleep(RETRY_DELAY_MS);
    }

    status = 'failed';
    emit();
    return false;
  })().finally(() => {
    wakePromise = null;
  });

  return wakePromise;
}

/** Start wake in the background (app boot). Does not throw. */
export function warmupServerInBackground(): void {
  if (typeof window === 'undefined') {return;}
  if (!isColdStartHandlingEnabled()) {return;}
  void ensureServerAwake();
}

/**
 * True when an Axios/network error looks like a cold/sleeping host.
 */
export function isLikelyColdStartError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {return false;}

  const err = error as {
    code?: string;
    message?: string;
    response?: { status?: number; headers?: Record<string, string> };
    request?: unknown;
  };

  // No response = network / DNS / connection reset / Render still booting
  if (!err.response && err.request) {return true;}

  const code = err.code || '';
  if (
    code === 'ECONNABORTED' ||
    code === 'ERR_NETWORK' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED'
  ) {
    return true;
  }

  const statusCode = err.response?.status;
  // Render often surfaces 502/503/504 while spinning up
  if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
    return true;
  }

  return false;
}
