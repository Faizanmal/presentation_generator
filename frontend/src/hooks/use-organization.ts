/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// Types
interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customDomain?: string;
  plan: 'starter' | 'team' | 'enterprise';
  ssoEnabled: boolean;
  createdAt: Date;
  memberCount: number;
}

interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  joinedAt: string;
  lastActiveAt?: string;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'expired';
  invitedBy: string;
  createdAt: Date;
  expiresAt: Date;
}

interface SSOConfig {
  id: string;
  provider: 'saml' | 'oidc';
  enabled: boolean;
  domain: string;
  issuer?: string;
  ssoUrl?: string;
  certificate?: string;
  clientId?: string;
  clientSecret?: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  actor: {
    id: string;
    email: string;
    name: string;
  };
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

interface WhiteLabelConfig {
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  customDomain: string;
  customEmailDomain: string;
  hideWatermark: boolean;
  customFooter: string;
}

export function useOrganization(orgId?: string) {
  const queryClient = useQueryClient();

  // Get current user's organization
  const {
    data: organization,
    isLoading,
    error,
  } = useQuery<Organization>({
    queryKey: ['organization', orgId || 'current'],
    queryFn: () => (orgId ? api.getOrganization(orgId) : api.getCurrentOrganization()),
    enabled: orgId !== undefined || true,
  });

  // Update organization
  const updateMutation = useMutation({
    mutationFn: (data: Partial<Organization>) =>
      api.updateOrganization(organization!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast.success('Organization updated');
    },
    onError: () => {
      toast.error('Failed to update organization');
    },
  });

  // Create organization
  const createMutation = useMutation({
    mutationFn: (data: { name: string; slug: string }) => api.createOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast.success('Organization created');
    },
    onError: () => {
      toast.error('Failed to create organization');
    },
  });

  return {
    organization,
    isLoading,
    error,
    updateOrganization: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    createOrganization: createMutation.mutate,
    isCreating: createMutation.isPending,
  };
}

export function useOrganizationMembers(orgId: string) {
  const queryClient = useQueryClient();

  // Get members
  const {
    data: members,
    isLoading,
    error,
  } = useQuery<OrganizationMember[]>({
    queryKey: ['organization', orgId, 'members'],
    queryFn: () => api.getOrganizationMembers(orgId),
    enabled: !!orgId,
  });

  // Update member role
  const updateRoleMutation = useMutation({
    mutationFn: (data: { memberId: string; role: OrganizationMember['role'] }) =>
      api.updateMemberRole(orgId, data.memberId, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'members'] });
      toast.success('Member role updated');
    },
    onError: () => {
      toast.error('Failed to update member role');
    },
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => api.removeMember(orgId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'members'] });
      toast.success('Member removed');
    },
    onError: () => {
      toast.error('Failed to remove member');
    },
  });

  return {
    members,
    isLoading,
    error,
    updateRole: updateRoleMutation.mutate,
    isUpdatingRole: updateRoleMutation.isPending,
    removeMember: removeMemberMutation.mutate,
    isRemoving: removeMemberMutation.isPending,
  };
}

export function useTeamInvitations(orgId: string) {
  const queryClient = useQueryClient();

  // Get invitations
  const {
    data: invitations,
    isLoading,
    error,
  } = useQuery<TeamInvitation[]>({
    queryKey: ['organization', orgId, 'invitations'],
    queryFn: () => api.getTeamInvitations(orgId),
    enabled: !!orgId,
  });

  // Send invitation
  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: TeamInvitation['role'] }) =>
      api.sendInvitation(orgId, data.email, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'invitations'] });
      toast.success('Invitation sent');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send invitation');
    },
  });

  // Resend invitation
  const resendMutation = useMutation({
    mutationFn: (invitationId: string) => api.resendInvitation(orgId, invitationId),
    onSuccess: () => {
      toast.success('Invitation resent');
    },
    onError: () => {
      toast.error('Failed to resend invitation');
    },
  });

  // Cancel invitation
  const cancelMutation = useMutation({
    mutationFn: (invitationId: string) => api.cancelInvitation(orgId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'invitations'] });
      toast.success('Invitation cancelled');
    },
    onError: () => {
      toast.error('Failed to cancel invitation');
    },
  });

  // Bulk invite
  const bulkInviteMutation = useMutation({
    mutationFn: (data: { emails: string[]; role: TeamInvitation['role'] }) =>
      api.bulkInvite(orgId, data.emails, data.role),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'invitations'] });
      toast.success(`${result.sent} invitation(s) sent`);
    },
    onError: () => {
      toast.error('Failed to send invitations');
    },
  });

  return {
    invitations,
    isLoading,
    error,
    invite: inviteMutation.mutate,
    isInviting: inviteMutation.isPending,
    resendInvitation: resendMutation.mutate,
    isResending: resendMutation.isPending,
    cancelInvitation: cancelMutation.mutate,
    isCancelling: cancelMutation.isPending,
    bulkInvite: bulkInviteMutation.mutate,
    isBulkInviting: bulkInviteMutation.isPending,
  };
}

