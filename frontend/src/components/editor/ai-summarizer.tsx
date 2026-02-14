'use client';

import { useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles,
  FileText,
  List,
  Target,
  Users,
  Twitter,
  Linkedin,
  Hash,
  Clock,
  BarChart2,
  Copy,
  Check,
  RefreshCw,
  Download,
  Lightbulb,
  MessageSquare,
  BookOpen,
} from 'lucide-react';

interface SlideOverview {
  slideNumber: number;
  title: string;
  summary: string;
  keyTakeaway: string;
}

interface PresentationSummary {
  executive: string;
  keyPoints: string[];
  slideOverviews: SlideOverview[];
  actionItems: string[];
  audienceNotes: string;
  talkingPoints: string[];
  hashtags: string[];
  socialPost: {
    twitter: string;
    linkedin: string;
  };
  outline: string;
  wordCloud: Array<{ word: string; weight: number }>;
  readingTime: number;
  complexity: 'beginner' | 'intermediate' | 'advanced';
}

interface AISummarizerProps {
  presentationId: string;
  presentationTitle: string;
  slideCount: number;
}

export function AISummarizer({ presentationTitle, slideCount }: AISummarizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<PresentationSummary | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [options, setOptions] = useState({
    style: 'executive' as 'executive' | 'detailed' | 'bullet-points' | 'narrative',
    length: 'medium' as 'short' | 'medium' | 'long',
    audience: 'general' as 'general' | 'technical' | 'executive' | 'academic',
    includeActionItems: true,
    includeSocialPosts: true,
  });

  const generateSummary = async () => {
    setIsLoading(true);
    try {
      // Mock API call - replace with actual API
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock response
      setSummary({
        executive:
          'This presentation covers key strategies for digital transformation in enterprise organizations. It outlines a phased approach to modernizing legacy systems, emphasizes the importance of change management, and provides concrete ROI metrics from case studies.',
        keyPoints: [
          'Digital transformation is essential for competitive advantage',
          'A phased approach reduces risk and ensures stakeholder buy-in',
          'Change management is as important as technology selection',
          'Cloud-native architecture enables scalability and flexibility',
          'Data-driven decision making accelerates business outcomes',
        ],
        slideOverviews: [
          {
            slideNumber: 1,
            title: 'Introduction',
            summary: 'Sets the stage for why digital transformation matters now.',
            keyTakeaway: '78% of enterprises prioritize digital transformation',
          },
          {
            slideNumber: 2,
            title: 'Current Challenges',
            summary: 'Identifies common pain points in legacy systems.',
            keyTakeaway: 'Technical debt costs $1.2M annually per enterprise',
          },
          {
            slideNumber: 3,
            title: 'Solution Framework',
            summary: 'Presents a 4-phase transformation methodology.',
            keyTakeaway: 'Assess → Plan → Execute → Optimize',
          },
        ],
        actionItems: [
          'Schedule discovery workshop with stakeholders',
          'Conduct technology audit of current systems',
          'Define success metrics and KPIs',
          'Identify quick wins for Phase 1',
          'Establish governance committee',
        ],
        audienceNotes:
          'For a general audience, emphasize business outcomes over technical details. Use analogies to explain complex concepts and focus on the human impact of transformation.',
        talkingPoints: [
          'Start with a compelling statistic about market disruption',
          'Share a relevant case study from a similar industry',
          'Address the elephant in the room: change resistance',
          'Highlight quick wins to build momentum',
          'End with a clear call to action',
        ],
        hashtags: ['#DigitalTransformation', '#Innovation', '#CloudFirst', '#AgileEnterprise', '#TechLeadership'],
        socialPost: {
          twitter:
            '🚀 Just shared insights on enterprise digital transformation. Key takeaway: Success = 40% technology + 60% change management. The human element matters! #DigitalTransformation #Leadership',
          linkedin:
            "Excited to share our latest presentation on enterprise digital transformation strategies. After working with 50+ organizations, we've identified the critical success factors that separate leaders from laggards. The key insight? Technology is only 40% of the equation - the rest is change management and cultural transformation.",
        },
        outline: `# ${presentationTitle}
1. Introduction
2. Current Challenges
3. Solution Framework
4. Case Studies
5. Implementation Roadmap
6. ROI Analysis
7. Next Steps`,
        wordCloud: [
          { word: 'transformation', weight: 100 },
          { word: 'digital', weight: 90 },
          { word: 'enterprise', weight: 75 },
          { word: 'cloud', weight: 70 },
          { word: 'strategy', weight: 65 },
          { word: 'innovation', weight: 60 },
          { word: 'scalability', weight: 55 },
          { word: 'agile', weight: 50 },
          { word: 'data', weight: 45 },
          { word: 'automation', weight: 40 },
        ],
        readingTime: 8,
        complexity: 'intermediate',
      });
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'beginner':
        return 'bg-green-100 text-green-700';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-700';
      case 'advanced':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          AI Summary
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Presentation Summarizer
          </DialogTitle>
          <DialogDescription>
            Generate intelligent summaries, key points, and social posts for your presentation
          </DialogDescription>
        </DialogHeader>

        {!summary ? (
          <div className="space-y-6 py-4">
            {/* Options */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Summary Style</Label>
                <Select
                  value={options.style}
                  onValueChange={(value: typeof options.style) =>
                    setOptions((prev) => ({ ...prev, style: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executive">Executive Summary</SelectItem>
                    <SelectItem value="detailed">Detailed Analysis</SelectItem>
                    <SelectItem value="bullet-points">Bullet Points</SelectItem>
                    <SelectItem value="narrative">Narrative Style</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Length</Label>
                <Select
                  value={options.length}
                  onValueChange={(value: typeof options.length) =>
                    setOptions((prev) => ({ ...prev, length: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (Key highlights)</SelectItem>
                    <SelectItem value="medium">Medium (Balanced)</SelectItem>
                    <SelectItem value="long">Long (Comprehensive)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Select
                  value={options.audience}
                  onValueChange={(value: typeof options.audience) =>
                    setOptions((prev) => ({ ...prev, audience: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Audience</SelectItem>
                    <SelectItem value="technical">Technical Team</SelectItem>
                    <SelectItem value="executive">C-Suite / Executives</SelectItem>
                    <SelectItem value="academic">Academic / Research</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <Label>Include Action Items</Label>
                  <Switch
                    checked={options.includeActionItems}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, includeActionItems: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Generate Social Posts</Label>
                  <Switch
                    checked={options.includeSocialPosts}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, includeSocialPosts: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Presentation Info */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{presentationTitle}</p>
                  <p className="text-sm text-muted-foreground">{slideCount} slides</p>
                </div>
                <Button onClick={generateSummary} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Summary
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="slides">Slides</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[500px] mt-4">
              <TabsContent value="summary" className="space-y-6 m-0 pr-4">
                {/* Quick Stats */}
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {summary.readingTime} min read
                  </Badge>
                  <Badge className={getComplexityColor(summary.complexity)}>
                    {summary.complexity}
                  </Badge>
                  <div className="flex gap-1">
                    {summary.hashtags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Executive Summary */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Executive Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{summary.executive}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => copyToClipboard(summary.executive, 'executive')}
                    >
                      {copied === 'executive' ? (
                        <Check className="h-4 w-4 mr-1" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      Copy
                    </Button>
                  </CardContent>
                </Card>

                {/* Key Points */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <List className="h-4 w-4" />
                      Key Points
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {summary.keyPoints.map((point, index) => (

                        <li key={point} className="flex items-start gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {index + 1}
                          </span>
                          <span className="text-muted-foreground">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Talking Points */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Talking Points
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {summary.talkingPoints.map((point, _index) => (

                        <li key={point} className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="slides" className="space-y-4 m-0 pr-4">
                {/* Outline */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Outline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-3 rounded">
                      {summary.outline}
                    </pre>
                  </CardContent>
                </Card>

                {/* Slide Overviews */}
                {summary.slideOverviews.map((slide) => (
                  <Card key={slide.slideNumber}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded bg-primary/10 text-primary text-sm flex items-center justify-center shrink-0">
                          {slide.slideNumber}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium">{slide.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{slide.summary}</p>
                          {slide.keyTakeaway && (
                            <Badge variant="outline" className="mt-2 text-xs">
                              💡 {slide.keyTakeaway}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="actions" className="space-y-6 m-0 pr-4">
                {/* Action Items */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Action Items
                    </CardTitle>
                    <CardDescription>
                      Next steps extracted from the presentation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {summary.actionItems.map((item, _index) => (

                        <li key={item} className="flex items-start gap-3">
                          <input type="checkbox" className="mt-1" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Audience Notes */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Audience Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{summary.audienceNotes}</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="social" className="space-y-6 m-0 pr-4">
                {/* Twitter */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Twitter className="h-4 w-4" />
                      Twitter / X Post
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={summary.socialPost.twitter}
                      readOnly
                      className="resize-none"
                      rows={3}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {summary.socialPost.twitter.length}/280 characters
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(summary.socialPost.twitter, 'twitter')}
                      >
                        {copied === 'twitter' ? (
                          <Check className="h-4 w-4 mr-1" />
                        ) : (
                          <Copy className="h-4 w-4 mr-1" />
                        )}
                        Copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* LinkedIn */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn Post
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={summary.socialPost.linkedin}
                      readOnly
                      className="resize-none"
                      rows={5}
                    />
                    <div className="flex justify-end mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(summary.socialPost.linkedin, 'linkedin')}
                      >
                        {copied === 'linkedin' ? (
                          <Check className="h-4 w-4 mr-1" />
                        ) : (
                          <Copy className="h-4 w-4 mr-1" />
                        )}
                        Copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Hashtags */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Suggested Hashtags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {summary.hashtags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80"
                          onClick={() => copyToClipboard(tag, tag)}
                        >
                          {tag}
                          {copied === tag && <Check className="h-3 w-3 ml-1" />}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="insights" className="space-y-6 m-0 pr-4">
                {/* Word Cloud */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart2 className="h-4 w-4" />
                      Topic Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {summary.wordCloud.map(({ word, weight }) => (
                        <span
                          key={word}
                          className="px-2 py-1 bg-primary/10 text-primary rounded"
                          style={{
                            fontSize: `${Math.max(12, weight / 8)}px`,
                            opacity: 0.5 + weight / 200,
                          }}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-2xl font-bold">{summary.readingTime}</p>
                      <p className="text-sm text-muted-foreground">Min Read Time</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <List className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-2xl font-bold">{summary.keyPoints.length}</p>
                      <p className="text-sm text-muted-foreground">Key Points</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-2xl font-bold">{summary.actionItems.length}</p>
                      <p className="text-sm text-muted-foreground">Action Items</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <Button
                variant="outline"
                onClick={() => setSummary(null)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button onClick={() => setIsOpen(false)}>Done</Button>
              </div>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
