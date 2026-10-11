'use client';

import { FEATURES, FEATURE_LABELS } from '@/lib/features';
import { ComingSoonPage } from '@/components/ui/coming-soon';

export default function MarketplaceAuthorPage() {
  if (!FEATURES.sellTemplates) {
    return (
      <ComingSoonPage
        title={FEATURE_LABELS.sellTemplates}
        backHref="/marketplace"
        backLabel="Back to marketplace"
      />
    );
  }

  return (
    <ComingSoonPage
      title="Sell Templates"
      description="Author onboarding and payouts are rolling out. You can still browse templates on the marketplace."
      backHref="/marketplace"
      backLabel="Back to marketplace"
    />
  );
}
