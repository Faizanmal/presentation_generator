"use client";

import { useState, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FilePlus2,
  PenTool,
  Image,
  Shapes,
  MessageSquare,
  MousePointer2,
  WandSparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Palette,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  hoverLift,
  springTransition,
  springSnappy,
  motionTiming,
  motionEase,
  staggerContainer,
  staggerChild,
  buttonPress,
} from "../lib/motion";
import type { EditorTool } from "../types";

interface AppSidebarProps {
  activeTool: EditorTool;
  onToolSelect: (tool: EditorTool) => void;
  onQuickNewProject: () => void;
}

const tools: Array<{
  id: EditorTool;
  label: string;
  icon: ComponentType<{ className?: string }>;
  shortcut?: string;
}> = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { id: "text", label: "Text", icon: PenTool, shortcut: "T" },
  { id: "image", label: "Image", icon: Image, shortcut: "I" },
  { id: "shape", label: "Shape", icon: Shapes, shortcut: "S" },
  { id: "chart", label: "Chart", icon: BarChart3, shortcut: "G" },
  { id: "comment", label: "Comments", icon: MessageSquare, shortcut: "C" },
  { id: "ai", label: "AI", icon: WandSparkles, shortcut: "A" },
];

const bottomTools: Array<{
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "themes", label: "Themes", icon: Palette },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "help", label: "Help", icon: HelpCircle },
];

export function AppSidebar({ activeTool, onToolSelect, onQuickNewProject }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{
        width: collapsed ? "var(--pd-comp-sidebar-collapsed-w)" : "var(--pd-comp-sidebar-w)",
      }}
      transition={springSnappy}
      className="flex h-full flex-col border-r border-pd-border bg-pd-panel/95 backdrop-blur-xl"
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className={cn("border-b border-pd-border p-3", collapsed && "px-2")}>
        {!collapsed ? (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            <motion.div variants={staggerChild} className="flex items-center gap-2">
              <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-gradient-to-br from-pd-accent to-[oklch(0.72_0.18_295)] text-sm font-bold text-white shadow-glow-subtle">
                P
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.12em] text-pd-muted">Workspace</p>
                <p className="truncate text-sm font-semibold text-pd-text">Presentation OS</p>
              </div>
            </motion.div>

            <motion.div variants={staggerChild}>
              <motion.div {...buttonPress}>
                <Button
                  onClick={onQuickNewProject}
                  className="w-full justify-start rounded-lg bg-pd-text text-pd-canvas"
                >
                  <FilePlus2 className="h-4 w-4" />
                  New project
                </Button>
              </motion.div>
            </motion.div>

            <motion.div variants={staggerChild}>
              <Button
                variant="outline"
                className="w-full justify-start rounded-lg border-pd-border bg-pd-elevated text-pd-text-secondary"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-pd-accent to-[oklch(0.72_0.18_295)] text-sm font-bold text-white shadow-glow-subtle">
              P
            </div>
            <motion.div {...buttonPress}>
              <Button
                size="icon"
                onClick={onQuickNewProject}
                className="h-8 w-8 rounded-lg bg-pd-text text-pd-canvas"
              >
                <FilePlus2 className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        )}
      </div>

      {/* ── Tools ───────────────────────────────────────────────── */}
      <div className={cn("flex-1 overflow-y-auto py-3 pd-scrollbar-thin", collapsed ? "px-1.5" : "px-2")}>
        {!collapsed && (
          <p className="mb-2 px-2 text-[10px] uppercase tracking-[0.12em] text-pd-muted">
            Tools
          </p>
        )}

        <div className="space-y-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;

            return (
              <motion.div key={tool.id} {...hoverLift}>
                <button
                  type="button"
                  onClick={() => onToolSelect(tool.id)}
                  className={cn(
                    "relative flex w-full items-center rounded-lg transition",
                    collapsed ? "justify-center p-2" : "gap-3 px-3 py-2 text-sm",
                    isActive
                      ? "bg-pd-accent-soft text-pd-text"
                      : "text-pd-text-secondary hover:bg-pd-elevated hover:text-pd-text",
                  )}
                  title={collapsed ? tool.label : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{tool.label}</span>
                      {tool.shortcut && (
                        <kbd className="rounded border border-pd-border bg-pd-sunken px-1 text-[10px] text-pd-muted">
                          {tool.shortcut}
                        </kbd>
                      )}
                    </>
                  )}
                  {isActive && (
                    <motion.span
                      layoutId="active-sidebar-indicator"
                      className={cn(
                        "absolute rounded-full bg-pd-accent",
                        collapsed
                          ? "bottom-0 left-1/2 h-1 w-3 -translate-x-1/2"
                          : "inset-y-1 left-1 w-1",
                      )}
                      transition={springTransition}
                    />
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom section ──────────────────────────────────────── */}
      <div className={cn("border-t border-pd-border py-2", collapsed ? "px-1.5" : "px-2")}>
        {bottomTools.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex w-full items-center rounded-lg text-pd-text-secondary transition hover:bg-pd-elevated hover:text-pd-text",
                collapsed ? "justify-center p-2" : "gap-3 px-3 py-1.5 text-xs",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Collapse toggle ─────────────────────────────────────── */}
      <div className="border-t border-pd-border p-2">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-pd-muted transition hover:bg-pd-elevated hover:text-pd-text"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* ── Pro tip (expanded only) ─────────────────────────────── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: motionTiming.normal, ease: motionEase.smooth }}
            className="overflow-hidden border-t border-pd-border"
          >
            <div className="p-3">
              <div className="rounded-xl border border-pd-border bg-pd-elevated p-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-pd-muted">
                  Creative Flow
                </p>
                <p className="mt-1 text-xs text-pd-text-secondary">
                  Press{" "}
                  <kbd className="rounded border border-pd-border bg-pd-sunken px-1 text-[10px]">
                    ⌘K
                  </kbd>{" "}
                  for every action.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
