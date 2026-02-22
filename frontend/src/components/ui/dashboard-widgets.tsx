"use client";

import { motion } from "framer-motion";
import {
    TrendingUp,
    TrendingDown,
    FileText,
    Eye,
    Clock,
    Sparkles,
    ArrowRight,
    BarChart3,
    Users,
    Zap,
} from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
    icon: React.ReactNode;
    iconColor?: string;
    trend?: "up" | "down" | "neutral";
}

export function StatCard({
    title,
    value,
    change,
    changeLabel = "vs last month",
    icon,
    iconColor = "from-blue-500 to-blue-600",
    trend,
}: StatCardProps) {
    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-lg transition-shadow"
        >
            <div className="flex items-start justify-between mb-4">
                <div
                    className={`h-12 w-12 rounded-xl bg-linear-to-br ${iconColor} flex items-center justify-center text-white shadow-lg`}
                >
                    {icon}
                </div>
                {change !== undefined && (
                    <div
                        className={`flex items-center gap-1 text-sm font-medium ${trend === "up"
                                ? "text-green-600"
                                : trend === "down"
                                    ? "text-red-600"
                                    : "text-slate-500"
                            }`}
                    >
                        {trend === "up" && <TrendingUp className="h-4 w-4" />}
                        {trend === "down" && <TrendingDown className="h-4 w-4" />}
                        <span>{change > 0 ? "+" : ""}{change}%</span>
                    </div>
                )}
            </div>

            <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{title}</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
                {changeLabel && change !== undefined && (
                    <p className="text-xs text-slate-400 mt-1">{changeLabel}</p>
                )}
            </div>
        </motion.div>
    );
}

// Quick action card
interface QuickActionCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    onClick: () => void;
}

export function QuickActionCard({
    title,
    description,
    icon,
    color,
    onClick,
}: QuickActionCardProps) {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="w-full text-left p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
        >
            <div className="flex items-start gap-4">
                <div
                    className={`h-12 w-12 rounded-xl bg-linear-to-br ${color} flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform`}
                >
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
            </div>
        </motion.button>
    );
}

// Stats grid component
interface StatsGridProps {
    totalPresentations: number;
    totalViews: number;
    aiGenerations: number;
    averageTime?: string;
    presentationsChange?: number;
    viewsChange?: number;
    generationsChange?: number;
}

export function StatsGrid({
    totalPresentations,
    totalViews,
    aiGenerations,
    averageTime = "4.5 min",
    presentationsChange = 12,
    viewsChange = 28,
    generationsChange = 45,
}: StatsGridProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                title="Total Presentations"
                value={totalPresentations}
                change={presentationsChange}
                trend={presentationsChange > 0 ? "up" : presentationsChange < 0 ? "down" : "neutral"}
                icon={<FileText className="h-6 w-6" />}
                iconColor="from-blue-500 to-blue-600"
            />
            <StatCard
                title="Total Views"
                value={totalViews.toLocaleString()}
                change={viewsChange}
                trend={viewsChange > 0 ? "up" : viewsChange < 0 ? "down" : "neutral"}
                icon={<Eye className="h-6 w-6" />}
                iconColor="from-purple-500 to-purple-600"
            />
            <StatCard
                title="AI Generations"
                value={aiGenerations}
                change={generationsChange}
                trend={generationsChange > 0 ? "up" : generationsChange < 0 ? "down" : "neutral"}
                icon={<Sparkles className="h-6 w-6" />}
                iconColor="from-pink-500 to-pink-600"
            />
            <StatCard
                title="Avg. Creation Time"
                value={averageTime}
                icon={<Clock className="h-6 w-6" />}
                iconColor="from-green-500 to-green-600"
            />
        </div>
    );
}

// Quick actions grid
interface QuickActionsGridProps {
    onCreateNew: () => void;
    onAIGenerate: () => void;
    onViewAnalytics: () => void;
    onInviteTeam: () => void;
}

