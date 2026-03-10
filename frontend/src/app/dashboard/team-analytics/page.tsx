"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Users,
  Activity,
  Clock,
  ChevronLeft,
  Loader2,
  Filter,
  Calendar,
  FileText,
  Presentation,
  Edit,
  Trash2,
  Share2,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";

const actionIcons: Record<string, React.ReactNode> = {
  CREATE: <FileText className="h-4 w-4 text-green-500" />,
  UPDATE: <Edit className="h-4 w-4 text-blue-500" />,
  DELETE: <Trash2 className="h-4 w-4 text-red-500" />,
  SHARE: <Share2 className="h-4 w-4 text-purple-500" />,
  COMMENT: <MessageSquare className="h-4 w-4 text-yellow-500" />,
  PRESENT: <Presentation className="h-4 w-4 text-indigo-500" />,
};

export default function TeamAnalyticsPage() {
  const [dateRange, setDateRange] = useState("7d");
  const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch activity logs
  const { data: activityData, isLoading } = useQuery({
    queryKey: ["team-analytics", dateRange, actionFilter, searchQuery],
    queryFn: () =>
      api.teamAnalytics.getActivityLogs({
        period: dateRange,
        action: actionFilter !== "all" ? actionFilter : undefined,
        search: searchQuery || undefined,
      }),
  });

  // Fetch team stats
  const { data: teamStats } = useQuery({
    queryKey: ["team-analytics-stats", dateRange],
    queryFn: () => api.teamAnalytics.getStats(dateRange),
  });

  const activities = activityData?.logs || [];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  Team Analytics
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Active Members
                  </p>
                  <p className="text-2xl font-bold">
                    {teamStats?.activeMembers ?? 0}
                  </p>
                </div>
                <Users className="h-8 w-8 text-cyan-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Activities
                  </p>
                  <p className="text-2xl font-bold">
                    {teamStats?.totalActivities ?? 0}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Projects Modified
                  </p>
                  <p className="text-2xl font-bold">
                    {teamStats?.projectsModified ?? 0}
                  </p>
                </div>
                <Presentation className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Daily Activity</p>
                  <p className="text-2xl font-bold">
                    {teamStats?.avgDailyActivity ?? 0}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="CREATE">Created</SelectItem>
                  <SelectItem value="UPDATE">Updated</SelectItem>
                  <SelectItem value="DELETE">Deleted</SelectItem>
                  <SelectItem value="SHARE">Shared</SelectItem>
                  <SelectItem value="COMMENT">Commented</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Feed</CardTitle>
            <CardDescription>
              Recent team activity across all projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !activities.length ? (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">No Activity</h3>
                <p className="text-muted-foreground">
                  No team activity found for the selected period.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map(
                  (activity: {
                    id: string;
                    action: string;
                    description?: string;
                    userId?: string;
                    userName?: string;
                    user?: { name?: string; avatar?: string };
                    target?: string;
                    resourceType?: string;
                    resourceName?: string;
                    timestamp?: string;
                    createdAt?: string;
                    details?: string;
                  }) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 p-4 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      <div className="mt-1">
                        {actionIcons[activity.action] || (
                          <Activity className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          <span className="font-semibold">
                            {activity.userName || activity.user?.name || "Unknown User"}
                          </span>{" "}
                          {activity.description || activity.details ||
                            `${activity.action.toLowerCase()} ${activity.target || activity.resourceType || "item"}`}
                        </p>
                        {(activity.resourceName || activity.target) && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {activity.resourceName || activity.target}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(activity.timestamp || activity.createdAt || '').toLocaleString()}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {activity.action}
                      </Badge>
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
