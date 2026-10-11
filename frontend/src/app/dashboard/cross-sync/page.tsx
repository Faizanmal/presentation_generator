'use client';

import { FEATURES, FEATURE_LABELS } from '@/lib/features';
import { ComingSoonPage } from '@/components/ui/coming-soon';

export default function CrossSyncPage() {
  if (!FEATURES.crossSync) {
    return <ComingSoonPage title={FEATURE_LABELS.crossSync} />;
  }

  return (
    <ComingSoonPage
      title={FEATURE_LABELS.crossSync}
      description="Cross-sync is enabled for your workspace. Multi-device sync is rolling out soon."
    />
  );
}
