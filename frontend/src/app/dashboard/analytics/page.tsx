'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  ArrowLeft,
  Loader2,
  TrendingUp,
  Users,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { FEATURES } from '@/lib/features';
import { SoonBadge } from '@/components/ui/soon-badge';
import type { Project } from '@/types';

// Dynamically import heavy analytics components
const EnhancedAnalyticsDashboard = dynamic(
  () => import('@/components/analytics').then((m) => m.EnhancedAnalyticsDashboard),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    ),
    ssr: false,
  },
);

const AudienceAnalyticsDashboard = dynamic(
  () => import('@/components/analytics').then((m) => m.AudienceAnalyticsDashboard),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    ),
    ssr: false,
  },
);

const InsightsDashboard = dynamic(
  () => import('@/components/analytics').then((m) => m.InsightsDashboard),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    ),
    ssr: false,
  },
);

function pickLatestProject(projects: Project[]): Project | undefined {
  if (!projects.length) {return undefined;}
  return [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
}

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('projectId') || '';
  const [activeTab, setActiveTab] = useState('overview');

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.projects.getAll(),
  });

  useEffect(() => {
    if (projectId || projectsLoading || !projects?.length) {return;}
    const latest = pickLatestProject(projects);
    if (latest) {
      router.replace(`/dashboard/analytics?projectId=${latest.id}`);
    }
  }, [projectId, projects, projectsLoading, router]);

  const selectedProject = projects?.find((p) => p.id === projectId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-primary" />
              Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              {projectId && selectedProject
                ? `Insights for "${selectedProject.title}"`
                : projectId
                  ? 'Presentation-level insights and engagement metrics'
                  : 'Pick a presentation to see analytics.'}
            </p>
          </div>
        </div>

        {projectId && (
          <Badge variant="secondary" className="text-sm px-3 py-1 max-w-[12rem] truncate">
            {selectedProject?.title || `Project ${projectId.slice(0, 8)}…`}
          </Badge>
        )}
      </div>

      {!projectId && projectsLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!projectId && !projectsLoading && !projects?.length && (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <FileText className="h-6 w-6 text-slate-400" />
            </div>
            <CardTitle>Pick a presentation to see analytics.</CardTitle>
            <CardDescription>
              Create or open a deck from your dashboard, then return here for views, engagement, and audience insights.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-3 flex-wrap pb-8">
            <Link href="/dashboard">
              <Button>Create or open a presentation</Button>
            </Link>
            <Link href="/dashboard/team-analytics">
              <Button variant="outline" className="gap-2">
                Team Analytics
                {!FEATURES.teamAnalytics && <SoonBadge />}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!projectId && !projectsLoading && projects && projects.length > 0 && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading analytics for your latest presentation…
        </div>
      )}

      {/* Project-level analytics */}
      {projectId && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="audience" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Audience
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <EnhancedAnalyticsDashboard projectId={projectId} />
          </TabsContent>

          <TabsContent value="audience">
            <AudienceAnalyticsDashboard projectId={projectId} />
          </TabsContent>

          <TabsContent value="insights">
            <InsightsDashboard projectId={projectId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
