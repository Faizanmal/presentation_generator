'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search, BookOpen, Sparkles, FileText, CheckCircle2, Loader2,
  ExternalLink, Shield, BarChart3, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useResearch } from '@/hooks/use-new-features';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';

export default function AIResearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const { isAuthenticated } = useAuthStore();
  const { researches, isLoading, startResearch, generateBlocks, factCheck } = useResearch(projectId);
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState('standard');

  const handleStartResearch = () => {
    if (!topic.trim()) return;
    startResearch.mutate(
      { topic, depth },
      {
        onSuccess: () => {
          toast.success('Research started! AI is gathering sources...');
          setTopic('');
        },
        onError: () => toast.error('Failed to start research'),
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Search className="w-8 h-8 text-primary" />
                AI Content Research
              </h1>
              <p className="text-muted-foreground mt-1">
                AI-powered research assistant for your presentations
              </p>
            </div>
          </div>
        </div>

        {/* Research Input */}
        <Card>
          <CardHeader>
            <CardTitle>Start New Research</CardTitle>
            <CardDescription>Enter a topic and let AI find relevant sources, statistics, and content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="Enter research topic (e.g., 'Renewable energy trends 2026')"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartResearch()}
                className="flex-1"
              />
              <Select value={depth} onValueChange={setDepth}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">Quick</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="deep">Deep Dive</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleStartResearch} disabled={startResearch.isPending || !topic.trim()}>
                {startResearch.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Research
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Research Results */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Research History</h2>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : researches?.length ? (
            <div className="grid gap-4">
              {researches.map((research: { id: string; topic: string; status: string; keyFindings: string[]; sources: { id: string }[]; createdAt: string }) => (
                <Card key={research.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{research.topic}</h3>
                          <Badge variant={research.status === 'completed' ? 'default' : 'secondary'}>
                            {research.status}
                          </Badge>
                        </div>
                        {research.keyFindings?.length > 0 && (
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {research.keyFindings.slice(0, 3).map((finding: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <CheckCircle2 className="w-3 h-3 mt-1 text-green-500 shrink-0" />
                                {finding}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> {research.sources?.length || 0} sources
                          </span>
                          <span>{new Date(research.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => factCheck.mutate(research.id, {
                            onSuccess: () => toast.success('Fact-check completed!'),
                          })}
                          disabled={factCheck.isPending}
                        >
                          <Shield className="w-3 h-3 mr-1" /> Fact-Check
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => generateBlocks.mutate(research.id, {
                            onSuccess: () => toast.success('Content blocks generated!'),
                          })}
                          disabled={generateBlocks.isPending}
                        >
                          <FileText className="w-3 h-3 mr-1" /> Generate Slides
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No research yet. Start by entering a topic above.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
