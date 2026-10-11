import { redirect } from 'next/navigation';
import { FEATURES, FEATURE_LABELS } from '@/lib/features';
import { ComingSoonPage } from '@/components/ui/coming-soon';

/** Alias route for team analytics (/dashboard/analytics/team). */
export default function TeamAnalyticsAliasPage() {
  if (FEATURES.teamAnalytics) {
    redirect('/dashboard/team-analytics');
  }

  return (
    <ComingSoonPage
      title={FEATURE_LABELS.teamAnalytics}
      backHref="/dashboard/analytics"
      backLabel="Back to analytics"
    />
  );
}
