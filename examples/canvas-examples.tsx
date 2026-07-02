/**
 * Canvas Integration Examples
 * Complete examples showing how to use the advanced canvas system
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import { AdvancedCanvasEditor } from '@/features/editor-v2/components/advanced-canvas-editor';
import type { CanvasElement } from '@/features/editor-v2/lib/canvas-drawing-engine';
import { DrawingUtils, ShapeLibrary } from '@/features/editor-v2/lib/drawing-utils';
import { ConstraintPresets } from '@/features/editor-v2/lib/constraint-engine';
import { Button } from '@/components/ui/button';

// ============================================================================
// Example 1: Basic Canvas with Event Handlers
// ============================================================================

export function BasicCanvasExample() {
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleElementsChange = useCallback((newElements: CanvasElement[]) => {
    setElements(newElements);
    console.log('Elements changed:', newElements);
    // TODO: Save to database
  }, []);

  const handleSelectionChange = useCallback((elementId: string | null) => {
    setSelectedId(elementId);
    console.log('Selection changed:', elementId);
  }, []);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Canvas Editor</h1>
        <div className="text-sm text-muted-foreground">
          {elements.length} elements
          {selectedId && ` • Selected: ${selectedId}`}
        </div>
      </div>

      <div className="flex-1">
        <AdvancedCanvasEditor
          width={1200}
          height={700}
          onElementsChange={handleElementsChange}
          onSelectionChange={handleSelectionChange}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Example 2: Canvas with Preset Shapes
// ============================================================================

export function CanvasWithPresetsExample() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);

  const addShape = useCallback(
    (shape: CanvasElement) => {
      setElements([...elements, shape]);
    },
    [elements]
  );

  const addRectangle = () => {
    addShape({
      ...ShapeLibrary.createRectangle(200, 150),
      x: Math.random() * 500,
      y: Math.random() * 300,
    });
  };

  const addCircle = () => {
    addShape({
      ...ShapeLibrary.createCircle(75),
      x: Math.random() * 500,
      y: Math.random() * 300,
    });
  };

  const addText = () => {
    addShape({
      ...ShapeLibrary.createText('Click to edit'),
      x: Math.random() * 500,
      y: Math.random() * 300,
    });
  };

  const addStar = () => {
    const star = DrawingUtils.createStar(50, 50, 50, 25, 5);
    addShape({
      id: `star_${Date.now()}`,
      type: 'path',
      x: Math.random() * 500,
      y: Math.random() * 300,
      width: 100,
      height: 100,
      data: { points: star },
      style: {
        fillColor: '#f59e0b',
        strokeColor: '#d97706',
        strokeWidth: 2,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
  };

  return (
    <div className="flex gap-4 h-full">
      <div className="flex flex-col gap-2 p-4 bg-card border rounded w-40">
        <h2 className="font-semibold mb-2">Shapes</h2>
        <Button onClick={addRectangle} variant="outline" size="sm">
          ▭ Rectangle
        </Button>
        <Button onClick={addCircle} variant="outline" size="sm">
          ● Circle
        </Button>
        <Button onClick={addText} variant="outline" size="sm">
          T Text
        </Button>
        <Button onClick={addStar} variant="outline" size="sm">
          ⭐ Star
        </Button>
      </div>

      <div className="flex-1">
        <AdvancedCanvasEditor
          width={900}
          height={600}
          initialElements={elements}
          onElementsChange={setElements}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Example 3: Canvas with Constraints (Responsive Layout)
// ============================================================================

export function CanvasWithConstraintsExample() {
  const [elements, setElements] = useState<CanvasElement[]>([
    {
      id: 'bg',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 1200,
      height: 600,
      style: {
        fillColor: '#f0f0f0',
        strokeColor: '#ccc',
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
    {
      ...ShapeLibrary.createRectangle(400, 300),
      id: 'main-card',
      x: 400,
      y: 150,
      style: {
        fillColor: '#ffffff',
        strokeColor: '#e0e0e0',
        strokeWidth: 2,
      },
    },
  ]);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-3 rounded border border-blue-200">
        <p className="text-sm">
          💡 <strong>Tip:</strong> Elements with aspect ratio constraints will maintain their
          proportions. Try resizing the card while holding Shift to lock aspect ratio.
        </p>
      </div>

      <AdvancedCanvasEditor
        width={1200}
        height={600}
        initialElements={elements}
        onElementsChange={setElements}
      />
    </div>
  );
}

// ============================================================================
// Example 4: Drawing Utilities Demo
// ============================================================================

export function DrawingUtilitiesExample() {
  const [demo, setDemo] = useState<'smooth' | 'simplify' | 'shapes' | 'transform'>('shapes');

  const renderShapesDemo = () => {
    const elements: CanvasElement[] = [];

    // Pentagon
    const pentagon = DrawingUtils.createPolygon(150, 150, 60, 5);
    elements.push({
      id: 'pentagon',
      type: 'path',
      x: 50,
      y: 50,
      width: 200,
      height: 200,
      data: { points: pentagon },
      style: { fillColor: '#8b5cf6', strokeColor: '#6d28d9' },
      metadata: { createdAt: Date.now(), updatedAt: Date.now() },
    });

    // Star
    const star = DrawingUtils.createStar(350, 150, 50, 25, 5);
    elements.push({
      id: 'star',
      type: 'path',
      x: 300,
      y: 50,
      width: 100,
      height: 100,
      data: { points: star },
      style: { fillColor: '#f59e0b', strokeColor: '#d97706' },
      metadata: { createdAt: Date.now(), updatedAt: Date.now() },
    });

    // Rounded rectangle
    const rounded = DrawingUtils.createRoundedRectangle(500, 50, 250, 150, 20);
    elements.push({
      id: 'rounded',
      type: 'path',
      x: 500,
      y: 50,
      width: 250,
      height: 150,
      data: { points: rounded },
      style: { fillColor: '#06b6d4', strokeColor: '#0891b2' },
      metadata: { createdAt: Date.now(), updatedAt: Date.now() },
    });

    return elements;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={demo === 'shapes' ? 'default' : 'outline'}
          onClick={() => setDemo('shapes')}
        >
          Shapes
        </Button>
        <Button
          variant={demo === 'smooth' ? 'default' : 'outline'}
          onClick={() => setDemo('smooth')}
        >
          Path Smoothing
        </Button>
        <Button
          variant={demo === 'simplify' ? 'default' : 'outline'}
          onClick={() => setDemo('simplify')}
        >
          Simplification
        </Button>
        <Button
          variant={demo === 'transform' ? 'default' : 'outline'}
          onClick={() => setDemo('transform')}
        >
          Transform
        </Button>
      </div>

      <AdvancedCanvasEditor
        width={1200}
        height={400}
        initialElements={demo === 'shapes' ? renderShapesDemo() : []}
        onElementsChange={() => {}}
      />
    </div>
  );
}

// ============================================================================
// Example 5: Collaboration-Ready Canvas
// ============================================================================

export function CollaborativeCanvasExample() {
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleElementsChange = (newElements: CanvasElement[]) => {
    setElements(newElements);

    // Simple undo/redo history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    // Simulate sending to server
    console.log('Syncing to server:', newElements);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex gap-2 items-center">
        <Button onClick={handleUndo} disabled={historyIndex <= 0} variant="outline" size="sm">
          ↶ Undo
        </Button>
        <Button onClick={handleRedo} disabled={historyIndex >= history.length - 1} variant="outline" size="sm">
          ↷ Redo
        </Button>
        <span className="text-sm text-muted-foreground">
          {historyIndex + 1} / {history.length}
        </span>
      </div>

      <div className="flex-1 bg-blue-50 border-2 border-dashed border-blue-300 rounded p-2">
        <AdvancedCanvasEditor
          width={1200}
          height={500}
          initialElements={elements}
          onElementsChange={handleElementsChange}
        />
      </div>

      <div className="text-xs text-muted-foreground bg-card p-2 rounded border">
        💬 Changes are synced to server automatically. Users can see real-time updates via WebSocket.
      </div>
    </div>
  );
}

// ============================================================================
// Example 6: Full-Featured Design Dashboard
// ============================================================================

export function DesignDashboardExample() {
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null);
  const [zoom, setZoom] = useState(100);

  return (
    <div className="flex gap-4 h-full">
      {/* Left Panel - Properties */}
      <div className="w-64 bg-card border-r p-4 space-y-4 overflow-y-auto">
        <h3 className="font-semibold">Properties</h3>

        {selectedElement ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">ID</label>
              <p className="text-xs text-muted-foreground font-mono">{selectedElement.id}</p>
            </div>

            <div>
              <label className="text-xs font-medium">Type</label>
              <p className="text-xs text-muted-foreground capitalize">{selectedElement.type}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">X</label>
                <p className="text-xs text-muted-foreground">{selectedElement.x.toFixed(0)}</p>
              </div>
              <div>
                <label className="text-xs font-medium">Y</label>
                <p className="text-xs text-muted-foreground">{selectedElement.y.toFixed(0)}</p>
              </div>
              <div>
                <label className="text-xs font-medium">Width</label>
                <p className="text-xs text-muted-foreground">{selectedElement.width.toFixed(0)}</p>
              </div>
              <div>
                <label className="text-xs font-medium">Height</label>
                <p className="text-xs text-muted-foreground">{selectedElement.height.toFixed(0)}</p>
              </div>
            </div>

            {selectedElement.style.fillColor && (
              <div>
                <label className="text-xs font-medium">Fill</label>
                <div
                  className="w-full h-8 rounded border"
                  style={{ backgroundColor: selectedElement.style.fillColor }}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Select an element to view properties</p>
        )}
      </div>

      {/* Center - Canvas */}
      <div className="flex-1 flex flex-col">
        <AdvancedCanvasEditor
          width={1000}
          height={600}
          initialElements={elements}
          onElementsChange={setElements}
          onSelectionChange={(id) => {
            const element = elements.find((e) => e.id === id);
            setSelectedElement(element || null);
          }}
        />
      </div>

      {/* Right Panel - Layers */}
      <div className="w-48 bg-card border-l p-4 space-y-2 overflow-y-auto">
        <h3 className="font-semibold text-sm">Layers ({elements.length})</h3>
        <div className="space-y-1">
          {elements.map((element) => (
            <div
              key={element.id}
              onClick={() => setSelectedElement(element)}
              className={`p-2 rounded text-xs cursor-pointer border ${
                selectedElement?.id === element.id
                  ? 'bg-blue-100 border-blue-300'
                  : 'bg-muted border-transparent hover:bg-muted'
              }`}
            >
              <p className="font-medium capitalize">{element.type}</p>
              <p className="text-muted-foreground text-xs font-mono">{element.id.slice(0, 12)}...</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Export all examples
// ============================================================================

export const canvasExamples = {
  BasicCanvasExample,
  CanvasWithPresetsExample,
  CanvasWithConstraintsExample,
  DrawingUtilitiesExample,
  CollaborativeCanvasExample,
  DesignDashboardExample,
};
