'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  StickyNote,
  Sparkles,
  Clock,
  FileText,
  Wand2,
  Copy,
  ChevronDown,
  ChevronUp,
  Mic,
  Volume2,
  RotateCcw,
  Save,
  BookOpen,
  Target,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface SlideNotesEditorProps {
  slideId: string;
  slideContent: Record<string, unknown>;
  initialNotes?: string;
  onNotesChange: (notes: string) => void;
  presentationTopic?: string;
}

interface TimingMarker {
  time: number;
  text: string;
  type: 'pause' | 'emphasis' | 'transition' | 'interaction';
}

export function SlideNotesEditor({
  slideId,
  slideContent,
  initialNotes = '',
  onNotesChange,
  presentationTopic,
}: SlideNotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [isExpanded, setIsExpanded] = useState(true);
  const [timingMarkers, setTimingMarkers] = useState<TimingMarker[]>([]);
  const [showTimingHelpers, setShowTimingHelpers] = useState(false);

  // Calculate estimated speaking time (average 150 words per minute) - moved to useMemo
  const estimatedTime = useMemo(() => {
    const wordCount = notes?.split(/\s+/).filter(Boolean).length ?? 0;
    return Math.ceil((wordCount / 150) * 60);
  }, [notes]);

  const generateNotesMutation = useMutation({
    mutationFn: async (style: 'brief' | 'detailed' | 'bullet' | 'script') => {
      const response = await fetch('/api/ai/speaker-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slideContent,
          presentationTopic,
          style,
        }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.notes) {
        setNotes(data.notes);
        onNotesChange(data.notes);
      }
    },
  });

  const summarizeNotesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ai/summarize-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      return response.json();
    },
  });

  const generateKeyPointsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ai/key-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slideContent,
          notes,
        }),
      });
      return response.json();
    },
  });

  const handleNotesChange = (value: string) => {
    setNotes(value);
    onNotesChange(value);
  };

  const insertTimingMarker = (type: TimingMarker['type']) => {
    const markers: Record<string, string> = {
      pause: '[PAUSE]',
      emphasis: '[EMPHASIZE]',
      transition: '[TRANSITION]',
      interaction: '[ASK AUDIENCE]',
    };
    
    const textarea = document.getElementById('slide-notes') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newNotes = notes.substring(0, start) + markers[type] + ' ' + notes.substring(end);
      setNotes(newNotes);
      onNotesChange(newNotes);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(notes);
  };

  return (
    <div className="flex flex-col rounded-lg border bg-background">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center justify-between border-b p-3 hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" />
              <span className="font-medium">Speaker Notes</span>
              {notes && (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="mr-1 h-3 w-3" />
                  {formatTime(estimatedTime)}
                </Badge>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Tabs defaultValue="edit" className="p-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-3">
              {/* AI Generation Buttons */}
              <div className="flex flex-wrap gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateNotesMutation.mutate('brief')}
                        disabled={generateNotesMutation.isPending}
                      >
                        <Sparkles className="mr-1 h-3 w-3" />
                        Brief
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate brief talking points</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateNotesMutation.mutate('detailed')}
                        disabled={generateNotesMutation.isPending}
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        Detailed
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate detailed speaker notes</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateNotesMutation.mutate('script')}
                        disabled={generateNotesMutation.isPending}
                      >
                        <BookOpen className="mr-1 h-3 w-3" />
                        Full Script
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate word-for-word script</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTimingHelpers(!showTimingHelpers)}
                >
                  <Clock className="mr-1 h-3 w-3" />
                  Timing
                </Button>
              </div>

              {/* Timing Markers */}
              {showTimingHelpers && (
                <div className="flex gap-2 rounded-lg bg-muted p-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => insertTimingMarker('pause')}
                  >
                    Pause
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => insertTimingMarker('emphasis')}
                  >
                    Emphasize
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => insertTimingMarker('transition')}
                  >
                    Transition
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => insertTimingMarker('interaction')}
                  >
                    Ask Audience
                  </Button>
                </div>
              )}

              {/* Notes Editor */}
              <Textarea
                id="slide-notes"
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Add speaker notes for this slide..."
                className="min-h-[200px] resize-none"
              />

              {/* Footer Actions */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyToClipboard}
                    disabled={!notes}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNotes('');
                      onNotesChange('');
                    }}
                    disabled={!notes}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Clear
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {notes.split(/\s+/).filter(Boolean).length} words •{' '}
                  ~{formatTime(estimatedTime)} speaking time
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview">
              <ScrollArea className="h-[250px]">
                <div className="prose prose-sm dark:prose-invert max-w-none p-2">
                  {notes ? (
                    <div className="whitespace-pre-wrap">
                      {notes.split(/(\[.*?\])/).map((part, i) => {
                        if (part.match(/^\[.*\]$/)) {
                          const type = part.slice(1, -1).toLowerCase();
                          return (
                            <Badge
                              key={i}
                              variant="outline"
                              className={cn(
                                'mx-1 my-0.5',
                                type.includes('pause') && 'border-blue-300 bg-blue-50',
                                type.includes('emphasis') && 'border-yellow-300 bg-yellow-50',
                                type.includes('transition') && 'border-green-300 bg-green-50',
                                type.includes('audience') && 'border-purple-300 bg-purple-50'
                              )}
                            >
                              {part}
                            </Badge>
                          );
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No notes yet</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="summary" className="space-y-3">
              <Button
                onClick={() => summarizeNotesMutation.mutate()}
                disabled={!notes || summarizeNotesMutation.isPending}
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Summary
              </Button>

              {summarizeNotesMutation.data && (
                <div className="space-y-3">
                  <div className="rounded-lg border p-3">
                    <h4 className="flex items-center gap-2 font-medium">
                      <Target className="h-4 w-4" />
                      Key Takeaway
                    </h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {summarizeNotesMutation.data.keyTakeaway}
                    </p>
                  </div>

                  <div className="rounded-lg border p-3">
                    <h4 className="flex items-center gap-2 font-medium">
                      <MessageSquare className="h-4 w-4" />
                      Talking Points
                    </h4>
                    <ul className="mt-2 space-y-1">
                      {summarizeNotesMutation.data.talkingPoints?.map(
                        (point: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-primary">•</span>
                            <span>{point}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>

                  <div className="flex items-center gap-4 rounded-lg bg-muted p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Recommended Time</p>
                      <p className="font-medium">
                        {summarizeNotesMutation.data.recommendedTime || formatTime(estimatedTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Difficulty</p>
                      <Badge variant="outline">
                        {summarizeNotesMutation.data.complexity || 'Medium'}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Key Points Section */}
              <div className="border-t pt-3">
                <Button
                  variant="outline"
                  onClick={() => generateKeyPointsMutation.mutate()}
                  disabled={generateKeyPointsMutation.isPending}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Extract Key Points
                </Button>

                {generateKeyPointsMutation.data?.keyPoints && (
                  <div className="mt-3 space-y-2">
                    {generateKeyPointsMutation.data.keyPoints.map(
                      (point: { point: string; importance: string }, i: number) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 rounded border p-2"
                        >
                          <Badge
                            variant={
                              point.importance === 'high'
                                ? 'default'
                                : point.importance === 'medium'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="mt-0.5"
                          >
                            {i + 1}
                          </Badge>
                          <span className="text-sm">{point.point}</span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Compact notes display for presentation mode
export function CompactNotesDisplay({ notes }: { notes: string }) {
  if (!notes) return null;

  return (
    <div className="rounded-lg bg-black/80 p-4 text-white">
      <ScrollArea className="h-32">
        <div className="text-sm leading-relaxed">
          {notes.split(/(\[.*?\])/).map((part, i) => {
            if (part.match(/^\[.*\]$/)) {
              return (
                <span
                  key={i}
                  className="mx-1 rounded bg-white/20 px-1 py-0.5 text-xs uppercase"
                >
                  {part.slice(1, -1)}
                </span>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
