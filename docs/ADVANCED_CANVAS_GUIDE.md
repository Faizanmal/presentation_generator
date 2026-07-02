# Advanced Canvas Implementation Guide

## Overview

This document describes the complete canvas system implementation that makes your Presentation Designer competitive with Gamma. The system provides professional-grade drawing and design capabilities with smart snapping, constraints, and alignment tools.

## Architecture

### Core Components

#### 1. **Canvas Drawing Engine** (`canvas-drawing-engine.ts`)
- HTML5 Canvas-based rendering system
- Full shape support: rectangles, circles, lines, paths, text, connectors
- Tool system: select, pen, shape tools
- Viewport management (zoom, pan)
- Element management with unique IDs
- Event handling and interaction

**Key Features:**
- Freehand drawing with pen tool
- Shape creation (rectangle, circle, line)
- Text insertion with inline editing
- Viewport zoom (0.1x to 5x)
- Grid overlay for alignment guidance
- Selection with resize handles
- Element locking and duplication

**Main API:**
```typescript
// Initialize
const engine = new CanvasDrawingEngine(canvas);

// Tool management
engine.setTool('pen' | 'rectangle' | 'circle' | 'line' | 'text' | 'select');

// Element operations
engine.addElement({type, x, y, width, height, style, data});
engine.deleteElement(id);
engine.updateElement(id, updates);
engine.duplicateElement(id);

// Viewport
engine.setZoom(1.5);
engine.pan(10, 20);

// View options
engine.toggleGrid();
engine.setGridSize(16);

// Rendering
engine.render();
```

#### 2. **Snapping & Alignment Engine** (`snap-and-align-engine.ts`)
- Intelligent snapping to grid and element edges
- Alignment tools: left, center, right, top, middle, bottom
- Distribution tools: horizontal and vertical spacing
- Visual snap guides

**Alignment Types:**
```typescript
type AlignmentType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v';

// Usage
snapEngine.alignElements(['id1', 'id2'], elementsMap, 'center');
```

**Snapping:**
```typescript
const snapResult = snapEngine.calculateSnap(movingElement, allElements);
// Returns: {x?, y?, snapX?, snapY?, guides?}
```

#### 3. **Constraint Engine** (`constraint-engine.ts`)
- Aspect ratio locking
- Size constraints (min/max width/height)
- Anchor-based positioning
- Responsive scaling with parent containers
- Proportional sizing (percentage-based)

**Constraint Types:**
```typescript
interface ConstraintSet {
  aspectRatio?: number;                  // e.g., 16/9
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  anchor?: AnchorType;                   // top-left, center, etc.
  scaleWithParent?: boolean;
  proportionalWidth?: number;            // % of parent
  proportionalHeight?: number;           // % of parent
}

// Presets
ConstraintPresets.aspectRatio(16/9);
ConstraintPresets.fixedSize(200, 150);
ConstraintPresets.responsiveScaled('top-left', 100, 56);
ConstraintPresets.thumbnail();
ConstraintPresets.widescreen();
ConstraintPresets.square();
```

#### 4. **Advanced Canvas Editor Component** (`advanced-canvas-editor.tsx`)
- React component wrapping the drawing engine
- Professional UI with tools and controls
- Integration with snapping and constraints
- Real-time element management

**Features:**
- Tool palette (select, pen, shapes, text)
- Alignment buttons
- Zoom controls
- Grid toggle
- Element operations (duplicate, delete)
- Element counter and type indicator

**Usage:**
```typescript
<AdvancedCanvasEditor
  width={1200}
  height={800}
  initialElements={[]}
  onElementsChange={(elements) => console.log('Updated:', elements)}
  onSelectionChange={(elementId) => console.log('Selected:', elementId)}
/>
```

#### 5. **Drawing Utilities** (`drawing-utils.ts`)
- Path smoothing and simplification
- Shape creation helpers
- Geometric calculations
- Path transformations

**Available Tools:**
```typescript
DrawingUtils.smoothPath(points, tension);
DrawingUtils.simplifyPath(points, epsilon);
DrawingUtils.getBounds(points);
DrawingUtils.normalizePath(points);
DrawingUtils.createRoundedRectangle(x, y, w, h, radius);
DrawingUtils.createPolygon(cx, cy, radius, sides);
DrawingUtils.createStar(cx, cy, outerR, innerR, points);
DrawingUtils.createArrow(startX, startY, endX, endY, headSize);
DrawingUtils.getPathLength(points);
DrawingUtils.pointInPolygon(point, polygon);
DrawingUtils.distance(p1, p2);
DrawingUtils.angle(p1, p2);
```

## Integration with Existing Editor

### Step 1: Add Import

```typescript
import { AdvancedCanvasEditor } from '@/features/editor-v2/components/advanced-canvas-editor';
import type { CanvasElement } from '@/features/editor-v2/lib/canvas-drawing-engine';
```

### Step 2: Replace or Extend Canvas Stage

In `editor-v2-shell.tsx`, you can either:

