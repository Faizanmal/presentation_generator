'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Crop,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  SunMedium,
  Contrast,
  Droplets,
  Sparkles,
  Palette,
  Eraser,
  Undo2,
  Redo2,
  ZoomIn,
  Move,
  Square,
  Type,
  Paintbrush,
  Image as ImageIcon,
  Check,
  X,
} from 'lucide-react';

interface ImageEditorProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (editedImageUrl: string) => void;
}

interface Filter {
  name: string;
  filter: string;
  thumbnail: string;
}

interface Adjustment {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  opacity: number;
  hue: number;
  sepia: number;
  grayscale: number;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

type EditorTool = 'select' | 'crop' | 'draw' | 'text' | 'shapes' | 'eraser';

const PRESET_FILTERS: Filter[] = [
  { name: 'Original', filter: 'none', thumbnail: '' },
  { name: 'Vintage', filter: 'sepia(0.4) contrast(1.1)', thumbnail: '' },
  { name: 'B&W', filter: 'grayscale(1)', thumbnail: '' },
  { name: 'Vivid', filter: 'saturate(1.5) contrast(1.1)', thumbnail: '' },
  { name: 'Warm', filter: 'sepia(0.2) saturate(1.2)', thumbnail: '' },
  { name: 'Cool', filter: 'hue-rotate(180deg) saturate(0.8)', thumbnail: '' },
  { name: 'Dramatic', filter: 'contrast(1.4) saturate(0.8)', thumbnail: '' },
  { name: 'Soft', filter: 'contrast(0.9) brightness(1.1) blur(0.5px)', thumbnail: '' },
  { name: 'Sharp', filter: 'contrast(1.2) brightness(0.95)', thumbnail: '' },
  { name: 'Fade', filter: 'opacity(0.9) saturate(0.7) brightness(1.1)', thumbnail: '' },
  { name: 'Noir', filter: 'grayscale(1) contrast(1.3)', thumbnail: '' },
  { name: 'Retro', filter: 'sepia(0.6) hue-rotate(-20deg)', thumbnail: '' },
];

const CROP_PRESETS = [
  { name: 'Free', ratio: null },
  { name: '1:1', ratio: 1 },
  { name: '4:3', ratio: 4 / 3 },
  { name: '16:9', ratio: 16 / 9 },
  { name: '3:2', ratio: 3 / 2 },
  { name: '2:3', ratio: 2 / 3 },
];

export function SmartImageEditor({ imageUrl, isOpen, onClose, onSave }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [selectedFilter, setSelectedFilter] = useState<Filter>(PRESET_FILTERS[0]);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);

