'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Award,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Info,
  Lightbulb,
  MessageSquare,
  Mic,
  Play,
  RefreshCw,
  Target,
  TrendingUp,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wand2,
  Eye,
  Clock,
  FileText,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface CategoryScore {
  score: number;
  maxScore: number;
  feedback: string;
  tips: string[];
}

interface Suggestion {
  type: 'critical' | 'warning' | 'info';
  category: string;
  slideIndex?: number;
  title: string;
  description: string;
  autoFixAvailable: boolean;
}

interface PresentationAnalysis {
  overallScore: number;
  categories: {
    content: CategoryScore;
    design: CategoryScore;
    engagement: CategoryScore;
    clarity: CategoryScore;
    accessibility: CategoryScore;
  };
  suggestions: Suggestion[];
  strengths: string[];
  improvements: string[];
  estimatedDuration: number;
  readabilityScore: number;
  wordCount: number;
  slideCount: number;
}

interface PresentationCoachProps {
  projectId: string;
  slides: Array<{
    id: string;
    content: string;
    speakerNotes?: string;
    hasImage: boolean;
    layout: string;
  }>;
  title: string;
  audience?: string;
  purpose?: string;
}

export function PresentationCoach({
  projectId,
  slides,
  title,
  audience,
  purpose,
}: PresentationCoachProps) {
  const [analysis, setAnalysis] = useState<PresentationAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const analyzeMutation = useMutation({
    mutationFn: () =>
      api.post('/ai/coach/analyze', {
        title,
        slides: slides.map((s) => ({
          content: s.content,
          speakerNotes: s.speakerNotes,
          hasImage: s.hasImage,
          layout: s.layout,
        })),
        audience,
        purpose,
      }),
    onSuccess: (data) => {
      setAnalysis(data as PresentationAnalysis | null);
    },
  });

  const getScoreColor = (score: number, max: number) => {
    const percentage = (score / max) * 100;
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getOverallGrade = (score: number) => {
    if (score >= 90) return { grade: 'A+', color: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 80) return { grade: 'A', color: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 70) return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (score >= 60) return { grade: 'C', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { grade: 'D', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const getSuggestionIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <Info className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Lightbulb className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-500" />
              AI Presentation Coach
            </h2>
            <p className="text-sm text-slate-500">
              Get AI-powered feedback to improve your presentation
            </p>
          </div>
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
          >
            {analyzeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 mr-2" />
            )}
            Analyze
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {!analysis && !analyzeMutation.isPending && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Award className="h-16 w-16 text-slate-300 mb-4" />
            <h3 className="font-medium text-lg mb-2">Ready to improve?</h3>
            <p className="text-sm text-slate-500 max-w-md mb-6">
              Click &quot;Analyze&quot; to get personalized feedback on your
              presentation&apos;s content, design, and engagement.
            </p>
            <div className="grid grid-cols-2 gap-4 text-left max-w-sm">
              <div className="flex items-start gap-2">
                <Target className="h-4 w-4 text-purple-500 mt-0.5" />
                <span className="text-sm">Content analysis</span>
              </div>
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 text-purple-500 mt-0.5" />
                <span className="text-sm">Design feedback</span>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500 mt-0.5" />
                <span className="text-sm">Engagement tips</span>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-purple-500 mt-0.5" />
                <span className="text-sm">Auto-fix suggestions</span>
              </div>
            </div>
          </div>
        )}

        {analyzeMutation.isPending && (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-12 w-12 text-purple-500 animate-spin mb-4" />
            <p className="text-slate-600">Analyzing your presentation...</p>
          </div>
        )}

        {analysis && (
          <div className="p-4 space-y-6">
            {/* Overall Score */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-6">
                  <div
                    className={cn(
                      'w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold',
                      getOverallGrade(analysis.overallScore).bg,
                      getOverallGrade(analysis.overallScore).color
                    )}
                  >
                    {getOverallGrade(analysis.overallScore).grade}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Overall Score</span>
                      <span className="text-2xl font-bold">
                        {analysis.overallScore}/100
                      </span>
                    </div>
                    <Progress value={analysis.overallScore} className="h-3" />
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
                  <div className="text-center">
                    <FileText className="h-5 w-5 mx-auto text-slate-400 mb-1" />
                    <div className="text-lg font-semibold">{analysis.slideCount}</div>
                    <div className="text-xs text-slate-500">Slides</div>
                  </div>
                  <div className="text-center">
                    <MessageSquare className="h-5 w-5 mx-auto text-slate-400 mb-1" />
                    <div className="text-lg font-semibold">{analysis.wordCount}</div>
                    <div className="text-xs text-slate-500">Words</div>
                  </div>
                  <div className="text-center">
                    <Clock className="h-5 w-5 mx-auto text-slate-400 mb-1" />
                    <div className="text-lg font-semibold">{analysis.estimatedDuration}m</div>
                    <div className="text-xs text-slate-500">Duration</div>
                  </div>
                  <div className="text-center">
                    <BarChart3 className="h-5 w-5 mx-auto text-slate-400 mb-1" />
                    <div className="text-lg font-semibold">{analysis.readabilityScore}</div>
                    <div className="text-xs text-slate-500">Readability</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs for detailed analysis */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Categories</TabsTrigger>
                <TabsTrigger value="suggestions">
                  Suggestions ({analysis.suggestions.length})
                </TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                {Object.entries(analysis.categories).map(([key, category]) => (
                  <Card key={key}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base capitalize">{key}</CardTitle>
                        <span
                          className={cn(
                            'text-lg font-bold',
                            getScoreColor(category.score, category.maxScore)
                          )}
                        >
                          {category.score}/{category.maxScore}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Progress
                        value={(category.score / category.maxScore) * 100}
                        className="h-2 mb-3"
                      />
                      <p className="text-sm text-slate-600 mb-3">{category.feedback}</p>
                      {category.tips.length > 0 && (
                        <div className="space-y-1">
                          {category.tips.map((tip, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <Lightbulb className="h-3 w-3 text-yellow-500 mt-1 flex-shrink-0" />
                              <span>{tip}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="suggestions" className="mt-4">
                <div className="space-y-3">
                  {analysis.suggestions.map((suggestion, i) => (
                    <Card key={i}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          {getSuggestionIcon(suggestion.type)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{suggestion.title}</span>
                              {suggestion.slideIndex !== undefined && (
                                <Badge variant="outline" className="text-xs">
                                  Slide {suggestion.slideIndex + 1}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">{suggestion.description}</p>
                            {suggestion.autoFixAvailable && (
                              <Button size="sm" variant="outline" className="mt-2">
                                <Wand2 className="h-3 w-3 mr-1" />
                                Auto-fix
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {analysis.suggestions.length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      <p className="text-slate-600">No issues found. Great job!</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="insights" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.strengths.map((strength, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      Areas for Improvement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.improvements.map((improvement, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2" />
                          {improvement}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
