'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  MessageSquareMore, Play, Square, Loader2, ArrowLeft, ThumbsUp, Shield,
  ChevronUp, ChevronDown, Bot, Users, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useLiveQA, useQASession } from '@/hooks/use-new-features';
import Link from 'next/link';

export default function LiveQAPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const { createSession, endSession } = useLiveQA(projectId);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const { data: session } = useQASession(activeSessionId || '');
  const [aiModeration, setAiModeration] = useState(true);
  const [anonymousMode, setAnonymousMode] = useState(false);

  const handleStart = async () => {
    try {
      const result = await createSession.mutateAsync({
        aiModeration,
        anonymousQuestions: anonymousMode,
        maxQuestionsPerUser: 5,
      });
      setActiveSessionId(result.id);
      toast.success('Live Q&A session started!');
    } catch {
      toast.error('Failed to start session');
    }
  };

  const handleEnd = async () => {
    if (!activeSessionId) return;
    try {
      await endSession.mutateAsync(activeSessionId);
      toast.success('Session ended');
      setActiveSessionId(null);
    } catch {
      toast.error('Failed to end session');
    }
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
              <MessageSquareMore className="w-8 h-8 text-primary" />
              Live Q&amp;A
            </h1>
            <p className="text-muted-foreground mt-1">
              AI-moderated audience questions with real-time voting
            </p>
          </div>
        </div>

        {!activeSessionId ? (
          <Card>
            <CardHeader>
              <CardTitle>Start Q&amp;A Session</CardTitle>
              <CardDescription>Configure and launch a live Q&amp;A for your presentation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>AI Moderation</Label>
                  <p className="text-sm text-muted-foreground">Auto-filter spam and inappropriate content</p>
                </div>
                <Switch checked={aiModeration} onCheckedChange={setAiModeration} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Anonymous Questions</Label>
                  <p className="text-sm text-muted-foreground">Allow anonymous submissions</p>
                </div>
                <Switch checked={anonymousMode} onCheckedChange={setAnonymousMode} />
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleStart}
                disabled={createSession.isPending}
              >
                {createSession.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                Start Live Q&amp;A
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="border-green-500">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="font-medium">Session Live</span>
                  <Badge variant="secondary">
                    <Users className="w-3 h-3 mr-1" /> {session?.questions?.length || 0} questions
                  </Badge>
                </div>
                <Button variant="destructive" size="sm" onClick={handleEnd} disabled={endSession.isPending}>
                  <Square className="w-3 h-3 mr-1" /> End Session
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {session?.questions?.map((q: { id: string; content: string; author: string; votes: number; status: string; aiAnswer?: string; createdAt: string }) => (
                <Card key={q.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <span className="text-sm font-medium">{q.votes}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{q.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>{q.author}</span>
                          <span>•</span>
                          <Clock className="w-3 h-3" />
                          <span>{new Date(q.createdAt).toLocaleTimeString()}</span>
                          {q.status === 'flagged' && <Badge variant="destructive" className="text-xs">Flagged</Badge>}
                        </div>
                        {q.aiAnswer && (
                          <div className="mt-3 p-3 bg-primary/5 rounded-lg text-sm">
                            <div className="flex items-center gap-1 text-primary mb-1">
                              <Bot className="w-3 h-3" /> AI Suggested Answer
                            </div>
                            {q.aiAnswer}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!session?.questions || session.questions.length === 0) && (
                <Card className="p-8 text-center">
                  <MessageSquareMore className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground text-sm">Waiting for questions...</p>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
