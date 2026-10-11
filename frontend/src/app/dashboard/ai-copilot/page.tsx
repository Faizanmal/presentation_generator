'use client';

import { FEATURES, FEATURE_LABELS } from '@/lib/features';
import { ComingSoonPage } from '@/components/ui/coming-soon';

export default function AiCopilotHubPage() {
  if (!FEATURES.aiCopilot) {
    return (
      <ComingSoonPage
        title={FEATURE_LABELS.aiCopilot}
        description="AI Co-Pilot is coming soon. When it ships, you'll be able to assist your deck from the editor."
      />
    );
  }

  return (
    <ComingSoonPage
      title={FEATURE_LABELS.aiCopilot}
      description="Open a presentation in the editor to start an AI Co-Pilot session."
      backHref="/dashboard"
    />
  );
}