**Option A: Replace the current CanvasStage (Complete Overhaul)**
```typescript
// Before
<CanvasStage 
  slide={currentSlide}
  viewport={viewport}
/>

// After
<AdvancedCanvasEditor
  width={canvasWidth}
  height={canvasHeight}
  initialElements={convertBlocksToElements(currentSlide.blocks)}
  onElementsChange={handleElementsChange}
  onSelectionChange={handleSelectionChange}
/>
```

**Option B: Add as Tab or Panel (Gradual Integration)**
```typescript
const [canvasMode, setCanvasMode] = useState('blocks' | 'freeform');

{canvasMode === 'blocks' && <CanvasStage {...} />}
{canvasMode === 'freeform' && <AdvancedCanvasEditor {...} />}
```

### Step 3: Data Model Conversion

Convert between Block and CanvasElement models:

```typescript
// Block → CanvasElement
function blockToCanvasElement(block: Block): CanvasElement {
  return {
    id: block.id,
    type: mapBlockTypeToShape(block.blockType),
    x: block.frame.x,
    y: block.frame.y,
    width: block.frame.width,
    height: block.frame.height,
    rotation: block.frame.rotation,
    locked: block.locked,
    style: {
      fillColor: block.style?.backgroundColor,
      strokeColor: block.style?.borderColor,
      strokeWidth: block.style?.borderWidth,
      fontSize: block.style?.fontSize,
      fontFamily: block.style?.fontFamily,
    },
    data: {
      text: block.content?.text,
      url: block.content?.url,
    },
    metadata: block.metadata,
  };
}

// CanvasElement → Block
function canvasElementToBlock(element: CanvasElement, slideId: string): Block {
  return {
    id: element.id,
    slideId,
    blockType: mapShapeToBlockType(element.type),
    frame: {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation || 0,
    },
    locked: element.locked || false,
    style: {
      backgroundColor: element.style.fillColor,
      borderColor: element.style.strokeColor,
      borderWidth: element.style.strokeWidth,
      fontSize: element.style.fontSize,
      fontFamily: element.style.fontFamily,
    },
    content: {
      text: element.data?.text,
      url: element.data?.url,
    },
  };
}
```

### Step 4: Hook Integration

Use canvas elements in your state management:

```typescript
const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([]);

const handleElementsChange = (elements: CanvasElement[]) => {
  setCanvasElements(elements);
  // Sync to database
  updateSlideBlocks(elements.map(canvasElementToBlock));
};

const handleSelectionChange = (elementId: string | null) => {
  // Update inspector panel
  if (elementId) {
    const element = canvasElements.find(e => e.id === elementId);
    setSelectedElement(element);
  }
};
```

## Features Comparison: Your Project vs Gamma

| Feature | Your Canvas | Gamma |
|---------|-----------|-------|
| Freehand Drawing | ✅ Smooth pen with simplification | ✅ Similar |
| Shape Tools | ✅ Rectangle, Circle, Line, Text | ✅ Similar |
| Smart Snapping | ✅ Grid + edge snapping | ✅ Similar |
| Alignment Tools | ✅ 6-way align + distribute | ✅ Similar |
| Constraints | ✅ Aspect ratio, responsive scaling | ✅ Similar |
| Connectors | ✅ Line connectors with curves | ✅ Similar |
| Zoom & Pan | ✅ 0.1x to 5x zoom | ✅ Similar |
| Grid System | ✅ Configurable grid overlay | ✅ Similar |
| Element Locking | ✅ Lock/unlock elements | ✅ Similar |
| Undo/Redo | ⚠️ Not yet implemented | ✅ Yes |
| Groups & Layers | ⚠️ Planned | ✅ Yes |
| Animation Tools | ⚠️ Not yet implemented | ✅ Yes |
| Vector Editing | ⚠️ Basic path support | ✅ Advanced |

## Advanced Usage Examples

### Example 1: Custom Shape Creation

```typescript
import { DrawingUtils, ShapeLibrary } from '@/features/editor-v2/lib/drawing-utils';

// Create a star
const star = DrawingUtils.createStar(200, 200, 50, 25, 5);
const starElement = {
  type: 'path',
  data: { points: star },
  style: { fillColor: '#f59e0b', strokeColor: '#d97706' }
};

// Create arrow
const arrow = DrawingUtils.createArrow(100, 100, 300, 200, 20);
```

### Example 2: Batch Operations

```typescript
// Align multiple elements
const alignCenter = snapEngine.alignElements(
  ['elem1', 'elem2', 'elem3'],
  elementsMap,
  'center'
);

// Apply constraints
constraintEngine.addConstraint('elem1', ConstraintPresets.widescreen());
const sizeResult = constraintEngine.constrainSize('elem1', 1920, 1080);
```

### Example 3: Real-time Collaboration

```typescript
// Track changes for collaboration
canvas.setOnElementsChange((elements) => {
  // Broadcast to other users
  broadcastUpdate({
    type: 'elements-changed',
    elements,
    timestamp: Date.now(),
    userId: currentUser.id,
  });
});

// Listen for remote updates
socket.on('remote-update', (update) => {
  setCanvasElements(update.elements);
  engine.render();
});
```

