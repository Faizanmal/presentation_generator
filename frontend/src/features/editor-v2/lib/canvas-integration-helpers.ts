/**
 * Canvas Integration Helpers
 * Utilities for integrating the advanced canvas with the existing editor system
 */

import type { CanvasElement } from './canvas-drawing-engine';
import type { Block, BlockType } from '../../../types';
import type { EditorBlock, EditorBlockType, EditorSlide } from '../types';

type CanvasBlockLike = {
  style?: {
    backgroundColor?: string;
    fillColor?: string;
    borderColor?: string;
    strokeColor?: string;
    borderWidth?: number;
    strokeWidth?: number;
    fontSize?: string | number;
    fontFamily?: string;
    textAlign?: 'left' | 'center' | 'right';
    opacity?: number;
  };
  content?: {
    text?: string;
    url?: string;
  };
  data?: {
    text?: string;
    url?: string;
    points?: unknown[];
  };
  createdAt?: string;
  updatedAt?: string;
};

function isEditorBlock(block: Block | EditorBlock): block is EditorBlock {
  return 'frame' in block;
}

function getBlockFrame(block: Block | EditorBlock) {
  if (isEditorBlock(block)) {
    return block.frame;
  }

  return {
    x: block.style?.x ?? 0,
    y: block.style?.y ?? 0,
    width: block.style?.width ?? 100,
    height: block.style?.height ?? 100,
    rotation: block.style?.rotation ?? 0,
  };
}

function getBlockLocked(block: Block | EditorBlock): boolean {
  return isEditorBlock(block) ? Boolean(block.locked) : Boolean(block.style?.locked);
}

function getBlockMetadata(block: Block | EditorBlock) {
  if (isEditorBlock(block)) {
    return {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: undefined,
    };
  }

  return {
    createdAt: block.createdAt ? Date.parse(block.createdAt) : Date.now(),
    updatedAt: block.updatedAt ? Date.parse(block.updatedAt) : Date.now(),
    createdBy: undefined,
  };
}

/**
 * Convert a Block (existing model) to CanvasElement
 */
export function blockToCanvasElement(block: Block | EditorBlock): CanvasElement {
  const frame = getBlockFrame(block);

  return {
    id: block.id,
    type: mapBlockTypeToCanvasType(
      isEditorBlock(block) ? block.type : block.blockType || block.type
    ),
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    rotation: frame.rotation,
    locked: getBlockLocked(block),
    style: {
      fillColor: getBlockFillColor(block),
      strokeColor: getBlockStrokeColor(block),
      strokeWidth: getBlockStrokeWidth(block),
      fontSize: getBlockFontSize(block),
      fontFamily: getBlockFontFamily(block),
      textAlign: getBlockTextAlign(block),
      opacity: getBlockOpacity(block),
    },
    data: {
      text: getBlockText(block),
      url: getBlockUrl(block),
      points: getBlockPoints(block),
    },
    metadata: getBlockMetadata(block),
  };
}

/**
 * Convert a CanvasElement back to Block
 */
export function canvasElementToBlock(element: CanvasElement, slideId: string): EditorBlock {
  return {
    id: element.id,
    type: mapCanvasTypeToEditorBlockType(element.type),
    frame: {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation || 0,
    },
    locked: element.locked || false,
    content: {
      text: element.data?.text,
      url: element.data?.url,
    },
  };
}

/**
 * Batch convert blocks to canvas elements
 */
export function blocksToCanvasElements(blocks: (Block | EditorBlock)[]): CanvasElement[] {
  return blocks.map(blockToCanvasElement);
}

/**
 * Batch convert canvas elements back to blocks
 */
export function canvasElementsToBlocks(elements: CanvasElement[], slideId: string): EditorBlock[] {
  return elements.map((el) => canvasElementToBlock(el, slideId));
}

/**
 * Map block types to canvas shape types
 */
function mapBlockTypeToCanvasType(blockType: BlockType | EditorBlockType | string): CanvasElement['type'] {
  const typeMap: Record<string, CanvasElement['type']> = {
    HEADING: 'text',
    SUBHEADING: 'text',
    PARAGRAPH: 'text',
    BULLET_LIST: 'text',
    NUMBERED_LIST: 'text',
    IMAGE: 'image',
    CODE: 'rectangle',
    QUOTE: 'rectangle',
    DIVIDER: 'line',
    TABLE: 'rectangle',
    EMBED: 'rectangle',
    CHART: 'rectangle',
    VIDEO: 'rectangle',
    AUDIO: 'rectangle',
    TIMELINE: 'line',
    COMPARISON: 'rectangle',
    STATS_GRID: 'rectangle',
    CALL_TO_ACTION: 'rectangle',
    SHAPE: 'rectangle',
    heading: 'text',
    paragraph: 'text',
    image: 'image',
    stat: 'rectangle',
    quote: 'rectangle',
    chart: 'rectangle',
    // Canvas types
    rectangle: 'rectangle',
    circle: 'circle',
    line: 'line',
    path: 'path',
    text: 'text',
    connector: 'connector',
    arrow: 'arrow',
  };

  return typeMap[blockType] || 'rectangle';
}

