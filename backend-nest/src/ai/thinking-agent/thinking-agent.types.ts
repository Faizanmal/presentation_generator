/**
 * Thinking Agent Types
 * Multi-step reasoning system for high-quality presentation generation
 */

// ============================================
// THINKING LOOP TYPES
// ============================================

export interface ThinkingStep {
  stepNumber: number;
  phase: ThinkingPhase;
  thought: string;
  action?: string;
  observation?: string;
  timestamp: Date;
}

export type ThinkingPhase =
  | 'planning'
  | 'research'
  | 'generation'
  | 'reflection'
  | 'refinement'
  | 'complete';

export interface ThinkingState {
  sessionId: string;
  currentPhase: ThinkingPhase;
  steps: ThinkingStep[];
  iterations: number;
  maxIterations: number;
  qualityScore: number;
  targetQualityScore: number;
  startTime: Date;
  endTime?: Date;
}

// ============================================
// PLANNING TYPES
// ============================================

export interface PresentationPlan {
  mainObjective: string;
  targetAudience: AudienceProfile;
  contentStrategy: ContentStrategy;
  structurePlan: StructurePlan;
  visualStrategy: VisualStrategy;
  estimatedSlides: number;
  keyMessages: string[];
  potentialChallenges: string[];
}

export interface AudienceProfile {
  type: string;
  knowledgeLevel: 'beginner' | 'intermediate' | 'expert';
  interests: string[];
  painPoints: string[];
  expectedOutcome: string;
}

export interface ContentStrategy {
  narrativeArc: string;
  hookType: string;
  conclusionStyle: string;
  dataUsage: 'minimal' | 'moderate' | 'heavy';
  storytellingApproach: string;
}

export interface StructurePlan {
  openingSlides: number;
  contentSlides: number;
  dataSlides: number;
  closingSlides: number;
  transitionPoints: string[];
}

export interface VisualStrategy {
  colorMood: string;
  imageStyle: string;
  chartPreference: string;
  layoutVariety: string[];
}

// ============================================
// REFLECTION TYPES
// ============================================

export interface ReflectionResult {
  overallScore: number;
  criteria: ReflectionCriteria;
  strengths: string[];
  weaknesses: string[];
  improvements: ImprovementSuggestion[];
  shouldRefine: boolean;
}

export interface ReflectionCriteria {
  clarity: CriteriaScore;
  relevance: CriteriaScore;
  engagement: CriteriaScore;
  structure: CriteriaScore;
  visualAppeal: CriteriaScore;
  completeness: CriteriaScore;
  audienceAlignment: CriteriaScore;
}

export interface CriteriaScore {
  score: number; // 1-10
  feedback: string;
}

export interface ImprovementSuggestion {
  area: string;
  currentState: string;
  suggestedChange: string;
  priority: 'high' | 'medium' | 'low';
  affectedSections: number[];
}

// ============================================
// AGENT COMMUNICATION TYPES
// ============================================

export interface AgentMessage {
  role: 'planner' | 'generator' | 'critic' | 'refiner' | 'orchestrator';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentTask {
  taskId: string;
  type: 'plan' | 'generate' | 'reflect' | 'refine' | 'validate';
  input: unknown;
  expectedOutput: string;
  constraints?: string[];
}

// ============================================
// ENHANCED GENERATION TYPES
// ============================================

export interface EnhancedGenerationParams {
  topic: string;
  tone?: string;
  audience?: string;
  length?: number;
  type?: 'presentation' | 'document' | 'pitch-deck' | 'report';
  style?: 'professional' | 'creative' | 'academic' | 'casual';
  generateImages?: boolean;
  smartLayout?: boolean;
  useThinkingMode?: boolean;
  qualityLevel?: 'standard' | 'high' | 'premium';
  maxThinkingIterations?: number;
  targetQualityScore?: number;
  additionalContext?: string;
  rawData?: string; // Unstructured raw data input
  brandGuidelines?: BrandGuidelines;
}

export interface BrandGuidelines {
  colors?: string[];
  fonts?: string[];
  tone?: string;
  logos?: string[];
  restrictions?: string[];
}

export interface EnhancedGenerationResult {
  presentation: EnhancedPresentation;
  thinkingProcess: ThinkingState;
  qualityReport: QualityReport;
  metadata: GenerationMetadata;
}

export interface EnhancedPresentation {
  title: string;
  subtitle?: string;
  sections: EnhancedSection[];
  metadata: PresentationMetadata;
}

export interface EnhancedSection {
  id: string;
  heading: string;
  subheading?: string;
  blocks: EnhancedBlock[];
  layout: LayoutType;
  suggestedImage?: ImageSuggestion;
  speakerNotes?: string;
  transition?: TransitionStyle;
  duration?: number; // seconds
}

export interface EnhancedBlock {
  id: string;
  type: BlockType;
  content: string;
  formatting?: BlockFormatting;
  chartData?: ChartData;
  embedData?: EmbedData;
  imageData?: ImageData;
}

export type BlockType =
  | 'heading'
  | 'subheading'
  | 'paragraph'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'statistic'
  | 'chart'
  | 'image'
  | 'embed'
  | 'callout'
  | 'timeline-item'
  | 'comparison-item';

export type LayoutType =
  | 'title'
  | 'title-subtitle'
  | 'title-content'
  | 'two-column'
  | 'three-column'
  | 'image-left'
  | 'image-right'
  | 'image-full'
  | 'comparison'
  | 'timeline'
  | 'quote-highlight'
  | 'stats-grid'
  | 'chart-focus'
  | 'gallery'
  | 'agenda';

export type TransitionStyle = 'fade' | 'slide' | 'zoom' | 'flip' | 'none';

export interface BlockFormatting {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  alignment?: 'left' | 'center' | 'right';
  variant?: 'default' | 'card' | 'outlined' | 'highlighted';
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter' | 'area';
  labels: string[];
  datasets: ChartDataset[];
  options?: Record<string, unknown>;
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
}

export interface EmbedData {
  url: string;
  type: 'youtube' | 'vimeo' | 'figma' | 'miro' | 'twitter' | 'custom';
  title?: string;
}

export interface ImageData {
  url?: string;
  alt: string;
  caption?: string;
  generationPrompt?: string;
}

export interface ImageSuggestion {
  prompt: string;
  style: string;
  placement: string;
}

export interface PresentationMetadata {
  estimatedDuration: number; // minutes
  keywords: string[];
  summary: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
}

// ============================================
// QUALITY REPORT TYPES
// ============================================

export interface QualityReport {
  overallScore: number; // 1-100
  breakdown: QualityBreakdown;
  suggestions: string[];
  comparisonToTarget: number; // percentage
  passedThreshold: boolean;
}

export interface QualityBreakdown {
  contentQuality: number;
  structureQuality: number;
  engagementPotential: number;
  visualRichness: number;
  audienceAlignment: number;
  originality: number;
}

export interface GenerationMetadata {
  totalTokensUsed: number;
  thinkingIterations: number;
  totalTimeMs: number;
  modelUsed: string;
  fallbackUsed: boolean;
  generateImages?: boolean;
}
