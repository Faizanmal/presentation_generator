'use client';

import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ScanEye, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Globe, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUniversalDesign } from '@/hooks/use-new-features';

const severityColor: Record<string, string> = {
  critical: 'text-red-500 bg-red-500/10',
  major: 'text-orange-500 bg-orange-500/10',
  minor: 'text-amber-500 bg-amber-500/10',
  info: 'text-blue-500 bg-blue-500/10',
};

export default function UniversalDesignPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const { checkDesign, report, culturalGuide } = useUniversalDesign(projectId);

  const handleCheck = async () => {
    if (!projectId) {
      toast.error('Select a project first');
      return;
    }
    try {
      await checkDesign.mutateAsync({ guidelines: ['WCAG2.1', 'Section508', 'EN301549'] });
      toast.success('Design check complete');
    } catch {
      toast.error('Failed to run design check');
    }
  };

  return (
    <div className="max-w-3xl p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScanEye className="w-6 h-6 text-primary" />
          Universal Design
        </h1>
        <p className="text-muted-foreground mt-1">
          Check accessibility compliance and cultural inclusivity
        </p>
      </div>

      {/* Run Check */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Accessibility Audit</CardTitle>
          <CardDescription>Scan presentation for WCAG 2.1, Section 508 & EN 301549 compliance</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleCheck}
            disabled={checkDesign.isPending}
            className="w-full"
          >
            {checkDesign.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Run Accessibility Check
          </Button>
        </CardContent>
      </Card>

      {/* Report */}
      {report.data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Compliance Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-4xl font-bold">{report.data.score}</p>
                  <p className="text-sm text-muted-foreground">/100</p>
                </div>
                <div className="flex-1">
                  <Progress value={report.data.score} className="h-3 mb-2" />
                  <div className="flex gap-2">
                    {report.data.passed && (
                      <Badge className="bg-green-500/10 text-green-600">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> {report.data.passed} passed
                      </Badge>
                    )}
                    {report.data.failed > 0 && (
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" /> {report.data.failed} failed
                      </Badge>
                    )}
                    {report.data.warnings > 0 && (
                      <Badge variant="outline" className="text-amber-500 border-amber-500">
                        <AlertTriangle className="w-3 h-3 mr-1" /> {report.data.warnings} warnings
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {report.data.issues?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Issues Found</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.data.issues.map((issue: { id: string; title: string; description: string; severity: string; guideline: string; slide?: number }) => (
                  <div key={issue.id} className="p-3 rounded-lg border">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-xs ${severityColor[issue.severity] || ''}`}>
                        {issue.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{issue.guideline}</Badge>
                      {issue.slide && <span className="text-xs text-muted-foreground">Slide {issue.slide}</span>}
                    </div>
                    <p className="font-medium text-sm">{issue.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Cultural Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5" /> Cultural Inclusivity Guide
          </CardTitle>
          <CardDescription>Region-specific design recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          {culturalGuide.data ? (
            <div className="space-y-3">
              {culturalGuide.data.tips?.map((tip: { title: string; description: string }) => (
                <div key={tip.title} className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-sm">{tip.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{tip.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading cultural guide...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
