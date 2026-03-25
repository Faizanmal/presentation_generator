"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

interface ThemeToggleButtonProps {
  variant?: "dark" | "light";
}

export function ThemeToggleButton({ variant = "light" }: ThemeToggleButtonProps) {
  const { theme, setTheme } = useTheme();

  // Avoid hydration mismatch by rendering a consistent initial UI on both server and client.
  // Use window detection instead of state updates in effects to satisfy lint and avoid cascading renders.
  const mounted = typeof window !== "undefined";
  const activeTheme = mounted ? theme ?? "system" : "system";

  const themeOptions = [
    { key: "light", icon: Sun, title: "Light mode" },
    { key: "dark", icon: Moon, title: "Dark mode" },
    { key: "system", icon: Monitor, title: "System mode" },
  ];

  const isDark = variant === "dark";

  return (
    <div
      className={`flex items-center gap-1 p-1 rounded-lg shadow-sm transition-colors ${isDark
          ? "bg-slate-800/50 border border-slate-700 hover:bg-slate-800/70"
          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70"
        }`}
    >
      {themeOptions.map(({ key, icon: Icon, title }) => (
        <button
          key={key}
          onClick={() => setTheme(key as Theme)}
          className={`p-2 rounded transition-colors ${activeTheme === key
              ? isDark
                ? "bg-slate-700 text-blue-400"
                : "bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400"
              : isDark
                ? "text-slate-400 hover:bg-slate-700/50"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            }`}
          title={title}
          aria-label={title}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
