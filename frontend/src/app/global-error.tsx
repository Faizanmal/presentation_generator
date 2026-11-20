'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RootGlobalError] Fatal application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-4 font-sans">
        <div className="w-full max-w-md p-8 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl text-center space-y-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-950/60 text-red-400 mx-auto border border-red-800/40">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Application Error
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              We encountered a critical error. Please reload the app to continue.
            </p>
            {error?.digest && (
              <p className="text-xs text-slate-500 mt-2 font-mono">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button
              onClick={() => reset()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload application
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
