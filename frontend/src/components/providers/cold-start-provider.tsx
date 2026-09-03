'use client';

import { useEffect, useState } from 'react';
import { Loader2, Server, RefreshCw } from 'lucide-react';
import {
  ensureServerAwake,
  subscribeServerWake,
  warmupServerInBackground,
} from '@/lib/server-wakeup';

/**
 * Shows a non-blocking overlay while the Render Free backend cold-starts.
 * Also kicks off a background warmup on first mount.
 */
export function ColdStartProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'idle' | 'waking' | 'ready' | 'failed'>('idle');
  const [attempt, setAttempt] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(12);
  const [message, setMessage] = useState('');

  useEffect(() => {
    warmupServerInBackground();
    return subscribeServerWake((state) => {
      setStatus(state.status);
      setAttempt(state.attempt);
      setMaxAttempts(state.maxAttempts);
      setMessage(state.message);
    });
  }, []);

  const visible = status === 'waking' || status === 'failed';
  const progress = maxAttempts > 0 ? Math.min(100, Math.round((attempt / maxAttempts) * 100)) : 0;

  return (
    <>
      {children}
      {visible && (
        <div
          className="fixed inset-x-0 bottom-0 z-[100] flex justify-center p-4 pointer-events-none sm:bottom-6"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                {status === 'failed' ? (
                  <Server className="h-5 w-5" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {status === 'failed' ? 'Server unavailable' : 'Connecting to the server'}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {message ||
                    (status === 'failed'
                      ? 'Could not reach the API. Please try again.'
                      : 'Please wait while we connect…')}
                </p>
                {status === 'waking' && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${Math.max(progress, 8)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      Attempt {attempt} of {maxAttempts}
                    </p>
                  </div>
                )}
                {status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => void ensureServerAwake()}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try again
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
