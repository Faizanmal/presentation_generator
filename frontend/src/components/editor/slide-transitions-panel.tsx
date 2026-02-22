'use client';

import { useState } from 'react';
import {
  Sparkles,
  Play,
  Check,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// import {
//   Accordion,
//   AccordionContent,
//   AccordionItem,
//   AccordionTrigger,
// } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type TransitionType =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'flip'
  | 'rotate'
  | 'cube'
  | 'dissolve'
  | 'morph';

type AnimationType =
  | 'none'
  | 'fade-in'
  | 'fade-in-up'
  | 'fade-in-down'
  | 'fade-in-left'
  | 'fade-in-right'
  | 'zoom-in'
  | 'bounce'
  | 'typewriter';

type EasingType = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring' | 'bounce';

interface TransitionConfig {
  type: TransitionType;
  duration: number;
  easing: EasingType;
}

interface AnimationConfig {
  type: AnimationType;
  duration: number;
  delay: number;
  easing: EasingType;
  trigger: 'on-enter' | 'on-click' | 'with-previous' | 'after-previous';
}

interface SlideTransitionsPanelProps {
  slideId: string;
  onTransitionChange?: (config: TransitionConfig) => void;
  onAnimationChange?: (blockId: string, config: AnimationConfig) => void;
}

const transitions: Array<{
  type: TransitionType;
  name: string;
  category: 'basic' | 'slide' | 'zoom' | '3d' | 'creative';
}> = [
  { type: 'none', name: 'None', category: 'basic' },
  { type: 'fade', name: 'Fade', category: 'basic' },
  { type: 'slide-left', name: 'Slide Left', category: 'slide' },
  { type: 'slide-right', name: 'Slide Right', category: 'slide' },
  { type: 'slide-up', name: 'Slide Up', category: 'slide' },
  { type: 'slide-down', name: 'Slide Down', category: 'slide' },
  { type: 'zoom-in', name: 'Zoom In', category: 'zoom' },
  { type: 'zoom-out', name: 'Zoom Out', category: 'zoom' },
  { type: 'flip', name: 'Flip', category: '3d' },
  { type: 'rotate', name: 'Rotate', category: '3d' },
  { type: 'cube', name: 'Cube', category: '3d' },
  { type: 'dissolve', name: 'Dissolve', category: 'creative' },
  { type: 'morph', name: 'Morph', category: 'creative' },
];

const animations: Array<{
  type: AnimationType;
  name: string;
  category: 'fade' | 'zoom' | 'slide' | 'attention' | 'text';
}> = [
  { type: 'none', name: 'None', category: 'fade' },
  { type: 'fade-in', name: 'Fade In', category: 'fade' },
  { type: 'fade-in-up', name: 'Fade In Up', category: 'fade' },
  { type: 'fade-in-down', name: 'Fade In Down', category: 'fade' },
  { type: 'fade-in-left', name: 'Fade In Left', category: 'fade' },
  { type: 'fade-in-right', name: 'Fade In Right', category: 'fade' },
  { type: 'zoom-in', name: 'Zoom In', category: 'zoom' },
  { type: 'bounce', name: 'Bounce', category: 'attention' },
  { type: 'typewriter', name: 'Typewriter', category: 'text' },
];

const easings: Array<{ value: EasingType; label: string }> = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In Out' },
  { value: 'spring', label: 'Spring' },
  { value: 'bounce', label: 'Bounce' },
];

