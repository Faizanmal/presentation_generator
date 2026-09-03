/**
 * Canvas Drawing Engine
 * Provides HTML5 Canvas-based drawing capabilities for competitive canvas features
 * Supports: shapes, pen drawing, text, connectors, with snapping & constraints
 */

export type ToolType = 'select' | 'pen' | 'rectangle' | 'circle' | 'line' | 'text' | 'connector' | 'arrow' | 'image';
export type ShapeType = 'rectangle' | 'circle' | 'line' | 'path' | 'text' | 'connector' | 'arrow' | 'image';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawingStyle {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | '500' | '600';
  textAlign?: 'left' | 'center' | 'right';
  dashArray?: number[];
}

export interface CanvasElement {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  locked?: boolean;
  style: DrawingStyle;
  data?: {
    text?: string;
    points?: Point[]; // for path/connector
    controlPoints?: Point[]; // for curves
    sourceId?: string; // for connector
    targetId?: string; // for connector
    url?: string; // for image
  };
  metadata?: {
    createdAt: number;
    updatedAt: number;
    createdBy?: string;
  };
}

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  elements: string[]; // element IDs that are aligned
}

export interface ConstraintOptions {
  aspectRatio?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  alignToGrid?: boolean;
  gridSize?: number;
}

/**
 * Main Canvas Drawing Engine
 */
