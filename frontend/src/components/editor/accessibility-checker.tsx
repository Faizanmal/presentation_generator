'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Accessibility,
  Eye,
  Type,
  Contrast,
  Image as ImageIcon,
  Check,
  X,
  AlertTriangle,
  Info,
  Loader2,
  Wand2,
  Download,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AccessibilityIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: 'contrast' | 'text' | 'images' | 'structure' | 'motion';
  title: string;
  description: string;
  slideIndex?: number;
  blockId?: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  wcagCriteria: string;
  autoFixAvailable: boolean;
  howToFix: string;
}

interface AccessibilityReport {
  score: number;
  level: 'A' | 'AA' | 'AAA' | 'Fail';
  issues: AccessibilityIssue[];
  passedChecks: number;
  totalChecks: number;
  categories: {
    contrast: { passed: number; failed: number };
    text: { passed: number; failed: number };
    images: { passed: number; failed: number };
    structure: { passed: number; failed: number };
    motion: { passed: number; failed: number };
  };
}

interface AccessibilityCheckerProps {
  projectId: string;
  slides: Array<{
    id: string;
    blocks: Array<{
      id: string;
      type: string;
      content: Record<string, unknown>;
    }>;
  }>;
}

const categoryIcons: Record<string, React.ReactNode> = {
  contrast: <Contrast className="h-4 w-4" />,
  text: <Type className="h-4 w-4" />,
  images: <ImageIcon className="h-4 w-4" />,
  structure: <FileText className="h-4 w-4" />,
  motion: <Eye className="h-4 w-4" />,
};

const categoryLabels: Record<string, string> = {
  contrast: 'Color Contrast',
  text: 'Text & Readability',
  images: 'Images & Media',
  structure: 'Structure & Navigation',
  motion: 'Motion & Animation',
};

