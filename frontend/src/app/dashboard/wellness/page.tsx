'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  HeartPulse, ArrowLeft, Loader2, Play, Square, Timer, Brain,
  Activity, Coffee, TrendingUp, AlertTriangle, Smile,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePresenterWellness } from '@/hooks/use-new-features';
import Link from 'next/link';

export default function WellnessPage() {
  const {
    startSession, endSession, recordBreak, analyzePace,
    detectStress, history, trends, breakReminders,
  } = usePresenterWellness();
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleStart = async () => {
    try {
      const result = await startSession.mutateAsync({
        type: 'presentation',
        breakInterval: 20,
      });
      setSessionId(result.id);
      toast.success('Wellness session started');
    } catch {
      toast.error('Failed to start session');
    }
  };

  const handleEnd = async () => {
    if (!sessionId) return;
    try {
      await endSession.mutateAsync(sessionId);
      setSessionId(null);
      toast.success('Session ended. Great job taking care of yourself!');
    } catch {
      toast.error('Failed to end session');
    }
  };

  const handleBreak = async () => {
    if (!sessionId) return;
    try {
      await recordBreak.mutateAsync({ sessionId, duration: 5, type: 'short' });
      toast.success('Break recorded. Well done!');
    } catch {
      toast.error('Failed to record break');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <HeartPulse className="w-8 h-8 text-red-500" />
              Presenter Wellness
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor stress, pacing, and well-being during presentations
            </p>
          </div>
        </div>

        {/* Session Control */}
        <Card>
          <CardContent className="p-6">
            {!sessionId ? (
              <Button onClick={handleStart} disabled={startSession.isPending} size="lg" className="w-full">
                {startSession.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                Start Wellness Tracking
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="font-medium">Session Active</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleBreak}>
                      <Coffee className="w-4 h-4 mr-2" /> Take Break
                    </Button>
                    <Button variant="destructive" onClick={handleEnd} disabled={endSession.isPending}>
                      <Square className="w-4 h-4 mr-2" /> End Session
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Break Reminders */}
        {breakReminders.data?.upcoming && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Timer className="w-5 h-5 text-amber-500" />
              <div>
                <p className="font-medium text-sm">Next break in {breakReminders.data.upcoming.minutesUntil} minutes</p>
                <p className="text-xs text-muted-foreground">{breakReminders.data.upcoming.suggestion}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trends */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Activity className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{trends.data?.avgPace || 0}</p>
              <p className="text-xs text-muted-foreground">Avg. Words/Min</p>
              <p className="text-xs mt-1">
                {(trends.data?.avgPace || 0) > 150 ? (
                  <span className="text-amber-500">Slow down a bit</span>
                ) : (trends.data?.avgPace || 0) < 100 ? (
                  <span className="text-amber-500">Pick up the pace</span>
                ) : (
                  <span className="text-green-500">Good pace!</span>
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Brain className="w-6 h-6 mx-auto text-purple-500 mb-2" />
              <p className="text-2xl font-bold">{trends.data?.stressLevel || 'Low'}</p>
              <p className="text-xs text-muted-foreground">Stress Level</p>
              <Progress value={trends.data?.stressScore || 20} className="mt-2 h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Smile className="w-6 h-6 mx-auto text-green-500 mb-2" />
              <p className="text-2xl font-bold">{trends.data?.wellnessScore || 0}/100</p>
              <p className="text-xs text-muted-foreground">Wellness Score</p>
              <Progress value={trends.data?.wellnessScore || 0} className="mt-2 h-2" />
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> Session History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.data?.map((s: { id: string; date: string; duration: number; breaks: number; stressLevel: string; score: number }) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{new Date(s.date).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.duration} min • {s.breaks} breaks
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={s.stressLevel === 'low' ? 'secondary' : s.stressLevel === 'medium' ? 'default' : 'destructive'} className="text-xs">
                      {s.stressLevel} stress
                    </Badge>
                    <span className="text-sm font-medium">{s.score}/100</span>
                  </div>
                </div>
              ))}
              {(!history.data || history.data.length === 0) && (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No sessions yet. Start tracking to see your wellness history.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
