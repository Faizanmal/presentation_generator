'use client';

import React, { useState, useMemo } from 'react';
import {
    Sparkles,
    Wand2,
    ArrowRight,
    Eye,
    Zap,
    Layers,
    MoveHorizontal,
    Cloud,
    FlipHorizontal,
    Expand,
    ArrowUpCircle,
    ArrowDownCircle,
    Circle,
    Square,
    Hexagon,
    Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SlideTransition {
    type: TransitionType;
    duration: number;
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';
    direction?: 'left' | 'right' | 'up' | 'down';
}

type TransitionType =
    | 'none'
    | 'fade'
    | 'slide'
    | 'zoom'
    | 'flip'
    | 'cube'
    | 'dissolve'
    | 'morph'
    | 'push'
    | 'wipe';

interface SmartTransitionSuggestionsProps {
    currentSlideContext: {
        slideNumber: number;
        heading: string;
        blockTypes: string[];
        theme?: string;
    };
    nextSlideContext?: {
        slideNumber: number;
        heading: string;
        blockTypes: string[];
    };
    onApplyTransition: (transition: SlideTransition) => void;
    currentTransition?: SlideTransition;
}

const TRANSITION_TYPES: Array<{
    type: TransitionType;
    label: string;
    icon: React.ElementType;
    description: string;
    isPremium?: boolean;
}> = [
        { type: 'none', label: 'None', icon: Square, description: 'No transition' },
        { type: 'fade', label: 'Fade', icon: Cloud, description: 'Simple fade in/out' },
        { type: 'slide', label: 'Slide', icon: MoveHorizontal, description: 'Slide from direction' },
        { type: 'zoom', label: 'Zoom', icon: Expand, description: 'Zoom in or out' },
        { type: 'flip', label: 'Flip', icon: FlipHorizontal, description: 'Flip like a card' },
        { type: 'cube', label: 'Cube', icon: Hexagon, description: '3D cube rotation', isPremium: true },
        { type: 'dissolve', label: 'Dissolve', icon: Circle, description: 'Pixel dissolve effect' },
        { type: 'morph', label: 'Morph', icon: Wand2, description: 'Smart morph animation', isPremium: true },
        { type: 'push', label: 'Push', icon: ArrowRight, description: 'Push previous slide' },
        { type: 'wipe', label: 'Wipe', icon: Layers, description: 'Wipe across screen' },
    ];

const EASING_OPTIONS = [
    { value: 'linear', label: 'Linear' },
    { value: 'ease-in', label: 'Ease In' },
    { value: 'ease-out', label: 'Ease Out' },
    { value: 'ease-in-out', label: 'Ease In-Out' },
    { value: 'bounce', label: 'Bounce' },
];

const DIRECTION_OPTIONS = [
    { value: 'left', label: 'Left', icon: ArrowRight },
    { value: 'right', label: 'Right', icon: ArrowRight },
    { value: 'up', label: 'Up', icon: ArrowUpCircle },
    { value: 'down', label: 'Down', icon: ArrowDownCircle },
];

export function SmartTransitionSuggestions({
    currentSlideContext,
    nextSlideContext,
    onApplyTransition,
    currentTransition,
}: SmartTransitionSuggestionsProps) {
    const [selectedType, setSelectedType] = useState<TransitionType>(currentTransition?.type || 'fade');
    const [duration, setDuration] = useState(currentTransition?.duration || 500);
    const [easing, setEasing] = useState(currentTransition?.easing || 'ease-in-out');
    const [direction, setDirection] = useState<'left' | 'right' | 'up' | 'down'>(currentTransition?.direction || 'right');
    const [autoTransition, setAutoTransition] = useState(false);



    // Generate smart suggestions based on slide content
    const smartSuggestions = useMemo(() => {
        const suggestions: Array<{
            type: TransitionType;
            reason: string;
            score: number;
        }> = [];

        // Analyze slide content for suggestions
        const currentBlocks = currentSlideContext.blockTypes;
        const nextBlocks = nextSlideContext?.blockTypes || [];

        // If next slide has similar content, suggest morph
        const hasSharedTypes = currentBlocks.some(b => nextBlocks.includes(b));
        if (hasSharedTypes) {
            suggestions.push({
                type: 'morph',
                reason: 'Similar content types - morph will animate smoothly',
                score: 95,
            });
        }

        // If moving from intro to content, suggest slide
        if (currentSlideContext.slideNumber === 1) {
            suggestions.push({
                type: 'slide',
                reason: 'Opening transition - slide creates forward momentum',
                score: 90,
            });
        }

        // If current slide has images, suggest zoom
        if (currentBlocks.includes('image') || currentBlocks.includes('hero')) {
            suggestions.push({
                type: 'zoom',
                reason: 'Visual content benefits from zoom transition',
                score: 85,
            });
        }

        // If topic is changing significantly, suggest fade
        if (!hasSharedTypes) {
            suggestions.push({
                type: 'fade',
                reason: 'Topic change - fade provides clean separation',
                score: 80,
            });
        }

        // Default professional suggestion
        suggestions.push({
            type: 'dissolve',
            reason: 'Professional and subtle transition',
            score: 75,
        });

        // Sort by score and return top 3
        return suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
    }, [currentSlideContext, nextSlideContext]);

    const handleApply = () => {
        onApplyTransition({
            type: selectedType,
            duration,
            easing: easing as SlideTransition['easing'],
            direction: selectedType === 'slide' || selectedType === 'push' || selectedType === 'wipe' ? direction : undefined,
        });
    };

    const needsDirection = ['slide', 'push', 'wipe'].includes(selectedType);

    return (
        <div className="space-y-6">
            {/* AI Suggestions */}
            <Card className="border-violet-200 bg-violet-50/50">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Sparkles className="h-4 w-4 text-violet-500" />
                        AI Suggestions
                    </CardTitle>
                    <CardDescription>
                        Smart recommendations based on your slide content
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {smartSuggestions.map((suggestion, index) => (
                        <button
                            // eslint-disable-next-line react/no-array-index-key
                            key={`${suggestion.type}-${suggestion.score}-${index}`}
                            onClick={() => setSelectedType(suggestion.type)}
                            className={cn(
                                'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
                                selectedType === suggestion.type
                                    ? 'border-violet-500 bg-violet-100'
                                    : 'hover:border-violet-300 hover:bg-white'
                            )}
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100">
                                {index === 0 ? (
                                    <Zap className="h-4 w-4 text-violet-600" />
                                ) : (
                                    <span className="text-sm font-medium text-violet-600">{index + 1}</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium capitalize">{suggestion.type}</span>
                                    {index === 0 && (
                                        <Badge variant="secondary" className="text-xs">
                                            Best Match
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-semibold text-violet-600">{suggestion.score}%</span>
                            </div>
                        </button>
                    ))}
                </CardContent>
            </Card>

            {/* All Transitions */}
            <div className="space-y-2">
                <Label>All Transitions</Label>
                <ScrollArea className="h-[200px]">
                    <div className="grid grid-cols-2 gap-2 pr-4">
                        {TRANSITION_TYPES.map((transition) => {
                            const Icon = transition.icon;
                            return (
                                <TooltipProvider key={transition.type}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={() => setSelectedType(transition.type)}
                                                className={cn(
                                                    'flex items-center gap-2 rounded-lg border p-3 text-left transition-all',
                                                    selectedType === transition.type
                                                        ? 'border-primary bg-primary/5'
                                                        : 'hover:border-primary/50'
                                                )}
                                            >
                                                <Icon className="h-5 w-5" />
                                                <div className="flex-1">
                                                    <span className="text-sm font-medium">{transition.label}</span>
                                                    {transition.isPremium && (
                                                        <Badge variant="secondary" className="ml-2 text-[10px]">
                                                            Pro
                                                        </Badge>
                                                    )}
                                                </div>
                                                {selectedType === transition.type && (
                                                    <Check className="h-4 w-4 text-primary" />
                                                )}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>{transition.description}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>

            {/* Transition Settings */}
            {selectedType !== 'none' && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Transition Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Duration */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Duration</Label>
                                <span className="text-sm text-muted-foreground">{duration}ms</span>
                            </div>
                            <Slider
                                value={[duration]}
                                onValueChange={([v]) => setDuration(v)}
                                min={200}
                                max={2000}
                                step={100}
                            />
                        </div>

                        {/* Easing */}
                        <div className="space-y-2">
                            <Label>Easing</Label>
                            <Select value={easing} onValueChange={(val) => setEasing(val as SlideTransition['easing'])}>
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

                        {/* Direction (for applicable transitions) */}
                        {needsDirection && (
                            <div className="space-y-2">
                                <Label>Direction</Label>
                                <div className="flex gap-2">
                                    {DIRECTION_OPTIONS.map((option) => (
                                        <Button
                                            key={option.value}
                                            variant={direction === option.value ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setDirection(option.value as typeof direction)}
                                            className="flex-1"
                                        >
                                            {option.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Auto-advance */}
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Auto-advance</Label>
                                <p className="text-xs text-muted-foreground">
                                    Automatically move to next slide
                                </p>
                            </div>
                            <Switch checked={autoTransition} onCheckedChange={setAutoTransition} />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Preview & Apply */}
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    onClick={() => { }}
                    className="flex-1 gap-2"
                >
                    <Eye className="h-4 w-4" />
                    Preview
                </Button>
                <Button onClick={handleApply} className="flex-1 gap-2">
                    <Check className="h-4 w-4" />
                    Apply Transition
                </Button>
            </div>

            {/* Apply to All */}
            <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
                <Layers className="h-4 w-4" />
                Apply to all slides
            </Button>
        </div>
    );
}