export class CanvasDrawingEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private elements: Map<string, CanvasElement> = new Map();
  private selectedId: string | null = null;
  private currentTool: ToolType = 'select';
  private isDrawing = false;
  private startPoint: Point = { x: 0, y: 0 };
  private currentPath: Point[] = [];
  private snapGuides: SnapGuide[] = [];
  private constraints: Map<string, ConstraintOptions> = new Map();
  private pixelRatio: number;
  private zoom: number = 1;
  private panOffset: Point = { x: 0, y: 0 };
  private gridSize: number = 16;
  private showGrid: boolean = true;
  private snapThreshold: number = 8;

  // Event handlers
  private onElementsChange?: (elements: CanvasElement[]) => void;
  private onSelectionChange?: (elementId: string | null) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {throw new Error('Could not get 2D context from canvas');}
    this.ctx = ctx;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.setupCanvas();
    this.attachEventListeners();
  }

  private setupCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.pixelRatio;
    this.canvas.height = rect.height * this.pixelRatio;
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
  }

  private attachEventListeners(): void {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleMouseDown(e: MouseEvent): void {
    const point = this.getCanvasPoint(e);
    this.startPoint = point;
    this.isDrawing = true;

    if (this.currentTool === 'select') {
      this.selectElementAt(point);
    } else if (this.currentTool === 'pen') {
      this.currentPath = [point];
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDrawing) {return;}

    const point = this.getCanvasPoint(e);

    if (this.currentTool === 'pen') {
      this.currentPath.push(point);
    } else if (this.currentTool === 'select' && this.selectedId) {
      this.moveElement(this.selectedId, {
        x: point.x - this.startPoint.x,
        y: point.y - this.startPoint.y,
      });
      this.startPoint = point;
    }

    this.render();
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.isDrawing) {return;}

    const point = this.getCanvasPoint(e);
    this.isDrawing = false;

    switch (this.currentTool) {
      case 'pen':
        if (this.currentPath.length > 2) {
          this.addElement({
            type: 'path',
            x: this.startPoint.x,
            y: this.startPoint.y,
            width: 100,
            height: 100,
            data: { points: this.currentPath },
            style: { strokeColor: '#000000', strokeWidth: 2 },
          });
        }
        this.currentPath = [];
        break;
      case 'rectangle':
        this.createRectangle(this.startPoint, point);
        break;
      case 'circle':
        this.createCircle(this.startPoint, point);
        break;
      case 'line':
        this.createLine(this.startPoint, point);
        break;
      case 'text':
        this.createText(point);
        break;
    }

    this.render();
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = -e.deltaY * 0.01;
    const newZoom = Math.max(0.1, Math.min(5, this.zoom + delta));
    const zoomDelta = newZoom - this.zoom;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.zoom = newZoom;
    this.panOffset.x -= mouseX * zoomDelta / this.zoom;
    this.panOffset.y -= mouseY * zoomDelta / this.zoom;
    this.render();
  }

  private getCanvasPoint(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this.zoom - this.panOffset.x,
      y: (e.clientY - rect.top) / this.zoom - this.panOffset.y,
    };
  }

  private selectElementAt(point: Point): void {
    const elements = Array.from(this.elements.values()).reverse();
    for (const element of elements) {
      if (this.pointInRect(point, element)) {
        this.selectedId = element.id;
        this.onSelectionChange?.(this.selectedId);
        return;
      }
    }
    this.selectedId = null;
    this.onSelectionChange?.(null);
  }

  private pointInRect(point: Point, rect: CanvasElement): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  private moveElement(id: string, delta: Point): void {
    const element = this.elements.get(id);
    if (!element || element.locked) {return;}

    element.x += delta.x;
    element.y += delta.y;
    element.metadata = {
      ...(element.metadata ?? { createdAt: Date.now() }),
      updatedAt: Date.now(),
    };
    this.onElementsChange?.(Array.from(this.elements.values()));
  }

  private createRectangle(start: Point, end: Point): void {
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);

    this.addElement({
      type: 'rectangle',
      x,
      y,
      width,
      height,
      style: {
        fillColor: 'rgba(59, 130, 246, 0.1)',
        strokeColor: '#3b82f6',
        strokeWidth: 2,
      },
    });
  }

  private createCircle(start: Point, end: Point): void {
    const radius = Math.hypot(end.x - start.x, end.y - start.y) / 2;
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;

    this.addElement({
      type: 'circle',
      x: cx - radius,
      y: cy - radius,
      width: radius * 2,
      height: radius * 2,
      style: {
        fillColor: 'rgba(59, 130, 246, 0.1)',
        strokeColor: '#3b82f6',
        strokeWidth: 2,
      },
    });
  }

  private createLine(start: Point, end: Point): void {
    this.addElement({
      type: 'line',
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
      data: { points: [start, end] },
      style: {
        strokeColor: '#3b82f6',
        strokeWidth: 2,
      },
    });
  }

  private createText(point: Point): void {
    const id = this.generateId();
    this.elements.set(id, {
      id,
      type: 'text',
      x: point.x,
      y: point.y,
      width: 150,
      height: 40,
      style: {
        fillColor: '#000000',
        fontSize: 16,
        fontFamily: 'Arial',
        textAlign: 'left',
      },
      data: { text: 'Click to edit' },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
    this.selectedId = id;
    this.onSelectionChange?.(id);
    this.onElementsChange?.(Array.from(this.elements.values()));
  }

  private addElement(partial: Partial<CanvasElement>): void {
    const id = this.generateId();
    const element: CanvasElement = {
      id,
      type: (partial.type || 'rectangle') as ShapeType,
      x: partial.x || 0,
      y: partial.y || 0,
      width: partial.width || 100,
      height: partial.height || 100,
      rotation: partial.rotation || 0,
      locked: partial.locked || false,
      style: partial.style || {},
      data: partial.data,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    this.elements.set(id, element);
    this.selectedId = id;
    this.onSelectionChange?.(id);
    this.onElementsChange?.(Array.from(this.elements.values()));
  }

  private generateId(): string {
    return `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public render(): void {
    this.clearCanvas();
    this.drawGrid();
    this.drawElements();
    this.drawSelection();
    this.drawSnapGuides();
  }

  private clearCanvas(): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawGrid(): void {
    if (!this.showGrid) {return;}

    this.ctx.strokeStyle = '#e5e7eb';
    this.ctx.lineWidth = 0.5;

    const gridSpacing = this.gridSize * this.zoom;
    const offsetX = this.panOffset.x * this.zoom;
    const offsetY = this.panOffset.y * this.zoom;

    // Vertical lines
    for (let i = Math.floor(offsetX / gridSpacing); i < (this.canvas.width + offsetX) / gridSpacing; i++) {
      const x = i * gridSpacing - offsetX;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let i = Math.floor(offsetY / gridSpacing); i < (this.canvas.height + offsetY) / gridSpacing; i++) {
      const y = i * gridSpacing - offsetY;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  private drawElements(): void {
    Array.from(this.elements.values()).forEach((element) => {
      this.drawElement(element);
    });
  }

  private drawElement(element: CanvasElement): void {
    this.ctx.save();
    this.ctx.translate(element.x + element.width / 2, element.y + element.height / 2);
    if (element.rotation) {
      this.ctx.rotate((element.rotation * Math.PI) / 180);
    }
    this.ctx.translate(-(element.width / 2), -(element.height / 2));

    this.applyStyle(element.style);

    switch (element.type) {
      case 'rectangle':
        this.drawRect(element);
        break;
      case 'circle':
        this.drawCircle(element);
        break;
      case 'line':
        this.drawLine(element);
        break;
      case 'path':
        this.drawPath(element);
        break;
      case 'text':
        this.drawText(element);
        break;
      case 'connector':
      case 'arrow':
        this.drawConnector(element);
        break;
    }

    this.ctx.restore();
  }

  private drawRect(element: CanvasElement): void {
    const { fillColor, strokeColor, strokeWidth = 1 } = element.style;
    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(0, 0, element.width, element.height);
    }
    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.strokeRect(0, 0, element.width, element.height);
    }
  }

  private drawCircle(element: CanvasElement): void {
    const radius = element.width / 2;
    const { fillColor, strokeColor, strokeWidth = 1 } = element.style;

    this.ctx.beginPath();
    this.ctx.arc(radius, radius, radius, 0, Math.PI * 2);

    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }
    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.stroke();
    }
  }

  private drawLine(element: CanvasElement): void {
    const { points } = element.data || {};
    if (!points || points.length < 2) {return;}

    const { strokeColor, strokeWidth = 1 } = element.style;
    this.ctx.strokeStyle = strokeColor || '#000000';
    this.ctx.lineWidth = strokeWidth;
    this.ctx.beginPath();

    this.ctx.moveTo(points[0].x - element.x, points[0].y - element.y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x - element.x, points[i].y - element.y);
    }
    this.ctx.stroke();
  }

  private drawPath(element: CanvasElement): void {
    const { points } = element.data || {};
    if (!points || points.length < 2) {return;}

    const { strokeColor, strokeWidth = 2 } = element.style;
    this.ctx.strokeStyle = strokeColor || '#000000';
    this.ctx.lineWidth = strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();

    this.ctx.moveTo(points[0].x - element.x, points[0].y - element.y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x - element.x, points[i].y - element.y);
    }
    this.ctx.stroke();
  }

  private drawText(element: CanvasElement): void {
    const { text = '' } = element.data || {};
    const { fillColor, fontSize = 16, fontFamily = 'Arial', fontWeight = 'normal' } = element.style;

    this.ctx.fillStyle = fillColor || '#000000';
    this.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    this.ctx.fillText(text, 5, fontSize, element.width - 10);
  }

  private drawConnector(element: CanvasElement): void {
    // Simple connector drawing
    const { strokeColor, strokeWidth = 2 } = element.style;
    this.ctx.strokeStyle = strokeColor || '#3b82f6';
    this.ctx.lineWidth = strokeWidth;
    this.ctx.setLineDash(element.type === 'connector' ? [5, 5] : []);
    this.ctx.beginPath();
    this.ctx.moveTo(0, element.height / 2);
    this.ctx.lineTo(element.width, element.height / 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  private drawSelection(): void {
    if (!this.selectedId) {return;}

    const element = this.elements.get(this.selectedId);
    if (!element) {return;}

    const padding = 4;
    this.ctx.strokeStyle = '#3b82f6';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeRect(
      element.x - padding,
      element.y - padding,
      element.width + padding * 2,
      element.height + padding * 2
    );
    this.ctx.setLineDash([]);

    // Draw handles
    this.drawResizeHandles(element);
  }

  private drawResizeHandles(element: CanvasElement): void {
    const handleSize = 6;
    const handles = [
      { x: element.x, y: element.y }, // top-left
      { x: element.x + element.width / 2, y: element.y }, // top-center
      { x: element.x + element.width, y: element.y }, // top-right
      { x: element.x, y: element.y + element.height / 2 }, // mid-left
      { x: element.x + element.width, y: element.y + element.height / 2 }, // mid-right
      { x: element.x, y: element.y + element.height }, // bottom-left
      { x: element.x + element.width / 2, y: element.y + element.height }, // bottom-center
      { x: element.x + element.width, y: element.y + element.height }, // bottom-right
    ];

    this.ctx.fillStyle = '#3b82f6';
    handles.forEach((handle) => {
      this.ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    });
  }

  private drawSnapGuides(): void {
    if (this.snapGuides.length === 0) {return;}

    this.ctx.strokeStyle = '#f97316';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 2]);

    this.snapGuides.forEach((guide) => {
      if (guide.type === 'vertical') {
        this.ctx.beginPath();
        this.ctx.moveTo(guide.position, 0);
        this.ctx.lineTo(guide.position, this.canvas.height);
        this.ctx.stroke();
      } else {
        this.ctx.beginPath();
        this.ctx.moveTo(0, guide.position);
        this.ctx.lineTo(this.canvas.width, guide.position);
        this.ctx.stroke();
      }
    });

    this.ctx.setLineDash([]);
  }

  private applyStyle(style: DrawingStyle): void {
    if (style.opacity !== undefined) {
      this.ctx.globalAlpha = style.opacity;
    }
    if (style.dashArray) {
      this.ctx.setLineDash(style.dashArray);
    }
  }

  // Public API

  public setTool(tool: ToolType): void {
    this.currentTool = tool;
  }

  public getTool(): ToolType {
    return this.currentTool;
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(0.1, Math.min(5, zoom));
    this.render();
  }

  public getZoom(): number {
    return this.zoom;
  }

  public pan(dx: number, dy: number): void {
    this.panOffset.x += dx;
    this.panOffset.y += dy;
    this.render();
  }

  public getPan(): Point {
    return { ...this.panOffset };
  }

  public getElements(): CanvasElement[] {
    return Array.from(this.elements.values());
  }

  public getElement(id: string): CanvasElement | undefined {
    return this.elements.get(id);
  }

  public updateElement(id: string, updates: Partial<CanvasElement>): void {
    const element = this.elements.get(id);
    if (!element) {return;}

    Object.assign(element, updates);
    element.metadata = {
      ...(element.metadata ?? { createdAt: Date.now() }),
      updatedAt: Date.now(),
    };
    this.onElementsChange?.(Array.from(this.elements.values()));
    this.render();
  }

  public deleteElement(id: string): void {
    this.elements.delete(id);
    if (this.selectedId === id) {
      this.selectedId = null;
      this.onSelectionChange?.(null);
    }
    this.onElementsChange?.(Array.from(this.elements.values()));
    this.render();
  }

  public duplicateElement(id: string): string {
    const element = this.elements.get(id);
    if (!element) {return '';}

    const newId = this.generateId();
    const newElement: CanvasElement = {
      ...JSON.parse(JSON.stringify(element)),
      id: newId,
      x: element.x + 20,
      y: element.y + 20,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    this.elements.set(newId, newElement);
    this.selectedId = newId;
    this.onSelectionChange?.(newId);
    this.onElementsChange?.(Array.from(this.elements.values()));
    this.render();
    return newId;
  }

  public setSelected(id: string | null): void {
    this.selectedId = id;
    this.onSelectionChange?.(id);
    this.render();
  }

  public getSelected(): string | null {
    return this.selectedId;
  }

  public setOnElementsChange(callback: (elements: CanvasElement[]) => void): void {
    this.onElementsChange = callback;
  }

  public setOnSelectionChange(callback: (elementId: string | null) => void): void {
    this.onSelectionChange = callback;
  }

  public toggleGrid(): void {
    this.showGrid = !this.showGrid;
    this.render();
  }

  public setGridSize(size: number): void {
    this.gridSize = size;
    this.render();
  }

  public clear(): void {
    this.elements.clear();
    this.selectedId = null;
    this.onElementsChange?.(Array.from(this.elements.values()));
    this.render();
  }

  public resize(): void {
    this.setupCanvas();
    this.render();
  }

  public dispose(): void {
    // Cleanup event listeners if needed
  }
}
