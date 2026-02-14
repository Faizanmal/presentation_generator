"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    ChevronLeft,
    TrendingUp,
    Activity,
    BarChart3,
    PieChart,
    Calendar,
    Download,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

interface TeamMember {
    userId: string;
    userName: string;
    projectsCreated: number;
    slidesCreated: number;
    avatar?: string;
}

interface ActivityItem {
    action: string;
    timestamp: string;
    userId: string;
    targetType: string;
    userName?: string;
}

export default function TeamAnalyticsPage() {
    const { } = useAuthStore();
    const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">("30d");
    const [activeTab, setActiveTab] = useState("overview");

    // Get org ID from current user context
    const orgId = "current"; // In real app, this would come from org context

    // Calculate date range
    const dateRange = useMemo(() => {
        const end = new Date();
        const start = new Date();
        switch (timeRange) {
            case "7d":
                start.setDate(start.getDate() - 7);
                break;
            case "30d":
                start.setDate(start.getDate() - 30);
                break;
            case "90d":
                start.setDate(start.getDate() - 90);
                break;
            case "1y":
                start.setFullYear(start.getFullYear() - 1);
                break;
        }
        return {
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
        };
    }, [timeRange]);

    // Fetch team performance
    const { data: performance, isLoading: perfLoading } = useQuery({
        queryKey: ["team-performance", orgId, dateRange],
        queryFn: () =>
            api.getTeamPerformance(orgId, dateRange.startDate, dateRange.endDate),
    });

    // Fetch member contributions
    const { data: contributions, isLoading: contribLoading } = useQuery({
        queryKey: ["team-contributions", orgId, dateRange],
        queryFn: () =>
            api.getMemberContributions(orgId, dateRange.startDate, dateRange.endDate),
    });

    // Fetch activity timeline
    const { data: activities, isLoading: activitiesLoading } = useQuery({
        queryKey: ["team-activity", orgId],
        queryFn: () => api.getActivityTimeline(orgId, { limit: 20 }),
    });

    // Fetch productivity trends
    const { isLoading: trendsLoading } = useQuery({
        queryKey: ["team-trends", orgId, dateRange],
        queryFn: () =>
            api.getProductivityTrends(orgId, dateRange.startDate, dateRange.endDate),
    });

    const isLoading = perfLoading || contribLoading || activitiesLoading || trendsLoading;

    // Stable now reference for calculations
    const [now] = useState(() => Date.now());

    // Mock data for demonstration when API returns empty
    const mockPerformance = {
        totalProjects: 42,
        totalPresentations: 156,
        averageEngagement: 78.5,
    };

    const mockContributions: TeamMember[] = [
        { userId: "1", userName: "John Smith", projectsCreated: 15, slidesCreated: 234 },
        { userId: "2", userName: "Sarah Johnson", projectsCreated: 12, slidesCreated: 198 },
        { userId: "3", userName: "Mike Chen", projectsCreated: 9, slidesCreated: 156 },
        { userId: "4", userName: "Emily Davis", projectsCreated: 6, slidesCreated: 89 },
    ];

    const mockActivities: ActivityItem[] = useMemo(() => [
        { action: "created", timestamp: new Date(now).toISOString(), userId: "1", targetType: "project", userName: "John Smith" },
        { action: "edited", timestamp: new Date(now - 3600000).toISOString(), userId: "2", targetType: "slide", userName: "Sarah Johnson" },
        { action: "shared", timestamp: new Date(now - 7200000).toISOString(), userId: "3", targetType: "project", userName: "Mike Chen" },
    ], [now]);

    const displayPerformance = performance || mockPerformance;
    const displayContributions = contributions?.length ? contributions : mockContributions;
    const displayActivities = activities?.length ? activities : mockActivities;

    // Generate trend data once
    const [trendData] = useState(() => {
        return Array.from({ length: 14 }, (_, i) => ({
            height: 30 + Math.random() * 70,
            index: i
        }));
    });

    const getActionColor = (action: string) => {
        switch (action) {
            case "created":
                return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
            case "edited":
                return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
            case "shared":
                return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
            case "deleted":
                return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
            default:
                return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
        }
    };

    const formatTimeAgo = (timestamp: string) => {
        const seconds = Math.floor((now - new Date(timestamp).getTime()) / 1000);
        if (seconds < 60) { return "just now"; }
        if (seconds < 3600) { return `${Math.floor(seconds / 60)}m ago`; }
        if (seconds < 86400) { return `${Math.floor(seconds / 3600)}h ago`; }
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="flex items-center gap-2">
                                <Button variant="ghost" size="sm">
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Back
                                </Button>
                            </Link>
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                    <BarChart3 className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-xl font-bold text-slate-900 dark:text-white">
                                    Team Analytics
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
                                <SelectTrigger className="w-[130px]">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7d">Last 7 days</SelectItem>
                                    <SelectItem value="30d">Last 30 days</SelectItem>
                                    <SelectItem value="90d">Last 90 days</SelectItem>
                                    <SelectItem value="1y">Last year</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="sm">
                                <Download className="h-4 w-4 mr-2" />
                                Export
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-blue-100">Total Projects</CardDescription>
                            <CardTitle className="text-4xl font-bold">
                                {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : displayPerformance.totalProjects}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-1 text-blue-100">
                                <TrendingUp className="h-4 w-4" />
                                <span className="text-sm">+12% from last period</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-purple-100">Total Presentations</CardDescription>
                            <CardTitle className="text-4xl font-bold">
                                {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : displayPerformance.totalPresentations}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-1 text-purple-100">
                                <TrendingUp className="h-4 w-4" />
                                <span className="text-sm">+8% from last period</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-green-100">Avg. Engagement</CardDescription>
                            <CardTitle className="text-4xl font-bold">
                                {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : `${displayPerformance.averageEngagement}%`}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-1 text-green-100">
                                <TrendingUp className="h-4 w-4" />
                                <span className="text-sm">+5% from last period</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-orange-100">Active Members</CardDescription>
                            <CardTitle className="text-4xl font-bold">
                                {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : displayContributions.length}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-1 text-orange-100">
                                <Activity className="h-4 w-4" />
                                <span className="text-sm">this period</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="bg-white dark:bg-slate-900 p-1 rounded-lg shadow-sm">
                        <TabsTrigger value="overview" className="rounded-md">
                            <PieChart className="h-4 w-4 mr-2" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="members" className="rounded-md">
                            <Activity className="h-4 w-4 mr-2" />
                            Members
                        </TabsTrigger>
                        <TabsTrigger value="activity" className="rounded-md">
                            <Activity className="h-4 w-4 mr-2" />
                            Activity
                        </TabsTrigger>
                        <TabsTrigger value="trends" className="rounded-md">
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Trends
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Top Contributors */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Activity className="h-5 w-5 text-indigo-500" />
                                        Top Contributors
                                    </CardTitle>
                                    <CardDescription>Team members with most contributions</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {displayContributions.slice(0, 5).map((member, index) => (
                                            <div key={member.userId} className="flex items-center gap-4">
                                                <div className="text-lg font-bold text-slate-400 w-6">#{index + 1}</div>
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={member.avatar} />
                                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                                        {member.userName.split(" ").map(n => n[0]).join("")}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-slate-900 dark:text-white truncate">
                                                        {member.userName}
                                                    </p>
                                                    <p className="text-sm text-slate-500">
                                                        {member.projectsCreated} projects • {member.slidesCreated} slides
                                                    </p>
                                                </div>
                                                <Badge variant="secondary">
                                                    {Math.round((member.slidesCreated / displayContributions.reduce((sum, m) => sum + m.slidesCreated, 0)) * 100)}%
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Recent Activity */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Activity className="h-5 w-5 text-green-500" />
                                        Recent Activity
                                    </CardTitle>
                                    <CardDescription>Latest team actions</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {displayActivities.slice(0, 5).map((activity) => (
                                            <div key={`${activity.timestamp}-${activity.userId}`} className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="text-xs bg-slate-100 dark:bg-slate-800">
                                                        {activity.userName?.split(" ").map(n => n[0]).join("") || "U"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm">
                                                        <span className="font-medium">{activity.userName || "User"}</span>{" "}
                                                        <span className={`px-1.5 py-0.5 rounded text-xs ${getActionColor(activity.action)}`}>
                                                            {activity.action}
                                                        </span>{" "}
                                                        a {activity.targetType}
                                                    </p>
                                                </div>
                                                <span className="text-xs text-slate-500">{formatTimeAgo(activity.timestamp)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Contribution Distribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-blue-500" />
                                    Contribution Distribution
                                </CardTitle>
                                <CardDescription>Slides created by each team member</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {displayContributions.map((member) => {
                                        const total = displayContributions.reduce((sum, m) => sum + m.slidesCreated, 0);
                                        const percentage = Math.round((member.slidesCreated / total) * 100);

                                        return (
                                            <div key={member.userId} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarFallback className="text-[10px] bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                                                {member.userName.split(" ").map(n => n[0]).join("")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium text-sm">{member.userName}</span>
                                                    </div>
                                                    <span className="text-sm text-slate-500">{member.slidesCreated} slides ({percentage}%)</span>
                                                </div>
                                                <Progress value={percentage} className="h-2" />
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Members Tab */}
                    <TabsContent value="members">
                        <Card>
                            <CardHeader>
                                <CardTitle>Team Members</CardTitle>
                                <CardDescription>All team members and their contributions</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                                <th className="text-left py-3 px-4 font-medium text-slate-500">Member</th>
                                                <th className="text-right py-3 px-4 font-medium text-slate-500">Projects Created</th>
                                                <th className="text-right py-3 px-4 font-medium text-slate-500">Slides Created</th>
                                                <th className="text-right py-3 px-4 font-medium text-slate-500">Contribution</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayContributions.map((member) => {
                                                const total = displayContributions.reduce((sum, m) => sum + m.slidesCreated, 0);
                                                const percentage = Math.round((member.slidesCreated / total) * 100);

                                                return (
                                                    <tr key={member.userId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="py-4 px-4">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-10 w-10">
                                                                    <AvatarImage src={member.avatar} />
                                                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                                                        {member.userName.split(" ").map(n => n[0]).join("")}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="font-medium text-slate-900 dark:text-white">{member.userName}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-4 text-right">
                                                            <span className="font-medium">{member.projectsCreated}</span>
                                                        </td>
                                                        <td className="py-4 px-4 text-right">
                                                            <span className="font-medium">{member.slidesCreated}</span>
                                                        </td>
                                                        <td className="py-4 px-4 text-right">
                                                            <Badge variant={percentage > 30 ? "default" : "secondary"}>
                                                                {percentage}%
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Activity Tab */}
                    <TabsContent value="activity">
                        <Card>
                            <CardHeader>
                                <CardTitle>Activity Timeline</CardTitle>
                                <CardDescription>Complete history of team actions</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {displayActivities.map((activity, index) => (
                                        <div key={`${activity.timestamp}-${activity.userId}`} className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-900 shadow">
                                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm">
                                                        {activity.userName?.split(" ").map(n => n[0]).join("") || "U"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {index < displayActivities.length - 1 && (
                                                    <div className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700 my-2" />
                                                )}
                                            </div>
                                            <div className="flex-1 pb-6">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium text-slate-900 dark:text-white">
                                                        {activity.userName || "User"}
                                                    </span>
                                                    <Badge className={getActionColor(activity.action)} variant="outline">
                                                        {activity.action}
                                                    </Badge>
                                                    <span className="text-slate-600 dark:text-slate-400">
                                                        a {activity.targetType}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-500">{formatTimeAgo(activity.timestamp)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Trends Tab */}
                    <TabsContent value="trends">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-green-500" />
                                    Productivity Trends
                                </CardTitle>
                                <CardDescription>Daily activity over the selected period</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] flex items-end justify-between gap-1 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                    {/* Simple bar chart visualization */}
                                    {trendData.map((item) => (
                                        <div
                                            key={`trend-${item.index}`}
                                            className="flex-1 bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer relative group"
                                            style={{ height: `${item.height}%` }}
                                        >
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                {Math.round(item.height / 10)} activities
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between mt-4 text-xs text-slate-500">
                                    <span>{dateRange.startDate}</span>
                                    <span>{dateRange.endDate}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