/**
 * Map canvas shape types back to editor block types
 */
function mapCanvasTypeToEditorBlockType(canvasType: CanvasElement['type']): EditorBlockType {
  const typeMap: Record<CanvasElement['type'], EditorBlockType> = {
    rectangle: 'quote',
    circle: 'quote',
    line: 'quote',
    path: 'quote',
    text: 'paragraph',
    connector: 'quote',
    arrow: 'quote',
    image: 'image',
  };

  return typeMap[canvasType] || 'quote';
}

/**
 * Helper functions to extract properties from blocks
 */

function getBlockFillColor(block: CanvasBlockLike): string | undefined {
  return block.style?.backgroundColor || block.style?.fillColor;
}

function getBlockStrokeColor(block: CanvasBlockLike): string | undefined {
  return block.style?.borderColor || block.style?.strokeColor;
}

function getBlockStrokeWidth(block: CanvasBlockLike): number | undefined {
  return block.style?.borderWidth || block.style?.strokeWidth;
}

function getBlockFontSize(block: CanvasBlockLike): number | undefined {
  const fontSize = block.style?.fontSize;
  if (typeof fontSize === 'string') {
    const parsed = Number(fontSize);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return typeof fontSize === 'number' ? fontSize : undefined;
}

function getBlockFontFamily(block: CanvasBlockLike): string | undefined {
  return block.style?.fontFamily || 'Arial';
}

function getBlockTextAlign(block: CanvasBlockLike): 'left' | 'center' | 'right' | undefined {
  return block.style?.textAlign;
}

function getBlockOpacity(block: CanvasBlockLike): number | undefined {
  return block.style?.opacity;
}

function getBlockText(block: CanvasBlockLike): string | undefined {
  return block.content?.text || block.data?.text;
}

function getBlockUrl(block: CanvasBlockLike): string | undefined {
  return block.content?.url || block.data?.url;
}

function getBlockPoints(block: CanvasBlockLike): unknown[] | undefined {
  return block.data?.points;
}

/**
 * Sync canvas elements to slide
 * Updates the slide with new element data
 */
export function syncCanvasElementsToSlide(
  slide: EditorSlide,
  elements: CanvasElement[]
): EditorSlide {
  return {
    ...slide,
    blocks: canvasElementsToBlocks(elements, slide.id),
  };
}

/**
 * Merge canvas changes with existing slide state
 * Useful for partial updates
 */
export function mergeCanvasChanges(
  slide: EditorSlide,
  updates: CanvasElement[],
  updateMode: 'replace' | 'merge' = 'replace'
): EditorSlide {
  if (updateMode === 'replace') {
    return syncCanvasElementsToSlide(slide, updates);
  }

  // Merge mode: update existing blocks, add new ones
  const updateMap = new Map(updates.map((u) => [u.id, u]));
  const merged = slide.blocks.map((block: EditorBlock) => {
    const update = updateMap.get(block.id);
    if (update) {
      updateMap.delete(block.id);
      return canvasElementToBlock(update, slide.id);
    }
    return block;
  });

  // Add new elements
  updateMap.forEach((element) => {
    merged.push(canvasElementToBlock(element, slide.id));
  });

  return {
    ...slide,
    blocks: merged,
  };
}

/**
 * Create diff between old and new canvas states
 * Useful for optimistic updates and conflict resolution
 */
export interface CanvasDiff {
  added: CanvasElement[];
  removed: string[];
  modified: Array<{ id: string; before: CanvasElement; after: CanvasElement }>;
}

export function diffCanvasElements(
  before: CanvasElement[],
  after: CanvasElement[]
): CanvasDiff {
  const beforeMap = new Map(before.map((e) => [e.id, e]));
  const afterMap = new Map(after.map((e) => [e.id, e]));

  const diff: CanvasDiff = {
    added: [],
    removed: [],
    modified: [],
  };

  // Find added and modified
  afterMap.forEach((element, id) => {
    const beforeElement = beforeMap.get(id);
    if (!beforeElement) {
      diff.added.push(element);
    } else if (!elementsEqual(beforeElement, element)) {
      diff.modified.push({
        id,
        before: beforeElement,
        after: element,
      });
    }
  });

  // Find removed
  beforeMap.forEach((element, id) => {
    if (!afterMap.has(id)) {
      diff.removed.push(id);
    }
  });

  return diff;
}

/**
 * Check if two canvas elements are equal
 */
function elementsEqual(a: CanvasElement, b: CanvasElement): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.rotation === b.rotation &&
    a.locked === b.locked &&
    JSON.stringify(a.style) === JSON.stringify(b.style) &&
    JSON.stringify(a.data) === JSON.stringify(b.data)
  );
}