export function useSSOConfig(orgId: string) {
  const queryClient = useQueryClient();

  // Get SSO config
  const {
    data: ssoConfig,
    isLoading,
    error,
  } = useQuery<SSOConfig | null>({
    queryKey: ['organization', orgId, 'sso'],
    queryFn: () => api.getSSOConfig(orgId),
    enabled: !!orgId,
  });

  // Configure SAML
  const configureSAMLMutation = useMutation({
    mutationFn: (data: {
      domain: string;
      issuer: string;
      ssoUrl: string;
      certificate: string;
    }) => api.configureSAML(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'sso'] });
      toast.success('SAML SSO configured');
    },
    onError: () => {
      toast.error('Failed to configure SAML');
    },
  });

  // Configure OIDC
  const configureOIDCMutation = useMutation({
    mutationFn: (data: {
      domain: string;
      issuer: string;
      clientId: string;
      clientSecret: string;
    }) => api.configureOIDC(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'sso'] });
      toast.success('OIDC SSO configured');
    },
    onError: () => {
      toast.error('Failed to configure OIDC');
    },
  });

  // Enable/Disable SSO
  const toggleSSOmutation = useMutation({
    mutationFn: (enabled: boolean) => api.toggleSSO(orgId, enabled),
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'sso'] });
      toast.success(`SSO ${enabled ? 'enabled' : 'disabled'}`);
    },
    onError: () => {
      toast.error('Failed to update SSO');
    },
  });

  // Test SSO connection
  const testConnectionMutation = useMutation({
    mutationFn: () => api.testSSOConnection(orgId),
    onSuccess: () => {
      toast.success('SSO connection successful');
    },
    onError: () => {
      toast.error('SSO connection test failed');
    },
  });

  return {
    ssoConfig,
    isLoading,
    error,
    configureSAML: configureSAMLMutation.mutate,
    isConfiguringSAML: configureSAMLMutation.isPending,
    configureOIDC: configureOIDCMutation.mutate,
    isConfiguringOIDC: configureOIDCMutation.isPending,
    toggleSSO: toggleSSOmutation.mutate,
    isToggling: toggleSSOmutation.isPending,
    testConnection: testConnectionMutation.mutate,
    isTesting: testConnectionMutation.isPending,
  };
}

export function useAuditLogs(
  orgId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    action?: string;
    actorId?: string;
    resourceType?: string;
    page?: number;
    limit?: number;
  }
) {
  // Get audit logs
  const {
    data: auditLogs,
    isLoading,
    error,
    refetch,
  } = useQuery<{ entries: AuditLogEntry[]; total: number; page: number }>({
    queryKey: ['organization', orgId, 'audit-logs', options],
    queryFn: () => api.getAuditLogs(orgId, options),
    enabled: !!orgId,
  });

  // Export audit logs
  const exportMutation = useMutation({
    mutationFn: (format: 'csv' | 'json') => api.exportAuditLogs(orgId, format, options),
    onSuccess: (data, format) => {
      const blob = new Blob([data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${orgId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: () => {
      toast.error('Failed to export audit logs');
    },
  });

  return {
    entries: auditLogs?.entries || [],
    total: auditLogs?.total || 0,
    page: auditLogs?.page || 1,
    isLoading,
    error,
    refetch,
    exportLogs: exportMutation.mutate,
    isExporting: exportMutation.isPending,
  };
}

export function useWhiteLabel(orgId: string) {
  const queryClient = useQueryClient();

  // Get white label config
  const {
    data: config,
    isLoading,
    error,
  } = useQuery<WhiteLabelConfig>({
    queryKey: ['organization', orgId, 'white-label'],
    queryFn: () => api.getWhiteLabelConfig(orgId),
    enabled: !!orgId,
  });

  // Update white label config
  const updateMutation = useMutation({
    mutationFn: (data: Partial<WhiteLabelConfig>) =>
      api.updateWhiteLabelConfig(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'white-label'] });
      toast.success('White label settings updated');
    },
    onError: () => {
      toast.error('Failed to update white label settings');
    },
  });

  // Upload logo
  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => api.uploadOrganizationLogo(orgId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'white-label'] });
      toast.success('Logo uploaded');
    },
    onError: () => {
      toast.error('Failed to upload logo');
    },
  });

  // Verify custom domain
  const verifyDomainMutation = useMutation({
    mutationFn: (domain: string) => api.verifyCustomDomain(orgId, domain),
    onSuccess: (result) => {
      if (result.verified) {
        queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'white-label'] });
        toast.success('Domain verified');
      } else {
        toast.error('Domain verification failed. Please check DNS settings.');
      }
    },
    onError: () => {
      toast.error('Failed to verify domain');
    },
  });

  return {
    config,
    isLoading,
    error,
    updateConfig: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    uploadLogo: uploadLogoMutation.mutate,
    isUploadingLogo: uploadLogoMutation.isPending,
    verifyDomain: verifyDomainMutation.mutate,
    isVerifyingDomain: verifyDomainMutation.isPending,
  };
}