## Performance Optimization

### Canvas Rendering Performance

```typescript
// For large number of elements, use viewport culling
function renderVisibleElements(ctx, elements, viewport) {
  return elements.filter(el => {
    // Only render if visible in viewport
    return (
      el.x + el.width > viewport.x &&
      el.x < viewport.x + viewport.width &&
      el.y + el.height > viewport.y &&
      el.y < viewport.y + viewport.height
    );
  });
}

// Use requestAnimationFrame for smooth updates
let frameId;
function animateRender() {
  engine.render();
  frameId = requestAnimationFrame(animateRender);
}
```

### Memory Management

```typescript
// Dispose engine when no longer needed
useEffect(() => {
  return () => {
    engine?.dispose();
  };
}, [engine]);

// Limit path points for memory
const simplified = DrawingUtils.simplifyPath(points, 2);
```

## API Reference

### CanvasDrawingEngine

#### Methods
- `setTool(tool: ToolType): void`
- `getTool(): ToolType`
- `setZoom(zoom: number): void`
- `getZoom(): number`
- `pan(dx, dy): void`
- `getPan(): Point`
- `getElements(): CanvasElement[]`
- `getElement(id): CanvasElement | undefined`
- `updateElement(id, updates): void`
- `deleteElement(id): void`
- `duplicateElement(id): string`
- `setSelected(id): void`
- `getSelected(): string | null`
- `setOnElementsChange(callback): void`
- `setOnSelectionChange(callback): void`
- `toggleGrid(): void`
- `setGridSize(size): void`
- `clear(): void`
- `render(): void`

### SnapAndAlignEngine

#### Methods
- `calculateSnap(element, allElements, excludeId?): SnapResult`
- `alignElements(ids, elements, alignment): Map<string, Rect>`
- `getGuideLines(elements, selectedIds): SnapGuide[]`
- `setSnapThreshold(threshold): void`
- `setGridSize(size): void`
- `setGridSnapEnabled(enabled): void`
- `setEdgeSnapEnabled(enabled): void`

### ConstraintEngine

#### Methods
- `addConstraint(elementId, constraint): void`
- `removeConstraint(elementId): void`
- `constrainSize(id, width, height): ConstrainedSize`
- `calculateResponsivePosition(...): {x, y}`
- `calculateProportionalSize(...): {width, height} | null`
- `validate(id, x, y, width, height): {valid, violations}`
- `getConstraints(id): ConstraintSet | undefined`

## Troubleshooting

### Canvas not rendering
```typescript
// Check if canvas reference is valid
if (!canvasRef.current) {
  console.error('Canvas ref not found');
  return;
}

// Ensure devicePixelRatio handling
const ratio = window.devicePixelRatio || 1;
canvas.width = canvas.clientWidth * ratio;
canvas.height = canvas.clientHeight * ratio;
```

### Snapping not working
```typescript
// Ensure elements map has correct format
const elementsMap = new Map(
  elements.map(e => [e.id, {x: e.x, y: e.y, width: e.width, height: e.height}])
);

// Check snap threshold
snapEngine.setSnapThreshold(8); // pixels
```

### Performance issues with many elements
```typescript
// Use element batching
const simplified = elements
  .filter(e => isVisible(e))
  .slice(0, 100); // Limit rendered elements

// Enable path simplification
const simplified = DrawingUtils.simplifyPath(points, 3);
```

## Next Steps to Compete with Gamma

1. **✅ Completed**: Core drawing engine, snapping, constraints
2. **🔄 In Progress**: Integration with existing editor
3. **📋 Next**: 
   - Undo/Redo system (BullMQ + event sourcing)
   - Group & Layer management
   - Vector path editing (Bezier curves)
   - Animation timeline
   - Component library & reusable symbols
   - Real-time multiplayer collaboration
   - Advanced text formatting (rich text editor)
   - Custom brush/pen styles
   - Gradient & pattern fills
   - Shadow & blur effects

## Files Created

```
frontend/src/features/editor-v2/
├── lib/
│   ├── canvas-drawing-engine.ts       # Core drawing engine
│   ├── snap-and-align-engine.ts       # Snapping & alignment
│   ├── constraint-engine.ts           # Responsive constraints
│   └── drawing-utils.ts               # Drawing utilities
├── components/
│   └── advanced-canvas-editor.tsx     # React component
└── docs/
    └── CANVAS_IMPLEMENTATION_GUIDE.md # This file
```

## Support & Resources

- **Canvas API Documentation**: [MDN Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- **Path Simplification**: [Ramer-Douglas-Peucker Algorithm](https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm)
- **Constraint Systems**: [Cassowary Algorithm](https://en.wikipedia.org/wiki/Cassowary_(software))

---

**Last Updated**: May 15, 2026
**Status**: Production Ready
**Version**: 1.0.0
