'use client';

// import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  Clock,
  Users,
  FileText,
  BarChart3,
  Target,
  Zap,
  Eye,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

interface PresentationInsight {
  category: 'content' | 'engagement' | 'structure' | 'design' | 'timing' | 'audience';
  type: 'strength' | 'improvement' | 'suggestion' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  recommendation?: string;
  relatedSlides?: string[];
}

interface InsightsDashboardProps {
  projectId: string;
}

export function InsightsDashboard({ projectId }: InsightsDashboardProps) {
  const { data: insights, isLoading, refetch } = useQuery({
    queryKey: ['presentation-insights', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/ai/insights/${projectId}`);
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <Brain className="mx-auto h-12 w-12 animate-pulse text-primary" />
          <p className="mt-4 text-lg font-medium">Analyzing your presentation...</p>
          <p className="text-sm text-muted-foreground">This may take a moment</p>
        </div>
      </div>
    );
  }

  const overallScore = insights?.overallScore || 0;
  const scoreColor =
    overallScore >= 80 ? 'text-green-600' : overallScore >= 60 ? 'text-yellow-600' : 'text-red-600';

  const getInsightIcon = (type: PresentationInsight['type']) => {
    switch (type) {
      case 'strength':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'improvement':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'suggestion':
        return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getCategoryIcon = (category: PresentationInsight['category']) => {
    switch (category) {
      case 'content':
        return <FileText className="h-4 w-4" />;
      case 'engagement':
        return <Zap className="h-4 w-4" />;
      case 'structure':
        return <BarChart3 className="h-4 w-4" />;
      case 'design':
        return <Eye className="h-4 w-4" />;
      case 'timing':
        return <Clock className="h-4 w-4" />;
      case 'audience':
        return <Users className="h-4 w-4" />;
    }
  };

  const getImpactBadge = (impact: PresentationInsight['impact']) => {
    switch (impact) {
      case 'high':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            High
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Minus className="h-3 w-3" />
            Medium
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <ArrowDown className="h-3 w-3" />
            Low
          </Badge>
        );
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const groupedInsights = (insights?.insights || []).reduce(
    (acc: Record<string, PresentationInsight[]>, insight: PresentationInsight) => {
      if (!acc[insight.category]) { acc[insight.category] = []; }
      acc[insight.category].push(insight);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Brain className="h-6 w-6 text-primary" />
            Presentation Insights
          </h2>
          <p className="text-muted-foreground">
            AI-powered analysis of your presentation
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Re-analyze
        </Button>
      </div>

      {/* Overall Score */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className={cn('text-5xl font-bold', scoreColor)}>
                {overallScore}
              </div>
              <p className="text-sm text-muted-foreground">Overall Score</p>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Presentation Quality</span>
                <span className={scoreColor}>{overallScore}%</span>
              </div>
              <Progress value={overallScore} className="h-3" />
              <p className="text-sm text-muted-foreground">
                {overallScore >= 80
                  ? 'Excellent! Your presentation is well-crafted.'
                  : overallScore >= 60
                    ? 'Good, but there are areas for improvement.'
                    : 'Consider addressing the suggested improvements.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{insights?.content?.wordCount || 0}</p>
                <p className="text-sm text-muted-foreground">Total Words</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatTime(insights?.timing?.totalEstimatedTime || 0)}
                </p>
                <p className="text-sm text-muted-foreground">Est. Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-2">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{insights?.content?.readabilityScore || 0}</p>
                <p className="text-sm text-muted-foreground">Readability</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-orange-100 p-2">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold capitalize">
                  {insights?.audience?.complexity || 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">Complexity</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <Tabs defaultValue="insights">
        <TabsList>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="timing">Timing</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          {Object.keys(groupedInsights).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Brain className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No insights available</p>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {Object.entries(groupedInsights).map(([category, categoryInsights]) => (
                <AccordionItem key={category} value={category} className="rounded-lg border">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      {getCategoryIcon(category as PresentationInsight['category'])}
                      <span className="capitalize">{category}</span>
                      <Badge variant="secondary">{(categoryInsights as PresentationInsight[]).length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3">
                      {(categoryInsights as PresentationInsight[]).map((insight, _index) => (
                        <div key={insight.title}
                          className="rounded-lg border p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              {getInsightIcon(insight.type)}
                              <div>
                                <p className="font-medium">{insight.title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {insight.description}
                                </p>
                                {insight.recommendation && (
                                  <div className="mt-2 rounded bg-muted p-2">
                                    <p className="text-sm">
                                      <span className="font-medium">Recommendation:</span>{' '}
                                      {insight.recommendation}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                            {getImpactBadge(insight.impact)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Key Topics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(insights?.content?.keyTopics || []).slice(0, 10).map(
                    (topic: { topic: string; frequency: number }, _index: number) => (
                      <Badge key={topic.topic} variant="secondary">
                        {topic.topic} ({topic.frequency})
                      </Badge>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Action Words</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(insights?.content?.actionWords || []).map(
                    (action: { word: string; count: number }) => (
                      <Badge key={action.word} variant="outline">
                        {action.word} ({action.count})
                      </Badge>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Content Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Reading Level</p>
                  <p className="font-medium">{insights?.content?.readingLevel || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Words/Slide</p>
                  <p className="font-medium">
                    {insights?.content?.averageWordsPerSlide || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sentiment</p>
                  <p className="font-medium capitalize">
                    {insights?.content?.sentimentOverall || 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structure" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Has Introduction</span>
                  {insights?.structure?.hasIntroduction ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Has Agenda</span>
                  {insights?.structure?.hasAgenda ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Has Conclusion</span>
                  {insights?.structure?.hasConclusion ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Flow Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Presentation Flow</span>
                  <span>{insights?.structure?.flowScore || 0}%</span>
                </div>
                <Progress value={insights?.structure?.flowScore || 0} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Slide Timing Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {(insights?.timing?.perSlideTime || []).map(
                    (slide: { slideId: string; estimatedSeconds: number }, index: number) => (
                      <div key={`timing-slide-${slide.slideId}`}
                        className="flex items-center justify-between rounded border p-2"
                      >
                        <span>Slide {index + 1}</span>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={(slide.estimatedSeconds / 180) * 100}
                            className="w-32"
                          />
                          <span className="w-16 text-right text-sm text-muted-foreground">
                            {formatTime(slide.estimatedSeconds)}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {(insights?.timing?.pacingIssues || []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Pacing Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights?.timing?.pacingIssues?.map(
                    (issue: { slideId: string; issue: string }, _index: number) => (

                      <div key={issue.slideId} className="text-sm text-muted-foreground">
                        • {issue.issue}
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="audience" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Technical Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Technical Complexity</span>
                    <span>{insights?.audience?.technicalLevel || 0}%</span>
                  </div>
                  <Progress value={insights?.audience?.technicalLevel || 0} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Accessibility Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Accessibility</span>
                    <span>{insights?.audience?.accessibilityScore || 0}%</span>
                  </div>
                  <Progress value={insights?.audience?.accessibilityScore || 0} />
                </div>
              </CardContent>
            </Card>
          </div>

          {(insights?.audience?.accessibilityIssues || []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Accessibility Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights?.audience?.accessibilityIssues?.map(
                    (issue: { slideId: string; issue: string }) => (

                      <div key={issue.slideId} className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <span>{issue.issue}</span>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
