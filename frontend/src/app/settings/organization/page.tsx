'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { OrganizationSettings } from '@/components/settings/organization-settings';
import { api } from '@/lib/api';

export default function OrganizationPage() {
  const { data: organization, isLoading, error } = useQuery({
    queryKey: ['organization', 'current'],
    queryFn: () => api.getCurrentOrganization(),
  });

  if (isLoading) {
    return (
      <div className="container max-w-5xl py-8 flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="container max-w-5xl py-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">No Organization Found</h2>
          <p className="text-muted-foreground">
            You are not a member of any organization yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-8">
      <OrganizationSettings orgId={organization.id} />
    </div>
  );
}
