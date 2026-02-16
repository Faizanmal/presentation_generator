import {
  EnhancedBlock,
  EnhancedGenerationResult,
  EnhancedPresentation,
  EnhancedSection,
  QualityReport,
} from './thinking-agent.types';

export interface ThinkingApiQualityScore {
  criterion: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface ThinkingApiImprovement {
  area: string;
  currentState: string;
  suggestedChange: string;
  priority: 'high' | 'medium' | 'low';
  affectedSections: number[];
}

export interface ThinkingApiQualityReport {
  overallScore: number;
  categoryScores: ThinkingApiQualityScore[];
  improvements: ThinkingApiImprovement[];
  passedQualityThreshold: boolean;
  summary: string;
}

export interface ThinkingApiPresentationBlock {
  id: string;
  type: string;
  content: string;
  formatting?: EnhancedBlock['formatting'];
  chartData?: EnhancedBlock['chartData'];
}

export interface ThinkingApiPresentationSection {
  id: string;
  heading: string;
  subheading?: string;
  blocks: ThinkingApiPresentationBlock[];
  layout: EnhancedSection['layout'];
  suggestedImage?: EnhancedSection['suggestedImage'];
  speakerNotes?: EnhancedSection['speakerNotes'];
  transition?: EnhancedSection['transition'];
  duration?: number;
}

export interface ThinkingApiPresentation {
  title: string;
  subtitle?: string;
  sections: ThinkingApiPresentationSection[];
  metadata: {
    estimatedDuration: number;
    keywords: string[];
    summary: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    category: string;
  };
}

export interface ThinkingApiGenerationResult {
  presentation: ThinkingApiPresentation;
  qualityReport: ThinkingApiQualityReport;
  thinkingSteps: EnhancedGenerationResult['thinkingProcess']['steps'];
  thinkingProcess: {
    steps: EnhancedGenerationResult['thinkingProcess']['steps'];
  };
  metadata: {
    totalIterations: number;
    totalTokensUsed: number;
    generationTimeMs: number;
    qualityImprovement: number;
    generateImages?: boolean;
  };
}

export function transformThinkingGenerationResult(
  result: EnhancedGenerationResult,
): ThinkingApiGenerationResult {
  return {
    presentation: transformPresentation(result.presentation),
    qualityReport: transformQualityReport(result.qualityReport),
    thinkingSteps: result.thinkingProcess.steps,
    thinkingProcess: {
      steps: result.thinkingProcess.steps,
    },
    metadata: {
      totalIterations: result.thinkingProcess.iterations,
      totalTokensUsed: result.metadata.totalTokensUsed,
      generationTimeMs: result.metadata.totalTimeMs,
      qualityImprovement: result.qualityReport.overallScore / 10 - 7,
      generateImages: result.metadata.generateImages,
    },
  };
}

function transformPresentation(
  presentation: EnhancedPresentation,
): ThinkingApiPresentation {
  return {
    title: presentation.title,
    subtitle: presentation.subtitle,
    sections: presentation.sections.map((section) => ({
      id: section.id,
      heading: section.heading,
      subheading: section.subheading,
      blocks: section.blocks.map((block) => ({
        id: block.id,
        type: block.type,
        content: block.content,
        formatting: block.formatting,
        chartData: block.chartData,
      })),
      layout: section.layout,
      suggestedImage: section.suggestedImage,
      speakerNotes: section.speakerNotes,
      transition: section.transition,
      duration: section.duration,
    })),
    metadata: {
      estimatedDuration: presentation.metadata?.estimatedDuration || 10,
      keywords: presentation.metadata?.keywords || [],
      summary: presentation.metadata?.summary || '',
      difficulty: presentation.metadata?.difficulty || 'intermediate',
      category: presentation.metadata?.category || 'presentation',
    },
  };
}

function transformQualityReport(
  qualityReport: QualityReport,
): ThinkingApiQualityReport {
  const breakdown = qualityReport.breakdown;
  const categoryScores: ThinkingApiQualityScore[] = [
    {
      criterion: 'Content Quality',
      score: breakdown.contentQuality / 10,
      maxScore: 10,
      feedback: `Content quality score: ${breakdown.contentQuality}/100`,
    },
    {
      criterion: 'Structure Quality',
      score: breakdown.structureQuality / 10,
      maxScore: 10,
      feedback: `Structure quality score: ${breakdown.structureQuality}/100`,
    },
    {
      criterion: 'Engagement Potential',
      score: breakdown.engagementPotential / 10,
      maxScore: 10,
      feedback: `Engagement potential score: ${breakdown.engagementPotential}/100`,
    },
    {
      criterion: 'Visual Richness',
      score: breakdown.visualRichness / 10,
      maxScore: 10,
      feedback: `Visual richness score: ${breakdown.visualRichness}/100`,
    },
    {
      criterion: 'Audience Alignment',
      score: breakdown.audienceAlignment / 10,
      maxScore: 10,
      feedback: `Audience alignment score: ${breakdown.audienceAlignment}/100`,
    },
    {
      criterion: 'Originality',
      score: breakdown.originality / 10,
      maxScore: 10,
      feedback: `Originality score: ${breakdown.originality}/100`,
    },
  ];

  const improvements: ThinkingApiImprovement[] = qualityReport.suggestions.map(
    (suggestion, index) => ({
      area: `Area ${index + 1}`,
      currentState: 'Current implementation',
      suggestedChange: suggestion,
      priority: 'medium',
      affectedSections: [],
    }),
  );

  return {
    overallScore: qualityReport.overallScore / 10,
    categoryScores,
    improvements,
    passedQualityThreshold: qualityReport.passedThreshold,
    summary: `Overall quality score: ${qualityReport.overallScore}/100`,
  };
}
