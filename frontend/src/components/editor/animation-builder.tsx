'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Zap,
  Layers,
  Clock,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  Wand2,
  RefreshCw,
  Settings2,
} from 'lucide-react';

// Animation types
type AnimationType = 
  | 'fadeIn' | 'fadeOut' 
  | 'slideInLeft' | 'slideInRight' | 'slideInUp' | 'slideInDown'
  | 'slideOutLeft' | 'slideOutRight' | 'slideOutUp' | 'slideOutDown'
  | 'scaleIn' | 'scaleOut' 
  | 'rotateIn' | 'rotateOut'
  | 'bounceIn' | 'bounceOut'
  | 'flipX' | 'flipY'
  | 'shake' | 'pulse' | 'wobble' | 'swing'
  | 'zoomIn' | 'zoomOut'
  | 'blur' | 'typewriter';

type EasingType = 
  | 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'
  | 'cubic-bezier' | 'spring' | 'bounce' | 'elastic';

type TriggerType = 'onLoad' | 'onClick' | 'onHover' | 'afterPrevious' | 'withPrevious';

interface Animation {
  id: string;
  elementId: string;
  elementName: string;
  type: AnimationType;
  duration: number;
  delay: number;
  easing: EasingType;
  trigger: TriggerType;
  iterations: number;
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  fillMode: 'none' | 'forwards' | 'backwards' | 'both';
  enabled: boolean;
  order: number;
}

interface SlideTransition {
  type: 'none' | 'fade' | 'slide' | 'zoom' | 'flip' | 'cube' | 'cover' | 'reveal';
  direction: 'left' | 'right' | 'up' | 'down';
  duration: number;
  easing: EasingType;
}

interface AnimationBuilderProps {
  slideId: string;
  elements: Array<{ id: string; name: string; type: string }>;
  onSaveAnimations?: (animations: Animation[]) => void;
  onSaveTransition?: (transition: SlideTransition) => void;
}

const ANIMATION_PRESETS: Record<string, { type: AnimationType; icon: React.ReactNode; label: string; category: string }[]> = {
  'Entrance': [
    { type: 'fadeIn', icon: <Eye className="h-4 w-4" />, label: 'Fade In', category: 'Entrance' },
    { type: 'slideInLeft', icon: <ArrowRight className="h-4 w-4" />, label: 'Slide In Left', category: 'Entrance' },
    { type: 'slideInRight', icon: <ArrowLeft className="h-4 w-4" />, label: 'Slide In Right', category: 'Entrance' },
    { type: 'slideInUp', icon: <ArrowDown className="h-4 w-4" />, label: 'Slide In Up', category: 'Entrance' },
    { type: 'slideInDown', icon: <ArrowUp className="h-4 w-4" />, label: 'Slide In Down', category: 'Entrance' },
    { type: 'scaleIn', icon: <Zap className="h-4 w-4" />, label: 'Scale In', category: 'Entrance' },
    { type: 'rotateIn', icon: <RefreshCw className="h-4 w-4" />, label: 'Rotate In', category: 'Entrance' },
    { type: 'bounceIn', icon: <ChevronUp className="h-4 w-4" />, label: 'Bounce In', category: 'Entrance' },
    { type: 'zoomIn', icon: <Plus className="h-4 w-4" />, label: 'Zoom In', category: 'Entrance' },
    { type: 'flipX', icon: <RefreshCw className="h-4 w-4" />, label: 'Flip X', category: 'Entrance' },
    { type: 'flipY', icon: <RefreshCw className="h-4 w-4" />, label: 'Flip Y', category: 'Entrance' },
  ],
  'Exit': [
    { type: 'fadeOut', icon: <EyeOff className="h-4 w-4" />, label: 'Fade Out', category: 'Exit' },
    { type: 'slideOutLeft', icon: <ArrowLeft className="h-4 w-4" />, label: 'Slide Out Left', category: 'Exit' },
    { type: 'slideOutRight', icon: <ArrowRight className="h-4 w-4" />, label: 'Slide Out Right', category: 'Exit' },
    { type: 'slideOutUp', icon: <ArrowUp className="h-4 w-4" />, label: 'Slide Out Up', category: 'Exit' },
    { type: 'slideOutDown', icon: <ArrowDown className="h-4 w-4" />, label: 'Slide Out Down', category: 'Exit' },
    { type: 'scaleOut', icon: <Zap className="h-4 w-4" />, label: 'Scale Out', category: 'Exit' },
    { type: 'rotateOut', icon: <RefreshCw className="h-4 w-4" />, label: 'Rotate Out', category: 'Exit' },
    { type: 'bounceOut', icon: <ChevronDown className="h-4 w-4" />, label: 'Bounce Out', category: 'Exit' },
    { type: 'zoomOut', icon: <Trash2 className="h-4 w-4" />, label: 'Zoom Out', category: 'Exit' },
  ],
  'Emphasis': [
    { type: 'pulse', icon: <Zap className="h-4 w-4" />, label: 'Pulse', category: 'Emphasis' },
    { type: 'shake', icon: <RefreshCw className="h-4 w-4" />, label: 'Shake', category: 'Emphasis' },
    { type: 'wobble', icon: <RefreshCw className="h-4 w-4" />, label: 'Wobble', category: 'Emphasis' },
    { type: 'swing', icon: <RefreshCw className="h-4 w-4" />, label: 'Swing', category: 'Emphasis' },
    { type: 'blur', icon: <Eye className="h-4 w-4" />, label: 'Blur', category: 'Emphasis' },
  ],
  'Special': [
    { type: 'typewriter', icon: <Wand2 className="h-4 w-4" />, label: 'Typewriter', category: 'Special' },
  ],
};

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In Out' },
  { value: 'spring', label: 'Spring' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'elastic', label: 'Elastic' },
];

