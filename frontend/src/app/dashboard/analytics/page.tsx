'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  BarChart3,
  ArrowLeft,
  Loader2,
  TrendingUp,
  Users,
  Eye,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

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

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const [activeTab, setActiveTab] = useState('overview');

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
              {projectId
                ? 'Presentation-level insights and engagement metrics'
                : 'Workspace-wide analytics and performance overview'}
            </p>
          </div>
        </div>

        {projectId && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            Project: {projectId.slice(0, 8)}…
          </Badge>
        )}
      </div>

      {/* No project selected – show workspace summary cards */}
      {!projectId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: 'Total Views',
              icon: Eye,
              value: '—',
              desc: 'Select a project to see data',
              color: 'text-blue-500',
            },
            {
              title: 'Unique Viewers',
              icon: Users,
              value: '—',
              desc: 'Select a project to see data',
              color: 'text-green-500',
            },
            {
              title: 'Avg. Engagement',
              icon: TrendingUp,
              value: '—',
              desc: 'Select a project to see data',
              color: 'text-purple-500',
            },
            {
              title: 'Locations',
              icon: Globe,
              value: '—',
              desc: 'Select a project to see data',
              color: 'text-orange-500',
            },
          ].map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  {stat.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
              </CardContent>
            </Card>
          ))}

          <Card className="sm:col-span-2 lg:col-span-4">
            <CardHeader>
              <CardTitle>Get Started with Analytics</CardTitle>
              <CardDescription>
                Open a presentation from your dashboard and view its analytics, or navigate to{' '}
                <Link href="/dashboard/analytics/team" className="text-primary underline underline-offset-2">
                  Team Analytics
                </Link>{' '}
                for workspace-wide insights.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3 flex-wrap">
              <Link href="/dashboard">
                <Button variant="outline">Go to Dashboard</Button>
              </Link>
              <Link href="/dashboard/analytics/team">
                <Button>View Team Analytics</Button>
              </Link>
            </CardContent>
          </Card>
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
