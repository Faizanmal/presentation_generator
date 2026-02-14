"use client";

import { motion } from "framer-motion";

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`}
        />
    );
}

// Text skeleton
export function SkeletonText({
    lines = 3,
    className = "",
}: {
    lines?: number;
    className?: string;
}) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    // eslint-disable-next-line react/no-array-index-key
                    key={`text-line-${i}`}
                    className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
                />
            ))}
        </div>
    );
}

// Card skeleton
export function SkeletonCard({ className = "" }: { className?: string }) {
    return (
        <div
            className={`bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden ${className}`}
        >
            <Skeleton className="aspect-[16/10] rounded-none" />
            <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                </div>
            </div>
        </div>
    );
}

// Avatar skeleton
export function SkeletonAvatar({
    size = "md",
}: {
    size?: "sm" | "md" | "lg";
}) {
    const sizeClasses = {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
    };

    return <Skeleton className={`rounded-full ${sizeClasses[size]}`} />;
}

// Button skeleton
export function SkeletonButton({
    size = "md",
}: {
    size?: "sm" | "md" | "lg";
}) {
    const sizeClasses = {
        sm: "h-8 w-20",
        md: "h-10 w-24",
        lg: "h-12 w-32",
    };

    return <Skeleton className={`rounded-lg ${sizeClasses[size]}`} />;
}

// List skeleton
export function SkeletonList({
    items = 5,
    className = "",
}: {
    items?: number;
    className?: string;
}) {
    return (
        <div className={`space-y-4 ${className}`}>
            {Array.from({ length: items }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={`list-item-${i}`} className="flex items-center gap-4">
                    <SkeletonAvatar />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-3/4" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// Table skeleton
export function SkeletonTable({
    rows = 5,
    cols = 4,
    className = "",
}: {
    rows?: number;
    cols?: number;
    className?: string;
}) {
    return (
        <div className={`space-y-3 ${className}`}>
            {/* Header */}
            <div className="flex gap-4">
                {Array.from({ length: cols }).map((_, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <Skeleton key={`table-header-${i}`} className="h-4 flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={`table-row-${rowIndex}`} className="flex gap-4 py-2">
                    {Array.from({ length: cols }).map((_, colIndex) => (
                        <Skeleton
                            // eslint-disable-next-line react/no-array-index-key
                            key={`table-col-${colIndex}`}
                            className="h-4 flex-1"
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

// Dashboard skeleton
export function SkeletonDashboard() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex gap-2">
                    <SkeletonButton />
                    <SkeletonButton />
                </div>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <SkeletonCard key={`dashboard-card-${i}`} />
                ))}
            </div>
        </div>
    );
}

// Editor skeleton
export function SkeletonEditor() {
    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="w-64 border-r border-slate-200 dark:border-slate-800 p-4 space-y-4">
                <Skeleton className="h-10 w-full" />
                <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <Skeleton key={`editor-side-${i}`} className="h-16 w-full rounded-lg" />
                    ))}
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    <Skeleton className="h-12 w-3/4" />
                    <SkeletonText lines={4} />
                    <Skeleton className="h-64 w-full rounded-lg" />
                    <SkeletonText lines={3} />
                </div>
            </div>
        </div>
    );
}

// Shimmer effect overlay
export function ShimmerOverlay({ className = "" }: { className?: string }) {
    return (
        <div className={`absolute inset-0 overflow-hidden ${className}`}>
            <motion.div
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
        </div>
    );
}

// Page loading component
export function PageLoading({ message = "Loading..." }: { message?: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
            >
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-slate-200 dark:border-slate-700 mx-auto" />
                    <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mx-auto" />
                </div>
                <p className="mt-4 text-slate-600 dark:text-slate-400">{message}</p>
            </motion.div>
        </div>
    );
}

// Inline loading spinner
export function LoadingSpinner({
    size = "md",
    className = "",
}: {
    size?: "sm" | "md" | "lg";
    className?: string;
}) {
    const sizeClasses = {
        sm: "h-4 w-4",
        md: "h-6 w-6",
        lg: "h-8 w-8",
    };

    return (
        <svg
            className={`animate-spin text-blue-500 ${sizeClasses[size]} ${className}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );
}