const TRANSITION_PRESETS: { type: SlideTransition['type']; label: string }[] = [
  { type: 'none', label: 'None' },
  { type: 'fade', label: 'Fade' },
  { type: 'slide', label: 'Slide' },
  { type: 'zoom', label: 'Zoom' },
  { type: 'flip', label: 'Flip' },
  { type: 'cube', label: 'Cube' },
  { type: 'cover', label: 'Cover' },
  { type: 'reveal', label: 'Reveal' },
];

export function AnimationBuilder({
  slideId,
  elements,
  onSaveAnimations,
  onSaveTransition,
}: AnimationBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [selectedAnimation, setSelectedAnimation] = useState<Animation | null>(null);
  const [transition, setTransition] = useState<SlideTransition>({
    type: 'fade',
    direction: 'left',
    duration: 500,
    easing: 'ease-out',
  });

  const addAnimation = useCallback((elementId: string, type: AnimationType) => {
    const element = elements.find((e) => e.id === elementId);
    if (!element) return;

    const newAnimation: Animation = {
      id: `anim_${Date.now()}`,
      elementId,
      elementName: element.name,
      type,
      duration: 500,
      delay: 0,
      easing: 'ease-out',
      trigger: 'onLoad',
      iterations: 1,
      direction: 'normal',
      fillMode: 'forwards',
      enabled: true,
      order: animations.length,
    };

    setAnimations((prev) => [...prev, newAnimation]);
    setSelectedAnimation(newAnimation);
  }, [animations.length, elements]);

  const updateAnimation = useCallback((id: string, updates: Partial<Animation>) => {
    setAnimations((prev) =>
      prev.map((anim) => (anim.id === id ? { ...anim, ...updates } : anim))
    );
    if (selectedAnimation?.id === id) {
      setSelectedAnimation((prev) => (prev ? { ...prev, ...updates } : null));
    }
  }, [selectedAnimation]);

  const deleteAnimation = useCallback((id: string) => {
    setAnimations((prev) => prev.filter((anim) => anim.id !== id));
    if (selectedAnimation?.id === id) {
      setSelectedAnimation(null);
    }
  }, [selectedAnimation]);

  const duplicateAnimation = useCallback((animation: Animation) => {
    const newAnimation: Animation = {
      ...animation,
      id: `anim_${Date.now()}`,
      order: animations.length,
    };
    setAnimations((prev) => [...prev, newAnimation]);
  }, [animations.length]);

  const moveAnimation = useCallback((id: string, direction: 'up' | 'down') => {
    setAnimations((prev) => {
      const index = prev.findIndex((a) => a.id === id);
      if (index === -1) return prev;
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.length - 1) return prev;

      const newAnimations = [...prev];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [newAnimations[index], newAnimations[swapIndex]] = [
        newAnimations[swapIndex],
        newAnimations[index],
      ];

      return newAnimations.map((a, i) => ({ ...a, order: i }));
    });
  }, []);

  const playPreview = useCallback(() => {
    setIsPlaying(true);
    // Calculate total duration
    const totalDuration = animations.reduce(
      (max, anim) => Math.max(max, anim.delay + anim.duration),
      0
    );
    setTimeout(() => setIsPlaying(false), totalDuration + 500);
  }, [animations]);

  const animationsByElement = useMemo(() => {
    const grouped: Record<string, Animation[]> = {};
    animations.forEach((anim) => {
      if (!grouped[anim.elementId]) {
        grouped[anim.elementId] = [];
      }
      grouped[anim.elementId].push(anim);
    });
    return grouped;
  }, [animations]);

  const getTotalDuration = () => {
    if (animations.length === 0) return 0;
    return Math.max(...animations.map((a) => a.delay + a.duration));
  };

  const handleSave = () => {
    onSaveAnimations?.(animations);
    onSaveTransition?.(transition);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Animations
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Animation Builder
          </DialogTitle>
          <DialogDescription>
            Add animations to elements and configure slide transitions
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="elements" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="elements">Element Animations</TabsTrigger>
            <TabsTrigger value="transitions">Slide Transition</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <div className="flex gap-4 mt-4">
            {/* Left Panel - Animation List / Presets */}
            <div className="w-64 shrink-0">
              <TabsContent value="elements" className="m-0">
                <Card className="h-[500px]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Elements</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-[430px]">
                      <div className="space-y-2">
                        {elements.map((element) => (
                          <div
                            key={element.id}
                            className="p-2 rounded border bg-card"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium truncate">
                                {element.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {element.type}
                              </Badge>
                            </div>
                            {animationsByElement[element.id]?.map((anim) => (
                              <div
                                key={anim.id}
                                className={`p-1.5 rounded text-xs flex items-center justify-between cursor-pointer mb-1 ${
                                  selectedAnimation?.id === anim.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted hover:bg-muted/80'
                                }`}
                                onClick={() => setSelectedAnimation(anim)}
                              >
                                <span className="truncate">{anim.type}</span>
                                <div className="flex items-center gap-1">
                                  <span className="opacity-70">{anim.duration}ms</span>
                                  {!anim.enabled && (
                                    <EyeOff className="h-3 w-3 opacity-50" />
                                  )}
                                </div>
                              </div>
                            ))}
                            <Select
                              onValueChange={(type) =>
                                addAnimation(element.id, type as AnimationType)
                              }
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <Plus className="h-3 w-3 mr-1" />
                                <span>Add Animation</span>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ANIMATION_PRESETS).map(
                                  ([category, presets]) => (
                                    <div key={category}>
                                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                                        {category}
                                      </div>
                                      {presets.map((preset) => (
                                        <SelectItem
                                          key={preset.type}
                                          value={preset.type}
                                        >
                                          <div className="flex items-center gap-2">
                                            {preset.icon}
                                            {preset.label}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </div>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="transitions" className="m-0">
                <Card className="h-[500px]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Transition Presets</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="grid grid-cols-2 gap-2">
                      {TRANSITION_PRESETS.map((preset) => (
                        <Button
                          key={preset.type}
                          variant={
                            transition.type === preset.type
                              ? 'default'
                              : 'outline'
                          }
                          size="sm"
                          className="h-auto py-3 flex-col"
                          onClick={() =>
                            setTransition((prev) => ({ ...prev, type: preset.type }))
                          }
                        >
                          <Layers className="h-5 w-5 mb-1" />
                          <span className="text-xs">{preset.label}</span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="timeline" className="m-0">
                <Card className="h-[500px]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Animation Order</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-[430px]">
                      <div className="space-y-1">
                        {animations
                          .sort((a, b) => a.order - b.order)
                          .map((anim, index) => (
                            <div
                              key={anim.id}
                              className={`p-2 rounded border text-sm flex items-center gap-2 cursor-pointer ${
                                selectedAnimation?.id === anim.id
                                  ? 'border-primary bg-primary/5'
                                  : ''
                              }`}
                              onClick={() => setSelectedAnimation(anim)}
                            >
                              <span className="w-5 h-5 rounded bg-muted text-xs flex items-center justify-center">
                                {index + 1}
                              </span>
                              <div className="flex-1 truncate">
                                <p className="truncate font-medium">
                                  {anim.elementName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {anim.type}
                                </p>
                              </div>
                              <div className="flex flex-col">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveAnimation(anim.id, 'up');
                                  }}
                                  disabled={index === 0}
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveAnimation(anim.id, 'down');
                                  }}
                                  disabled={index === animations.length - 1}
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>

            {/* Right Panel - Settings */}
            <div className="flex-1">
              <TabsContent value="elements" className="m-0">
                {selectedAnimation ? (
                  <Card className="h-[500px]">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          Animation Settings
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              updateAnimation(selectedAnimation.id, {
                                enabled: !selectedAnimation.enabled,
                              })
                            }
                          >
                            {selectedAnimation.enabled ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => duplicateAnimation(selectedAnimation)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAnimation(selectedAnimation.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <CardDescription>
                        {selectedAnimation.elementName} - {selectedAnimation.type}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[380px] pr-4">
                        <div className="space-y-6">
                          {/* Duration */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Duration</Label>
                              <span className="text-sm text-muted-foreground">
                                {selectedAnimation.duration}ms
                              </span>
                            </div>
                            <Slider
                              value={[selectedAnimation.duration]}
                              min={100}
                              max={3000}
                              step={50}
                              onValueChange={([value]) =>
                                updateAnimation(selectedAnimation.id, {
                                  duration: value,
                                })
                              }
                            />
                          </div>

                          {/* Delay */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Delay</Label>
                              <span className="text-sm text-muted-foreground">
                                {selectedAnimation.delay}ms
                              </span>
                            </div>
                            <Slider
                              value={[selectedAnimation.delay]}
                              min={0}
                              max={5000}
                              step={50}
                              onValueChange={([value]) =>
                                updateAnimation(selectedAnimation.id, {
                                  delay: value,
                                })
                              }
                            />
                          </div>

                          {/* Easing */}
                          <div className="space-y-2">
                            <Label>Easing</Label>
                            <Select
                              value={selectedAnimation.easing}
                              onValueChange={(value: EasingType) =>
                                updateAnimation(selectedAnimation.id, {
                                  easing: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {EASING_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Trigger */}
                          <div className="space-y-2">
                            <Label>Trigger</Label>
                            <Select
                              value={selectedAnimation.trigger}
                              onValueChange={(value: TriggerType) =>
                                updateAnimation(selectedAnimation.id, {
                                  trigger: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="onLoad">On Load</SelectItem>
                                <SelectItem value="onClick">On Click</SelectItem>
                                <SelectItem value="onHover">On Hover</SelectItem>
                                <SelectItem value="afterPrevious">
                                  After Previous
                                </SelectItem>
                                <SelectItem value="withPrevious">
                                  With Previous
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Iterations */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Iterations</Label>
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                value={selectedAnimation.iterations}
                                onChange={(e) =>
                                  updateAnimation(selectedAnimation.id, {
                                    iterations: parseInt(e.target.value) || 1,
                                  })
                                }
                                className="w-20 h-8"
                              />
                            </div>
                          </div>

                          {/* Direction */}
                          <div className="space-y-2">
                            <Label>Direction</Label>
                            <Select
                              value={selectedAnimation.direction}
                              onValueChange={(value: Animation['direction']) =>
                                updateAnimation(selectedAnimation.id, {
                                  direction: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="reverse">Reverse</SelectItem>
                                <SelectItem value="alternate">Alternate</SelectItem>
                                <SelectItem value="alternate-reverse">
                                  Alternate Reverse
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Fill Mode */}
                          <div className="space-y-2">
                            <Label>Fill Mode</Label>
                            <Select
                              value={selectedAnimation.fillMode}
                              onValueChange={(value: Animation['fillMode']) =>
                                updateAnimation(selectedAnimation.id, {
                                  fillMode: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="forwards">Forwards</SelectItem>
                                <SelectItem value="backwards">Backwards</SelectItem>
                                <SelectItem value="both">Both</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="h-[500px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Select an animation to edit</p>
                      <p className="text-sm mt-1">
                        or add a new animation to an element
                      </p>
                    </div>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="transitions" className="m-0">
                <Card className="h-[500px]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Transition Settings</CardTitle>
                    <CardDescription>
                      Configure how this slide transitions to the next
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Direction */}
                      {transition.type !== 'none' && transition.type !== 'fade' && (
                        <div className="space-y-2">
                          <Label>Direction</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {(['left', 'right', 'up', 'down'] as const).map((dir) => (
                              <Button
                                key={dir}
                                variant={
                                  transition.direction === dir
                                    ? 'default'
                                    : 'outline'
                                }
                                size="sm"
                                onClick={() =>
                                  setTransition((prev) => ({ ...prev, direction: dir }))
                                }
                              >
                                {dir === 'left' && <ArrowLeft className="h-4 w-4" />}
                                {dir === 'right' && <ArrowRight className="h-4 w-4" />}
                                {dir === 'up' && <ArrowUp className="h-4 w-4" />}
                                {dir === 'down' && <ArrowDown className="h-4 w-4" />}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Duration */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Duration</Label>
                          <span className="text-sm text-muted-foreground">
                            {transition.duration}ms
                          </span>
                        </div>
                        <Slider
                          value={[transition.duration]}
                          min={100}
                          max={2000}
                          step={50}
                          onValueChange={([value]) =>
                            setTransition((prev) => ({ ...prev, duration: value }))
                          }
                        />
                      </div>

                      {/* Easing */}
                      <div className="space-y-2">
                        <Label>Easing</Label>
                        <Select
                          value={transition.easing}
                          onValueChange={(value: EasingType) =>
                            setTransition((prev) => ({ ...prev, easing: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EASING_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Preview Box */}
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <div className="aspect-video bg-background rounded border flex items-center justify-center">
                          <div
                            className={`w-32 h-20 bg-primary/20 rounded border-2 border-primary ${
                              isPlaying ? 'animate-pulse' : ''
                            }`}
                          >
                            <div className="p-2">
                              <div className="h-2 w-16 bg-primary/40 rounded mb-1" />
                              <div className="h-1.5 w-12 bg-primary/30 rounded mb-1" />
                              <div className="h-1.5 w-14 bg-primary/30 rounded" />
                            </div>
                          </div>
                        </div>
                        <p className="text-center text-sm text-muted-foreground mt-2">
                          {transition.type === 'none'
                            ? 'No transition'
                            : `${transition.type} ${transition.direction}`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="timeline" className="m-0">
                <Card className="h-[500px]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Animation Timeline</CardTitle>
                    <CardDescription>
                      Total duration: {getTotalDuration()}ms
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Timeline visualization */}
                      <div className="relative h-[300px] border rounded bg-muted/30 overflow-hidden">
                        {/* Time markers */}
                        <div className="absolute top-0 left-0 right-0 h-6 border-b bg-muted flex items-center text-xs text-muted-foreground">
                          {[0, 25, 50, 75, 100].map((percent) => (
                            <span
                              key={percent}
                              className="absolute"
                              style={{ left: `${percent}%` }}
                            >
                              {Math.round((getTotalDuration() * percent) / 100)}ms
                            </span>
                          ))}
                        </div>

                        {/* Animation bars */}
                        <div className="pt-8 px-2 space-y-2">
                          {animations
                            .sort((a, b) => a.order - b.order)
                            .map((anim) => {
                              const totalDuration = getTotalDuration() || 1;
                              const startPercent = (anim.delay / totalDuration) * 100;
                              const widthPercent =
                                (anim.duration / totalDuration) * 100;

                              return (
                                <div
                                  key={anim.id}
                                  className="relative h-8"
                                  onClick={() => setSelectedAnimation(anim)}
                                >
                                  <div
                                    className={`absolute h-6 rounded cursor-pointer transition-all ${
                                      selectedAnimation?.id === anim.id
                                        ? 'bg-primary ring-2 ring-primary ring-offset-2'
                                        : 'bg-primary/60 hover:bg-primary/80'
                                    } ${!anim.enabled ? 'opacity-40' : ''}`}
                                    style={{
                                      left: `${startPercent}%`,
                                      width: `${widthPercent}%`,
                                      minWidth: '20px',
                                    }}
                                  >
                                    <span className="absolute inset-0 flex items-center px-2 text-xs text-primary-foreground truncate">
                                      {anim.elementName}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>

                        {/* Playhead */}
                        {isPlaying && (
                          <div
                            className="absolute top-6 bottom-0 w-0.5 bg-red-500"
                            style={{
                              animation: `playhead ${getTotalDuration()}ms linear forwards`,
                            }}
                          />
                        )}
                      </div>

                      {/* Quick stats */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 rounded-lg bg-muted">
                          <p className="text-2xl font-bold">{animations.length}</p>
                          <p className="text-xs text-muted-foreground">
                            Animations
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted">
                          <p className="text-2xl font-bold">
                            {new Set(animations.map((a) => a.elementId)).size}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Elements
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted">
                          <p className="text-2xl font-bold">
                            {(getTotalDuration() / 1000).toFixed(1)}s
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Total Time
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={playPreview}
              disabled={animations.length === 0}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Preview
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAnimations([]);
                setSelectedAnimation(null);
              }}
              disabled={animations.length === 0}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Animations
            </Button>
          </div>
        </div>

        <style jsx global>{`
          @keyframes playhead {
            from {
              left: 0%;
            }
            to {
              left: 100%;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