export function AccessibilityChecker({ }: AccessibilityCheckerProps) {
  const [report, setReport] = useState<AccessibilityReport | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const checkMutation = useMutation({
    mutationFn: async () => {
      // Simulate accessibility check
      await new Promise((r) => setTimeout(r, 2000));

      // Mock report
      const mockReport: AccessibilityReport = {
        score: 78,
        level: 'AA',
        passedChecks: 28,
        totalChecks: 36,
        issues: [
          {
            id: '1',
            type: 'error',
            category: 'contrast',
            title: 'Insufficient color contrast',
            description: 'Text color #888888 on background #ffffff has a contrast ratio of 3.5:1, which is below the required 4.5:1 for normal text.',
            slideIndex: 2,
            wcagLevel: 'AA',
            wcagCriteria: '1.4.3',
            autoFixAvailable: true,
            howToFix: 'Darken the text color to at least #767676 to meet the 4.5:1 contrast ratio.',
          },
          {
            id: '2',
            type: 'error',
            category: 'images',
            title: 'Missing alt text',
            description: 'Image on slide 3 does not have alternative text, making it inaccessible to screen readers.',
            slideIndex: 3,
            wcagLevel: 'A',
            wcagCriteria: '1.1.1',
            autoFixAvailable: false,
            howToFix: 'Add descriptive alt text that conveys the meaning or purpose of the image.',
          },
          {
            id: '3',
            type: 'warning',
            category: 'text',
            title: 'Small font size',
            description: 'Text is 12px which may be difficult to read. Recommended minimum is 16px for body text.',
            slideIndex: 4,
            wcagLevel: 'AAA',
            wcagCriteria: '1.4.8',
            autoFixAvailable: true,
            howToFix: 'Increase font size to at least 16px for better readability.',
          },
          {
            id: '4',
            type: 'warning',
            category: 'structure',
            title: 'Missing heading hierarchy',
            description: 'Slide jumps from H1 to H3 without an H2, which may confuse screen reader users.',
            slideIndex: 5,
            wcagLevel: 'AA',
            wcagCriteria: '1.3.1',
            autoFixAvailable: true,
            howToFix: 'Ensure headings follow a logical hierarchy (H1, H2, H3, etc.).',
          },
          {
            id: '5',
            type: 'info',
            category: 'motion',
            title: 'Animation may cause discomfort',
            description: 'Consider providing a way to reduce or disable animations for users with vestibular disorders.',
            wcagLevel: 'AAA',
            wcagCriteria: '2.3.3',
            autoFixAvailable: false,
            howToFix: 'Add a "reduce motion" option or use CSS prefers-reduced-motion media query.',
          },
        ],
        categories: {
          contrast: { passed: 5, failed: 1 },
          text: { passed: 7, failed: 1 },
          images: { passed: 4, failed: 1 },
          structure: { passed: 8, failed: 1 },
          motion: { passed: 4, failed: 0 },
        },
      };

      return mockReport;
    },
    onSuccess: (data) => {
      setReport(data);
    },
  });

  const autoFixMutation = useMutation({
    mutationFn: async (_issueId: string) => {
      void _issueId;
      await new Promise((r) => setTimeout(r, 1000));
      return { success: true };
    },
    onSuccess: (_, issueId) => {
      if (report) {
        setReport({
          ...report,
          issues: report.issues.filter((i) => i.id !== issueId),
          passedChecks: report.passedChecks + 1,
          score: Math.min(100, report.score + 3),
        });
      }
      toast.success('Issue fixed automatically');
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) {return 'text-green-600';}
    if (score >= 70) {return 'text-yellow-600';}
    return 'text-red-600';
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'AAA':
        return <Badge className="bg-green-500">WCAG AAA</Badge>;
      case 'AA':
        return <Badge className="bg-blue-500">WCAG AA</Badge>;
      case 'A':
        return <Badge className="bg-yellow-500">WCAG A</Badge>;
      default:
        return <Badge variant="destructive">Needs Work</Badge>;
    }
  };

  const getIssueIcon = (type: AccessibilityIssue['type']) => {
    switch (type) {
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const exportReport = () => {
    toast.success('Accessibility report exported');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Accessibility className="h-5 w-5 text-blue-500" />
              Accessibility Checker
            </h2>
            <p className="text-sm text-slate-500">
              Ensure your presentation is accessible to everyone
            </p>
          </div>
          <Button
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending}
          >
            {checkMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Run Check
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {!report && !checkMutation.isPending && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Accessibility className="h-16 w-16 text-slate-300 mb-4" />
            <h3 className="font-medium text-lg mb-2">Check Accessibility</h3>
            <p className="text-sm text-slate-500 max-w-md mb-6">
              Run an accessibility check to identify issues that might prevent
              some users from accessing your content effectively.
            </p>
            <div className="grid grid-cols-2 gap-4 text-left max-w-sm text-sm">
              <div className="flex items-start gap-2">
                <Contrast className="h-4 w-4 text-blue-500 mt-0.5" />
                <span>Color contrast</span>
              </div>
              <div className="flex items-start gap-2">
                <Type className="h-4 w-4 text-blue-500 mt-0.5" />
                <span>Text readability</span>
              </div>
              <div className="flex items-start gap-2">
                <ImageIcon className="h-4 w-4 text-blue-500 mt-0.5" />
                <span>Image alt text</span>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-blue-500 mt-0.5" />
                <span>Heading structure</span>
              </div>
            </div>
          </div>
        )}

        {checkMutation.isPending && (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
            <p className="text-slate-600">Checking accessibility...</p>
            <p className="text-sm text-slate-400">This may take a moment</p>
          </div>
        )}

        {report && (
          <div className="p-4 space-y-6">
            {/* Score Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-6">
                  <div
                    className={cn(
                      'w-20 h-20 rounded-full border-4 flex items-center justify-center text-2xl font-bold',
                      report.score >= 90
                        ? 'border-green-500'
                        : report.score >= 70
                          ? 'border-yellow-500'
                          : 'border-red-500'
                    )}
                  >
                    <span className={getScoreColor(report.score)}>{report.score}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">Accessibility Score</span>
                      {getLevelBadge(report.level)}
                    </div>
                    <Progress value={report.score} className="h-2 mb-2" />
                    <p className="text-sm text-slate-500">
                      {report.passedChecks} of {report.totalChecks} checks passed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(report.categories).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                        {categoryIcons[key]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            {categoryLabels[key]}
                          </span>
                          <span className="text-sm text-slate-500">
                            {value.passed}/{value.passed + value.failed}
                          </span>
                        </div>
                        <Progress
                          value={(value.passed / (value.passed + value.failed)) * 100}
                          className="h-1.5"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Issues */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">
                  Issues ({report.issues.length})
                </h3>
                <Button variant="outline" size="sm" onClick={exportReport}>
                  <Download className="h-3 w-3 mr-1" />
                  Export Report
                </Button>
              </div>

              {report.issues.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Check className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="font-medium">All checks passed!</p>
                    <p className="text-sm text-slate-500">
                      Your presentation meets accessibility standards.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Accordion
                  type="single"
                  collapsible
                  value={expandedIssue || undefined}
                  onValueChange={(v) => setExpandedIssue(v)}
                >
                  {report.issues.map((issue) => (
                    <AccordionItem key={issue.id} value={issue.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          {getIssueIcon(issue.type)}
                          <div>
                            <div className="font-medium">{issue.title}</div>
                            <div className="text-sm text-slate-500 flex items-center gap-2">
                              {issue.slideIndex !== undefined && (
                                <span>Slide {issue.slideIndex + 1}</span>
                              )}
                              <Badge variant="outline" className="text-xs">
                                WCAG {issue.wcagCriteria}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pl-7 space-y-3">
                          <p className="text-sm text-slate-600">
                            {issue.description}
                          </p>
                          <div className="bg-slate-50 p-3 rounded-lg">
                            <p className="text-sm font-medium mb-1">How to fix:</p>
                            <p className="text-sm text-slate-600">{issue.howToFix}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {issue.autoFixAvailable && (
                              <Button
                                size="sm"
                                onClick={() => autoFixMutation.mutate(issue.id)}
                                disabled={autoFixMutation.isPending}
                              >
                                {autoFixMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Wand2 className="h-3 w-3 mr-1" />
                                )}
                                Auto-fix
                              </Button>
                            )}
                            <Button variant="outline" size="sm">
                              Go to Slide
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
