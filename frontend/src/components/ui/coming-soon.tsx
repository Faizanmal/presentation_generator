'use client';

import Link from 'next/link';
import { ArrowLeft, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SoonBadge } from '@/components/ui/soon-badge';
import { PRODUCT_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

interface ComingSoonPageProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

/** Full-page Coming soon state for flagged-off routes */
export function ComingSoonPage({
  title,
  description,
  backHref = '/dashboard',
  backLabel = 'Back to dashboard',
  className,
}: ComingSoonPageProps) {
  return (
    <div
      className={cn(
        'flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
        <Construction className="h-7 w-7" />
      </div>
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
        <SoonBadge />
      </div>
      <p className="mb-8 max-w-md text-slate-600 dark:text-slate-400">
        {description ||
          `${title} is coming soon to ${PRODUCT_NAME}. We're finishing it up — check back shortly.`}
      </p>
      <Button asChild variant="outline">
        <Link href={backHref}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Link>
      </Button>
    </div>
  );
}

interface ComingSoonModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
}

/** Lightweight modal for actions like Invite Team while flagged off */
export function ComingSoonModal({
  open,
  onClose,
  title,
  description,
}: ComingSoonModalProps) {
  if (!open) {return null;}

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <SoonBadge />
        </div>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
          {description || `${title} are coming soon.`}
        </p>
        <Button className="w-full" onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}
