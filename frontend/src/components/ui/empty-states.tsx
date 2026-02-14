"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: LucideIcon;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    secondaryAction,
    className = "",
}: EmptyStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col items-center justify-center text-center py-16 px-8 ${className}`}
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="relative mb-6"
            >
                <div className="h-24 w-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Icon className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                </div>
                {/* Decorative rings */}
                <div className="absolute inset-0 -z-10 h-24 w-24 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-700 animate-spin-slow" style={{ animationDuration: "20s" }} />
                <div className="absolute -inset-4 -z-10 h-32 w-32 rounded-full border border-slate-100 dark:border-slate-800" />
            </motion.div>

            <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-semibold text-slate-900 dark:text-white mb-2"
            >
                {title}
            </motion.h3>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-slate-600 dark:text-slate-400 max-w-sm mb-6"
            >
                {description}
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-3"
            >
                {action && (
                    <Button onClick={action.onClick} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                        {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                        {action.label}
                    </Button>
                )}
                {secondaryAction && (
                    <Button variant="outline" onClick={secondaryAction.onClick}>
                        {secondaryAction.label}
                    </Button>
                )}
            </motion.div>
        </motion.div>
    );
}

// Illustration-based empty state
interface IllustratedEmptyStateProps {
    illustration: "presentations" | "search" | "favorites" | "analytics" | "team";
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function IllustratedEmptyState({
    illustration,
    title,
    description,
    action,
    className = "",
}: IllustratedEmptyStateProps) {
    const illustrations = {
        presentations: (
            <svg className="w-48 h-48" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="30" y="50" width="140" height="100" rx="8" className="fill-slate-100 dark:fill-slate-800" />
                <rect x="40" y="60" width="120" height="80" rx="4" className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-700" stroke="currentColor" strokeWidth="2" />
                <rect x="50" y="75" width="60" height="6" rx="3" className="fill-slate-200 dark:fill-slate-700" />
                <rect x="50" y="90" width="80" height="4" rx="2" className="fill-slate-100 dark:fill-slate-800" />
                <rect x="50" y="100" width="70" height="4" rx="2" className="fill-slate-100 dark:fill-slate-800" />
                <rect x="50" y="110" width="40" height="4" rx="2" className="fill-slate-100 dark:fill-slate-800" />
                <circle cx="150" cy="140" r="25" className="fill-blue-500/20" />
                <path d="M145 135l10 5-10 5v-10z" className="fill-blue-500" />
            </svg>
        ),
        search: (
            <svg className="w-48 h-48" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="90" cy="90" r="50" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="8" />
                <line x1="125" y1="125" x2="165" y2="165" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="8" strokeLinecap="round" />
                <circle cx="90" cy="90" r="25" className="fill-slate-100 dark:fill-slate-800" />
                <text x="82" y="96" className="fill-slate-400 text-lg">?</text>
            </svg>
        ),
        favorites: (
            <svg className="w-48 h-48" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M100 50l15.5 31.5 34.8 5-25.2 24.5 6 34.5L100 128l-31.1 17.5 6-34.5-25.2-24.5 34.8-5L100 50z" className="fill-yellow-100 dark:fill-yellow-900/30 stroke-yellow-400" strokeWidth="4" />
                <circle cx="60" cy="150" r="8" className="fill-slate-200 dark:fill-slate-700" />
                <circle cx="140" cy="155" r="6" className="fill-slate-200 dark:fill-slate-700" />
                <circle cx="155" cy="45" r="5" className="fill-slate-200 dark:fill-slate-700" />
            </svg>
        ),
        analytics: (
            <svg className="w-48 h-48" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="30" y="130" width="25" height="40" rx="4" className="fill-blue-200 dark:fill-blue-900" />
                <rect x="65" y="100" width="25" height="70" rx="4" className="fill-blue-300 dark:fill-blue-800" />
                <rect x="100" y="70" width="25" height="100" rx="4" className="fill-blue-400 dark:fill-blue-700" />
                <rect x="135" y="90" width="25" height="80" rx="4" className="fill-blue-500 dark:fill-blue-600" />
                <path d="M40 120c20-20 40-10 60-30s40-20 60 0" className="stroke-purple-400" strokeWidth="3" fill="none" strokeLinecap="round" />
                <circle cx="40" cy="120" r="5" className="fill-purple-500" />
                <circle cx="100" cy="90" r="5" className="fill-purple-500" />
                <circle cx="160" cy="90" r="5" className="fill-purple-500" />
            </svg>
        ),
        team: (
            <svg className="w-48 h-48" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="70" r="30" className="fill-blue-100 dark:fill-blue-900" />
                <circle cx="100" cy="60" r="15" className="fill-blue-300 dark:fill-blue-700" />
                <ellipse cx="100" cy="100" rx="35" ry="20" className="fill-blue-200 dark:fill-blue-800" />
                <circle cx="50" cy="100" r="20" className="fill-slate-100 dark:fill-slate-800" />
                <circle cx="50" cy="95" r="10" className="fill-slate-300 dark:fill-slate-600" />
                <ellipse cx="50" cy="120" rx="20" ry="12" className="fill-slate-200 dark:fill-slate-700" />
                <circle cx="150" cy="100" r="20" className="fill-slate-100 dark:fill-slate-800" />
                <circle cx="150" cy="95" r="10" className="fill-slate-300 dark:fill-slate-600" />
                <ellipse cx="150" cy="120" rx="20" ry="12" className="fill-slate-200 dark:fill-slate-700" />
            </svg>
        ),
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col items-center justify-center text-center py-16 px-8 ${className}`}
        >
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="mb-6"
            >
                {illustrations[illustration]}
            </motion.div>

            <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-semibold text-slate-900 dark:text-white mb-2"
            >
                {title}
            </motion.h3>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-slate-600 dark:text-slate-400 max-w-sm mb-6"
            >
                {description}
            </motion.p>

            {action && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Button onClick={action.onClick} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                        {action.label}
                    </Button>
                </motion.div>
            )}
        </motion.div>
    );
}

// Coming soon state
interface ComingSoonProps {
    title: string;
    description: string;
    expectedDate?: string;
    onNotify?: () => void;
    className?: string;
}

export function ComingSoon({
    title,
    description,
    expectedDate,
    onNotify,
    className = "",
}: ComingSoonProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col items-center justify-center text-center py-16 px-8 ${className}`}
        >
            <motion.div
                animate={{
                    rotate: [0, 10, -10, 0],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3,
                }}
                className="text-6xl mb-6"
            >
                🚀
            </motion.div>

            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {title}
            </h3>

            <p className="text-slate-600 dark:text-slate-400 max-w-md mb-4">
                {description}
            </p>

            {expectedDate && (
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-6">
                    Expected: {expectedDate}
                </p>
            )}

            {onNotify && (
                <Button variant="outline" onClick={onNotify}>
                    Notify me when it&apos;s ready
                </Button>
            )}
        </motion.div>
    );
}
