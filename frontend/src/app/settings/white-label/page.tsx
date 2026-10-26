'use client';

import Link from 'next/link';
import { FEATURES, FEATURE_LABELS } from '@/lib/features';
import { ComingSoonPage } from '@/components/ui/coming-soon';
import { Button } from '@/components/ui/button';
import { ProBadge } from '@/components/ui/pro-badge';
import { PRODUCT_NAME } from '@/lib/brand';
import { Boxes } from 'lucide-react';

/**
 * White-Label SDK settings entry.
 * Flagged off by default — never 404 from the settings sidebar.
 */
export default function WhiteLabelSettingsPage() {
  if (!FEATURES.whiteLabelSdk) {
    return (
      <div className="mx-auto max-w-lg py-12 px-4 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
          <Boxes className="h-7 w-7" />
        </div>
        <div className="mb-2 flex items-center justify-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {FEATURE_LABELS.whiteLabelSdk}
          </h1>
          <ProBadge />
        </div>
        <p className="mb-6 text-slate-600 dark:text-slate-400">
          Embed {PRODUCT_NAME} in your product with your brand. Available on
          Enterprise — or use Organization branding today.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/settings/billing">View plans</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings/organization">Organization branding</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ComingSoonPage
      title={FEATURE_LABELS.whiteLabelSdk}
      description={`White-Label SDK is enabled for your workspace. Full docs and keys are rolling out in ${PRODUCT_NAME}.`}
      backHref="/settings"
      backLabel="Back to settings"
    />
  );
}
