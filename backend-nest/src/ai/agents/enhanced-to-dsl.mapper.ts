/**
 * Maps thinking-agent EnhancedPresentation → DSL PresentationDocument
 * so pin / editMemory / partial regen share one path.
 */
import type {
  BlockKind,
  PresentationDocument,
  PresentationMeta,
  PresentationSection,
  PresentationSlide,
  PresentationTheme,
  SlideBlock,
  NarrativeRole,
} from '@shared/presentation-dsl';
import { getBlockFontSize, getSlidePadding } from '@shared/layout-engine';
import type {
  EnhancedBlock,
  EnhancedPresentation,
  EnhancedSection,
} from '../thinking-agent/thinking-agent.types';

const DEFAULT_THEME: PresentationTheme = {
  id: 'thinking-default',
  name: 'Thinking Default',
  colors: {
    primary: '#0F172A',
    secondary: '#334155',
    accent: '#0D9488',
    background: '#FFFFFF',
    surface: '#F1F5F9',
    text: '#0F172A',
    textMuted: '#64748B',
    chart: ['#0F172A', '#0D9488', '#0369A1', '#B45309', '#BE123C'],
  },
  typography: {
    headingFont: 'DM Sans',
    bodyFont: 'DM Sans',
    monoFont: 'IBM Plex Mono',
    baseSize: 16,
    scale: 1.25,
  },
  spacing: { base: 8, scale: 1.5 },
  effects: {
    borderRadius: '10px',
    shadow: '0 4px 24px rgba(15,23,42,0.08)',
    glassmorphism: false,
  },
};

const NARRATIVE_ROLES: NarrativeRole[] = [
  'hook',
  'context',
  'problem',
  'solution',
  'evidence',
  'transformation',
  'call-to-action',
  'recap',
];

function mapBlockKind(type: EnhancedBlock['type']): BlockKind {
  switch (type) {
    case 'heading':
      return 'heading';
    case 'subheading':
      return 'subheading';
    case 'bullet':
      return 'bullet-list';
    case 'numbered':
      return 'numbered-list';
    case 'quote':
      return 'quote';
    case 'statistic':
      return 'statistic';
    case 'chart':
      return 'chart';
    case 'image':
      return 'image';
    case 'embed':
      return 'embed';
    case 'callout':
      return 'callout';
    case 'timeline-item':
      return 'timeline-item';
    case 'comparison-item':
      return 'comparison-row';
    default:
      return 'paragraph';
  }
}

function mapEnhancedBlock(
  block: EnhancedBlock,
  slideId: string,
  order: number,
): SlideBlock {
  const kind = mapBlockKind(block.type);
  const content: SlideBlock['content'] = {};

  if (kind === 'bullet-list' || kind === 'numbered-list') {
    content.items = block.content
      .split('\n')
      .map((line) => line.replace(/^[-•*\d.]+\s*/, '').trim())
      .filter(Boolean);
  } else if (kind === 'statistic') {
    const [value, ...rest] = block.content.split(/[:–—-]/);
    content.value = value?.trim() || block.content;
    content.label = rest.join('-').trim() || '';
  } else if (kind === 'image') {
    content.url = block.imageData?.url || '';
    content.alt = block.imageData?.alt || block.content;
    content.generationPrompt = block.imageData?.generationPrompt;
  } else if (kind === 'chart' && block.chartData) {
    content.chartData = {
      type: block.chartData.type,
      labels: block.chartData.labels,
      datasets: block.chartData.datasets,
      options: block.chartData.options,
    };
  } else if (kind === 'embed' && block.embedData) {
    content.embedUrl = block.embedData.url;
    content.embedType =
      block.embedData.type === 'custom' ? 'generic' : block.embedData.type;
  } else {
    content.text = block.content;
  }

  return {
    id: block.id || `block-${slideId}-${order}`,
    slideId,
    kind,
    content,
    style: {
      ...(block.formatting?.color ? { color: block.formatting.color } : {}),
      ...(block.formatting?.alignment
        ? { textAlign: block.formatting.alignment }
        : {}),
    },
    order,
    source: 'ai',
    pinned: false,
  };
}

function mapLayoutPreset(
  layout: EnhancedSection['layout'],
): PresentationSlide['layout'] {
  const presetMap: Record<string, PresentationSlide['layout']['preset']> = {
    title: 'title-hero',
    'title-hero': 'title-hero',
    'title-slide': 'title-hero',
    'two-column': 'two-column',
    'three-column': 'three-column',
    'image-left': 'image-left',
    'image-right': 'image-right',
    full: 'image-full',
    'full-image': 'image-full',
    grid: 'bento-grid',
    comparison: 'comparison',
    timeline: 'timeline',
    quote: 'quote-centered',
    chart: 'chart-focus',
    stats: 'stats-grid',
  };

  const preset = presetMap[String(layout)] || 'single-column';
  const multiZone =
    preset === 'two-column' ||
    preset === 'two-column-image' ||
    preset === 'three-column' ||
    preset === 'comparison' ||
    preset === 'image-left' ||
    preset === 'image-right' ||
    preset === 'bento-grid' ||
    preset === 'stats-grid';

  return {
    preset,
    zones:
      preset === 'three-column'
        ? 3
        : preset === 'bento-grid' || preset === 'stats-grid'
          ? 4
          : multiZone
            ? 2
            : 1,
    density: 'balanced',
  };
}

