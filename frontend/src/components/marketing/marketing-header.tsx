'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, LayoutDashboard, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggleButton } from '@/components/ui/enhanced-ui';
import { PRODUCT_NAME } from '@/lib/brand';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

type MarketingNavKey = 'home' | 'features' | 'pricing' | 'templates';

const NAV: { key: MarketingNavKey; href: string; label: string }[] = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'features', href: '/features', label: 'Features' },
  { key: 'pricing', href: '/pricing', label: 'Pricing' },
  { key: 'templates', href: '/marketplace', label: 'Templates' },
];

interface MarketingHeaderProps {
  active?: MarketingNavKey;
  className?: string;
}

/** Shared marketing nav that reflects login state and includes a mobile hamburger menu. */
export function MarketingHeader({ active, className }: MarketingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  const showAuthed = initialized && isAuthenticated;

  return (
    <nav className={cn('container mx-auto px-4 sm:px-6 py-4 sm:py-6', className)}>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <span className="text-base sm:text-xl font-bold truncate">{PRODUCT_NAME}</span>
        </Link>

        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'transition-colors',
                active === item.key
                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="hidden lg:block">
            <ThemeToggleButton />
          </div>
          {showAuthed ? (
            <>
              <Link href="/dashboard" className="shrink-0">
                <Button variant="ghost" size="sm" className="text-slate-700 dark:text-slate-300 gap-1.5 px-2.5 sm:px-3 focus-visible:ring-2 focus-visible:ring-blue-500">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </Link>
              <Link href="/settings" className="shrink-0">
                <Button size="sm" className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 max-w-[8rem] sm:max-w-[10rem] truncate text-xs sm:text-sm px-2.5 sm:px-4 focus-visible:ring-2 focus-visible:ring-blue-500">
                  {user?.name || user?.email || 'Account'}
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="shrink-0">
                <Button variant="ghost" size="sm" className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm px-2.5 sm:px-3 shrink-0 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-blue-500">
                  Log in
                </Button>
              </Link>
              <Link href="/register" className="shrink-0">
                <Button size="sm" className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs sm:text-sm px-2.5 sm:px-4 whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500">
                  Get Started Free
                </Button>
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-lg flex flex-col gap-2">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active === item.key
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
              )}
            >
              {item.label}
            </Link>
          ))}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200 dark:border-slate-800 px-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Theme</span>
            <ThemeToggleButton />
          </div>
        </div>
      )}
    </nav>
  );
}
