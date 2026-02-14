'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Integration, GoogleDriveFile, FigmaFile, NotionPage, ZoomMeeting, SlackChannel, IntegrationProvider } from '@/types';

// Re-export types for convenience
export type { IntegrationProvider } from '@/types';

export function useIntegrations() {
  const queryClient = useQueryClient();

  // Fetch all connected integrations
  const {
    data: integrations,
    isLoading,
    error,
  } = useQuery<Integration[]>({
    queryKey: ['integrations'],
    queryFn: () => api.getIntegrations(),
  });

  // Connect integration (initiates OAuth)
  const connectIntegration = useCallback(
    async (provider: IntegrationProvider) => {
      try {
        const { authUrl } = await api.connectIntegration(provider);
        
        // Open OAuth window
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          authUrl,
          `Connect ${provider}`,
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Poll for completion
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
          }
        }, 500);
      } catch (error) {
        console.error('Error connecting integration:', error);
        toast.error(`Failed to connect ${provider}`);
      }
    },
    [queryClient]
  );

  // Disconnect integration
  const disconnectMutation = useMutation({
    mutationFn: (integrationId: string) => api.disconnectIntegration(integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integration disconnected');
    },
    onError: () => {
      toast.error('Failed to disconnect integration');
    },
  });

  // Check if specific provider is connected
  const isConnected = useCallback(
    (provider: IntegrationProvider) =>
      integrations?.some((i) => i.provider === provider) ?? false,
    [integrations]
  );

  // Get specific integration
  const getIntegration = useCallback(
    (provider: IntegrationProvider) =>
      integrations?.find((i) => i.provider === provider),
    [integrations]
  );

  return {
    integrations,
    isLoading,
    error,
    connectIntegration,
    disconnectIntegration: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
    isConnected,
    getIntegration,
  };
}

// Zoom-specific hooks
export function useZoomIntegration() {
  const { isConnected } = useIntegrations();

  // Create meeting with presentation
  const createMeetingMutation = useMutation({
    mutationFn: (data: {
      projectId: string;
      topic: string;
      startTime?: Date;
      duration?: number;
    }) => api.createZoomMeeting(data),
    onSuccess: () => {
      toast.success('Zoom meeting created');
    },
    onError: () => {
      toast.error('Failed to create Zoom meeting');
    },
  });

  // Get upcoming meetings
  const { data: meetings, isLoading: isLoadingMeetings } = useQuery<ZoomMeeting[]>({
    queryKey: ['zoom', 'meetings'],
    queryFn: () => api.getZoomMeetings(),
    enabled: isConnected('ZOOM'),
  });

  return {
    isConnected: isConnected('ZOOM'),
    meetings,
    isLoadingMeetings,
    createMeeting: createMeetingMutation.mutate,
    isCreating: createMeetingMutation.isPending,
  };
}

// Slack-specific hooks
export function useSlackIntegration() {
  const { isConnected } = useIntegrations();

  // Get channels
  const { data: channels, isLoading: isLoadingChannels } = useQuery<SlackChannel[]>({
    queryKey: ['slack', 'channels'],
    queryFn: () => api.getSlackChannels(),
    enabled: isConnected('SLACK'),
  });

  // Send presentation to channel
  const sendMutation = useMutation({
    mutationFn: (data: { projectId: string; channelId: string; message?: string }) =>
      api.sendToSlack(data),
    onSuccess: () => {
      toast.success('Presentation shared to Slack');
    },
    onError: () => {
      toast.error('Failed to share to Slack');
    },
  });

  return {
    isConnected: isConnected('SLACK'),
    channels,
    isLoadingChannels,
    sendToChannel: sendMutation.mutate,
    isSending: sendMutation.isPending,
  };
}

// Microsoft Teams-specific hooks
export function useTeamsIntegration() {
  const { isConnected } = useIntegrations();

  // Get teams and channels
  const { data: teams, isLoading: isLoadingTeams } = useQuery({
    queryKey: ['teams', 'list'],
    queryFn: () => api.getTeamsList(),
    enabled: isConnected('TEAMS'),
  });

  // Send to Teams
  const sendMutation = useMutation({
    mutationFn: (data: { projectId: string; teamId: string; channelId: string }) =>
      api.sendToTeams(data),
    onSuccess: () => {
      toast.success('Presentation shared to Teams');
    },
    onError: () => {
      toast.error('Failed to share to Teams');
    },
  });

  // Create Teams meeting
  const createMeetingMutation = useMutation({
    mutationFn: (data: { projectId: string; subject: string; startTime: Date }) =>
      api.createTeamsMeeting(data),
    onSuccess: () => {
      toast.success('Teams meeting created');
    },
    onError: () => {
      toast.error('Failed to create Teams meeting');
    },
  });

  return {
    isConnected: isConnected('TEAMS'),
    teams,
    isLoadingTeams,
    sendToTeams: sendMutation.mutate,
    isSending: sendMutation.isPending,
    createMeeting: createMeetingMutation.mutate,
    isCreatingMeeting: createMeetingMutation.isPending,
  };
}