export function SlideTransitionsPanel({
  onTransitionChange,
}: SlideTransitionsPanelProps) {
  const [transitionConfig, setTransitionConfig] = useState<TransitionConfig>({
    type: 'fade',
    duration: 500,
    easing: 'ease-out',
  });
  const [selectedAnimation, setSelectedAnimation] = useState<AnimationType>('fade-in-up');
  const [animationDuration, setAnimationDuration] = useState(400);
  const [animationDelay, setAnimationDelay] = useState(0);
  const [animationEasing, setAnimationEasing] = useState<EasingType>('ease-out');
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const handleTransitionSelect = (type: TransitionType) => {
    const newConfig = { ...transitionConfig, type };
    setTransitionConfig(newConfig);
    onTransitionChange?.(newConfig);
  };

  const handleDurationChange = (value: number[]) => {
    const newConfig = { ...transitionConfig, duration: value[0] };
    setTransitionConfig(newConfig);
    onTransitionChange?.(newConfig);
  };

  const handleEasingChange = (value: EasingType) => {
    const newConfig = { ...transitionConfig, easing: value };
    setTransitionConfig(newConfig);
    onTransitionChange?.(newConfig);
  };

  const handlePreview = () => {
    setPreviewPlaying(true);
    setTimeout(() => setPreviewPlaying(false), transitionConfig.duration + 100);
  };

  const applyToAll = () => {
    toast.success('Transition applied to all slides');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Transitions & Animations
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Add motion to bring your slides to life
        </p>
      </div>

      <Tabs defaultValue="transition" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 m-4 mb-0">
          <TabsTrigger value="transition">Slide Transition</TabsTrigger>
          <TabsTrigger value="animation">Element Animations</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="transition" className="p-4 m-0 space-y-6">
            {/* Transition Preview */}
            <Card>
              <CardContent className="pt-4">
                <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                  <div
                    className={cn(
                      'w-3/4 h-3/4 bg-white rounded-lg shadow-lg flex items-center justify-center transition-all',
                      previewPlaying && transitionConfig.type === 'fade' && 'animate-pulse',
                      previewPlaying && transitionConfig.type === 'zoom-in' && 'scale-110',
                      previewPlaying && transitionConfig.type === 'slide-left' && 'translate-x-4'
                    )}
                    style={{ transitionDuration: `${transitionConfig.duration}ms` }}
                  >
                    <span className="text-slate-400 text-sm">Preview</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-3"
                  onClick={handlePreview}
                  disabled={previewPlaying}
                >
                  {previewPlaying ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Preview
                </Button>
              </CardContent>
            </Card>

            {/* Transition Types */}
            <div>
              <Label className="mb-2 block">Transition Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {transitions.map((t) => (
                  <button
                    key={t.type}
                    onClick={() => handleTransitionSelect(t.type)}
                    className={cn(
                      'p-3 rounded-lg border text-center transition-all',
                      transitionConfig.type === t.type
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <div className="text-sm font-medium">{t.name}</div>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {t.category}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Duration</Label>
                <span className="text-sm text-slate-500">
                  {transitionConfig.duration}ms
                </span>
              </div>
              <Slider
                value={[transitionConfig.duration]}
                onValueChange={handleDurationChange}
                min={100}
                max={2000}
                step={50}
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Fast</span>
                <span>Slow</span>
              </div>
            </div>

            {/* Easing */}
            <div>
              <Label className="mb-2 block">Easing</Label>
              <Select value={transitionConfig.easing} onValueChange={handleEasingChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {easings.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Apply to all */}
            <Button variant="outline" className="w-full" onClick={applyToAll}>
              <Check className="h-4 w-4 mr-2" />
              Apply to All Slides
            </Button>
          </TabsContent>

          <TabsContent value="animation" className="p-4 m-0 space-y-6">
            {/* Animation Types */}
            <div>
              <Label className="mb-2 block">Animation Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {animations.map((a) => (
                  <button
                    key={a.type}
                    onClick={() => setSelectedAnimation(a.type)}
                    className={cn(
                      'p-3 rounded-lg border text-center transition-all',
                      selectedAnimation === a.type
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <div className="text-sm font-medium">{a.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Duration</Label>
                <span className="text-sm text-slate-500">{animationDuration}ms</span>
              </div>
              <Slider
                value={[animationDuration]}
                onValueChange={(v) => setAnimationDuration(v[0])}
                min={100}
                max={1500}
                step={50}
              />
            </div>

            {/* Delay */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Delay</Label>
                <span className="text-sm text-slate-500">{animationDelay}ms</span>
              </div>
              <Slider
                value={[animationDelay]}
                onValueChange={(v) => setAnimationDelay(v[0])}
                min={0}
                max={2000}
                step={50}
              />
            </div>

            {/* Easing */}
            <div>
              <Label className="mb-2 block">Easing</Label>
              <Select
                value={animationEasing}
                onValueChange={(v) => setAnimationEasing(v as EasingType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {easings.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Animation Order */}
            <div>
              <Label className="mb-2 block">Animation Order</Label>
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-sm">Title</span>
                    <Badge variant="outline">1st</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-sm">Subtitle</span>
                    <Badge variant="outline">2nd</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-sm">Image</span>
                    <Badge variant="outline">3rd</Badge>
                  </div>
                </CardContent>
              </Card>
              <p className="text-xs text-slate-500 mt-2">
                Drag elements to reorder animation sequence
              </p>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
