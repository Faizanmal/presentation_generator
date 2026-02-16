// ============================================
// USER & AUTH TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  name: string;
  password: string;
}

// ============================================
// PROJECT TYPES
// ============================================

export type ProjectType = 'PRESENTATION' | 'DOCUMENT';
export type ProjectStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface Project {
  id: string;
  title: string;
  description: string | null;
  type: ProjectType;
  status: ProjectStatus;
  isPublic: boolean;
  shareToken: string | null;
  themeId: string | null;
  theme: Theme | null;
  ownerId: string;
  owner?: {
    id: string;
    name: string | null;
    image: string | null;
  };
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    slides: number;
    blocks: number;
  };
}

export interface CreateProjectInput {
  title: string;
  description?: string;
  type?: string;
}

export interface GenerateProjectInput {
  topic: string;
  tone?: string;
  audience?: string;
  length?: number;
  type?: string;
  generateImages?: boolean;
  imageSource?: 'ai' | 'stock';
}

// ============================================
// SLIDE TYPES
// ============================================

export interface Slide {
  id: string;
  title?: string;
  projectId: string;
  order: number;
  layout: string;
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSlideInput {
  projectId?: string;
  title?: string;
  order: number;
  layout?: string;
}

// ============================================
// BLOCK TYPES
// ============================================

export type BlockType =
  | 'HEADING'
  | 'SUBHEADING'
  | 'PARAGRAPH'
  | 'BULLET_LIST'
  | 'NUMBERED_LIST'
  | 'IMAGE'
  | 'CODE'
  | 'QUOTE'
  | 'DIVIDER'
  | 'TABLE'
  | 'EMBED';

export interface BlockContent {
  text?: string;
  url?: string;
  alt?: string;
  items?: string[];
  code?: string;
  language?: string;
  author?: string;
  rows?: string[][];
  chartData?: {
    type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
    }[];
  };
  [key: string]: unknown;
}

export interface BlockStyle {
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: string;
  color?: string;
  backgroundColor?: string;
  [key: string]: string | undefined;
}

export interface Block {
  id: string;
  projectId: string;
  slideId: string | null;
  type: BlockType;
  blockType?: BlockType; // Alias for compatibility
  content: BlockContent;
  style: BlockStyle | null;
  formatting?: {
    bold?: boolean;
    size?: string;
    alignment?: string;
    color?: string;
    variant?: string;
  };
  chartData?: {
    type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
    }[];
  };
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlockInput {
  projectId: string;
  slideId?: string;
  blockType: BlockType;
  content: BlockContent;
  order: number;
  style?: BlockStyle;
}

export interface UpdateBlockInput {
  content?: BlockContent;
  order?: number;
  style?: BlockStyle;
  blockType?: BlockType;
}

// ============================================
// THEME TYPES
// ============================================

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
}

export interface ThemeFonts {
  heading: string;
  body: string;
}

export interface ThemeSpacing {
  base: number;
  scale: number;
}

export interface Theme {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isPremium: boolean;
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
}

// ============================================
// SUBSCRIPTION TYPES
// ============================================

export type SubscriptionPlan = 'FREE' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'TRIALING' | 'PAUSED';

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  projectsLimit: number;
  projectsUsed: number;
  aiGenerationsLimit: number;
  aiGenerationsUsed: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

// ============================================
// UPLOAD TYPES
// ============================================

export interface Asset {
  id: string;
  userId: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

// ============================================
// COLLABORATION TYPES
// ============================================

export type CollaboratorRole = 'VIEWER' | 'EDITOR' | 'ADMIN';

export interface Collaborator {
  id: string;
  projectId: string;
  userId: string;
  role: CollaboratorRole;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  joinedAt: string;
}

export interface CollaborationSession {
  id: string;
  projectId: string;
  activeUsers: ActiveUser[];
  startedAt: string;
}

export interface ActiveUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  cursor?: { x: number; y: number; slideId?: string };
  color: string;
}

