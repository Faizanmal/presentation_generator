'use client';

import { FEATURES, FEATURE_LABELS } from '@/lib/features';
import { ComingSoonPage } from '@/components/ui/coming-soon';

export default function ImmersiveViewPage() {
  if (!FEATURES.immersiveView) {
    return <ComingSoonPage title={FEATURE_LABELS.immersiveView} />;
  }

  return (
    <ComingSoonPage
      title={FEATURE_LABELS.immersiveView}
      description="Immersive view is enabled for your workspace. The full experience is rolling out soon."
    />
  );
}
