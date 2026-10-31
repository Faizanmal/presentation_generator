'use client';

import { useEffect, useState } from 'react';
import { Server, RefreshCw, Loader2 } from 'lucide-react';
import {
  ensureServerAwake,
  subscribeServerWake,
  warmupServerInBackground,
  startKeepAlive,
} from '@/lib/server-wakeup';

/**
 * Background Render Free cold-start warmup.
 * Shows a friendly waking banner with retry and live timer — never raw 503s or forced logout.
 */
export function ColdStartProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'idle' | 'waking' | 'ready' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    warmupServerInBackground();
    const stopKeepAlive = startKeepAlive();
    const unsubscribe = subscribeServerWake((state) => {
      setStatus(state.status);
      setMessage(state.message);
      setAttempt(state.attempt);
      setMaxAttempts(state.maxAttempts);
    });
    return () => {
      stopKeepAlive();
      unsubscribe();
    };
  }, []);

  // Live timer while server is waking up
  useEffect(() => {
    if (status !== 'waking') {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const showBanner = status === 'waking' || status === 'failed';

  return (
    <>
      {children}
      {showBanner && (
        <div
          className="fixed inset-x-0 bottom-0 z-[100] flex justify-center p-4 pointer-events-none sm:bottom-6"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto w-full max-w-md rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                {status === 'waking' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Server className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {status === 'waking' ? 'Waking up the server' : 'Server unavailable'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {message ||
                    (status === 'waking'
                      ? 'Starting services (usually ready in 25–45s)…'
                      : 'Could not reach the API. Please try again.')}
                  {status === 'waking' && maxAttempts > 0
                    ? ` (${attempt}/${maxAttempts} • ${elapsedSeconds}s)`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void ensureServerAwake()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