export interface Comment {
  id: string;
  projectId: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  slideId?: string;
  blockId?: string;
  content: string;
  resolved: boolean;
  parentId?: string;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  name?: string;
  snapshot: unknown;
  createdById: string;
  createdBy: {
    id: string;
    name: string | null;
  };
  createdAt: string;
}

// ============================================
// VOICE-TO-SLIDE TYPES
// ============================================

export type VoiceProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface VoiceRecording {
  id: string;
  userId: string;
  projectId?: string;
  filename: string;
  url: string;
  duration: number;
  transcription?: string;
  status: VoiceProcessingStatus;
  createdAt: string;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface AnalyticsOverview {
  totalViews: number;
  uniqueViewers: number;
  avgViewDuration: number;
  completionRate: number;
  engagementScore: number;
  viewsByDay: { date: string; views: number }[];
}

export interface SlideAnalytics {
  slideId: string;
  slideNumber: number;
  views: number;
  avgDuration: number;
  dropoffRate: number;
  engagementScore: number;
}

export interface ViewerSession {
  id: string;
  viewerId: string;
  viewerEmail?: string;
  startTime: string;
  endTime?: string;
  duration: number;
  slidesViewed: number;
  completionPercentage: number;
  device: string;
  browser: string;
  location?: string;
}

export interface HeatmapData {
  slideId: string;
  x: number;
  y: number;
  intensity: number;
}

export interface AIInsight {
  type: 'improvement' | 'warning' | 'tip' | 'success';
  title: string;
  description: string;
  actionable: boolean;
  priority: 'high' | 'medium' | 'low';
  slideId?: string;
  metric?: string;
  value?: number;
  implementation?: string;
  expectedImpact?: string;
}

export interface StructuredInsightsResponse {
  insights: AIInsight[];
  generatedAt: string;
}

export interface PredictiveAnalytics {
  forecast: Array<{
    date: string;
    predictedViews: number;
  }>;
  trend: 'growing' | 'declining' | 'stable' | 'insufficient_data';
  confidence: number;
  projectedGrowth: number;
  insights: string[];
}

export interface RealTimeMetrics {
  activeViewers: number;
  viewsLastHour: number;
  viewsLast24Hours: number;
  engagementRate: number;
  timestamp: string;
}

export interface AudienceSegments {
  devices: Record<string, number>;
  browsers: Record<string, number>;
  engagement: {
    high: number;
    medium: number;
    low: number;
  };
  totalAudience: number;
  insights: string[];
}

export interface ContentOptimization {
  suggestions: Array<{
    slideNumber: number;
    type: 'content' | 'design' | 'engagement' | 'pacing';
    issue: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
    expectedImpact: string;
  }>;
}

// ============================================
// INTEGRATION TYPES
// ============================================

export type IntegrationProvider =
  | 'ZOOM'
  | 'SLACK'
  | 'TEAMS'
  | 'GOOGLE_DRIVE'
  | 'FIGMA'
  | 'NOTION';

export interface Integration {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// INTEGRATION FILE TYPES
// ============================================

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailLink?: string;
}

export interface FigmaFile {
  id: string;
  name: string;
  thumbnailUrl: string;
  lastModified: Date;
}

export interface NotionPage {
  id: string;
  title: string;
  icon?: string;
  lastEdited: Date;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
  failureCount: number;
}

// ============================================
// MEETING INTEGRATION TYPES
// ============================================

export interface ZoomMeeting {
  id: string;
  topic: string;
  startUrl: string;
  joinUrl: string;
  startTime: Date;
  duration: number;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

// ============================================
// PERSONALIZATION / BRAND TYPES
// ============================================

export interface BrandProfile {
  id: string;
  userId: string;
  name: string;
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  voiceTone?: string;
  industry?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface TrainingDocument {
  id: string;
  userId: string;
  title: string;
  filename: string;
  fileType: string;
  status: DocumentStatus;
  wordCount?: number;
  createdAt: string;
}

export interface AIPersonalization {
  id: string;
  userId: string;
  writingStyle?: string;
  preferredTone?: string;
  defaultAudience?: string;
  avoidPhrases?: string[];
  preferredPhrases?: string[];
  industryTerms?: string[];
}

// ============================================
// ORGANIZATION / ENTERPRISE TYPES
// ============================================

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customDomain?: string;
  plan: 'STARTER' | 'TEAM' | 'ENTERPRISE';
  ssoEnabled: boolean;
  createdAt: string;
  memberCount: number;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  joinedAt: string;
  lastActiveAt?: string;
}

export interface TeamInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  invitedById: string;
  invitedBy: {
    name: string | null;
    email: string;
  };
  token: string;
  createdAt: string;
  expiresAt: string;
}

export type SSOProvider = 'SAML' | 'OIDC';

export interface SSOConfig {
  id: string;
  organizationId: string;
  provider: SSOProvider;
  enabled: boolean;
  domain: string;
  issuer?: string;
  ssoUrl?: string;
  certificate?: string;
  clientId?: string;
}

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  action: string;
  actorId: string;
  actor: {
    id: string;
    email: string;
    name: string | null;
  };
  resourceType: string;
  resourceId: string;
  resourceName?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface WhiteLabelConfig {
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

// ============================================
// SYNC / OFFLINE TYPES
// ============================================

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'CONFLICT' | 'FAILED';

export interface SyncQueueItem {
  id: string;
  operation: SyncOperation;
  entityType: 'PROJECT' | 'SLIDE' | 'BLOCK';
  entityId: string;
  data: unknown;
  timestamp: number;
  status: SyncStatus;
}

export interface SyncConflict {
  id: string;
  entityType: 'PROJECT' | 'SLIDE' | 'BLOCK';
  entityId: string;
  localVersion: unknown;
  serverVersion: unknown;
  createdAt: string;
}

export interface OfflineCache {
  key: string;
  data: unknown;
  timestamp: number;
  expiresAt?: number;
}

// ============================================
// TAG TYPES
// ============================================

export interface Tag {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    projects: number;
  };
}

export interface CreateTagInput {
  name: string;
  color: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

// ============================================
// AI THINKING MODE TYPES
// ============================================

export type ThinkingPhase = 'planning' | 'research' | 'generation' | 'reflection' | 'refinement' | 'complete';

export interface ThinkingStep {
  stepNumber: number;
  phase: ThinkingPhase;
  thought: string;
  action: string;
  observation: string;
  timestamp: string;
}

export interface ThinkingState {
  currentPhase: ThinkingPhase;
  iteration: number;
  maxIterations: number;
  overallProgress: number;
  qualityScore?: number;
  targetQualityScore: number;
}

export interface ThinkingSection {
  id: string;
  heading: string;
  subheading?: string;
  blocks: Array<{
    id: string;
    type: string;
    content: string;
    formatting?: {
      bold?: boolean;
      size?: string;
      alignment?: string;
      color?: string;
      variant?: string;
    };
    chartData?: {
      type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
      labels: string[];
      datasets: {
        label: string;
        data: number[];
        backgroundColor?: string | string[];
      }[];
    };
  }>;
  layout: string;
  suggestedImage?: {
    prompt: string;
    style: string;
    placement: string;
  };
  speakerNotes?: string;
  transition?: string;
  duration?: number;
}

export interface ThinkingPresentation {
  title: string;
  subtitle?: string;
  sections: ThinkingSection[];
  metadata: {
    estimatedDuration: number;
    keywords: string[];
    summary: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    category: string;
  };
}

export interface QualityScore {
  criterion: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface ImprovementSuggestion {
  area: string;
  currentState: string;
  suggestedChange: string;
  priority: 'high' | 'medium' | 'low';
  affectedSections: number[];
}

export interface QualityReport {
  overallScore: number;
  categoryScores: QualityScore[];
  improvements: ImprovementSuggestion[];
  passedQualityThreshold: boolean;
  summary: string;
}

export interface ThinkingGenerationResult {
  presentation: ThinkingPresentation;
  qualityReport: QualityReport;
  thinkingSteps: ThinkingStep[];
  thinkingProcess?: {
    steps: ThinkingStep[];
  };
  metadata: {
    totalIterations: number;
    totalTokensUsed: number;
    generationTimeMs: number;
    qualityImprovement: number;
    generateImages?: boolean;
  };
}

// ============================================
// AI RESEARCH TYPES
// ============================================

export interface ContentResearch {
  id: string;
  projectId: string;
  topic: string;
  status: string;
  sources: ContentResearchSource[];
  keyFindings: string[];
  suggestedContent: object[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentResearchSource {
  id: string;
  title: string;
  url: string;
  sourceType: string;
  content: string;
  relevanceScore: number;
  credibilityScore: number;
}

export interface ContentBlock {
  type: string;
  title: string;
  content: string;
  suggestedVisuals: string[];
  talkingPoints: string[];
}

// ============================================
// STORYBOARDING TYPES
// ============================================

export interface Storyboard {
  id: string;
  projectId: string;
  title: string;
  narrativeArc: string;
  status: string;
  sections: StoryboardSection[];
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardSection {
  id: string;
  title: string;
  content: string;
  order: number;
  speakerNotes: string;
  duration: number;
  transition: string;
}

// ============================================
// A/B TESTING TYPES
// ============================================

export interface ABTest {
  id: string;
  projectId: string;
  name: string;
  status: string;
  variants: ABTestVariant[];
  metrics: object;
  results: object;
  startedAt: string;
  endedAt?: string;
}

export interface ABTestVariant {
  id: string;
  name: string;
  config: object;
  impressions: number;
  engagementScore: number;
}

// ============================================
// VR/AR TYPES
// ============================================

export interface VRExport {
  id: string;
  projectId: string;
  format: string;
  status: string;
  outputUrl?: string;
  settings: object;
}

// ============================================
// HOLOGRAPHIC TYPES
// ============================================

export interface HolographicPreview {
  id: string;
  projectId: string;
  format: string;
  status: string;
  outputUrl?: string;
  settings: object;
}

// ============================================
// BLOCKCHAIN/NFT TYPES
// ============================================

export interface NFTCollection {
  id: string;
  name: string;
  chain: string;
  contractAddress?: string;
  status: string;
  nfts: NFTToken[];
}

export interface NFTToken {
  id: string;
  tokenId?: string;
  name: string;
  status: string;
  txHash?: string;
  metadata: object;
}

// ============================================
// AI COPILOT TYPES
// ============================================

export interface AIChatSession {
  id: string;
  projectId: string;
  messages: AIChatMessage[];
  createdAt: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: object;
  timestamp: string;
}

// ============================================
// LIVE Q&A TYPES
// ============================================

export interface LiveQASession {
  id: string;
  projectId: string;
  status: string;
  settings: object;
  questions: LiveQAQuestion[];
  createdAt: string;
}

export interface LiveQAQuestion {
  id: string;
  content: string;
  author: string;
  votes: number;
  status: string;
  aiAnswer?: string;
  createdAt: string;
}

// ============================================
// CROSS-PLATFORM SYNC TYPES
// ============================================

export interface DeviceSync {
  id: string;
  deviceName: string;
  deviceType: string;
  lastSyncedAt: string;
  status: string;
}

export interface SyncConflict {
  id: string;
  type: string;
  deviceA: string;
  deviceB: string;
  conflictData: object;
  resolution?: string;
}

// ============================================
// PREDICTIVE ANALYTICS TYPES
// ============================================

export interface PredictiveInsight {
  id: string;
  projectId: string;
  type: string;
  prediction: object;
  score: number;
  factors: object[];
  recommendations: string[];
  createdAt: string;
}

// ============================================
// SENTIMENT ANALYSIS TYPES
// ============================================

export interface SentimentSession {
  id: string;
  projectId: string;
  status: string;
  overallSentiment: number;
  timeline: SentimentDataPoint[];
  alerts: object[];
}

export interface SentimentDataPoint {
  timestamp: string;
  sentiment: number;
  engagement: number;
  dominantEmotion: string;
}

// ============================================
// LEARNING PATHS TYPES
// ============================================

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedHours: number;
  modules: LearningModule[];
  progress?: number;
  status: string;
}

export interface LearningModule {
  id: string;
  title: string;
  type: string;
  content: object;
  order: number;
  completed?: boolean;
}

// ============================================
// SIGN LANGUAGE TYPES
// ============================================

export interface SignLanguageConfig {
  id: string;
  projectId: string;
  language: string;
  avatarStyle: string;
  position: string;
  size: string;
  translations: object[];
}

// ============================================
// COGNITIVE ACCESSIBILITY TYPES
// ============================================

export interface CognitiveAccessibilityProfile {
  id: string;
  name: string;
  preset?: string;
  settings: {
    fontSize: string;
    fontFamily: string;
    lineSpacing: number;
    colorScheme: string;
    reducedMotion: boolean;
    simplifiedLayout: boolean;
    readingGuide: boolean;
    textToSpeech: boolean;
  };
}

// ============================================
// UNIVERSAL DESIGN TYPES
// ============================================

export interface UniversalDesignReport {
  id: string;
  projectId: string;
  score: number;
  issues: DesignIssue[];
  suggestions: string[];
  wcagLevel: string;
}

export interface DesignIssue {
  type: string;
  severity: 'critical' | 'major' | 'minor';
  element: string;
  description: string;
  suggestion: string;
}

// ============================================
// PUBLIC API TYPES
// ============================================

export interface APIKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  status: string;
  usage: { count: number; limit: number };
}

// ============================================
// WHITE-LABEL SDK TYPES
// ============================================

export interface SDKConfiguration {
  id: string;
  sdkKey: string;
  name: string;
  branding: {
    logoUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
  features: string[];
  status: string;
  instances: SDKInstance[];
}

export interface SDKInstance {
  id: string;
  name: string;
  domain: string;
  status: string;
  usage: object;
}

// ============================================
// IOT INTEGRATION TYPES
// ============================================

export interface IoTDevice {
  id: string;
  name: string;
  deviceType: string;
  capabilities: object;
  manufacturer?: string;
  model?: string;
  status: string;
  state: { connected: boolean; battery?: number };
  lastConnectedAt?: string;
}

// ============================================
// ECO-FRIENDLY TYPES
// ============================================

export interface EcoSettings {
  lowPowerMode: boolean;
  reducedAnimations: boolean;
  compressImages: boolean;
  darkModePreferred: boolean;
  offlineFirst: boolean;
  streamQuality: 'low' | 'medium' | 'high' | 'auto';
  cacheStrategy: 'aggressive' | 'moderate' | 'minimal';
}

export interface EcoOptimizationResult {
  presentationId: string;
  originalSize: number;
  optimizedSize: number;
  savingsKB: number;
  savingsPercent: number;
  optimizations: string[];
  energyImpact: object;
}

// ============================================
// PRESENTER WELLNESS TYPES
// ============================================

export interface WellnessSession {
  id: string;
  presentationId: string;
  startTime: string;
  endTime?: string;
  wellnessScore: number;
  metrics: {
    speakingPaceWPM: number;
    pauseFrequency: number;
    fillerWordCount: number;
    stressIndicators: number;
    volumeVariation: number;
  };
  breaksTaken: number;
  recommendations?: object[];
}

export interface WellnessTrends {
  trend: string;
  recentAverageScore: number;
  historicalAverageScore: number;
  totalSessions: number;
  insights: string[];
}

// ============================================
// CARBON FOOTPRINT TYPES
// ============================================

export interface CarbonFootprint {
  presentationId: string;
  emissions: {
    dataTransfer: number;
    compute: number;
    storage: number;
    streaming: number;
    total: number;
  };
  comparisons: { item: string; equivalent: string }[];
  recommendations: string[];
}

export interface CarbonOffset {
  id: string;
  provider: string;
  project: string;
  amount: number;
  cost: number;
  status: string;
  certificateUrl?: string;
}

export interface EcoBadge {
  badge: string;
  description: string;
  earnedAt?: string;
  requirement?: string;
}

// ============================================
// TYPE ALIASES
// ============================================

export type Presentation = Project;
