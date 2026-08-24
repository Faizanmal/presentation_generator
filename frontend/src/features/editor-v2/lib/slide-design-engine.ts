import type { BlockFrame, EditorBlock, SlideLayoutBlueprint, LayoutScore } from "../types";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export interface TypographyScale {
  heading: number;
  subheading: number;
  body: number;
  caption: number;
}

export function computeTypographyScale(canvasWidth: number): TypographyScale {
  const ratio = clamp(canvasWidth / 1600, 0.72, 1.34);

  return {
    heading: Math.round(58 * ratio),
    subheading: Math.round(36 * ratio),
    body: Math.round(22 * ratio),
    caption: Math.round(15 * ratio),
  };
}

export function buildLayoutBlueprint(
  canvasWidth: number,
  canvasHeight: number,
  layoutPreset?: string,
): SlideLayoutBlueprint {
  const safeMargin = Math.round(canvasWidth * 0.06);
  const innerWidth = canvasWidth - safeMargin * 2;
  const innerHeight = canvasHeight - safeMargin * 2;

  const titleHeight = Math.round(innerHeight * 0.2);
  const bodyHeight = Math.round(innerHeight * 0.47);
  const preset = layoutPreset || 'single-column';

  // Image-left: media on left, body on right
  if (preset === 'image-left') {
    return {
      titleArea: {
        x: safeMargin + Math.round(innerWidth * 0.42),
        y: safeMargin,
        width: Math.round(innerWidth * 0.58),
        height: titleHeight,
        rotation: 0,
      },
      bodyArea: {
        x: safeMargin + Math.round(innerWidth * 0.42),
        y: safeMargin + titleHeight + Math.round(innerHeight * 0.04),
        width: Math.round(innerWidth * 0.58),
        height: bodyHeight,
        rotation: 0,
      },
      mediaArea: {
        x: safeMargin,
        y: safeMargin,
        width: Math.round(innerWidth * 0.38),
        height: innerHeight,
        rotation: 0,
      },
    };
  }

  // Hero / quote: centered title + body
  if (preset === 'title-hero' || preset === 'title-subtitle' || preset === 'quote-centered') {
    const centeredWidth = Math.round(innerWidth * 0.72);
    const centeredX = safeMargin + Math.round((innerWidth - centeredWidth) / 2);
    return {
      titleArea: {
        x: centeredX,
        y: safeMargin + Math.round(innerHeight * 0.22),
        width: centeredWidth,
        height: Math.round(innerHeight * 0.28),
        rotation: 0,
      },
      bodyArea: {
        x: centeredX,
        y: safeMargin + Math.round(innerHeight * 0.52),
        width: centeredWidth,
        height: Math.round(innerHeight * 0.28),
        rotation: 0,
      },
      mediaArea: {
        x: centeredX,
        y: safeMargin + Math.round(innerHeight * 0.72),
        width: centeredWidth,
        height: Math.round(innerHeight * 0.18),
        rotation: 0,
      },
    };
  }

  // Two-column / comparison: split body
  if (preset === 'two-column' || preset === 'comparison') {
    return {
      titleArea: {
        x: safeMargin,
        y: safeMargin,
        width: innerWidth,
        height: titleHeight,
        rotation: 0,
      },
      bodyArea: {
        x: safeMargin,
        y: safeMargin + titleHeight + Math.round(innerHeight * 0.05),
        width: Math.round(innerWidth * 0.48),
        height: bodyHeight,
        rotation: 0,
      },
      mediaArea: {
        x: safeMargin + Math.round(innerWidth * 0.52),
        y: safeMargin + titleHeight + Math.round(innerHeight * 0.05),
        width: Math.round(innerWidth * 0.48),
        height: bodyHeight,
        rotation: 0,
      },
    };
  }

  return {
    titleArea: {
      x: safeMargin,
      y: safeMargin,
      width: innerWidth,
      height: titleHeight,
      rotation: 0,
    },
    bodyArea: {
      x: safeMargin,
      y: safeMargin + titleHeight + Math.round(innerHeight * 0.05),
      width: Math.round(innerWidth * 0.56),
      height: bodyHeight,
      rotation: 0,
    },
    mediaArea: {
      x: safeMargin + Math.round(innerWidth * 0.6),
      y: safeMargin + titleHeight,
      width: Math.round(innerWidth * 0.4),
      height: innerHeight - titleHeight,
      rotation: 0,
    },
  };
}

const resolveTextHeight = (content?: string): number => {
  const words = (content ?? "").split(/\s+/).filter(Boolean).length;
  return clamp(Math.round(words * 10), 68, 260);
};

const withPadding = (area: BlockFrame, padding: number): BlockFrame => ({
  x: area.x + padding,
  y: area.y + padding,
  width: Math.max(48, area.width - padding * 2),
  height: Math.max(48, area.height - padding * 2),
  rotation: area.rotation,
});

