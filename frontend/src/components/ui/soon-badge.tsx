import { cn } from '@/lib/utils';

interface SoonBadgeProps {
  className?: string;
  label?: string;
}

/** Compact "Soon" pill for nav items and cards behind a feature flag */
export function SoonBadge({ className, label = 'Soon' }: SoonBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
        className,
      )}
    >
      {label}
    </span>
  );
}
