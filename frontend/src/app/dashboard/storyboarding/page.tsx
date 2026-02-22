'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Layout, Sparkles, Loader2, ArrowLeft, BookTemplate,
  ArrowRight, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStoryboards } from '@/hooks/use-new-features';
import Link from 'next/link';

const narrativeArcs = [
  { value: 'hero-journey', label: "Hero's Journey" },
  { value: 'problem-solution', label: 'Problem → Solution' },
  { value: 'chronological', label: 'Chronological' },
  { value: 'compare-contrast', label: 'Compare & Contrast' },
];

const audienceTypes = [
  { value: 'executives', label: 'Executives' },
  { value: 'technical', label: 'Technical Team' },
  { value: 'investors', label: 'Investors' },
  { value: 'general', label: 'General Audience' },
];

interface StoryboardSection {
  id?: string;
  title: string;
  order?: number;
  duration: number;
}

interface StoryboardItem {
  id: string;
  title: string;
  narrativeArc: string;
  status: string;
  sections?: StoryboardSection[];
  content?: { sections?: StoryboardSection[] };
}

export default function StoryboardingPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const { storyboards, isLoading, createStoryboard, applyStoryboard } = useStoryboards(projectId);
  const [title, setTitle] = useState('');
  const [arc, setArc] = useState('problem-solution');
  const [audience, setAudience] = useState('general');

  const handleCreate = () => {
    if (!title.trim()) { return; }
    createStoryboard.mutate(
      { title, narrativeArc: arc, audienceType: audience },
      {
        onSuccess: () => {
          toast.success('Storyboard created with AI!');
          setTitle('');
        },
        onError: () => toast.error('Failed to create storyboard'),
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Layout className="w-8 h-8 text-primary" />
              AI Storyboarding
            </h1>
            <p className="text-muted-foreground mt-1">
              Create compelling narrative structures with AI assistance
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create New Storyboard</CardTitle>
            <CardDescription>Choose a narrative arc and audience to generate an AI-powered storyboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Storyboard title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="flex gap-3">
              <Select value={arc} onValueChange={setArc}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Narrative Arc" />
                </SelectTrigger>
                <SelectContent>
                  {narrativeArcs.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Audience" />
                </SelectTrigger>
                <SelectContent>
                  {audienceTypes.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} disabled={createStoryboard.isPending || !title.trim()}>
                {createStoryboard.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Storyboards</h2>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : storyboards?.length ? (
            storyboards.map((sb: StoryboardItem) => (
              <Card key={sb.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{typeof sb.title === 'string' ? sb.title : 'Untitled Storyboard'}</h3>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">{typeof sb.narrativeArc === 'string' ? sb.narrativeArc : 'Custom'}</Badge>
                        <Badge variant={sb.status === 'completed' ? 'default' : 'secondary'}>{typeof sb.status === 'string' ? sb.status : 'Draft'}</Badge>
                      </div>
                    </div>
                    <Button
                      onClick={() => applyStoryboard.mutate(sb.id, {
                        onSuccess: () => toast.success('Storyboard applied to presentation!'),
                      })}
                      disabled={applyStoryboard.isPending}
                    >
                      <ArrowRight className="w-4 h-4 mr-2" /> Apply to Slides
                    </Button>
                  </div>
                  {/* Ensure sections is an array before mapping */}
                  {Array.isArray(sb.sections) && sb.sections.length > 0 ? (
                    <div className="space-y-2">
                      {sb.sections.map((section: StoryboardSection, idx: number) => (
                        <div key={section.id || `section-${idx}`} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{(section.order || idx) + 1}.</span>
                          <span className="text-sm flex-1">{typeof section.title === 'string' ? section.title : 'Untitled Section'}</span>
                          <span className="text-xs text-muted-foreground">{section.duration}min</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Fallback if sections is wrapped or structure is different
                    Array.isArray(sb.content?.sections) && (
                      <div className="space-y-2">
                        {sb.content.sections.map((section: StoryboardSection, idx: number) => (
                          <div key={section.id || `fallback-section-${idx}`} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{idx + 1}.</span>
                            <span className="text-sm flex-1">{section.title}</span>
                            <span className="text-xs text-muted-foreground">{section.duration}min</span>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <BookTemplate className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No storyboards yet. Create one above.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
