'use client';

import { FEATURES, FEATURE_LABELS } from '@/lib/features';
import { ComingSoonPage } from '@/components/ui/coming-soon';

export default function LiveQaPage() {
  if (!FEATURES.liveQa) {
    return <ComingSoonPage title={FEATURE_LABELS.liveQa} />;
  }

  return (
    <ComingSoonPage
      title={FEATURE_LABELS.liveQa}
      description="Live Q&A is enabled for your workspace. The full session experience is rolling out soon."
    />
  );
}
