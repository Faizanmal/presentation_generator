'use client';

import { useSearchParams } from 'next/navigation';
import {
  TrendingUp, ArrowLeft, Brain, BarChart3, Lightbulb,
  ArrowUpRight, ArrowDownRight, Minus, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePredictiveAnalytics } from '@/hooks/use-new-features';
import Link from 'next/link';

const trendIcon = (t: string) =>
  t === 'up' ? <ArrowUpRight className="w-4 h-4 text-green-500" /> :
  t === 'down' ? <ArrowDownRight className="w-4 h-4 text-red-500" /> :
  <Minus className="w-4 h-4 text-muted-foreground" />;

export default function PredictiveAnalyticsPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const { insights, recommendations, benchmarks } = usePredictiveAnalytics(projectId);
  // `insights`, `recommendations`, and `benchmarks` are React Query objects now

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-primary" />
              Predictive Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              AI-powered insights and performance predictions
            </p>
          </div>
        </div>

        {/* Insights */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Brain className="w-5 h-5" /> Predictive Insights
          </h2>
          {insights.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {insights.data?.map((i: { id: string; metric: string; predicted: number; confidence: number; trend: string; description: string }) => (
                <Card key={i.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">{i.metric}</span>
                      {trendIcon(i.trend)}
                    </div>
                    <p className="text-2xl font-bold">{i.predicted}%</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={i.confidence} className="flex-1" />
                      <span className="text-xs text-muted-foreground">{i.confidence}% conf.</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{i.description}</p>
                  </CardContent>
                </Card>
              ))}
              {(!insights.data || insights.data.length === 0) && (
                <Card className="col-span-full p-8 text-center">
                  <Brain className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground text-sm">No insights available. Present more to generate predictions.</p>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Lightbulb className="w-5 h-5" /> AI Recommendations
          </h2>
          <div className="space-y-3">
            {recommendations.data?.map((r: { id: string; title: string; description: string; impact: string; priority: string }) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{r.title}</p>
                      <Badge variant={r.priority === 'high' ? 'destructive' : r.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                        {r.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                    <p className="text-xs text-primary mt-1">Expected impact: {r.impact}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Benchmarks */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Industry Benchmarks
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {benchmarks.data?.map((b: { id: string; metric: string; yourScore: number; industryAvg: number; topPerformer: number }) => (
              <Card key={b.id}>
                <CardContent className="p-4">
                  <p className="text-sm font-medium mb-3">{b.metric}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Your Score</span>
                      <span className="font-medium">{b.yourScore}%</span>
                    </div>
                    <Progress value={b.yourScore} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Avg: {b.industryAvg}%</span>
                      <span>Top: {b.topPerformer}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
