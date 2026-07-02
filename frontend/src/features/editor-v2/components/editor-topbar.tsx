"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Play,
  PanelLeftClose,
  PanelRightClose,
  Search,
  Moon,
  Sun,
  Cloud,
  CloudOff,
  Share2,
  MoreHorizontal,
  Undo2,
  Redo2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { hoverLift, buttonPress, motionTiming, motionEase, springSnappy } from "../lib/motion";
import type { PresenceUser } from "../types";

interface EditorTopbarProps {
  title: string;
  subtitle: string;
  zoom: number;
  isSaving: boolean;
  showLeftRail: boolean;
  showRightRail: boolean;
  participants: PresenceUser[];
  onChangeTitle: (title: string) => void;
  onToggleLeftRail: () => void;
  onToggleRightRail: () => void;
  onOpenPalette: () => void;
  onOpenAI: () => void;
  onPresent: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onExport?: () => void;
  onShare?: () => void;
}

export function EditorTopbar({
  title,
  subtitle,
  zoom,
  isSaving,
  showLeftRail,
  showRightRail,
  participants,
  onChangeTitle,
  onToggleLeftRail,
  onToggleRightRail,
  onOpenPalette,
  onOpenAI,
  onPresent,
  onUndo,
  onRedo,
  onExport,
  onShare,
}: EditorTopbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [titleFocused, setTitleFocused] = useState(false);

  return (
    <header className="flex h-[var(--pd-comp-topbar-h)] items-center justify-between border-b border-pd-border bg-pd-panel/90 px-3 backdrop-blur-xl">
      {/* ── Left Section ────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {/* Rail toggles */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={onToggleLeftRail}
          aria-label="Toggle storyboard rail"
        >
          <PanelLeftClose className={cn("h-4 w-4 transition", showLeftRail && "text-pd-accent")} />
        </Button>

        {/* Undo / Redo */}
        <div className="flex items-center rounded-lg border border-pd-border bg-pd-elevated">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-l-lg rounded-r-none text-pd-text-secondary hover:text-pd-text"
            onClick={onUndo}
            aria-label="Undo"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <div className="h-4 w-px bg-pd-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-l-none rounded-r-lg text-pd-text-secondary hover:text-pd-text"
            onClick={onRedo}
            aria-label="Redo"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Title input */}
        <div className="ml-2 flex flex-col">
          <Input
            value={title}
            onChange={(event) => onChangeTitle(event.target.value)}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
            className={cn(
              "h-7 min-w-[240px] border-transparent bg-transparent px-2 text-sm font-medium text-pd-text shadow-none transition-all",
              titleFocused
                ? "border-pd-border-focus bg-pd-elevated"
                : "hover:bg-pd-elevated/60",
            )}
          />
          <div className="flex items-center gap-2 px-2">
            <p className="text-[0.65rem] text-pd-muted">{subtitle}</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={isSaving ? "saving" : "saved"}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: motionTiming.quick }}
                className="flex items-center gap-1"
              >
                {isSaving ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    >
                      <Cloud className="h-2.5 w-2.5 text-pd-accent" />
                    </motion.div>
                    <span className="text-[0.6rem] text-pd-accent">Saving…</span>
                  </>
                ) : (
                  <>
                    <Cloud className="h-2.5 w-2.5 text-pd-success" />
                    <span className="text-[0.6rem] text-pd-success">Saved</span>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Center Section ──────────────────────────────────────── */}
      <div className="hidden items-center gap-2 md:flex">
        <span className="rounded-lg border border-pd-border bg-pd-elevated px-2 py-1 text-xs tabular-nums text-pd-text-secondary">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* ── Right Section ───────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {/* Command palette */}
        <motion.div {...hoverLift}>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenPalette}
            className="hidden rounded-lg border-pd-border bg-pd-elevated text-pd-text-secondary sm:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="ml-1.5">Command</span>
            <kbd className="ml-2 rounded border border-pd-border bg-pd-sunken px-1 text-[10px] text-pd-muted">
              ⌘K
            </kbd>
          </Button>
        </motion.div>

        {/* AI compose */}
        <motion.div {...hoverLift}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenAI}
            className="rounded-lg bg-pd-accent text-white shadow-glow-subtle hover:bg-pd-accent-hover"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI Compose</span>
          </Button>
        </motion.div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-pd-text-secondary"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={resolvedTheme}
              initial={{ rotate: -30, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 30, opacity: 0 }}
              transition={{ duration: motionTiming.quick }}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </motion.div>
          </AnimatePresence>
        </Button>

        {/* Share */}
        {onShare && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-pd-text-secondary"
            onClick={onShare}
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        )}

        {/* Export */}
        {onExport && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-pd-text-secondary"
            onClick={onExport}
            aria-label="Export"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}

        {/* Participants */}
        <div className="ml-1 flex items-center -space-x-2">
          {participants.slice(0, 4).map((participant) => (
            <motion.span
              key={participant.id}
              whileHover={{ scale: 1.15, zIndex: 10 }}
              className="relative grid h-7 w-7 place-items-center rounded-full border-2 border-pd-panel text-[10px] font-semibold text-white shadow-xs"
              style={{ backgroundColor: participant.color }}
              title={participant.name}
            >
              {participant.avatar}
              {participant.isTyping && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-pd-panel bg-pd-success" />
              )}
            </motion.span>
          ))}
          {participants.length > 4 && (
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-pd-panel bg-pd-elevated text-[10px] font-medium text-pd-text-secondary">
              +{participants.length - 4}
            </span>
          )}
        </div>

        {/* Inspector toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={onToggleRightRail}
          aria-label="Toggle inspector rail"
        >
          <PanelRightClose className={cn("h-4 w-4 transition", showRightRail && "text-pd-accent")} />
        </Button>

        {/* Present button */}
        <motion.div {...buttonPress}>
          <Button
            onClick={onPresent}
            size="sm"
            className="rounded-lg bg-pd-text text-pd-canvas transition-shadow hover:shadow-float"
          >
            <Play className="h-3.5 w-3.5" />
            Present
          </Button>
        </motion.div>
      </div>
    </header>
  );
}
