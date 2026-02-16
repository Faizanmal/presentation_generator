'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { FlaskConical, Plus, Loader2, ArrowLeft, BarChart3, TrendingUp, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useABTests, useABTestResults } from '@/hooks/use-new-features';
import Link from 'next/link';

export default function ABTestingPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const { tests, isLoading, createTest } = useABTests(projectId);
  const [name, setName] = useState('');
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const { data: results } = useABTestResults(selectedTestId || '');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FlaskConical className="w-8 h-8 text-primary" />
              A/B Testing
            </h1>
            <p className="text-muted-foreground mt-1">
              Test different design variants and find what works best
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create New Test</CardTitle>
            <CardDescription>Compare design variants to optimize engagement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Test name (e.g., 'Color scheme test')"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => {
                  createTest.mutate(
                    { name, variants: [{ name: 'Variant A' }, { name: 'Variant B' }] },
                    {
                      onSuccess: () => { toast.success('A/B test created!'); setName(''); },
                      onError: () => toast.error('Failed to create test'),
                    },
                  );
                }}
                disabled={createTest.isPending || !name.trim()}
              >
                {createTest.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Test
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Results Panel */}
        {selectedTestId && results && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> Test Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {results.variants?.map((v: { id: string; name: string; impressions: number; engagementScore: number }, i: number) => (
                  <div key={v.id} className={`p-4 rounded-lg border ${i === 0 ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-muted'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{v.name}</span>
                      {i === 0 && <Trophy className="w-4 h-4 text-green-500" />}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Impressions</span>
                        <span className="font-medium">{v.impressions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Engagement</span>
                        <span className="font-medium">{v.engagementScore}%</span>
                      </div>
                      <Progress value={v.engagementScore} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
              {results.statisticalSignificance && (
                <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
                  <span className="font-medium">Statistical Significance:</span>{' '}
                  <Badge variant={results.isSignificant ? 'default' : 'secondary'}>
                    {results.statisticalSignificance}% confidence
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Active Tests</h2>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : tests?.length ? (
            tests.map((test: { id: string; name: string; status: string; variants: { id: string; name: string; impressions: number }[]; createdAt: string }) => (
              <Card key={test.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedTestId(test.id)}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{test.name}</h3>
                      <div className="flex gap-2 mt-1">
                        <Badge variant={test.status === 'running' ? 'default' : 'secondary'}>{test.status}</Badge>
                        <span className="text-xs text-muted-foreground">{test.variants?.length || 0} variants</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <TrendingUp className="w-4 h-4" />
                      {test.variants?.reduce((sum: number, v: { impressions: number }) => sum + v.impressions, 0) || 0} impressions
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No A/B tests yet.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
