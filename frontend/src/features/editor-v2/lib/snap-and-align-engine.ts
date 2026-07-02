/**
 * Snapping & Alignment System
 * Provides intelligent snapping guides and alignment tools for canvas elements
 * Features: snap to grid, snap to edges, align tools, distribution
 */

import type { Point, Rect } from './canvas-drawing-engine';

export type AlignmentType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v';

export interface SnapResult {
  x?: number;
  y?: number;
  snapX?: boolean;
  snapY?: boolean;
  guides?: SnapGuide[];
}

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  elements: string[];
}

/**
 * Snapping and Alignment Engine
 */
export class SnapAndAlignEngine {
  private snapThreshold: number = 8;
  private gridSize: number = 16;
  private enableGridSnap: boolean = true;
  private enableEdgeSnap: boolean = true;

  constructor(snapThreshold: number = 8, gridSize: number = 16) {
    this.snapThreshold = snapThreshold;
    this.gridSize = gridSize;
  }

  /**
   * Calculate snap position for an element being dragged
   */
  public calculateSnap(
    movingElement: Rect,
    allElements: Map<string, Rect>,
    excludeId?: string
  ): SnapResult {
    const result: SnapResult = {};
    const guides: SnapGuide[] = [];

    // Grid snapping
    if (this.enableGridSnap) {
      const gridSnapX = this.snapToGrid(movingElement.x);
      const gridSnapY = this.snapToGrid(movingElement.y);

      if (Math.abs(movingElement.x - gridSnapX) < this.snapThreshold) {
        result.x = gridSnapX;
        result.snapX = true;
      }

      if (Math.abs(movingElement.y - gridSnapY) < this.snapThreshold) {
        result.y = gridSnapY;
        result.snapY = true;
      }
    }

    // Edge snapping
    if (this.enableEdgeSnap) {
      const edgeSnaps = this.snapToEdges(movingElement, allElements, excludeId);

      if (edgeSnaps.x !== undefined) {
        result.x = edgeSnaps.x;
        result.snapX = true;
      }
      if (edgeSnaps.y !== undefined) {
        result.y = edgeSnaps.y;
        result.snapY = true;
      }
      if (edgeSnaps.guides) {
        guides.push(...edgeSnaps.guides);
      }
    }

    result.guides = guides;
    return result;
  }

  /**
   * Snap position to grid
   */
  private snapToGrid(position: number): number {
    return Math.round(position / this.gridSize) * this.gridSize;
  }

  /**
   * Snap element edges to other elements
   */
  private snapToEdges(
    movingElement: Rect,
    allElements: Map<string, Rect>,
    excludeId?: string
  ): { x?: number; y?: number; guides?: SnapGuide[] } {
    const result: { x?: number; y?: number; guides?: SnapGuide[] } = { guides: [] };
    const snapPoints = {
      x: new Map<number, string[]>(),
      y: new Map<number, string[]>(),
    };

    // Collect snap points from other elements
    allElements.forEach((element, id) => {
      if (id === excludeId) {return;}

      const points = {
        left: element.x,
        centerX: element.x + element.width / 2,
        right: element.x + element.width,
        top: element.y,
        centerY: element.y + element.height / 2,
        bottom: element.y + element.height,
      };

      // Register horizontal snap points
      this.registerSnapPoint(snapPoints.x, movingElement.x, points.left, id);
      this.registerSnapPoint(snapPoints.x, movingElement.x + movingElement.width / 2, points.centerX, id);
      this.registerSnapPoint(snapPoints.x, movingElement.x + movingElement.width, points.right, id);

      // Register vertical snap points
      this.registerSnapPoint(snapPoints.y, movingElement.y, points.top, id);
      this.registerSnapPoint(snapPoints.y, movingElement.y + movingElement.height / 2, points.centerY, id);
      this.registerSnapPoint(snapPoints.y, movingElement.y + movingElement.height, points.bottom, id);
    });

    // Find closest snap points
    const snapX = this.findClosestSnap(snapPoints.x, movingElement.x);
    const snapY = this.findClosestSnap(snapPoints.y, movingElement.y);

    if (snapX.snapped && snapX.position !== undefined) {
      result.x = snapX.position;
      result.guides!.push({
        type: 'vertical',
        position: snapX.position,
        elements: snapX.elements,
      });
    }

    if (snapY.snapped && snapY.position !== undefined) {
      result.y = snapY.position;
      result.guides!.push({
        type: 'horizontal',
        position: snapY.position,
        elements: snapY.elements,
      });
    }

    return result;
  }

  private registerSnapPoint(
    snapMap: Map<number, string[]>,
    currentPos: number,
    targetPos: number,
    elementId: string
  ): void {
    if (Math.abs(currentPos - targetPos) < this.snapThreshold) {
      if (!snapMap.has(targetPos)) {
        snapMap.set(targetPos, []);
      }
      snapMap.get(targetPos)!.push(elementId);
    }
  }

  private findClosestSnap(
    snapMap: Map<number, string[]>,
    currentPos: number
  ): { snapped: boolean; position?: number; elements: string[] } {
    if (snapMap.size === 0) {
      return { snapped: false, elements: [] };
    }

    let closestDist = this.snapThreshold;
    let closestPos: number | undefined;
    let elements: string[] = [];

    snapMap.forEach((els, pos) => {
      const dist = Math.abs(currentPos - pos);
      if (dist < closestDist) {
        closestDist = dist;
        closestPos = pos;
        elements = els;
      }
    });

    return {
      snapped: closestPos !== undefined,
      position: closestPos,
      elements,
    };
  }

