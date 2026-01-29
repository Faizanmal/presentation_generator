'use client';

import { use } from 'react';
import { AnalyticsDashboard } from '@/components/editor/analytics-dashboard';

interface AnalyticsPageProps {
  params: Promise<{ id: string }>;
}

export default function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { id } = use(params);

  return (
    <div className="container max-w-6xl py-8">
      <AnalyticsDashboard projectId={id} />
    </div>
  );
}
