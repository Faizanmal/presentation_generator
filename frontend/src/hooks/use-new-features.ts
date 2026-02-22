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
// VR/AR HOOKS
// ============================================

export function useVRExport(projectId: string) {
  const exportToVR = useMutation({
    mutationFn: (options?: object) => api.vr.export(projectId, options),
  });

  const generateARMarker = useMutation({
    mutationFn: () => api.vr.generateMarker(projectId),
  });

  return { exportToVR, generateARMarker };
}

// ============================================
// HOLOGRAPHIC HOOKS
// ============================================

export function useHolographic(projectId: string) {
  const { data: formats } = useQuery({
    queryKey: ['holographic-formats'],
    queryFn: () => api.holographic.getFormats(),
  });

  const createPreview = useMutation({
    mutationFn: (input: { format: string; settings?: object }) =>
      api.holographic.create(projectId, input),
  });

  return { formats, createPreview };
}

// ============================================
// BLOCKCHAIN/NFT HOOKS
// ============================================

export function useNFTCollections() {
  const queryClient = useQueryClient();

  const { data: collections, isLoading } = useQuery({
    queryKey: ['nft-collections'],
    queryFn: () => api.blockchain.listCollections(),
  });

  const createCollection = useMutation({
    mutationFn: (input: { name: string; chain: string; description?: string }) =>
      api.blockchain.createCollection(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nft-collections'] }),
  });

  const mintNFT = useMutation({
    mutationFn: ({ collectionId, input }: { collectionId: string; input: { presentationId: string; name: string; description?: string } }) =>
      api.blockchain.mint(collectionId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nft-collections'] }),
  });

  return { collections, isLoading, createCollection, mintNFT };
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
// LIVE Q&A HOOKS
// ============================================

export function useLiveQA(projectId: string) {
  const _queryClient = useQueryClient();

  const createSession = useMutation({
    mutationFn: (settings?: object) => api.qa.createSession(projectId, settings),
  });

  const endSession = useMutation({
    mutationFn: (sessionId: string) => api.qa.endSession(sessionId),
  });

  return { createSession, endSession };
}

export function useQASession(sessionId: string) {
  return useQuery({
    queryKey: ['qa-session', sessionId],
    queryFn: () => api.qa.getSession(sessionId),
    enabled: !!sessionId,
    refetchInterval: 5000,
  });
}

// ============================================
// CROSS-PLATFORM SYNC HOOKS
// ============================================

export function useCrossPlatformSync() {
  const queryClient = useQueryClient();

  const devices = useQuery({
    queryKey: ['sync-devices'],
    queryFn: () => api.crossSync.listDevices(),
  });

  const syncStatus = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => api.crossSync.getSyncStatus(),
    refetchInterval: 10000,
  });

  const registerDevice = useMutation({
    mutationFn: (input: { name: string; type: string; capabilities: string[] }) =>
      api.crossSync.registerDevice(input as Record<string, unknown>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync-devices'] }),
  });

  const resolveConflict = useMutation({
    mutationFn: (conflictId: string) => api.crossSync.resolveConflict(conflictId),
  });

  return { devices, syncStatus, registerDevice, resolveConflict };
}

// ============================================
// PREDICTIVE ANALYTICS HOOKS
// ============================================

export function usePredictiveAnalytics(projectId: string) {
  const insightsQuery = useQuery({
    queryKey: ['predictive-insights', projectId],
    queryFn: () => api.predictive.getInsights(projectId),
    enabled: !!projectId,
  });

  const recommendationsQuery = useQuery({
    queryKey: ['predictive-recommendations', projectId],
    queryFn: () => api.predictive.getRecommendations(projectId),
    enabled: !!projectId,
  });

  const benchmarksQuery = useQuery({
    queryKey: ['predictive-benchmarks', projectId],
    queryFn: () => api.predictive.getBenchmarks(projectId),
    enabled: !!projectId,
  });

  // Return the full query objects so callers can access loading / error state
  return {
    insights: insightsQuery,
    recommendations: recommendationsQuery,
    benchmarks: benchmarksQuery,
  };
}

// ============================================
// SENTIMENT ANALYSIS HOOKS
// ============================================

export function useSentimentAnalysis(projectId: string) {
  const startSession = useMutation({
    mutationFn: (options: { source: string; language: string }) =>
      api.sentiment.startSession(projectId, options as Record<string, unknown>),
  });

  return { startSession };
}

export function useSentimentSession(sessionId: string) {
  return useQuery({
    queryKey: ['sentiment-session', sessionId],
    queryFn: () => api.sentiment.getSession(sessionId),
    enabled: !!sessionId,
    refetchInterval: 3000,
  });
}

// ============================================
// LEARNING PATHS HOOKS
// ============================================

export function useLearningPaths() {
  const queryClient = useQueryClient();

  const paths = useQuery({
    queryKey: ['learning-paths'],
    queryFn: () => api.learningPaths.list(),
  });

  const createPath = useMutation({
    mutationFn: (input: { title: string; description: string; modules: object[] }) =>
      api.learningPaths.create(input as Record<string, unknown>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['learning-paths'] }),
  });

  const updateProgress = useMutation({
    mutationFn: ({ pathId, moduleId, completed }: { pathId: string; moduleId: string; completed: boolean }) =>
      api.learningPaths.updateProgress(pathId, moduleId, completed),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['learning-paths'] }),
  });

  const getCertificate = useMutation({
    mutationFn: (pathId: string) => api.learningPaths.getCertificate(pathId),
  });

  return { paths, createPath, updateProgress, getCertificate };
}

