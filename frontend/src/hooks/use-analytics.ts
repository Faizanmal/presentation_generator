'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AnalyticsOverview, SlideAnalytics, ViewerSession, HeatmapData } from '@/types';

interface UseAnalyticsOptions {
  projectId: string;
  timeRange?: 'day' | 'week' | 'month' | 'all';
  enabled?: boolean;
}

// Helper to convert time range to dates
function getDateRange(timeRange: 'day' | 'week' | 'month' | 'all'): { startDate?: string; endDate?: string } {
  const now = new Date();
  let startDate: Date | undefined;

  switch (timeRange) {
    case 'day':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
    default:
      return {};
  }

  return {
    startDate: startDate?.toISOString(),
    endDate: now.toISOString(),
  };
}

export function useAnalytics({
  projectId,
  timeRange = 'week',
  enabled = true,
}: UseAnalyticsOptions) {
  const queryClient = useQueryClient();
  const { startDate, endDate } = getDateRange(timeRange);

  // Get analytics summary
  const {
    data: overview,
    isLoading: isLoadingOverview,
    error: overviewError,
  } = useQuery<AnalyticsOverview>({
    queryKey: ['analytics', 'overview', projectId, timeRange],
    queryFn: () => api.getAnalyticsSummary(projectId, startDate, endDate),
    enabled: enabled && !!projectId,
    staleTime: 60 * 1000, // 1 minute
  });

  // Get AI insights
  const {
    data: insightsData,
    isLoading: isLoadingInsights,
    error: insightsError,
  } = useQuery<{
    insights: string[];
    recommendations: string[];
    score: number;
  }>({
    queryKey: ['analytics', 'insights', projectId],
    queryFn: () => api.getAIInsights(projectId),
    enabled: enabled && !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get per-slide analytics
  const {
    data: slideAnalytics,
    isLoading: isLoadingSlides,
    error: slidesError,
  } = useQuery<SlideAnalytics[]>({
    queryKey: ['analytics', 'slides', projectId, timeRange],
    queryFn: () => api.getSlidePerformance(projectId, startDate, endDate),
    enabled: enabled && !!projectId,
    staleTime: 60 * 1000,
  });

  // Get viewer sessions
  const {
    data: viewerSessionsData,
    isLoading: isLoadingSessions,
    error: sessionsError,
  } = useQuery<{ data: ViewerSession[]; total: number }>({
    queryKey: ['analytics', 'sessions', projectId, timeRange],
    queryFn: async () => {
      const response = await api.getViewerSessions(projectId, 1, 50);
      return {
        data: response.data,
        total: response.meta.total,
      };
    },
    enabled: enabled && !!projectId,
    staleTime: 60 * 1000,
  });

  const viewerSessions = viewerSessionsData?.data;

  // Get presentation stats
  const {
    data: stats,
    isLoading: isLoadingStats,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['analytics', 'stats', projectId],
    queryFn: () => api.getPresentationStats(projectId),
    enabled: enabled && !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get heatmap data for a specific slide
  const getSlideHeatmap = async (slideId: string): Promise<HeatmapData[]> => {
    return api.getSlideHeatmap(projectId, slideId);
  };

  // Refresh all analytics
  const refreshAnalytics = () => {
    queryClient.invalidateQueries({ queryKey: ['analytics', 'overview', projectId] });
    queryClient.invalidateQueries({ queryKey: ['analytics', 'slides', projectId] });
    queryClient.invalidateQueries({ queryKey: ['analytics', 'sessions', projectId] });
    queryClient.invalidateQueries({ queryKey: ['analytics', 'stats', projectId] });
    queryClient.invalidateQueries({ queryKey: ['analytics', 'insights', projectId] });
  };

  // Export analytics as CSV/PDF
  const exportAnalyticsMutation = useMutation({
    mutationFn: (format: 'csv' | 'pdf') =>
      api.exportAnalytics(projectId, format, timeRange),
    onSuccess: (data, format) => {
      const blob = new Blob([data], {
        type: format === 'csv' ? 'text/csv' : 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${projectId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  // Calculate derived metrics
  const derivedMetrics = {
    // Top performing slides
    topSlides: slideAnalytics
      ?.sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 3),

    // Slides needing improvement (high drop-off)
    lowPerformingSlides: slideAnalytics
      ?.filter((s) => s.dropoffRate > 30)
      .sort((a, b) => b.dropoffRate - a.dropoffRate),

    // Average session duration
    avgSessionDuration: (() => {
      const totalDuration = viewerSessions?.reduce((acc, s) => acc + s.duration, 0) ?? 0;
      const sessionCount = viewerSessions?.length ?? 0;
      return sessionCount > 0 ? totalDuration / sessionCount : 0;
    })(),

    // Device breakdown
    deviceBreakdown: viewerSessions
      ? viewerSessions.reduce(
        (acc, s) => {
          acc[s.device] = (acc[s.device] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      )
      : {},
  };

  return {
    // Overview
    overview,
    isLoadingOverview,
    overviewError,

    // Insights
    insights: insightsData?.insights || [],
    isLoadingInsights,
    insightsError,

    // Slide analytics
    slideAnalytics,
    isLoadingSlides,
    slidesError,

    // Viewer sessions
    viewerSessions,
    isLoadingSessions,
    sessionsError,

    // Stats
    stats,
    isLoadingStats,
    statsError,
    refetchStats,

    // Derived metrics
    derivedMetrics,

    // Actions
    getSlideHeatmap,
    refreshAnalytics,
    exportAnalytics: exportAnalyticsMutation.mutate,
    isExporting: exportAnalyticsMutation.isPending,

    // Combined loading state
    isLoading:
      isLoadingOverview || isLoadingSlides || isLoadingSessions || isLoadingStats,
  };
}

// Hook for public view tracking (used in present mode)
export function useViewTracking(projectId: string, sessionId?: string) {
  const sessionIdRef = { current: sessionId || crypto.randomUUID() };
  const presentationViewIdRef = { current: '' };
  const currentSlideViewIdRef = { current: '' };

  // Track presentation view start
  const trackViewStart = async () => {
    try {
      const result = await api.trackViewStart(projectId, sessionIdRef.current);
      presentationViewIdRef.current = result.viewId;
      return result;
    } catch (error) {
      console.error('Error tracking view start:', error);
    }
  };

  // Track slide enter
  const trackSlideEnter = async (slideId: string, slideIndex: number) => {
    if (!presentationViewIdRef.current) {return;}

    try {
      const result = await api.trackSlideEnter(presentationViewIdRef.current, slideId, slideIndex) as { id: string };
      currentSlideViewIdRef.current = result.id;
      return result;
    } catch (error) {
      console.error('Error tracking slide enter:', error);
    }
  };

  // Track slide exit
  const trackSlideExit = async () => {
    if (!currentSlideViewIdRef.current) {return;}

    try {
      await api.trackSlideExit(currentSlideViewIdRef.current);
      currentSlideViewIdRef.current = '';
    } catch (error) {
      console.error('Error tracking slide exit:', error);
    }
  };

  // Track slide interaction
  const trackInteraction = async () => {
    if (!currentSlideViewIdRef.current) {return;}

    try {
      await api.trackSlideInteraction(currentSlideViewIdRef.current);
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  };

  // Track heatmap click
  const trackHeatmapClick = async (slideId: string, x: number, y: number) => {
    try {
      await api.trackHeatmap(projectId, slideId, x, y);
    } catch (error) {
      console.error('Error tracking heatmap:', error);
    }
  };

  // Track presentation end
  const trackViewEnd = async () => {
    if (!presentationViewIdRef.current) {return;}

    try {
      await api.trackViewEnd(presentationViewIdRef.current);
    } catch (error) {
      console.error('Error tracking view end:', error);
    }
  };

  return {
    sessionId: sessionIdRef.current,
    trackViewStart,
    trackSlideEnter,
    trackSlideExit,
    trackInteraction,
    trackHeatmapClick,
    trackViewEnd,
  };
}
