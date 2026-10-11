'use client';

import { cn } from '@/lib/utils';
import { SoonBadge } from '@/components/ui/soon-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DisabledFeatureCardProps {
  children: React.ReactNode;
  tooltip?: string;
  label?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Wraps a dashboard/nav card so it stays visible but clearly disabled,
 * with a Coming soon tooltip (or custom click handler for a modal).
 */
export function DisabledFeatureCard({
  children,
  tooltip = 'Coming soon',
  label = 'Soon',
  className,
  onClick,
}: DisabledFeatureCardProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={(e) => {
              if (!onClick) {return;}
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }}
            className={cn(
              'relative cursor-not-allowed opacity-60',
              onClick && 'cursor-pointer',
              className,
            )}
            aria-disabled={!onClick}
          >
            <div className="pointer-events-none select-none">{children}</div>
            <div className="absolute right-2 top-2">
              <SoonBadge label={label} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
