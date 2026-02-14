'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  Lightbulb,
  Image as ImageIcon,
  BarChart3,
  Quote,
  Hash,
  List,
  Layout,
  Wand2,
  RefreshCw,
  Plus,
  X,
  Zap,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BlockContent } from "@/types";
import { cn } from '@/lib/utils';

interface Suggestion {
  id: string;
  type: 'text' | 'image' | 'icon' | 'chart' | 'quote' | 'statistic' | 'bullet' | 'layout';
  content: string | Record<string, unknown>;
  confidence: number;
  reason: string;
  preview?: string;
}

interface SmartSuggestionsPanelProps {
  projectId: string;
  slideId: string;
  slideContent: BlockContent;
  presentationTopic: string;
  onApplySuggestion: (suggestion: Suggestion) => void;
  onInsertContent: (content: Record<string, unknown>) => void;
}

export function SmartSuggestionsPanel({
  slideContent,
  presentationTopic,
  onApplySuggestion,
  onInsertContent,
}: SmartSuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'content' | 'visual' | 'style'>('all');

  const getSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slideContent,
          context: {
            title: 'Presentation',
            topic: presentationTopic,
            previousSlides: [],
          },
        }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSuggestions(data || []);
    },
  });

  // const smartCompleteMutation = useMutation({
  //   mutationFn: async (partialText: string) => {
  //     const response = await fetch('/api/ai/smart-complete', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({
  //         partialText,
  //         context: {
  //           presentationTopic,
  //         },
  //       }),
  //     });
  //     return response.json();
  //   },
  // });

  const rewriteMutation = useMutation({
    mutationFn: async ({ content, style }: { content: string; style: string }) => {
      const response = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, style }),
      });
      return response.json();
    },
  });

  useEffect(() => {
    if (isExpanded && suggestions.length === 0) {
      getSuggestionsMutation.mutate();
    }
  }, [isExpanded, getSuggestionsMutation, suggestions.length]);

  const getTypeIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'text':
        return <Type className="h-4 w-4" />;
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'chart':
        return <BarChart3 className="h-4 w-4" />;
      case 'quote':
        return <Quote className="h-4 w-4" />;
      case 'statistic':
        return <Hash className="h-4 w-4" />;
      case 'bullet':
        return <List className="h-4 w-4" />;
      case 'layout':
        return <Layout className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: Suggestion['type']) => {
    switch (type) {
      case 'text':
        return 'bg-blue-100 text-blue-700';
      case 'image':
        return 'bg-purple-100 text-purple-700';
      case 'chart':
        return 'bg-green-100 text-green-700';
      case 'quote':
        return 'bg-orange-100 text-orange-700';
      case 'statistic':
        return 'bg-red-100 text-red-700';
      case 'bullet':
        return 'bg-cyan-100 text-cyan-700';
      case 'layout':
        return 'bg-pink-100 text-pink-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredSuggestions = suggestions.filter((s) => {
    if (activeTab === 'all') { return true; }
    if (activeTab === 'content') { return ['text', 'bullet', 'quote', 'statistic'].includes(s.type); }
    if (activeTab === 'visual') { return ['image', 'chart', 'icon'].includes(s.type); }
    if (activeTab === 'style') { return ['layout'].includes(s.type); }
    return true;
  });

  const quickActions = [
    {
      id: 'professional',
      label: 'Make Professional',
      icon: Wand2,
      action: () => rewriteMutation.mutate({ content: slideContent.text || '', style: 'professional' }),
    },
    {
      id: 'concise',
      label: 'Make Concise',
      icon: Zap,
      action: () => rewriteMutation.mutate({ content: slideContent.text || '', style: 'concise' }),
    },
    {
      id: 'persuasive',
      label: 'Make Persuasive',
      icon: Sparkles,
      action: () => rewriteMutation.mutate({ content: slideContent.text || '', style: 'persuasive' }),
    },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isExpanded ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="lg"
                className="h-14 w-14 rounded-full shadow-lg"
                onClick={() => setIsExpanded(true)}
              >
                <Sparkles className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Smart Suggestions</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="w-[380px] rounded-xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">Smart Suggestions</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => getSuggestionsMutation.mutate()}
                disabled={getSuggestionsMutation.isPending}
              >
                <RefreshCw
                  className={cn(
                    'h-4 w-4',
                    getSuggestionsMutation.isPending && 'animate-spin'
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="border-b p-3">
            <div className="flex gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={action.action}
                  disabled={rewriteMutation.isPending}
                >
                  <action.icon className="mr-1 h-3 w-3" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'content' | 'visual' | 'style')}>
            <TabsList className="w-full rounded-none border-b bg-transparent p-0">
              <TabsTrigger
                value="all"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="content"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                Content
              </TabsTrigger>
              <TabsTrigger
                value="visual"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                Visual
              </TabsTrigger>
              <TabsTrigger
                value="style"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                Style
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="m-0">
              <ScrollArea className="h-[300px]">
                {getSuggestionsMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="relative">
                      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                      <Sparkles className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-primary" />
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Analyzing your slide...
                    </p>
                  </div>
                ) : filteredSuggestions.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Lightbulb className="mx-auto h-8 w-8 opacity-50" />
                    <p className="mt-2">No suggestions available</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => getSuggestionsMutation.mutate()}
                    >
                      Refresh
                    </Button>
                  </div>
                ) : (
                  <div className="p-2">
                    {filteredSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="group mb-2 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'mt-0.5 flex items-center gap-1',
                                getTypeColor(suggestion.type)
                              )}
                            >
                              {getTypeIcon(suggestion.type)}
                              <span className="capitalize">{suggestion.type}</span>
                            </Badge>
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {typeof suggestion.content === 'string'
                                  ? suggestion.content.substring(0, 100)
                                  : 'Visual suggestion'}
                                {typeof suggestion.content === 'string' &&
                                  suggestion.content.length > 100 &&
                                  '...'}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {suggestion.reason}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onApplySuggestion(suggestion)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {/* Confidence bar */}
                        <div className="mt-2">
                          <div className="h-1 w-full rounded-full bg-muted">
                            <div
                              className="h-1 rounded-full bg-primary"
                              style={{ width: `${suggestion.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Rewrite result */}
          {rewriteMutation.data && (
            <div className="border-t p-3">
              <div className="rounded-lg bg-green-50 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Rewritten Content
                    </p>
                    <p className="mt-1 text-sm text-green-700">
                      {rewriteMutation.data.rewritten}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onInsertContent({ text: rewriteMutation.data.rewritten })
                    }
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Powered by AI</span>
              <span>{suggestions.length} suggestions</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline suggestion component for real-time typing suggestions
export function InlineSuggestion({
  partialText,
  onAccept,
}: {
  partialText: string;
  onAccept: (completion: string) => void;
}) {
  const [completions, setCompletions] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const fetchCompletions = useCallback(async () => {
    if (partialText.length < 5) {
      setIsVisible(false);
      return;
    }

    try {
      const response = await fetch('/api/ai/smart-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partialText, context: {} }),
      });
      const data = await response.json();
      if (data.completions?.length > 0) {
        setCompletions(data.completions);
        setIsVisible(true);
      }
    } catch {
      setIsVisible(false);
    }
  }, [partialText]);

  useEffect(() => {
    const debounce = setTimeout(fetchCompletions, 500);
    return () => clearTimeout(debounce);
  }, [fetchCompletions]);

  if (!isVisible || completions.length === 0) { return null; }

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border bg-background shadow-lg">
      {completions.map((completion) => (
         
         
         
         
         
        <button
          key={completion}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
          onClick={() => {
            onAccept(completion);
            setIsVisible(false);
          }}
        >
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-muted-foreground">{partialText}</span>
          <span className="text-foreground">{completion}</span>
          <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-xs">
            Tab
          </kbd>
        </button>
      ))}
    </div>
  );
}
