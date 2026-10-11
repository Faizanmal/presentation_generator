'use client';

import { FEATURES, FEATURE_LABELS } from '@/lib/features';
import { ComingSoonPage } from '@/components/ui/coming-soon';

export default function LearningPathsPage() {
  if (!FEATURES.learningPaths) {
    return <ComingSoonPage title={FEATURE_LABELS.learningPaths} />;
  }

  return (
    <ComingSoonPage
      title={FEATURE_LABELS.learningPaths}
      description="Learning paths are enabled for your workspace. Structured courses are rolling out soon."
    />
  );
}
