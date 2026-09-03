'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CanvasDrawingEngine, type ToolType, type CanvasElement } from '../lib/canvas-drawing-engine';
import { SnapAndAlignEngine, type AlignmentType } from '../lib/snap-and-align-engine';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AdvancedCanvasEditorProps {
  onElementsChange?: (elements: CanvasElement[]) => void;
  onSelectionChange?: (elementId: string | null) => void;
  initialElements?: CanvasElement[];
  width?: number;
  height?: number;
}

export const AdvancedCanvasEditor: React.FC<AdvancedCanvasEditorProps> = ({
  onElementsChange,
  onSelectionChange,
  initialElements = [],
  width = 1200,
  height = 800,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<CanvasDrawingEngine | null>(null);
  const [snapEngine] = useState(() => new SnapAndAlignEngine(8, 16));
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null);
  const [elements, setElements] = useState<CanvasElement[]>(initialElements);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  // Keep latest elements for selection callback without re-initing the engine
  const elementsRef = useRef(elements);
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  // Initialize canvas engine
  useEffect(() => {
    if (!canvasRef.current) {return;}

    const canvas = canvasRef.current;
    const newEngine = new CanvasDrawingEngine(canvas);
    newEngine.setOnElementsChange((els) => {
      setElements(els);
      onElementsChange?.(els);
    });
    newEngine.setOnSelectionChange((id) => {
      const selected = elementsRef.current.find((e: CanvasElement) => e.id === id) || null;
      setSelectedElement(selected || null);
      onSelectionChange?.(id);
    });

    setEngine(newEngine);
    newEngine.render();

    return () => {
      newEngine.dispose();
    };
  }, [onElementsChange, onSelectionChange]);

  const handleToolChange = useCallback(
    (tool: ToolType) => {
      setCurrentTool(tool);
      engine?.setTool(tool);
    },
    [engine]
  );

  const handleZoom = useCallback(
    (delta: number) => {
      if (!engine) {return;}
      const newZoom = Math.max(0.1, Math.min(5, zoom + delta));
      setZoom(newZoom);
      engine.setZoom(newZoom);
    },
    [engine, zoom]
  );

  const handleAlign = useCallback(
    (alignment: AlignmentType) => {
      if (!engine || elements.length < 2) {return;}

      // Get selected elements (for simplicity, align first 2 selected)
      const elementMap = new Map(elements.map((e) => [e.id, { x: e.x, y: e.y, width: e.width, height: e.height }]));
      const selectedIds = elements.slice(0, 2).map((e) => e.id);

      const aligned = snapEngine.alignElements(selectedIds, elementMap, alignment);

      // Update elements with new positions
      elements.forEach((e) => {
        const newPos = aligned.get(e.id);
        if (newPos) {
          engine.updateElement(e.id, {
            x: newPos.x,
            y: newPos.y,
            width: newPos.width,
            height: newPos.height,
          });
        }
      });
    },
    [engine, elements, snapEngine]
  );

  const handleDuplicate = useCallback(() => {
    if (!engine || !selectedElement) {return;}
    engine.duplicateElement(selectedElement.id);
  }, [engine, selectedElement]);

  const handleDelete = useCallback(() => {
    if (!engine || !selectedElement) {return;}
    engine.deleteElement(selectedElement.id);
    setSelectedElement(null);
  }, [engine, selectedElement]);

  const handleToggleGrid = useCallback(() => {
    engine?.toggleGrid();
    setShowGrid(!showGrid);
  }, [engine, showGrid]);

  const handleClear = useCallback(() => {
    if (confirm('Clear all elements? This cannot be undone.')) {
      engine?.clear();
      setElements([]);
      setSelectedElement(null);
    }
  }, [engine]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-background border rounded-lg">
        {/* Toolbar */}
        <div className="border-b bg-card p-3 space-y-2">
          {/* Tools */}
          <div className="flex gap-1 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={currentTool === 'select' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleToolChange('select')}
                >
                  ↖️ Select
                </Button>
              </TooltipTrigger>
              <TooltipContent>Select and move elements</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={currentTool === 'rectangle' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleToolChange('rectangle')}
                >
                  ▭ Rectangle
                </Button>
              </TooltipTrigger>
              <TooltipContent>Draw rectangle</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={currentTool === 'circle' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleToolChange('circle')}
                >
                  ● Circle
                </Button>
              </TooltipTrigger>
              <TooltipContent>Draw circle</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={currentTool === 'line' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleToolChange('line')}
                >
                  / Line
                </Button>
              </TooltipTrigger>
              <TooltipContent>Draw line</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={currentTool === 'pen' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleToolChange('pen')}
                >
                  ✏️ Pen
                </Button>
              </TooltipTrigger>
              <TooltipContent>Draw freehand</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={currentTool === 'text' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleToolChange('text')}
                >
                  T Text
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add text</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" />

            {/* Alignment */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAlign('left')}
                  disabled={elements.length < 2}
                >
                  ⬅ Align Left
                </Button>
              </TooltipTrigger>
              <TooltipContent>Align selected to left</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAlign('center')}
                  disabled={elements.length < 2}
                >
                  ⬌ Center
                </Button>
              </TooltipTrigger>
              <TooltipContent>Align selected horizontally</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAlign('right')}
                  disabled={elements.length < 2}
                >
                  Align Right ➡
                </Button>
              </TooltipTrigger>
              <TooltipContent>Align selected to right</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAlign('top')}
                  disabled={elements.length < 2}
                >
                  ⬆ Align Top
                </Button>
              </TooltipTrigger>
              <TooltipContent>Align selected to top</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAlign('middle')}
                  disabled={elements.length < 2}
                >
                  ⬍ Middle
                </Button>
              </TooltipTrigger>
              <TooltipContent>Align selected vertically</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAlign('bottom')}
                  disabled={elements.length < 2}
                >
                  Align Bottom ⬇
                </Button>
              </TooltipTrigger>
              <TooltipContent>Align selected to bottom</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" />

            {/* Element operations */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDuplicate}
                  disabled={!selectedElement}
                >
                  📋 Duplicate
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicate selected element</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={!selectedElement}
                >
                  🗑️ Delete
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete selected element</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" />

            {/* View options */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showGrid ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleToggleGrid}
                >
                  # Grid
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle grid visibility</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleZoom(0.2)}
                >
                  🔍+ Zoom In
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleZoom(-0.2)}
                >
                  🔍- Zoom Out
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>

            <div className="text-sm text-muted-foreground flex items-center">
              {Math.round(zoom * 100)}%
            </div>

            <Separator orientation="vertical" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                >
                  🔄 Clear
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear all elements</TooltipContent>
            </Tooltip>
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground">
            {elements.length} element{elements.length !== 1 ? 's' : ''}
            {selectedElement && ` • Selected: ${selectedElement.type}`}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden bg-muted/30">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full h-full cursor-crosshair"
          />
        </div>
      </div>
    </TooltipProvider>
  );
};