// Google Drive-specific hooks
export function useGoogleDriveIntegration() {
  const { isConnected } = useIntegrations();
  const queryClient = useQueryClient();

  // List files
  const { data: files, isLoading: isLoadingFiles } = useQuery<GoogleDriveFile[]>({
    queryKey: ['google-drive', 'files'],
    queryFn: async () => {
      const apiFiles = await api.getGoogleDriveFiles();
      return apiFiles.map(file => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        webViewLink: '', // API doesn't provide this
        thumbnailLink: undefined,
      }));
    },
    enabled: isConnected('GOOGLE_DRIVE'),
  });

  // Export to Google Drive
  const exportMutation = useMutation({
    mutationFn: (data: { projectId: string; format: 'slides' | 'pdf'; folderId?: string }) =>
      api.exportToGoogleDrive(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-drive', 'files'] });
      toast.success('Exported to Google Drive');
    },
    onError: () => {
      toast.error('Failed to export to Google Drive');
    },
  });

  // Import from Google Drive
  const importMutation = useMutation({
    mutationFn: (fileId: string) => api.importFromGoogleDrive(fileId),
    onSuccess: () => {
      toast.success('Imported from Google Drive');
    },
    onError: () => {
      toast.error('Failed to import from Google Drive');
    },
  });

  return {
    isConnected: isConnected('GOOGLE_DRIVE'),
    files,
    isLoadingFiles,
    exportToGoogleDrive: exportMutation.mutate,
    isExporting: exportMutation.isPending,
    importFromGoogleDrive: importMutation.mutate,
    isImporting: importMutation.isPending,
  };
}

// Figma-specific hooks
export function useFigmaIntegration() {
  const { isConnected } = useIntegrations();

  // List recent files
  const { data: files, isLoading: isLoadingFiles } = useQuery<FigmaFile[]>({
    queryKey: ['figma', 'files'],
    queryFn: async () => {
      const apiFiles = await api.getFigmaFiles();
      return apiFiles.map(file => ({
        id: file.id,
        name: file.name,
        thumbnailUrl: '', // API doesn't provide this
        lastModified: new Date(file.lastModified),
      }));
    },
    enabled: isConnected('FIGMA'),
  });

  // Import Figma frames as slides
  const importMutation = useMutation({
    mutationFn: (data: { fileId: string; frameIds: string[] }) =>
      api.importFromFigma(data),
    onSuccess: () => {
      toast.success('Frames imported from Figma');
    },
    onError: () => {
      toast.error('Failed to import from Figma');
    },
  });

  // Sync changes from Figma
  const syncMutation = useMutation({
    mutationFn: (data: { projectId: string; fileId: string }) =>
      api.syncFromFigma(data),
    onSuccess: () => {
      toast.success('Synced with Figma');
    },
    onError: () => {
      toast.error('Failed to sync with Figma');
    },
  });

  return {
    isConnected: isConnected('FIGMA'),
    files,
    isLoadingFiles,
    importFromFigma: importMutation.mutate,
    isImporting: importMutation.isPending,
    syncFromFigma: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
  };
}

// Notion-specific hooks
export function useNotionIntegration() {
  const { isConnected } = useIntegrations();

  // List pages
  const { data: pages, isLoading: isLoadingPages } = useQuery<NotionPage[]>({
    queryKey: ['notion', 'pages'],
    queryFn: async () => {
      const apiPages = await api.getNotionPages();
      return apiPages.map(page => ({
        id: page.id,
        title: page.title,
        icon: undefined,
        lastEdited: new Date(page.lastEditedTime),
      }));
    },
    enabled: isConnected('NOTION'),
  });

  // Import from Notion
  const importMutation = useMutation({
    mutationFn: (pageId: string) => api.importFromNotion(pageId),
    onSuccess: () => {
      toast.success('Imported from Notion');
    },
    onError: () => {
      toast.error('Failed to import from Notion');
    },
  });

  // Export to Notion
  const exportMutation = useMutation({
    mutationFn: (data: { projectId: string; parentPageId?: string }) =>
      api.exportToNotion(data),
    onSuccess: () => {
      toast.success('Exported to Notion');
    },
    onError: () => {
      toast.error('Failed to export to Notion');
    },
  });

  return {
    isConnected: isConnected('NOTION'),
    pages,
    isLoadingPages,
    importFromNotion: importMutation.mutate,
    isImporting: importMutation.isPending,
    exportToNotion: exportMutation.mutate,
    isExporting: exportMutation.isPending,
  };
}
