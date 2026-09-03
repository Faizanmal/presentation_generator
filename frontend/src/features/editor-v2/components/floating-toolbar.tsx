"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Type,
  Pilcrow,
  Image as ImageIcon,
  MessageSquarePlus,
  Hash,
  Quote,
  BarChart3,
  ChevronUp,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toolbarEntrance, motionTiming, motionEase, springSnappy, buttonPress } from "../lib/motion";
import type { EditorTool } from "../types";

interface FloatingToolbarProps {
  activeTool: EditorTool;
  onSetTool: (tool: EditorTool) => void;
  onInsertHeading: () => void;
  onInsertParagraph: () => void;
  onInsertImage: () => void;
  onInsertStat?: () => void;
  onInsertQuote?: () => void;
  onInsertChart?: () => void;
  onOpenAI: () => void;
  onAddComment: () => void;
}

const primaryActions = [
  { id: "heading", label: "Heading", icon: Type, shortcut: "H" },
  { id: "paragraph", label: "Body", icon: Pilcrow, shortcut: "T" },
  { id: "image", label: "Image", icon: ImageIcon, shortcut: "I" },
  { id: "comment", label: "Comment", icon: MessageSquarePlus, shortcut: "C" },
] as const;

const expandedActions = [
  { id: "stat", label: "Stat", icon: Hash },
  { id: "quote", label: "Quote", icon: Quote },
  { id: "chart", label: "Chart", icon: BarChart3 },
] as const;

export function FloatingToolbar({
  activeTool,
  onSetTool,
  onInsertHeading,
  onInsertParagraph,
  onInsertImage,
  onInsertStat,
  onInsertQuote,
  onInsertChart,
  onOpenAI,
  onAddComment,
}: FloatingToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case "heading":
        onInsertHeading();
        onSetTool("text");
        break;
      case "paragraph":
        onInsertParagraph();
        onSetTool("text");
        break;
      case "image":
        onInsertImage();
        onSetTool("image");
        break;
      case "comment":
        onAddComment();
        onSetTool("comment");
        break;
      case "stat":
        onInsertStat?.();
        onSetTool("text");
        break;
      case "quote":
        onInsertQuote?.();
        onSetTool("text");
        break;
      case "chart":
        onInsertChart?.();
        onSetTool("text");
        break;
      default:
        break;
    }
  };

  const isToolActive = (actionId: string) => {
    if ((actionId === "heading" || actionId === "paragraph") && activeTool === "text") {
      return true;
    }
    if (actionId === "image" && activeTool === "image") {
      return true;
    }
    if (actionId === "comment" && activeTool === "comment") {
      return true;
    }
    return false;
  };

  return (
    <motion.div
      {...toolbarEntrance}
      className="pointer-events-auto absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {/* ── Expanded block types ────────────────────────────────── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ y: 8, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.95 }}
            transition={{ duration: motionTiming.normal, ease: motionEase.smooth }}
            className="flex items-center gap-1 rounded-xl pd-surface-glass p-1.5"
          >
            {expandedActions.map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.id}
                  type="button"
                  onClick={() => handleAction(action.id)}
                  {...buttonPress}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-pd-text-secondary transition hover:bg-pd-panel hover:text-pd-text"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {action.label}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Primary toolbar ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 rounded-2xl border border-pd-border bg-pd-elevated/92 p-1.5 shadow-float backdrop-blur-xl">
        {/* Expand toggle */}
        <motion.button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={springSnappy}
          className="rounded-lg p-2 text-pd-muted transition hover:bg-pd-panel hover:text-pd-text"
          aria-label={isExpanded ? "Collapse block types" : "More block types"}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </motion.button>

        <div className="mx-0.5 h-6 w-px bg-pd-border" />

        {/* Primary actions */}
        {primaryActions.map((action) => {
          const Icon = action.icon;
          const isActive = isToolActive(action.id);

          return (
            <motion.button
              key={action.id}
              type="button"
              onClick={() => handleAction(action.id)}
              {...buttonPress}
              className={cn(
                "relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition",
                isActive
                  ? "bg-pd-accent text-white"
                  : "text-pd-text-secondary hover:bg-pd-panel hover:text-pd-text",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {action.label}
              {isActive && (
                <motion.div
                  layoutId="floating-active-indicator"
                  className="absolute inset-0 rounded-xl bg-pd-accent"
                  transition={springSnappy}
                  style={{ zIndex: -1 }}
                />
              )}
            </motion.button>
          );
        })}

        <div className="mx-1 h-6 w-px bg-pd-border" />

        {/* AI compose button */}
        <motion.button
          type="button"
          onClick={onOpenAI}
          whileHover={{
            boxShadow: "0 0 24px rgba(77, 116, 255, 0.3)",
          }}
          {...buttonPress}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-pd-accent to-[oklch(0.72_0.18_295)] px-4 py-2 text-xs font-semibold text-white shadow-glow-subtle"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          >
            <Wand2 className="h-3.5 w-3.5" />
          </motion.div>
          AI Compose
        </motion.button>
      </div>
    </motion.div>
  );
}
