"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useTheme as useNextTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "./button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./dropdown-menu";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export function useTheme() {
    const { theme, setTheme, resolvedTheme, systemTheme } = useNextTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return {
        theme: (theme || "system") as Theme,
        setTheme: setTheme || (() => { }),
        resolvedTheme: (resolvedTheme || "light") as "light" | "dark",
        systemTheme: (systemTheme || "light") as "light" | "dark",
        mounted,
    };
}

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme, mounted } = useTheme();

    if (!mounted) { return <Button variant="ghost" size="icon" disabled />; }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <AnimatePresence mode="wait">
                        {resolvedTheme === "light" ? (
                            <motion.div
                                key="sun"
                                initial={{ scale: 0, rotate: -90 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0, rotate: 90 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Sun className="h-5 w-5" />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="moon"
                                initial={{ scale: 0, rotate: 90 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0, rotate: -90 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Moon className="h-5 w-5" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={() => setTheme("light")}
                    className={theme === "light" ? "bg-slate-100 dark:bg-slate-800" : ""}
                >
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setTheme("dark")}
                    className={theme === "dark" ? "bg-slate-100 dark:bg-slate-800" : ""}
                >
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setTheme("system")}
                    className={theme === "system" ? "bg-slate-100 dark:bg-slate-800" : ""}
                >
                    <Monitor className="h-4 w-4 mr-2" />
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// Simple toggle button (without dropdown)
export function ThemeToggleSimple() {
    const { resolvedTheme, setTheme, mounted } = useTheme();

    if (!mounted) { return <Button variant="ghost" size="icon" disabled />; }

    const toggleTheme = () => {
        setTheme(resolvedTheme === "light" ? "dark" : "light");
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="relative overflow-hidden"
            title={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
        >
            <AnimatePresence mode="wait">
                {resolvedTheme === "light" ? (
                    <motion.div
                        key="sun"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Sun className="h-5 w-5" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="moon"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Moon className="h-5 w-5" />
                    </motion.div>
                )}
            </AnimatePresence>
        </Button>
    );
}

// Animated switch toggle
export function ThemeSwitch() {
    const { resolvedTheme, setTheme, mounted } = useTheme();

    if (!mounted) {
        return (
            <button
                className="relative w-16 h-8 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors"
                role="switch"
                aria-checked={false}
                disabled
            />
        );
    }

    const isDark = resolvedTheme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="relative w-16 h-8 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors"
            role="switch"
            aria-checked={isDark}
            title={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
            {/* Track icons */}
            <Sun className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-500" />
            <Moon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

            {/* Thumb */}
            <motion.div
                className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center"
                animate={{
                    x: isDark ? 32 : 0,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
                {isDark ? (
                    <Moon className="h-4 w-4 text-slate-700" />
                ) : (
                    <Sun className="h-4 w-4 text-yellow-500" />
                )}
            </motion.div>
        </button>
    );
}
