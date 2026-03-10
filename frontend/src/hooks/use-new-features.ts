'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============================================
// AI RESEARCH HOOKS
// ============================================

export function useResearch(projectId: string) {
  const queryClient = useQueryClient();

  const queryKey = projectId ? ['research', projectId] : ['research', 'user'];

  const { data: researches, isLoading } = useQuery({
    queryKey,
    queryFn: () => (projectId ? api.research.list(projectId) : api.research.getHistory()),
    enabled: true,
  });

  const startResearch = useMutation({
    mutationFn: (input: { topic: string; depth?: string; sources?: string[] }) =>
      api.research.start(projectId || undefined, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const generateBlocks = useMutation({
    mutationFn: (id: string) => api.research.generateBlocks(id),
  });

  const factCheck = useMutation({
    mutationFn: (id: string) => api.research.factCheck(id),
  });

  return { researches, isLoading, startResearch, generateBlocks, factCheck };
}

export function useResearchDetail(id: string) {
  return useQuery({
    queryKey: ['research', 'detail', id],
    queryFn: () => api.research.get(id),
    enabled: !!id,
  });
}

// ============================================
// STORYBOARDING HOOKS
// ============================================

export function useStoryboards(projectId: string) {
  const queryClient = useQueryClient();

  const { data: storyboards, isLoading } = useQuery({
    queryKey: ['storyboards', projectId],
    queryFn: () => api.storyboard.list(projectId),
  });

  const createStoryboard = useMutation({
    mutationFn: (input: { title: string; narrativeArc?: string; audienceType?: string }) =>
      api.storyboard.create(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storyboards', projectId] }),
  });

  const applyStoryboard = useMutation({
    mutationFn: (id: string) => api.storyboard.apply(id, projectId),
  });

  return { storyboards, isLoading, createStoryboard, applyStoryboard };
}

// ============================================
// A/B TESTING HOOKS
// ============================================

export function useABTests(projectId: string) {
  const queryClient = useQueryClient();

  const { data: tests, isLoading } = useQuery({
    queryKey: ['ab-tests', projectId],
    queryFn: () => api.abTesting.list(projectId),
    enabled: !!projectId,
  });

  const createTest = useMutation({
    mutationFn: (input: { name: string; variants: object[] }) =>
      api.abTesting.create(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ab-tests', projectId] }),
  });

  return { tests, isLoading, createTest };
}

export function useABTestResults(testId: string) {
  return useQuery({
    queryKey: ['ab-test-results', testId],
    queryFn: () => api.abTesting.getResults(testId),
    enabled: !!testId,
    refetchInterval: 30000,
  });
}



// ============================================
// AI COPILOT HOOKS
// ============================================

export function useAICopilot(projectId: string) {
  const createSession = useMutation({
    mutationFn: () => api.copilot.createSession(projectId),
  });

  const sendMessage = useMutation({
    mutationFn: ({ sessionId, message }: { sessionId: string; message: string }) =>
      api.copilot.sendMessage(sessionId, message),
  });

  const executeAction = useMutation({
    mutationFn: ({ sessionId, action, params }: { sessionId: string; action: string; params?: object }) =>
      api.copilot.executeAction(sessionId, action, params),
  });

  return { createSession, sendMessage, executeAction };
}

// ============================================
// UNIVERSAL DESIGN HOOKS
// ============================================

export function useUniversalDesign(projectId: string) {
  const checkDesign = useMutation({
    mutationFn: (options: { guidelines: string[] }) =>
      api.universalDesign.check(projectId, options as Record<string, unknown>),
  });

  const report = useQuery({
    queryKey: ['universal-design-report', projectId],
    queryFn: () => api.universalDesign.getReport(projectId),
    enabled: !!projectId,
  });

  const culturalGuide = useQuery({
    queryKey: ['cultural-guide', projectId],
    queryFn: () => api.universalDesign.getCulturalGuide(projectId),
    enabled: !!projectId,
  });

  return { checkDesign, report, culturalGuide };
}

// ============================================
// PREDICTIVE ANALYTICS HOOK
// ============================================

export function usePredictiveAnalytics(projectId: string, days: number = 30) {
  return useQuery({
    queryKey: ['predictive-analytics', projectId, days],
    queryFn: () => api.getPredictiveAnalytics(projectId, days),
    enabled: !!projectId,
  });
}

// ============================================
// API KEYS HOOKS
// ============================================

export function useAPIKeys() {
  const queryClient = useQueryClient();

  const keys = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.apiKeys.list(),
  });

  const usage = useQuery({
    queryKey: ['api-usage'],
    queryFn: () => api.apiKeys.getUsage(),
  });

  const createKey = useMutation({
    mutationFn: (input: { name: string; scopes: string[]; expiresInDays?: number }) =>
      api.apiKeys.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const revokeKey = useMutation({
    mutationFn: (id: string) => api.apiKeys.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  return { keys, usage, createKey, revokeKey };
}


// ============================================
// BRAND KIT HOOKS
// ============================================

export function useBrandKits(organizationId?: string) {
  const queryClient = useQueryClient();

  const brandKits = useQuery({
    queryKey: ['brand-kits', organizationId],
    queryFn: () => api.brandKit.list(organizationId),
  });

  const defaultKit = useQuery({
    queryKey: ['brand-kit-default', organizationId],
    queryFn: () => api.brandKit.getDefault(organizationId),
  });

  const createBrandKit = useMutation({
    mutationFn: (data: Parameters<typeof api.createBrandKit>[0]) =>
      api.brandKit.create(data, organizationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-kits'] }),
  });

  const updateBrandKit = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      api.brandKit.update(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-kits'] }),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.brandKit.setDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
      queryClient.invalidateQueries({ queryKey: ['brand-kit-default'] });
    },
  });

  const duplicateBrandKit = useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      api.brandKit.duplicate(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-kits'] }),
  });

  const deleteBrandKit = useMutation({
    mutationFn: (id: string) => api.brandKit.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-kits'] }),
  });

  return { brandKits, defaultKit, createBrandKit, updateBrandKit, setDefault, duplicateBrandKit, deleteBrandKit };
}

export function useBrandKitDetail(id: string) {
  return useQuery({
    queryKey: ['brand-kit', id],
    queryFn: () => api.brandKit.get(id),
    enabled: !!id,
  });
}

// ============================================
// CONTENT LIBRARY HOOKS
// ============================================

export function useContentLibrary(options?: {
  type?: 'slide' | 'block';
  category?: string;
  search?: string;
}) {
  const queryClient = useQueryClient();

  const items = useQuery({
    queryKey: ['library', options],
    queryFn: () => api.library.get(options),
  });

  const templates = useQuery({
    queryKey: ['library-templates', options?.type],
    queryFn: () => api.library.getTemplates(options?.type),
  });

  const saveItem = useMutation({
    mutationFn: (item: Parameters<typeof api.saveToLibrary>[0]) =>
      api.library.save(item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library'] }),
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => api.library.delete(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library'] }),
  });

  return { items, templates, saveItem, deleteItem };
}

// ============================================
// IMAGE ACQUISITION HOOKS
// ============================================

export function useImageAcquisition(projectId: string) {
  const sources = useQuery({
    queryKey: ['image-sources'],
    queryFn: () => api.imageAcquisition.getSources(),
  });

  const acquire = useMutation({
    mutationFn: (options: Omit<Parameters<typeof api.acquireImage>[0], 'projectId'>) =>
      api.imageAcquisition.acquire({ ...options, projectId }),
  });

  const smartAcquire = useMutation({
    mutationFn: (options: Omit<Parameters<typeof api.smartAcquireImage>[0], 'projectId'>) =>
      api.imageAcquisition.smartAcquire({ ...options, projectId }),
  });

  const bulkAcquire = useMutation({
    mutationFn: (options: Omit<Parameters<typeof api.bulkAcquireImages>[0], 'projectId'>) =>
      api.imageAcquisition.bulkAcquire({ ...options, projectId }),
  });

  return { sources, acquire, smartAcquire, bulkAcquire };
}

export function useImageAcquisitionJob(jobId: string) {
  return useQuery({
    queryKey: ['image-acquisition-job', jobId],
    queryFn: () => api.imageAcquisition.getJobStatus(jobId),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const state = query.state.data?.job?.state;
      if (state === 'completed' || state === 'failed') { return false; }
      return 2000;
    },
  });
}

// ============================================
// IMAGE RECOGNITION HOOKS
// ============================================

export function useImageRecognition(projectId?: string) {
  const queryClient = useQueryClient();

  const imagesInProject = useQuery({
    queryKey: ['project-images', projectId],
    queryFn: () => api.imageRecognition.getInPresentation(projectId ?? ''),
    enabled: !!projectId,
  });

  const analytics = useQuery({
    queryKey: ['image-analytics'],
    queryFn: () => api.imageRecognition.getAnalytics(),
  });

  const findSimilar = useMutation({
    mutationFn: ({ uploadId, limit, minSimilarity }: { uploadId: string; limit?: number; minSimilarity?: number }) =>
      api.imageRecognition.findSimilar(uploadId, limit, minSimilarity),
  });

  const trackUsage = useMutation({
    mutationFn: (usage: Parameters<typeof api.trackImageUsage>[0]) =>
      api.imageRecognition.trackUsage(usage),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-images'] }),
  });

  const predict = useMutation({
    mutationFn: (options: Parameters<typeof api.predictImagesForPresentation>[0]) =>
      api.imageRecognition.predict(options),
  });

  const describe = useMutation({
    mutationFn: (imageUrl: string) =>
      api.imageRecognition.describe(imageUrl),
  });

  return { imagesInProject, analytics, findSimilar, trackUsage, predict, describe };
}

// ============================================
// PRESENTATION COACH HOOKS
// ============================================

export function usePresentationCoach() {
  const analyze = useMutation({
    mutationFn: (input: Parameters<typeof api.analyzePresentation>[0]) =>
      api.coach.analyze(input),
  });

  const rehearsalFeedback = useMutation({
    mutationFn: (input: Parameters<typeof api.getRehearsalFeedback>[0]) =>
      api.coach.rehearsalFeedback(input),
  });

  const improveSlide = useMutation({
    mutationFn: (input: Parameters<typeof api.suggestSlideImprovements>[0]) =>
      api.coach.improveSlide(input),
  });

  const speakerNotes = useMutation({
    mutationFn: (input: Parameters<typeof api.generateCoachSpeakerNotes>[0]) =>
      api.coach.speakerNotes(input),
  });

  return { analyze, rehearsalFeedback, improveSlide, speakerNotes };
}

// ============================================
// DATA IMPORT HOOKS
// ============================================

export function useDataImport() {
  const upload = useMutation({
    mutationFn: (formData: FormData) => api.dataImport.upload(formData),
  });

  const generatePresentation = useMutation({
    mutationFn: (formData: FormData) => api.dataImport.generatePresentation(formData),
  });

  const previewSheets = useMutation({
    mutationFn: (formData: FormData) => api.dataImport.previewSheets(formData),
  });

  const analyzeData = useMutation({
    mutationFn: ({ formData, sheetName }: { formData: FormData; sheetName?: string }) =>
      api.dataImport.analyze(formData, sheetName),
  });

  return { upload, generatePresentation, previewSheets, analyzeData };
}