  /**
   * Align elements
   */
  public alignElements(
    elementIds: string[],
    elements: Map<string, Rect>,
    alignment: AlignmentType
  ): Map<string, Rect> {
    const result = new Map(elements);
    if (elementIds.length < 2) {return result;}

    const selectedElements = elementIds.map((id) => elements.get(id)!).filter((e) => e !== undefined);

    let alignValue: number;

    switch (alignment) {
      case 'left':
        alignValue = Math.min(...selectedElements.map((e) => e.x));
        selectedElements.forEach((e, i) => {
          const updatedEl = { ...e, x: alignValue };
          result.set(elementIds[i], updatedEl);
        });
        break;

      case 'center':
        alignValue =
          selectedElements.reduce((sum, e) => sum + e.x + e.width / 2, 0) / selectedElements.length;
        selectedElements.forEach((e, i) => {
          const updatedEl = { ...e, x: alignValue - e.width / 2 };
          result.set(elementIds[i], updatedEl);
        });
        break;

      case 'right':
        alignValue = Math.max(...selectedElements.map((e) => e.x + e.width));
        selectedElements.forEach((e, i) => {
          const updatedEl = { ...e, x: alignValue - e.width };
          result.set(elementIds[i], updatedEl);
        });
        break;

      case 'top':
        alignValue = Math.min(...selectedElements.map((e) => e.y));
        selectedElements.forEach((e, i) => {
          const updatedEl = { ...e, y: alignValue };
          result.set(elementIds[i], updatedEl);
        });
        break;

      case 'middle':
        alignValue =
          selectedElements.reduce((sum, e) => sum + e.y + e.height / 2, 0) / selectedElements.length;
        selectedElements.forEach((e, i) => {
          const updatedEl = { ...e, y: alignValue - e.height / 2 };
          result.set(elementIds[i], updatedEl);
        });
        break;

      case 'bottom':
        alignValue = Math.max(...selectedElements.map((e) => e.y + e.height));
        selectedElements.forEach((e, i) => {
          const updatedEl = { ...e, y: alignValue - e.height };
          result.set(elementIds[i], updatedEl);
        });
        break;

      case 'distribute-h':
        this.distributeHorizontally(result, elementIds, selectedElements);
        break;

      case 'distribute-v':
        this.distributeVertically(result, elementIds, selectedElements);
        break;
    }

    return result;
  }

  private distributeHorizontally(
    result: Map<string, Rect>,
    elementIds: string[],
    elements: Rect[]
  ): void {
    if (elements.length < 3) {return;}

    const sorted = elements
      .map((e, i) => ({ element: e, id: elementIds[i], centerX: e.x + e.width / 2 }))
      .sort((a, b) => a.centerX - b.centerX);

    const firstX = sorted[0].element.x + sorted[0].element.width / 2;
    const lastX = sorted[sorted.length - 1].element.x + sorted[sorted.length - 1].element.width / 2;
    const totalSpace = lastX - firstX;
    const gap = totalSpace / (sorted.length - 1);

    sorted.forEach((item, index) => {
      const newCenterX = firstX + gap * index;
      const newX = newCenterX - item.element.width / 2;
      result.set(item.id, { ...item.element, x: newX });
    });
  }

  private distributeVertically(
    result: Map<string, Rect>,
    elementIds: string[],
    elements: Rect[]
  ): void {
    if (elements.length < 3) {return;}

    const sorted = elements
      .map((e, i) => ({ element: e, id: elementIds[i], centerY: e.y + e.height / 2 }))
      .sort((a, b) => a.centerY - b.centerY);

    const firstY = sorted[0].element.y + sorted[0].element.height / 2;
    const lastY = sorted[sorted.length - 1].element.y + sorted[sorted.length - 1].element.height / 2;
    const totalSpace = lastY - firstY;
    const gap = totalSpace / (sorted.length - 1);

    sorted.forEach((item, index) => {
      const newCenterY = firstY + gap * index;
      const newY = newCenterY - item.element.height / 2;
      result.set(item.id, { ...item.element, y: newY });
    });
  }

  /**
   * Get guides for rendering
   */
  public getGuideLines(elements: Map<string, Rect>, selectedIds: string[]): SnapGuide[] {
    const guides: SnapGuide[] = [];
    const selectedElements = selectedIds.map((id) => elements.get(id)!).filter((e) => e !== undefined);

    if (selectedElements.length === 0) {return guides;}

    const positions = {
      x: new Set<number>(),
      y: new Set<number>(),
    };

    // Collect positions from selected elements
    selectedElements.forEach((e) => {
      positions.x.add(e.x);
      positions.x.add(e.x + e.width / 2);
      positions.x.add(e.x + e.width);
      positions.y.add(e.y);
      positions.y.add(e.y + e.height / 2);
      positions.y.add(e.y + e.height);
    });

    // Create guide lines at these positions
    positions.x.forEach((x) => {
      guides.push({
        type: 'vertical',
        position: x,
        elements: selectedIds,
      });
    });

    positions.y.forEach((y) => {
      guides.push({
        type: 'horizontal',
        position: y,
        elements: selectedIds,
      });
    });

    return guides;
  }

  public setSnapThreshold(threshold: number): void {
    this.snapThreshold = threshold;
  }

  public setGridSize(size: number): void {
    this.gridSize = size;
  }

  public setGridSnapEnabled(enabled: boolean): void {
    this.enableGridSnap = enabled;
  }

  public setEdgeSnapEnabled(enabled: boolean): void {
    this.enableEdgeSnap = enabled;
  }
}
