'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  SmilePlus, ArrowLeft, Play, Square, Loader2, Smile, Frown, Meh,
  ThumbsUp, ThumbsDown, TrendingUp, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSentimentAnalysis, useSentimentSession } from '@/hooks/use-new-features';
import Link from 'next/link';

const sentimentEmoji: Record<string, React.ReactNode> = {
  positive: <Smile className="w-5 h-5 text-green-500" />,
  negative: <Frown className="w-5 h-5 text-red-500" />,
  neutral: <Meh className="w-5 h-5 text-amber-500" />,
};

export default function SentimentPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const { startSession } = useSentimentAnalysis(projectId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { data: session } = useSentimentSession(sessionId || '');

  const handleStart = async () => {
    try {
      const result = await startSession.mutateAsync({ source: 'live', language: 'en' });
      setSessionId(result.id);
      toast.success('Sentiment tracking started');
    } catch {
      toast.error('Failed to start session');
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
              <SmilePlus className="w-8 h-8 text-primary" />
              Sentiment Analysis
            </h1>
            <p className="text-muted-foreground mt-1">
              Track audience reactions and engagement in real-time
            </p>
          </div>
        </div>

        {!sessionId ? (
          <Card>
            <CardHeader>
              <CardTitle>Start Sentiment Tracking</CardTitle>
              <CardDescription>Monitor audience sentiment during your presentation</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStart} disabled={startSession.isPending} size="lg" className="w-full">
                {startSession.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                Start Tracking
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Overall Sentiment */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Sentiment</p>
                    <div className="flex items-center gap-2 mt-1">
                      {sentimentEmoji[session?.overallSentiment || 'neutral']}
                      <span className="text-2xl font-bold capitalize">{session?.overallSentiment || 'Neutral'}</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg px-4 py-1">
                    {session?.score ?? 0}/100
                  </Badge>
                </div>
                <Progress value={session?.score ?? 50} className="h-3" />
              </CardContent>
            </Card>

            {/* Emotion Breakdown */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Smile className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{session?.emotions?.positive ?? 0}%</p>
                  <p className="text-sm text-muted-foreground">Positive</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Meh className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{session?.emotions?.neutral ?? 0}%</p>
                  <p className="text-sm text-muted-foreground">Neutral</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Frown className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{session?.emotions?.negative ?? 0}%</p>
                  <p className="text-sm text-muted-foreground">Negative</p>
                </CardContent>
              </Card>
            </div>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Sentiment Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {session?.dataPoints?.length > 0 ? (
                  <div className="space-y-2">
                    {session.dataPoints.slice(-10).map((dp: { timestamp: string; score: number; label: string }, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-16">
                          {new Date(dp.timestamp).toLocaleTimeString()}
                        </span>
                        <div className="flex-1">
                          <Progress value={dp.score} className="h-2" />
                        </div>
                        <span className="text-xs w-10 text-right">{dp.score}%</span>
                        {sentimentEmoji[dp.label] || sentimentEmoji.neutral}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    Collecting data points...
                  </p>
                )}
              </CardContent>
            </Card>

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setSessionId(null)}
            >
              <Square className="w-4 h-4 mr-2" /> Stop Tracking
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
