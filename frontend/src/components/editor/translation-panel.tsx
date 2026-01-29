'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Languages,
  Globe,
  ChevronRight,
  Check,
  AlertTriangle,
  Loader2,
  FileDown,
  Copy,
  ArrowRight,
  Settings,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
}

interface TranslationPanelProps {
  projectId: string;
  slides: any[];
  onTranslationComplete: (translatedSlides: any[]) => void;
}

export function TranslationPanel({
  projectId,
  slides,
  onTranslationComplete,
}: TranslationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string>('');
  const [options, setOptions] = useState({
    preserveFormatting: true,
    adaptCulturally: true,
    createCopy: true,
  });
  const [glossary, setGlossary] = useState<{ term: string; translation: string }[]>([]);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: languages } = useQuery({
    queryKey: ['supported-languages'],
    queryFn: async () => {
      const response = await fetch('/api/ai/translation/languages');
      return response.json() as Promise<SupportedLanguage[]>;
    },
  });

  const translateMutation = useMutation({
    mutationFn: async () => {
      const glossaryMap = glossary.reduce((acc, { term, translation }) => {
        if (term && translation) acc[term] = translation;
        return acc;
      }, {} as Record<string, string>);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setTranslationProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/ai/translation/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          slides,
          targetLanguage,
          options: {
            ...options,
            glossary: Object.keys(glossaryMap).length > 0 ? glossaryMap : undefined,
          },
        }),
      });

      clearInterval(progressInterval);
      setTranslationProgress(100);

      return response.json();
    },
    onSuccess: (data) => {
      if (data.translations) {
        const translatedSlides = data.translations.map((t: any) => ({
          ...slides.find((s) => s.id === t.slideId),
          content: t.translatedContent,
        }));
        onTranslationComplete(translatedSlides);
      }
    },
  });

  const detectLanguageMutation = useMutation({
    mutationFn: async () => {
      const text = slides[0]?.content?.title || '';
      const response = await fetch('/api/ai/translation/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      return response.json();
    },
  });

  const localizationSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ai/translation/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides,
          targetLanguage,
        }),
      });
      return response.json();
    },
  });

  const addGlossaryTerm = () => {
    setGlossary([...glossary, { term: '', translation: '' }]);
  };

  const updateGlossaryTerm = (index: number, field: 'term' | 'translation', value: string) => {
    const newGlossary = [...glossary];
    newGlossary[index][field] = value;
    setGlossary(newGlossary);
  };

  const removeGlossaryTerm = (index: number) => {
    setGlossary(glossary.filter((_, i) => i !== index));
  };

  const selectedLanguage = languages?.find((l) => l.code === targetLanguage);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Languages className="mr-2 h-4 w-4" />
          Translate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Translate Presentation
          </DialogTitle>
          <DialogDescription>
            Translate your presentation to reach a global audience
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="translate">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="translate">Translate</TabsTrigger>
            <TabsTrigger value="suggestions">Localization Tips</TabsTrigger>
          </TabsList>

          <TabsContent value="translate" className="space-y-4">
            {/* Source Language Detection */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Detected Source Language</p>
                  <p className="text-2xl font-bold">
                    {detectLanguageMutation.data?.code?.toUpperCase() || 'EN'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => detectLanguageMutation.mutate()}
                  disabled={detectLanguageMutation.isPending}
                >
                  {detectLanguageMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Detect
                </Button>
              </div>
            </div>

            {/* Target Language Selection */}
            <div className="space-y-2">
              <Label>Target Language</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-64">
                    {(languages || []).map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <div className="flex items-center gap-2">
                          <span>{lang.name}</span>
                          <span className="text-muted-foreground">({lang.nativeName})</span>
                          {lang.rtl && (
                            <Badge variant="outline" className="text-xs">
                              RTL
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Preserve Formatting</Label>
                  <p className="text-xs text-muted-foreground">
                    Keep original text styles and layout
                  </p>
                </div>
                <Switch
                  checked={options.preserveFormatting}
                  onCheckedChange={(v) => setOptions({ ...options, preserveFormatting: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cultural Adaptation</Label>
                  <p className="text-xs text-muted-foreground">
                    Adapt idioms and references for target culture
                  </p>
                </div>
                <Switch
                  checked={options.adaptCulturally}
                  onCheckedChange={(v) => setOptions({ ...options, adaptCulturally: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Create New Copy</Label>
                  <p className="text-xs text-muted-foreground">
                    Keep original and create translated version
                  </p>
                </div>
                <Switch
                  checked={options.createCopy}
                  onCheckedChange={(v) => setOptions({ ...options, createCopy: v })}
                />
              </div>
            </div>

            {/* Advanced Options */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Advanced Options
                </span>
                <ChevronRight
                  className={cn(
                    'h-4 w-4 transition-transform',
                    showAdvanced && 'rotate-90'
                  )}
                />
              </Button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Custom Glossary
                    </Label>
                    <Button variant="outline" size="sm" onClick={addGlossaryTerm}>
                      Add Term
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Define specific translations for terms or phrases
                  </p>
                  
                  {glossary.length > 0 && (
                    <div className="space-y-2">
                      {glossary.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            placeholder="Original term"
                            value={item.term}
                            onChange={(e) => updateGlossaryTerm(index, 'term', e.target.value)}
                          />
                          <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <Input
                            placeholder="Translation"
                            value={item.translation}
                            onChange={(e) => updateGlossaryTerm(index, 'translation', e.target.value)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeGlossaryTerm(index)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Translation Progress */}
            {translateMutation.isPending && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Translating {slides.length} slides...</span>
                  <span>{translationProgress}%</span>
                </div>
                <Progress value={translationProgress} />
              </div>
            )}

            {/* Success Message */}
            {translateMutation.isSuccess && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 text-green-700">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Translation Complete!</span>
                </div>
                <p className="mt-1 text-sm text-green-600">
                  {slides.length} slides translated to{' '}
                  {selectedLanguage?.name || targetLanguage}
                </p>
                {translateMutation.data?.warnings?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-orange-700">Warnings:</p>
                    {translateMutation.data.warnings.map((warning: string, i: number) => (
                      <p key={i} className="text-sm text-orange-600">
                        • {warning}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-4">
            {!targetLanguage ? (
              <div className="py-8 text-center text-muted-foreground">
                Select a target language first to get localization suggestions
              </div>
            ) : (
              <>
                <Button
                  onClick={() => localizationSuggestionsMutation.mutate()}
                  disabled={localizationSuggestionsMutation.isPending}
                >
                  {localizationSuggestionsMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Analyze for Localization Issues
                </Button>

                {localizationSuggestionsMutation.data?.suggestions && (
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {localizationSuggestionsMutation.data.suggestions.map(
                        (suggestion: any, index: number) => (
                          <div
                            key={index}
                            className={cn(
                              'rounded-lg border p-3',
                              suggestion.severity === 'high'
                                ? 'border-red-200 bg-red-50'
                                : suggestion.severity === 'medium'
                                ? 'border-yellow-200 bg-yellow-50'
                                : 'border-blue-200 bg-blue-50'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <AlertTriangle
                                className={cn(
                                  'mt-0.5 h-4 w-4',
                                  suggestion.severity === 'high'
                                    ? 'text-red-500'
                                    : suggestion.severity === 'medium'
                                    ? 'text-yellow-500'
                                    : 'text-blue-500'
                                )}
                              />
                              <div>
                                <p className="text-sm font-medium">{suggestion.issue}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {suggestion.suggestion}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      )}

                      {localizationSuggestionsMutation.data.suggestions.length === 0 && (
                        <div className="py-8 text-center">
                          <Check className="mx-auto h-8 w-8 text-green-500" />
                          <p className="mt-2 font-medium">No localization issues found!</p>
                          <p className="text-sm text-muted-foreground">
                            Your presentation is ready for translation
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => translateMutation.mutate()}
            disabled={!targetLanguage || translateMutation.isPending}
          >
            {translateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <Languages className="mr-2 h-4 w-4" />
                Translate to {selectedLanguage?.name || 'Selected Language'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