/** Assign layout zones so renderers can place columns / media correctly */
export function assignZonesToBlocks(
  blocks: SlideBlock[],
  layout: PresentationSlide['layout'],
): void {
  const zoneCount = layout.zones || 1;
  if (zoneCount <= 1) return;

  const titleKinds = new Set(['heading', 'subheading']);
  const mediaKinds = new Set(['image', 'chart', 'embed']);
  const preset = layout.preset;
  const unzoned = blocks.filter(
    (b) => typeof b.zone !== 'number' && !titleKinds.has(b.kind),
  );
  if (unzoned.length === 0) return;

  if (preset === 'image-left') {
    for (const block of unzoned) {
      block.zone = mediaKinds.has(block.kind) ? 0 : 1;
    }
    return;
  }

  if (preset === 'image-right' || preset === 'two-column-image') {
    for (const block of unzoned) {
      block.zone = mediaKinds.has(block.kind) ? 1 : 0;
    }
    return;
  }

  const textBody = unzoned.filter((b) => !mediaKinds.has(b.kind));
  textBody.forEach((block, i) => {
    block.zone = i % zoneCount;
  });
  unzoned
    .filter((b) => mediaKinds.has(b.kind))
    .forEach((block, i) => {
      block.zone = Math.min(zoneCount - 1, i);
    });
}

export { mapLayoutPreset };

/**
 * Convert thinking EnhancedPresentation into a PresentationDocument.
 * Uses one section with one slide per EnhancedSection (thinking model is flat).
 */
export function enhancedToPresentationDocument(
  presentation: EnhancedPresentation,
  options?: {
    documentId?: string;
    audience?: string;
    tone?: string;
    theme?: PresentationTheme;
    qualityScore?: number;
  },
): PresentationDocument {
  const now = new Date().toISOString();
  const documentId = options?.documentId || `thinking-${Date.now()}`;

  const slides: PresentationSlide[] = presentation.sections.map(
    (section, index) => {
      const slideId = section.id || `slide-${index}`;
      const blocks: SlideBlock[] = [];
      let order = 0;
      const theme = options?.theme || DEFAULT_THEME;
      const layout = mapLayoutPreset(section.layout);
      const padding = getSlidePadding(layout.density, theme.spacing.base);

      blocks.push({
        id: `block-${slideId}-heading`,
        slideId,
        kind: 'heading',
        content: { text: section.heading },
        style: {
          fontSize: getBlockFontSize('heading', layout.density, theme),
          fontWeight: 'bold',
        },
        order: order++,
        source: 'ai',
        pinned: false,
      });

      if (section.subheading) {
        blocks.push({
          id: `block-${slideId}-subheading`,
          slideId,
          kind: 'subheading',
          content: { text: section.subheading },
          style: {
            fontSize: getBlockFontSize('subheading', layout.density, theme),
          },
          order: order++,
          source: 'ai',
          pinned: false,
        });
      }

      for (const block of section.blocks) {
        const mapped = mapEnhancedBlock(block, slideId, order++);
        mapped.style = {
          ...mapped.style,
          fontSize:
            mapped.style.fontSize ||
            getBlockFontSize(mapped.kind, layout.density, theme),
        };
        blocks.push(mapped);
      }

      if (section.suggestedImage?.prompt) {
        blocks.push({
          id: `block-${slideId}-suggested-image`,
          slideId,
          kind: 'image',
          content: {
            url: '',
            alt: String(section.suggestedImage.prompt),
            generationPrompt: String(section.suggestedImage.prompt),
          },
          style: {},
          order: order,
          source: 'ai',
          pinned: false,
        });
      }

      assignZonesToBlocks(blocks, layout);

      return {
        id: slideId,
        sectionId: 'section-0',
        order: index,
        layout: { ...layout, padding },
        blocks,
        speakerNotes: section.speakerNotes,
        transition: {
          type: 'fade',
          duration: 300,
        },
        duration: section.duration,
        aiConfidence: 0.8,
        userEdited: false,
      };
    },
  );

  const section: PresentationSection = {
    id: 'section-0',
    order: 0,
    title: presentation.title,
    narrativeRole: NARRATIVE_ROLES[0],
    slides,
  };

  const metadata: PresentationMeta = {
    estimatedDuration: presentation.metadata.estimatedDuration || slides.length,
    totalSlides: slides.length,
    keywords: presentation.metadata.keywords || [],
    summary: presentation.metadata.summary || '',
    audience: options?.audience || 'general',
    tone: options?.tone || 'professional',
    difficulty: presentation.metadata.difficulty || 'intermediate',
    category: presentation.metadata.category || 'general',
    qualityScore: options?.qualityScore,
  };

  return {
    id: documentId,
    version: 1,
    title: presentation.title,
    subtitle: presentation.subtitle,
    sections: [section],
    theme: options?.theme || DEFAULT_THEME,
    metadata,
    generationState: {
      status: 'complete',
      progress: 100,
      currentAgent: null,
      currentSlideIndex: null,
      startedAt: now,
      completedAt: now,
      error: null,
      tokenUsage: {},
      regeneratedSlides: [],
    },
    editMemory: [],
    createdAt: now,
    updatedAt: now,
  };
}
