'use client';

import { FEATURES, FEATURE_LABELS } from '@/lib/features';
import { ComingSoonPage } from '@/components/ui/coming-soon';

export default function PresentationCoachHubPage() {
  if (!FEATURES.presentationCoach) {
    return <ComingSoonPage title={FEATURE_LABELS.presentationCoach} />;
  }

  return (
    <ComingSoonPage
      title={FEATURE_LABELS.presentationCoach}
      description="Open a presentation in the editor to use Presentation Coach while you rehearse and refine your deck."
      backHref="/dashboard"
    />
  );
}
