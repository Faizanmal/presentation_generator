'use client';

import { Button } from '@/components/ui/button';
import { Wifi, Home, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-100">
      <div className="text-center max-w-md px-6">
        {/* Offline Icon */}
        <div className="relative inline-block mb-8">
          <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
            <Wifi className="w-12 h-12 text-slate-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-white text-lg font-bold">!</span>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-3xl font-bold text-slate-900 mb-4">You&apos;re Offline</h1>
        <p className="text-slate-600 mb-8">
          It looks like you&apos;ve lost your internet connection. Don&apos;t worry - any work you&apos;ve
          done is saved locally and will sync when you&apos;re back online.
        </p>

        {/* What you can do */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
          <h2 className="font-semibold text-slate-900 mb-4">While offline, you can:</h2>
          <ul className="text-left space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-slate-600">View and edit saved presentations</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-slate-600">Create new slides and content</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-slate-600">Practice your presentation</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow-500 mt-0.5">⏸</span>
              <span className="text-slate-600">AI features will resume when online</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <Home className="w-4 h-4" />
            Go Back
          </Button>
          <Button onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        </div>

        {/* Status */}
        <p className="mt-8 text-sm text-slate-400">
          We&apos;ll automatically reconnect when your internet is restored.
        </p>
      </div>
    </div>
  );
}