// ============================================
// SIGN LANGUAGE HOOKS
// ============================================

export function useSignLanguage() {
  const config = useQuery({
    queryKey: ['sign-language-config'],
    queryFn: () => api.signLanguage.getConfig(),
  });

  const supportedLanguages = useQuery({
    queryKey: ['sign-languages'],
    queryFn: () => api.signLanguage.getLanguages(),
  });

  const updateConfig = useMutation({
    mutationFn: (newConfig: object) => api.signLanguage.updateConfig('default', newConfig),
  });

  const translate = useMutation({
    mutationFn: (input: { text: string; language?: string }) => api.signLanguage.translate(input),
  });

  return { config, supportedLanguages, updateConfig, translate };
}

// ============================================
// COGNITIVE ACCESSIBILITY HOOKS
// ============================================

export function useCognitiveAccessibility() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['cognitive-profile'],
    queryFn: () => api.cognitiveAccess.getProfile(),
  });

  const { data: presets } = useQuery({
    queryKey: ['cognitive-presets'],
    queryFn: () => api.cognitiveAccess.getPresets(),
  });

  const updateProfile = useMutation({
    mutationFn: (settings: object) => api.cognitiveAccess.updateProfile(settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cognitive-profile'] }),
  });

  const applyPreset = useMutation({
    mutationFn: (name: string) => api.cognitiveAccess.applyPreset(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cognitive-profile'] }),
  });

  const simplifyText = useMutation({
    mutationFn: ({ text, level }: { text: string; level?: string }) => api.cognitiveAccess.simplifyText(text, level),
  });

  return { profile, presets, isLoading, updateProfile, applyPreset, simplifyText };
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
// WHITE-LABEL SDK HOOKS
// ============================================

export function useSDKConfigurations() {
  const queryClient = useQueryClient();

  const configs = useQuery({
    queryKey: ['sdk-configs'],
    queryFn: () => api.sdk.list(),
  });

  const createConfig = useMutation({
    mutationFn: (input: { name: string; domain?: string; branding?: object; features?: string[] }) =>
      api.sdk.create(input as Record<string, unknown>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sdk-configs'] }),
  });

  const updateConfig = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: object }) =>
      api.sdk.update(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sdk-configs'] }),
  });

  const getEmbedCode = useMutation({
    mutationFn: (id: string) => api.sdk.getEmbedCode(id),
  });

  const getReactComponent = useMutation({
    mutationFn: (id: string) => api.sdk.getReactComponent(id),
  });

  return { configs, createConfig, updateConfig, getEmbedCode, getReactComponent };
}

// ============================================
// IOT INTEGRATION HOOKS
// ============================================