export function QuickActionsGrid({
    onCreateNew,
    onAIGenerate,
    onViewAnalytics,
    onInviteTeam,
}: QuickActionsGridProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuickActionCard
                title="Create New Presentation"
                description="Start from scratch or use a template"
                icon={<FileText className="h-6 w-6" />}
                color="from-blue-500 to-blue-600"
                onClick={onCreateNew}
            />
            <QuickActionCard
                title="AI Generate"
                description="Let AI create your presentation"
                icon={<Sparkles className="h-6 w-6" />}
                color="from-purple-500 to-purple-600"
                onClick={onAIGenerate}
            />
            <QuickActionCard
                title="View Analytics"
                description="Track views and engagement"
                icon={<BarChart3 className="h-6 w-6" />}
                color="from-green-500 to-green-600"
                onClick={onViewAnalytics}
            />
            <QuickActionCard
                title="Invite Team"
                description="Collaborate with your team"
                icon={<Users className="h-6 w-6" />}
                color="from-orange-500 to-orange-600"
                onClick={onInviteTeam}
            />
        </div>
    );
}

// Activity item
interface ActivityItem {
    id: string;
    type: "created" | "edited" | "shared" | "viewed" | "generated";
    title: string;
    time: string;
    user?: string;
}

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
    const getIcon = (type: ActivityItem["type"]) => {
        switch (type) {
            case "created":
                return <FileText className="h-4 w-4 text-blue-500" />;
            case "edited":
                return <Zap className="h-4 w-4 text-yellow-500" />;
            case "shared":
                return <Users className="h-4 w-4 text-green-500" />;
            case "viewed":
                return <Eye className="h-4 w-4 text-purple-500" />;
            case "generated":
                return <Sparkles className="h-4 w-4 text-pink-500" />;
        }
    };

    const getLabel = (type: ActivityItem["type"]) => {
        switch (type) {
            case "created":
                return "Created";
            case "edited":
                return "Edited";
            case "shared":
                return "Shared";
            case "viewed":
                return "Viewed";
            case "generated":
                return "Generated";
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
            <div className="space-y-4">
                {activities.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
                ) : (
                    activities.map((activity) => (
                        <motion.div
                            key={activity.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-start gap-3"
                        >
                            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                {getIcon(activity.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-900 dark:text-white">
                                    <span className="font-medium">{getLabel(activity.type)}</span>{" "}
                                    <span className="text-slate-600 dark:text-slate-400">{activity.title}</span>
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {activity.user && <span>{activity.user} • </span>}
                                    {activity.time}
                                </p>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}

// Usage progress component
interface UsageProgressProps {
    label: string;
    used: number;
    total: number;
    color?: string;
}

export function UsageProgress({
    label,
    used,
    total,
    color = "bg-blue-500",
}: UsageProgressProps) {
    const percentage = Math.min((used / total) * 100, 100);
    const isWarning = percentage > 80;
    const isCritical = percentage > 95;

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{label}</span>
                <span
                    className={`font-medium ${isCritical
                            ? "text-red-600"
                            : isWarning
                                ? "text-yellow-600"
                                : "text-slate-900 dark:text-white"
                        }`}
                >
                    {used.toLocaleString()} / {total.toLocaleString()}
                </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full rounded-full ${isCritical
                            ? "bg-red-500"
                            : isWarning
                                ? "bg-yellow-500"
                                : color
                        }`}
                />
            </div>
        </div>
    );
}

// Usage card
interface UsageCardProps {
    plan: string;
    presentations: { used: number; total: number };
    aiGenerations: { used: number; total: number };
    onUpgrade?: () => void;
}

export function UsageCard({
    plan,
    presentations,
    aiGenerations,
    onUpgrade,
}: UsageCardProps) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Usage</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Current plan: <span className="font-medium capitalize">{plan}</span>
                    </p>
                </div>
                {plan === "free" && onUpgrade && (
                    <button
                        onClick={onUpgrade}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        Upgrade
                    </button>
                )}
            </div>

            <div className="space-y-4">
                <UsageProgress
                    label="Presentations"
                    used={presentations.used}
                    total={presentations.total}
                    color="bg-blue-500"
                />
                <UsageProgress
                    label="AI Generations"
                    used={aiGenerations.used}
                    total={aiGenerations.total}
                    color="bg-purple-500"
                />
            </div>
        </div>
    );
}