export function computeBalancedFrames(
  blocks: EditorBlock[],
  blueprint: SlideLayoutBlueprint,
  layoutPreset?: string,
): Record<string, BlockFrame> {
  const result: Record<string, BlockFrame> = {};
  const preset = layoutPreset || 'single-column';

  const heading = blocks.find((block) => block.type === "heading");
  const paragraphs = blocks.filter((block) => block.type === "paragraph" || block.type === "quote" || block.type === "stat");
  const media = blocks.filter((block) => block.type === "image" || block.type === "chart");

  if (heading) {
    const frame = withPadding(blueprint.titleArea, 8);
    frame.height = clamp(resolveTextHeight(heading.content.text), 82, blueprint.titleArea.height);
    result[heading.id] = frame;
  }

  // Zone-aware two-column placement
  if (preset === 'two-column' || preset === 'comparison') {
    const colBlocks = paragraphs.filter((b) => !(b.id in result));
    const left = colBlocks.filter((b) => (b.zone ?? 0) === 0);
    const right = colBlocks.filter((b) => (b.zone ?? 0) !== 0);
    const leftPool = left.length ? left : colBlocks.slice(0, Math.ceil(colBlocks.length / 2));
    const rightPool = right.length ? right : colBlocks.slice(Math.ceil(colBlocks.length / 2));

    leftPool.forEach((block, idx) => {
      const rowH = Math.max(80, Math.floor(blueprint.bodyArea.height / Math.max(1, leftPool.length)));
      result[block.id] = {
        x: blueprint.bodyArea.x + 8,
        y: blueprint.bodyArea.y + idx * rowH,
        width: blueprint.bodyArea.width - 16,
        height: rowH - 10,
        rotation: 0,
      };
    });
    rightPool.forEach((block, idx) => {
      const rowH = Math.max(80, Math.floor(blueprint.mediaArea.height / Math.max(1, rightPool.length)));
      result[block.id] = {
        x: blueprint.mediaArea.x + 8,
        y: blueprint.mediaArea.y + idx * rowH,
        width: blueprint.mediaArea.width - 16,
        height: rowH - 10,
        rotation: 0,
      };
    });
  } else {
    const paragraph = paragraphs[0];
    if (paragraph) {
      const frame = withPadding(blueprint.bodyArea, 10);
      frame.height = clamp(resolveTextHeight(paragraph.content.text) + 90, 140, blueprint.bodyArea.height);
      result[paragraph.id] = frame;
    }
  }

  media.forEach((block, idx) => {
    if (result[block.id]) {return;}
    const frame = withPadding(blueprint.mediaArea, 10);
    if (idx > 0) {
      frame.y += idx * 24;
      frame.height = Math.max(48, frame.height - idx * 24);
    }
    result[block.id] = frame;
  });

  const remaining = blocks.filter((block) => !(block.id in result));
  const rowHeight = Math.max(80, Math.floor(blueprint.bodyArea.height / Math.max(1, remaining.length)));

  remaining.forEach((block, idx) => {
    result[block.id] = {
      x: blueprint.bodyArea.x + 12,
      y: blueprint.bodyArea.y + idx * rowHeight,
      width: blueprint.bodyArea.width - 24,
      height: rowHeight - 10,
      rotation: 0,
    };
  });

  return result;
}

export function fitImageToFrame(
  sourceWidth: number,
  sourceHeight: number,
  frame: BlockFrame,
): { width: number; height: number; offsetX: number; offsetY: number } {
  const sourceRatio = sourceWidth / sourceHeight;
  const frameRatio = frame.width / frame.height;

  if (sourceRatio > frameRatio) {
    const height = frame.height;
    const width = height * sourceRatio;
    return {
      width,
      height,
      offsetX: (frame.width - width) / 2,
      offsetY: 0,
    };
  }

  const width = frame.width;
  const height = width / sourceRatio;
  return {
    width,
    height,
    offsetX: 0,
    offsetY: (frame.height - height) / 2,
  };
}

export function scoreLayout(blocks: EditorBlock[], blueprint: SlideLayoutBlueprint): LayoutScore {
  const usedArea = blocks.reduce((sum, block) => sum + block.frame.width * block.frame.height, 0);
  const totalArea = blueprint.mediaArea.width * blueprint.mediaArea.height + blueprint.bodyArea.width * blueprint.bodyArea.height;
  const density = clamp(usedArea / totalArea, 0, 1);

  const whitespace = clamp((1 - density) * 100, 22, 94);
  const hierarchy = blocks.some((block) => block.type === "heading") ? 90 : 62;
  const visualBalance = blocks.some((block) => block.type === "image") ? 88 : 70;
  const overall = Math.round((whitespace * 0.28 + hierarchy * 0.34 + visualBalance * 0.38) * 10) / 10;

  return {
    whitespace: Math.round(whitespace),
    hierarchy: Math.round(hierarchy),
    visualBalance: Math.round(visualBalance),
    overall,
  };
}

