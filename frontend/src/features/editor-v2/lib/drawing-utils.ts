/**
 * Drawing Utilities & Tools
 * Provides advanced drawing capabilities: strokes, shapes, paths, effects
 */

import type { Point, CanvasElement } from './canvas-drawing-engine';

export interface StrokeProperties {
  width: number;
  color: string;
  opacity: number;
  lineCap: 'butt' | 'round' | 'square';
  lineJoin: 'bevel' | 'miter' | 'round';
  dashArray?: number[];
  dashOffset?: number;
}

export interface FillProperties {
  color: string;
  opacity: number;
  pattern?: ImageData;
}

export interface ShadowProperties {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface GradientProperties {
  type: 'linear' | 'radial';
  angle?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  r1?: number;
  r2?: number;
  stops: Array<{ position: number; color: string }>;
}

/**
 * Drawing utilities for common shapes and effects
 */
export class DrawingUtils {
  /**
   * Smooth a path using Catmull-Rom curve interpolation
   */
  static smoothPath(points: Point[], _tension: number = 0.5): Point[] {
    if (points.length < 2) {return points;}

    const result: Point[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i === 0 ? points[0] : points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i === points.length - 2 ? p2 : points[i + 2];

      // Generate curve points between p1 and p2
      for (let t = 0; t < 1; t += 0.1) {
        const t2 = t * t;
        const t3 = t2 * t;

        const p = {
          x:
            0.5 *
            (2 * p1.x +
              (-p0.x + p2.x) * t +
              (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
              (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y:
            0.5 *
            (2 * p1.y +
              (-p0.y + p2.y) * t +
              (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
              (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        };
        result.push(p);
      }
    }

    result.push(points[points.length - 1]);
    return result;
  }

  /**
   * Simplify path using Ramer-Douglas-Peucker algorithm
   */
  static simplifyPath(points: Point[], epsilon: number = 2): Point[] {
    if (points.length < 3) {return points;}

    let dmax = 0;
    let index = 0;

    for (let i = 1; i < points.length - 1; i++) {
      const d = this.pointToLineDistance(points[i], points[0], points[points.length - 1]);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }

    if (dmax > epsilon) {
      const result1 = this.simplifyPath(points.slice(0, index + 1), epsilon);
      const result2 = this.simplifyPath(points.slice(index), epsilon);
      return result1.slice(0, -1).concat(result2);
    } else {
      return [points[0], points[points.length - 1]];
    }
  }

  private static pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const numerator = Math.abs(
      (lineEnd.y - lineStart.y) * point.x -
        (lineEnd.x - lineStart.x) * point.y +
        lineEnd.x * lineStart.y -
        lineEnd.y * lineStart.x
    );
    const denominator = Math.sqrt(
      Math.pow(lineEnd.y - lineStart.y, 2) + Math.pow(lineEnd.x - lineStart.x, 2)
    );
    return numerator / denominator;
  }

  /**
   * Calculate bounding box for a set of points
   */
  static getBounds(points: Point[]): { x: number; y: number; width: number; height: number } {
    if (points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = points[0].x;
    let maxX = points[0].x;
    let minY = points[0].y;
    let maxY = points[0].y;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Normalize path coordinates to start at (0, 0)
   */
  static normalizePath(points: Point[]): Point[] {
    if (points.length === 0) {return [];}

    const bounds = this.getBounds(points);
    return points.map((p) => ({
      x: p.x - bounds.x,
      y: p.y - bounds.y,
    }));
  }

  /**
   * Draw rounded rectangle
   */
  static createRoundedRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number = 5
  ): Point[] {
    const points: Point[] = [];
    const steps = 20;

    // Top-left corner
    for (let i = 0; i <= steps; i++) {
      const angle = Math.PI + (Math.PI / 2) * (i / steps);
      points.push({
        x: x + radius + radius * Math.cos(angle),
        y: y + radius + radius * Math.sin(angle),
      });
    }

    // Top-right corner
    for (let i = 0; i <= steps; i++) {
      const angle = (Math.PI / 2) * (1 - i / steps);
      points.push({
        x: x + width - radius + radius * Math.cos(angle),
        y: y + radius + radius * Math.sin(angle),
      });
    }

    // Bottom-right corner
    for (let i = 0; i <= steps; i++) {
      const angle = (Math.PI / 2) * (i / steps);
      points.push({
        x: x + width - radius + radius * Math.cos(angle),
        y: y + height - radius + radius * Math.sin(angle),
      });
    }

    // Bottom-left corner
    for (let i = 0; i <= steps; i++) {
      const angle = (Math.PI / 2) * (1 + i / steps);
      points.push({
        x: x + radius + radius * Math.cos(angle),
        y: y + height - radius + radius * Math.sin(angle),
      });
    }

    return points;
  }

  /**
   * Create polygon shape
   */
  static createPolygon(centerX: number, centerY: number, radius: number, sides: number): Point[] {
    const points: Point[] = [];
    const angleSlice = (Math.PI * 2) / sides;

    for (let i = 0; i < sides; i++) {
      const angle = angleSlice * i - Math.PI / 2;
      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    }

    return points;
  }

  /**
   * Create star shape
   */
  static createStar(
    centerX: number,
    centerY: number,
    outerRadius: number,
    innerRadius: number,
    points: number = 5
  ): Point[] {
    const result: Point[] = [];
    const angleSlice = (Math.PI * 2) / (points * 2);

    for (let i = 0; i < points * 2; i++) {
      const angle = angleSlice * i - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      result.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    }

    return result;
  }

  /**
   * Create arrow shape
   */
  static createArrow(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    headSize: number = 20
  ): { line: Point[]; head: Point[] } {
    const line: Point[] = [{ x: startX, y: startY }];

    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx);

    // Adjust end point to account for arrow head
    const adjustedEnd = {
      x: endX - Math.cos(angle) * headSize,
      y: endY - Math.sin(angle) * headSize,
    };

    line.push(adjustedEnd);

    // Arrow head
    const head: Point[] = [
      { x: endX, y: endY },
      {
        x: adjustedEnd.x - Math.cos(angle + Math.PI / 6) * headSize,
        y: adjustedEnd.y - Math.sin(angle + Math.PI / 6) * headSize,
      },
      {
        x: adjustedEnd.x - Math.cos(angle - Math.PI / 6) * headSize,
        y: adjustedEnd.y - Math.sin(angle - Math.PI / 6) * headSize,
      },
    ];

    return { line, head };
  }

  /**
   * Calculate length of a path
   */
  static getPathLength(points: Point[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  /**
   * Get point at distance along path
   */
  static getPointAtDistance(points: Point[], distance: number): Point | null {
    let traveled = 0;

    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);

      if (traveled + segmentLength >= distance) {
        const ratio = (distance - traveled) / segmentLength;
        return {
          x: points[i - 1].x + dx * ratio,
          y: points[i - 1].y + dy * ratio,
        };
      }

      traveled += segmentLength;
    }

    return null;
  }

  /**
   * Rotate points around center
   */
  static rotatePoints(points: Point[], centerX: number, centerY: number, angle: number): Point[] {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return points.map((p) => {
      const x = p.x - centerX;
      const y = p.y - centerY;
      return {
        x: centerX + x * cos - y * sin,
        y: centerY + x * sin + y * cos,
      };
    });
  }

  /**
   * Scale points around center
   */
  static scalePoints(points: Point[], centerX: number, centerY: number, scaleX: number, scaleY: number): Point[] {
    return points.map((p) => ({
      x: centerX + (p.x - centerX) * scaleX,
      y: centerY + (p.y - centerY) * scaleY,
    }));
  }

  /**
   * Translate points
   */
  static translatePoints(points: Point[], dx: number, dy: number): Point[] {
    return points.map((p) => ({
      x: p.x + dx,
      y: p.y + dy,
    }));
  }

  /**
   * Check if point is inside polygon (ray casting algorithm)
   */
  static pointInPolygon(point: Point, polygon: Point[]): boolean {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) {inside = !inside;}
    }

    return inside;
  }

  /**
   * Distance between two points
   */
  static distance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Angle between two points (in radians)
   */
  static angle(p1: Point, p2: Point): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  }

  /**
   * Midpoint between two points
   */
  static midpoint(p1: Point, p2: Point): Point {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  }
}

/**
 * Shape library for common predefined shapes
 */
export class ShapeLibrary {
  static createRectangle(width: number, height: number): CanvasElement {
    return {
      id: `rect_${Date.now()}`,
      type: 'rectangle',
      x: 0,
      y: 0,
      width,
      height,
      style: {
        fillColor: 'rgba(59, 130, 246, 0.1)',
        strokeColor: '#3b82f6',
        strokeWidth: 2,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  }

  static createCircle(radius: number): CanvasElement {
    return {
      id: `circle_${Date.now()}`,
      type: 'circle',
      x: 0,
      y: 0,
      width: radius * 2,
      height: radius * 2,
      style: {
        fillColor: 'rgba(59, 130, 246, 0.1)',
        strokeColor: '#3b82f6',
        strokeWidth: 2,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  }

  static createText(content: string, fontSize: number = 16): CanvasElement {
    return {
      id: `text_${Date.now()}`,
      type: 'text',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      data: { text: content },
      style: {
        fillColor: '#000000',
        fontSize,
        fontFamily: 'Arial',
        textAlign: 'left',
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  }

  static createLine(x1: number, y1: number, x2: number, y2: number): CanvasElement {
    return {
      id: `line_${Date.now()}`,
      type: 'line',
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      data: { points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] },
      style: {
        strokeColor: '#3b82f6',
        strokeWidth: 2,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  }
}
