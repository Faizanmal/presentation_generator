'use client';

import Link from 'next/link';
import { Crown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PRODUCT_NAME } from '@/lib/brand';

interface ProBadgeProps {
  className?: string;
  label?: string;
}

/** Compact Pro lock badge for gated menu items */
export function ProBadge({ className, label = 'Pro' }: ProBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
        className,
      )}
    >
      <Lock className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  description?: string;
}

/** Modal prompting Free users to upgrade */
export function UpgradePrompt({
  open,
  onOpenChange,
  feature = 'This feature',
  description,
}: UpgradePromptProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            <Crown className="h-5 w-5" />
          </div>
          <DialogTitle>Upgrade to Pro</DialogTitle>
          <DialogDescription>
            {description ||
              `${feature} is available on Pro and Enterprise plans. Upgrade to unlock PDF, PowerPoint, and more in ${PRODUCT_NAME}.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button asChild>
            <Link href="/settings/billing">View plans</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