export function useIoTDevices() {
  const queryClient = useQueryClient();

  const devices = useQuery({
    queryKey: ['iot-devices'],
    queryFn: () => api.iot.list(),
  });

  const deviceTypes = useQuery({
    queryKey: ['iot-device-types'],
    queryFn: () => api.iot.getDeviceTypes(),
  });

  const registerDevice = useMutation({
    mutationFn: (input: { name: string; type: string; connectionString?: string }) =>
      api.iot.register(input as Record<string, unknown>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iot-devices'] }),
  });

  const sendCommand = useMutation({
    mutationFn: ({ deviceId, command, params }: { deviceId: string; command: string; params?: object }) =>
      api.iot.sendCommand(deviceId, { action: command, payload: params }),
  });

  const revokeDevice = useMutation({
    mutationFn: (id: string) => api.iot.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iot-devices'] }),
  });

  return { devices, deviceTypes, registerDevice, sendCommand, revokeDevice };
}

// ============================================
// ECO-FRIENDLY HOOKS
// ============================================

export function useEcoFriendly(projectId?: string) {
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: ['eco-settings'],
    queryFn: () => api.eco.getSettings(),
  });

  const tips = useQuery({
    queryKey: ['eco-tips'],
    queryFn: () => api.eco.getTips(),
  });

  const updateSettings = useMutation({
    mutationFn: (newSettings: object) => api.eco.updateSettings(newSettings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['eco-settings'] }),
  });

  const optimize = useMutation({
    mutationFn: (options: { targets: string[]; aggressiveness: string }) =>
      api.eco.optimize(projectId || '', options as Record<string, unknown>),
  });

  const trackMetrics = useMutation({
    mutationFn: (data: object) => api.eco.trackMetrics(data as Record<string, unknown>),
  });

  return { settings, tips, updateSettings, optimize, trackMetrics };
}

// ============================================
// PRESENTER WELLNESS HOOKS
// ============================================

export function usePresenterWellness() {
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: ['wellness-history'],
    queryFn: () => api.wellness.getHistory(),
  });

  const trends = useQuery({
    queryKey: ['wellness-trends'],
    queryFn: () => api.wellness.getTrends(),
  });

  const breakReminders = useQuery({
    queryKey: ['break-reminders'],
    queryFn: () => api.wellness.getBreakReminders(),
  });

  const startSession = useMutation({
    mutationFn: (input: { type: string; breakInterval: number }) =>
      api.wellness.startSession(input as Record<string, unknown>),
  });

  const endSession = useMutation({
    mutationFn: (sessionId: string) => api.wellness.endSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wellness-history'] }),
  });

  const recordBreak = useMutation({
    mutationFn: (input: { sessionId: string; duration: number; type: string }) =>
      api.wellness.recordBreak(input as Record<string, unknown>),
  });

  const analyzePace = useMutation({
    mutationFn: (sessionId: string) => api.wellness.analyzePace(sessionId),
  });

  const detectStress = useMutation({
    mutationFn: (sessionId: string) => api.wellness.detectStress(sessionId),
  });

  return { history, trends, breakReminders, startSession, endSession, recordBreak, analyzePace, detectStress };
}

// ============================================
// CARBON FOOTPRINT HOOKS
// ============================================

export function useCarbonFootprint(projectId?: string) {
  const queryClient = useQueryClient();

  const footprint = useQuery({
    queryKey: ['carbon-footprint', projectId],
    queryFn: () => api.carbon.getFootprint(projectId || ''),
    enabled: !!projectId,
  });

  const ecoReport = useQuery({
    queryKey: ['eco-report', projectId],
    queryFn: () => api.carbon.getReport(projectId || ''),
    enabled: !!projectId,
  });

  const badges = useQuery({
    queryKey: ['eco-badges'],
    queryFn: () => api.carbon.getBadges(),
  });

  const offsetOptions = useQuery({
    queryKey: ['carbon-offset-options'],
    queryFn: () => api.carbon.getOffsetOptions(),
  });

  const offsetHistory = useQuery({
    queryKey: ['carbon-offset-history'],
    queryFn: () => api.carbon.getOffsetHistory(),
  });

  const purchaseOffset = useMutation({
    mutationFn: (input: { optionId: string; amount: number }) =>
      api.carbon.purchaseOffset(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['carbon-offset-history'] }),
  });

  return { footprint, ecoReport, badges, offsetOptions, offsetHistory, purchaseOffset };
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