  const [adjustments, setAdjustments] = useState<Adjustment>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    opacity: 100,
    hue: 0,
    sepia: 0,
    grayscale: 0,
  });

  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropRatio, setCropRatio] = useState<number | null>(null);

  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {return;}

    const ctx = canvas.getContext('2d');
    if (!ctx) {return;}

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), imageData]);
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const initCanvas = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) {return;}

    const ctx = canvas.getContext('2d');
    if (!ctx) {return;}

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    // Save initial state
    saveToHistory();
  }, [saveToHistory]);

  // Load image
  useEffect(() => {
    if (!imageUrl) {return;}

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      initCanvas(img);
    };
    img.src = imageUrl;
  }, [imageUrl, initCanvas]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) {return;}

    const canvas = canvasRef.current;
    if (!canvas) {return;}

    const ctx = canvas.getContext('2d');
    if (!ctx) {return;}

    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) {return;}

    const canvas = canvasRef.current;
    if (!canvas) {return;}

    const ctx = canvas.getContext('2d');
    if (!ctx) {return;}

    const newIndex = historyIndex + 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  const applyFilter = useCallback((filter: Filter) => {
    setSelectedFilter(filter);
  }, []);

  const getFilterString = useCallback(() => {
    const adj = adjustments;
    let filter = selectedFilter.filter !== 'none' ? selectedFilter.filter : '';

    if (adj.brightness !== 100) {filter += ` brightness(${adj.brightness / 100})`;}
    if (adj.contrast !== 100) {filter += ` contrast(${adj.contrast / 100})`;}
    if (adj.saturation !== 100) {filter += ` saturate(${adj.saturation / 100})`;}
    if (adj.blur > 0) {filter += ` blur(${adj.blur}px)`;}
    if (adj.opacity !== 100) {filter += ` opacity(${adj.opacity / 100})`;}
    if (adj.hue !== 0) {filter += ` hue-rotate(${adj.hue}deg)`;}
    if (adj.sepia > 0) {filter += ` sepia(${adj.sepia / 100})`;}
    if (adj.grayscale > 0) {filter += ` grayscale(${adj.grayscale / 100})`;}

    return filter.trim() || 'none';
  }, [adjustments, selectedFilter]);

  const rotateImage = useCallback((degrees: number) => {
    setRotation((prev) => (prev + degrees) % 360);
  }, []);

  const flipImage = useCallback((direction: 'horizontal' | 'vertical') => {
    if (direction === 'horizontal') {
      setFlipX((prev) => !prev);
    } else {
      setFlipY((prev) => !prev);
    }
  }, []);

  const handleCropStart = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== 'crop' || !containerRef.current) {return;}

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setCropArea({ x, y, width: 0, height: 0 });
      setIsCropping(true);
    },
    [activeTool]
  );

  const handleCropMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isCropping || !cropArea || !containerRef.current) {return;}

      const rect = containerRef.current.getBoundingClientRect();
      const width = e.clientX - rect.left - cropArea.x;
      let height = e.clientY - rect.top - cropArea.y;

      if (cropRatio) {
        height = width / cropRatio;
      }

      setCropArea((prev) => (prev ? { ...prev, width, height } : null));
    },
    [isCropping, cropArea, cropRatio]
  );

  const handleCropEnd = useCallback(() => {
    setIsCropping(false);
  }, []);

  const applyCrop = useCallback(() => {
    if (!cropArea || !canvasRef.current || !image) {return;}

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {return;}

    // Calculate actual crop dimensions based on canvas/display ratio
    const displayWidth = canvas.offsetWidth;
    const displayHeight = canvas.offsetHeight;
    const scaleX = canvas.width / displayWidth;
    const scaleY = canvas.height / displayHeight;

    const actualCrop = {
      x: cropArea.x * scaleX,
      y: cropArea.y * scaleY,
      width: cropArea.width * scaleX,
      height: cropArea.height * scaleY,
    };

    const imageData = ctx.getImageData(
      actualCrop.x,
      actualCrop.y,
      Math.abs(actualCrop.width),
      Math.abs(actualCrop.height)
    );

    canvas.width = Math.abs(actualCrop.width);
    canvas.height = Math.abs(actualCrop.height);
    ctx.putImageData(imageData, 0, 0);

    setCropArea(null);
    setActiveTool('select');
    saveToHistory();
  }, [cropArea, image, saveToHistory]);

  const handleDrawStart = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== 'draw' || !canvasRef.current) {return;}

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {return;}

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      setIsDrawing(true);
    },
    [activeTool, brushColor, brushSize]
  );

  const handleDrawMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || activeTool !== 'draw' || !canvasRef.current) {return;}

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {return;}

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [activeTool, isDrawing]
  );

  const handleDrawEnd = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
    }
  }, [isDrawing, saveToHistory]);

  const resetAdjustments = useCallback(() => {
    setAdjustments({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      opacity: 100,
      hue: 0,
      sepia: 0,
      grayscale: 0,
    });
    setSelectedFilter(PRESET_FILTERS[0]);
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!canvasRef.current) {return;}

    // Apply visual transformations to canvas
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {return;}

    // Create a temporary canvas with all effects applied
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {return;}

    tempCtx.filter = getFilterString();

    // Apply transformations
    tempCtx.save();
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate((rotation * Math.PI) / 180);
    tempCtx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    tempCtx.translate(-tempCanvas.width / 2, -tempCanvas.height / 2);
    tempCtx.drawImage(canvas, 0, 0);
    tempCtx.restore();

    const dataUrl = tempCanvas.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  }, [getFilterString, rotation, flipX, flipY, onSave, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0">
        <div className="flex flex-col h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <DialogHeader className="space-y-0">
              <DialogTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Image Editor
              </DialogTitle>
              <DialogDescription>Edit and enhance your image</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={undo} disabled={historyIndex <= 0}>
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-border mx-2" />
              <Button variant="ghost" size="sm" onClick={resetAdjustments}>
                Reset
              </Button>
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Check className="h-4 w-4 mr-2" />
                Apply
              </Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Tools Sidebar */}
            <div className="w-14 border-r bg-muted/30 flex flex-col items-center py-4 gap-2">
              {[
                { tool: 'select' as EditorTool, icon: Move, label: 'Select' },
                { tool: 'crop' as EditorTool, icon: Crop, label: 'Crop' },
                { tool: 'draw' as EditorTool, icon: Paintbrush, label: 'Draw' },
                { tool: 'text' as EditorTool, icon: Type, label: 'Text' },
                { tool: 'shapes' as EditorTool, icon: Square, label: 'Shapes' },
                { tool: 'eraser' as EditorTool, icon: Eraser, label: 'Eraser' },
              ].map(({ tool, icon: Icon, label }) => (
                <Button
                  key={tool}
                  variant={activeTool === tool ? 'secondary' : 'ghost'}
                  size="icon"
                  className="w-10 h-10"
                  onClick={() => setActiveTool(tool)}
                  title={label}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              ))}
            </div>

            {/* Canvas Area */}
            <div className="flex-1 bg-slate-900 overflow-hidden flex items-center justify-center p-8">
              <div
                ref={containerRef}
                className="relative"
                onMouseDown={activeTool === 'crop' ? handleCropStart : handleDrawStart}
                onMouseMove={activeTool === 'crop' ? handleCropMove : handleDrawMove}
                onMouseUp={activeTool === 'crop' ? handleCropEnd : handleDrawEnd}
                onMouseLeave={activeTool === 'crop' ? handleCropEnd : handleDrawEnd}
              >
                <canvas
                  ref={canvasRef}
                  className="max-w-full max-h-full object-contain"
                  style={{
                    filter: getFilterString(),
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})`,
                    cursor: activeTool === 'draw' ? 'crosshair' : activeTool === 'crop' ? 'crosshair' : 'default',
                  }}
                />

                {/* Crop Overlay */}
                {cropArea && (
                  <div
                    className="absolute border-2 border-white border-dashed bg-black/30"
                    style={{
                      left: cropArea.x,
                      top: cropArea.y,
                      width: Math.abs(cropArea.width),
                      height: Math.abs(cropArea.height),
                    }}
                  >
                    {/* Corner handles */}
                    {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
                      <div
                        key={pos}
                        className={`absolute w-3 h-3 bg-white rounded-full ${pos.includes('top') ? 'top-0' : 'bottom-0'
                          } ${pos.includes('left') ? 'left-0' : 'right-0'} -translate-x-1/2 -translate-y-1/2`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel */}
            <div className="w-72 border-l bg-background overflow-hidden flex flex-col">
              <Tabs defaultValue="adjust" className="flex flex-col flex-1">
                <TabsList className="grid grid-cols-3 m-2">
                  <TabsTrigger value="adjust">Adjust</TabsTrigger>
                  <TabsTrigger value="filters">Filters</TabsTrigger>
                  <TabsTrigger value="transform">Transform</TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1">
                  <TabsContent value="adjust" className="p-4 space-y-6 m-0">
                    {/* Brightness */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="flex items-center gap-2">
                          <SunMedium className="h-4 w-4" />
                          Brightness
                        </Label>
                        <span className="text-sm text-muted-foreground">
                          {adjustments.brightness}%
                        </span>
                      </div>
                      <Slider
                        value={[adjustments.brightness]}
                        onValueChange={([value]) =>
                          setAdjustments((prev) => ({ ...prev, brightness: value }))
                        }
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>

                    {/* Contrast */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="flex items-center gap-2">
                          <Contrast className="h-4 w-4" />
                          Contrast
                        </Label>
                        <span className="text-sm text-muted-foreground">
                          {adjustments.contrast}%
                        </span>
                      </div>
                      <Slider
                        value={[adjustments.contrast]}
                        onValueChange={([value]) =>
                          setAdjustments((prev) => ({ ...prev, contrast: value }))
                        }
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>

                    {/* Saturation */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="flex items-center gap-2">
                          <Droplets className="h-4 w-4" />
                          Saturation
                        </Label>
                        <span className="text-sm text-muted-foreground">
                          {adjustments.saturation}%
                        </span>
                      </div>
                      <Slider
                        value={[adjustments.saturation]}
                        onValueChange={([value]) =>
                          setAdjustments((prev) => ({ ...prev, saturation: value }))
                        }
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>

                    {/* Hue */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="flex items-center gap-2">
                          <Palette className="h-4 w-4" />
                          Hue
                        </Label>
                        <span className="text-sm text-muted-foreground">{adjustments.hue}°</span>
                      </div>
                      <Slider
                        value={[adjustments.hue]}
                        onValueChange={([value]) =>
                          setAdjustments((prev) => ({ ...prev, hue: value }))
                        }
                        min={-180}
                        max={180}
                        step={1}
                      />
                    </div>

                    {/* Blur */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Blur
                        </Label>
                        <span className="text-sm text-muted-foreground">{adjustments.blur}px</span>
                      </div>
                      <Slider
                        value={[adjustments.blur]}
                        onValueChange={([value]) =>
                          setAdjustments((prev) => ({ ...prev, blur: value }))
                        }
                        min={0}
                        max={20}
                        step={0.5}
                      />
                    </div>

                    {/* Drawing Tools */}
                    {activeTool === 'draw' && (
                      <div className="pt-4 border-t space-y-4">
                        <h4 className="font-medium">Brush Settings</h4>
                        <div className="space-y-2">
                          <Label>Color</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={brushColor}
                              onChange={(e) => setBrushColor(e.target.value)}
                              className="w-12 h-10 p-1"
                            />
                            <Input
                              value={brushColor}
                              onChange={(e) => setBrushColor(e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <Label>Size</Label>
                            <span className="text-sm text-muted-foreground">{brushSize}px</span>
                          </div>
                          <Slider
                            value={[brushSize]}
                            onValueChange={([value]) => setBrushSize(value)}
                            min={1}
                            max={50}
                            step={1}
                          />
                        </div>
                      </div>
                    )}

                    {/* Crop Tools */}
                    {activeTool === 'crop' && (
                      <div className="pt-4 border-t space-y-4">
                        <h4 className="font-medium">Crop Settings</h4>
                        <div className="space-y-2">
                          <Label>Aspect Ratio</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {CROP_PRESETS.map((preset) => (
                              <Button
                                key={preset.name}
                                variant={cropRatio === preset.ratio ? 'secondary' : 'outline'}
                                size="sm"
                                onClick={() => setCropRatio(preset.ratio)}
                              >
                                {preset.name}
                              </Button>
                            ))}
                          </div>
                        </div>
                        {cropArea && (
                          <Button onClick={applyCrop} className="w-full">
                            Apply Crop
                          </Button>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="filters" className="p-4 m-0">
                    <div className="grid grid-cols-3 gap-2">
                      {PRESET_FILTERS.map((filter) => (
                        <button
                          key={filter.name}
                          onClick={() => applyFilter(filter)}
                          className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${selectedFilter.name === filter.name
                              ? 'border-primary'
                              : 'border-transparent'
                            }`}
                        >
                          <div
                            className="w-full h-full bg-linear-to-br from-slate-300 to-slate-500"
                            style={{ filter: filter.filter }}
                          />
                          <span className="block text-xs mt-1 text-center">{filter.name}</span>
                        </button>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="transform" className="p-4 space-y-6 m-0">
                    {/* Zoom */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="flex items-center gap-2">
                          <ZoomIn className="h-4 w-4" />
                          Zoom
                        </Label>
                        <span className="text-sm text-muted-foreground">{zoom}%</span>
                      </div>
                      <Slider
                        value={[zoom]}
                        onValueChange={([value]) => setZoom(value)}
                        min={25}
                        max={200}
                        step={5}
                      />
                    </div>

                    {/* Rotation */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <RotateCw className="h-4 w-4" />
                        Rotate
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rotateImage(-90)}
                          className="flex-1"
                        >
                          -90°
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rotateImage(90)}
                          className="flex-1"
                        >
                          +90°
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rotateImage(180)}
                          className="flex-1"
                        >
                          180°
                        </Button>
                      </div>
                    </div>

                    {/* Flip */}
                    <div className="space-y-2">
                      <Label>Flip</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={flipX ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => flipImage('horizontal')}
                          className="flex-1"
                        >
                          <FlipHorizontal className="h-4 w-4 mr-2" />
                          Horizontal
                        </Button>
                        <Button
                          variant={flipY ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => flipImage('vertical')}
                          className="flex-1"
                        >
                          <FlipVertical className="h-4 w-4 mr-2" />
                          Vertical
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
