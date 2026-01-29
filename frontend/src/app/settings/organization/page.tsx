'use client';

import { useSearchParams } from 'next/navigation';
import { OrganizationSettings } from '@/components/settings/organization-settings';

export default function OrganizationPage() {
  // In a real app, you'd get this from auth context or route params
  const orgId = 'current'; // placeholder

  return (
    <div className="container max-w-5xl py-8">
      <OrganizationSettings orgId={orgId} />
    </div>
  );
}
