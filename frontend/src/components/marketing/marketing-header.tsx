'use client';

import Link from 'next/link';
import { Sparkles, LayoutDashboard } from 'lucide-react';
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

/** Shared marketing nav that reflects login state. */
export function MarketingHeader({ active, className }: MarketingHeaderProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  const showAuthed = initialized && isAuthenticated;

  return (
    <nav className={cn('container mx-auto px-6 py-6', className)}>
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold">{PRODUCT_NAME}</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
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

        <div className="flex items-center gap-4">
          <ThemeToggleButton />
          {showAuthed ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" className="text-slate-700 dark:text-slate-300 gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/settings">
                <Button className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 max-w-[10rem] truncate">
                  {user?.name || user?.email || 'Account'}
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-slate-700 dark:text-slate-300">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