/**
 * Apply diff to canvas elements
 * Useful for conflict resolution
 */
export function applyCanvasDiff(base: CanvasElement[], diff: CanvasDiff): CanvasElement[] {
  const result = new Map(base.map((e) => [e.id, e]));

  // Remove elements
  diff.removed.forEach((id) => {
    result.delete(id);
  });

  // Apply modifications
  diff.modified.forEach(({ id, after }) => {
    result.set(id, after);
  });

  // Add new elements
  diff.added.forEach((element) => {
    result.set(element.id, element);
  });

  return Array.from(result.values());
}

/**
 * Validate canvas elements
 */
export interface ValidationError {
  elementId: string;
  field: string;
  error: string;
}

export function validateCanvasElements(elements: CanvasElement[]): ValidationError[] {
  const errors: ValidationError[] = [];

  elements.forEach((element) => {
    // Validate position
    if (!Number.isFinite(element.x)) {
      errors.push({ elementId: element.id, field: 'x', error: 'Invalid x coordinate' });
    }
    if (!Number.isFinite(element.y)) {
      errors.push({ elementId: element.id, field: 'y', error: 'Invalid y coordinate' });
    }

    // Validate size
    if (!Number.isFinite(element.width) || element.width <= 0) {
      errors.push({ elementId: element.id, field: 'width', error: 'Width must be positive' });
    }
    if (!Number.isFinite(element.height) || element.height <= 0) {
      errors.push({ elementId: element.id, field: 'height', error: 'Height must be positive' });
    }

    // Validate type
    const validTypes: CanvasElement['type'][] = [
      'rectangle',
      'circle',
      'line',
      'path',
      'text',
      'connector',
      'arrow',
      'image',
    ];
    if (!validTypes.includes(element.type)) {
      errors.push({ elementId: element.id, field: 'type', error: `Invalid type: ${element.type}` });
    }
  });

  return errors;
}

/**
 * Export canvas elements to JSON
 */
export function exportCanvasToJSON(elements: CanvasElement[], metadata?: Record<string, unknown>): string {
  return JSON.stringify(
    {
      version: '1.0',
      metadata,
      elements,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

/**
 * Import canvas elements from JSON
 */
export function importCanvasFromJSON(json: string): {
  elements: CanvasElement[];
  metadata?: Record<string, unknown>;
  version: string;
} {
  const data = JSON.parse(json) as {
    version?: string;
    metadata?: Record<string, unknown>;
    elements?: CanvasElement[];
  };
  return {
    version: data.version || '1.0',
    metadata: data.metadata,
    elements: data.elements || [],
  };
}

/**
 * Clone canvas elements (deep copy)
 */
export function cloneCanvasElements(elements: CanvasElement[]): CanvasElement[] {
  return JSON.parse(JSON.stringify(elements));
}

/**
 * Get canvas bounds (bounding box for all elements)
 */
export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export function getCanvasBounds(elements: CanvasElement[]): CanvasBounds | null {
  if (elements.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  elements.forEach((el) => {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  });

  const width = maxX - minX;
  const height = maxY - minY;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

/**
 * Fit canvas elements to viewport
 * Adjusts zoom and pan to show all elements
 */
export function fitCanvasToViewport(
  elements: CanvasElement[],
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 20
): {
  zoom: number;
  panX: number;
  panY: number;
} {
  const bounds = getCanvasBounds(elements);
  if (!bounds) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  const availableWidth = viewportWidth - padding * 2;
  const availableHeight = viewportHeight - padding * 2;

  const zoomX = availableWidth / bounds.width;
  const zoomY = availableHeight / bounds.height;
  const zoom = Math.min(zoomX, zoomY, 1);

  const panX = -(bounds.minX * zoom - padding);
  const panY = -(bounds.minY * zoom - padding);

  return { zoom, panX, panY };
}
