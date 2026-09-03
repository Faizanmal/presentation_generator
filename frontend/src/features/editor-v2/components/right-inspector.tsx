"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  SlidersHorizontal,
  Users,
  Zap,
  CheckCircle2,
  Send,
  Sparkles,
  Lock,
  Unlock,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { staggerContainer, staggerChild, motionTiming, motionEase, buttonPress } from "../lib/motion";
import type { EditorBlock, EditorComment, LayoutScore, PresenceUser } from "../types";

interface RightInspectorProps {
  selectedBlock: EditorBlock | null;
  layoutScore: LayoutScore;
  collaborators: PresenceUser[];
  comments: EditorComment[];
  onAddInlineComment: (content: string) => void;
  onResolveComment?: (commentId: string) => void;
  onToggleBlockLock?: () => void;
  onRegenerateSlide?: () => void;
  isRegenerating?: boolean;
}

const tabs = [
  { id: "design", label: "Design", icon: SlidersHorizontal },
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "presence", label: "Live", icon: Users },
] as const;

type InspectorTab = (typeof tabs)[number]["id"];

function ScoreBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-pd-text-secondary">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-pd-sunken">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: motionEase.smooth }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function RightInspector({
  selectedBlock,
  layoutScore,
  collaborators,
  comments,
  onAddInlineComment,
  onResolveComment,
  onToggleBlockLock,
  onRegenerateSlide,
  isRegenerating = false,
}: RightInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("design");
  const [draftComment, setDraftComment] = useState("");

  const typingNames = useMemo(
    () =>
      collaborators
        .filter((participant) => participant.isTyping)
        .map((participant) => participant.name),
    [collaborators],
  );

  const unresolvedComments = useMemo(
    () => comments.filter((c) => !c.resolved),
    [comments],
  );

  const scoreColor =
    layoutScore.overall >= 85
      ? "var(--pd-sys-success)"
      : layoutScore.overall >= 65
        ? "var(--pd-sys-warning)"
        : "var(--pd-sys-danger)";

  return (
    <aside className="flex h-full w-[var(--pd-comp-inspector-w)] flex-col border-l border-pd-border bg-pd-panel/90 backdrop-blur-xl">
      {/* Tabs */}
      <div className="flex h-11 border-b border-pd-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          const badge =
            tab.id === "comments" && unresolvedComments.length > 0
              ? unresolvedComments.length
              : tab.id === "presence"
                ? collaborators.length
                : null;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-1.5 text-xs font-medium transition",
                isActive
                  ? "text-pd-text"
                  : "text-pd-text-secondary hover:text-pd-text",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{tab.label}</span>
              {badge !== null && badge > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-pd-accent px-1 text-[9px] font-bold text-white">
                  {badge}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="inspector-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-pd-accent"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 pd-scrollbar-thin">
        <AnimatePresence mode="wait">
          {/* ── Design Tab ─────────────────────────────────────── */}
          {activeTab === "design" && (
            <motion.div
              key="design"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: motionTiming.quick, ease: motionEase.out }}
              className="space-y-4"
            >
              {/* Layout score */}
              <div className="rounded-xl border border-pd-border bg-pd-elevated p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-pd-muted">
                    Layout Health
                  </p>
                  <motion.span
                    key={layoutScore.overall}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-lg font-bold tabular-nums"
                    style={{ color: scoreColor }}
                  >
                    {layoutScore.overall}
                  </motion.span>
                </div>
                <div className="space-y-2.5">
                  <ScoreBar value={layoutScore.whitespace} label="Whitespace" color="var(--pd-sys-accent)" />
                  <ScoreBar value={layoutScore.hierarchy} label="Hierarchy" color="var(--pd-ref-emerald-400)" />
                  <ScoreBar value={layoutScore.visualBalance} label="Balance" color="var(--pd-ref-violet-400)" />
                </div>
              </div>

              {/* Selected block */}
              <div className="rounded-xl border border-pd-border bg-pd-elevated p-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-pd-muted">
                  Selected Block
                </p>
                {selectedBlock ? (
                  <motion.div
                    key={selectedBlock.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: motionTiming.quick }}
                  >
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-md bg-pd-accent-ultra-soft px-2 py-0.5 text-xs font-medium text-pd-accent">
                        {selectedBlock.type}
                      </span>
                      <button
                        type="button"
                        onClick={onToggleBlockLock}
                        className="rounded-md p-1 text-pd-muted transition hover:bg-pd-elevated hover:text-pd-text"
                        aria-label={
                          selectedBlock.locked
                            ? "Unpin from AI regeneration"
                            : "Pin — AI will not change this block"
                        }
                        title={
                          selectedBlock.locked
                            ? "Pinned: AI will keep this on regenerate"
                            : "Pin so AI keeps this on regenerate"
                        }
                      >
                        {selectedBlock.locked ? (
                          <Lock className="h-3 w-3 text-pd-accent" />
                        ) : (
                          <Unlock className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                      <div className="rounded-lg bg-pd-sunken px-2 py-1.5 text-center">
                        <p className="text-pd-muted">W</p>
                        <p className="font-medium tabular-nums">{Math.round(selectedBlock.frame.width)}</p>
                      </div>
                      <div className="rounded-lg bg-pd-sunken px-2 py-1.5 text-center">
                        <p className="text-pd-muted">H</p>
                        <p className="font-medium tabular-nums">{Math.round(selectedBlock.frame.height)}</p>
                      </div>
                      <div className="rounded-lg bg-pd-sunken px-2 py-1.5 text-center">
                        <p className="text-pd-muted">X</p>
                        <p className="font-medium tabular-nums">{Math.round(selectedBlock.frame.x)}</p>
                      </div>
                      <div className="rounded-lg bg-pd-sunken px-2 py-1.5 text-center">
                        <p className="text-pd-muted">Y</p>
                        <p className="font-medium tabular-nums">{Math.round(selectedBlock.frame.y)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <RotateCw className="h-3 w-3 text-pd-muted" />
                      <span className="text-xs tabular-nums text-pd-text-secondary">
                        {selectedBlock.frame.rotation}°
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <p className="mt-2 text-xs text-pd-text-secondary">
                    Select a block to inspect and tune its properties.
                  </p>
                )}
              </div>

              {/* AI Quick Actions */}
              <div className="rounded-xl border border-pd-border bg-pd-elevated p-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-pd-muted">AI Quick Actions</p>
                <div className="mt-2 space-y-1.5">
                  <motion.button
                    type="button"
                    {...buttonPress}
                    onClick={onRegenerateSlide}
                    disabled={isRegenerating || !onRegenerateSlide}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-pd-text-secondary transition hover:bg-pd-accent-ultra-soft hover:text-pd-text disabled:opacity-40"
                  >
                    <RotateCw className={cn("h-3 w-3 text-pd-accent", isRegenerating && "animate-spin")} />
                    {isRegenerating ? "Regenerating slide…" : "Regenerate this slide"}
                  </motion.button>
                  <motion.button
                    type="button"
                    {...buttonPress}
                    onClick={onToggleBlockLock}
                    disabled={!selectedBlock || !onToggleBlockLock}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-pd-text-secondary transition hover:bg-pd-accent-ultra-soft hover:text-pd-text disabled:opacity-40"
                  >
                    {selectedBlock?.locked ? (
                      <Unlock className="h-3 w-3 text-pd-accent" />
                    ) : (
                      <Lock className="h-3 w-3 text-pd-accent" />
                    )}
                    {selectedBlock?.locked ? "Unpin block from AI" : "Pin block from AI"}
                  </motion.button>
                  {["Rewrite for clarity", "Expand with data", "Simplify language"].map((action) => (
                    <motion.button
                      key={action}
                      type="button"
                      {...buttonPress}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-pd-text-secondary transition hover:bg-pd-accent-ultra-soft hover:text-pd-text"
                    >
                      <Sparkles className="h-3 w-3 text-pd-accent" />
                      {action}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Comments Tab ───────────────────────────────────── */}
          {activeTab === "comments" && (
            <motion.div
              key="comments"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: motionTiming.quick, ease: motionEase.out }}
              className="space-y-3"
            >
              {/* New comment */}
              <div className="rounded-xl border border-pd-border bg-pd-elevated p-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-pd-muted">
                  New Comment
                </p>
                <textarea
                  value={draftComment}
                  onChange={(event) => setDraftComment(event.target.value)}
                  className="mt-2 h-20 w-full resize-none rounded-lg border border-pd-border bg-pd-sunken p-2 text-xs text-pd-text outline-none transition focus:border-pd-border-focus"
                  placeholder="Share feedback on this slide…"
                />
                <div className="mt-2 flex justify-end">
                  <motion.button
                    type="button"
                    {...buttonPress}
                    onClick={() => {
                      if (!draftComment.trim()) {
                        return;
                      }
                      onAddInlineComment(draftComment.trim());
                      setDraftComment("");
                    }}
                    disabled={!draftComment.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-pd-accent px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
                  >
                    <Send className="h-3 w-3" />
                    Send
                  </motion.button>
                </div>
              </div>

              {/* Comments list */}
              {comments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-pd-border p-4 text-center">
                  <MessageSquare className="mx-auto mb-2 h-5 w-5 text-pd-muted opacity-40" />
                  <p className="text-xs text-pd-text-secondary">
                    No comments yet. Start a conversation.
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  {comments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      variants={staggerChild}
                      className={cn(
                        "rounded-xl border border-pd-border bg-pd-elevated p-3 transition",
                        comment.resolved && "opacity-50",
                      )}
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: comment.authorColor }}
                          />
                          <p className="text-xs font-semibold text-pd-text">
                            {comment.authorName}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <p className="text-[10px] text-pd-muted">
                            {new Date(comment.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {!comment.resolved && onResolveComment && (
                            <button
                              type="button"
                              onClick={() => onResolveComment(comment.id)}
                              className="rounded-md p-0.5 text-pd-muted transition hover:text-pd-success"
                              aria-label="Resolve comment"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-pd-text-secondary">
                        {comment.content}
                      </p>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── Presence Tab ───────────────────────────────────── */}
          {activeTab === "presence" && (
            <motion.div
              key="presence"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: motionTiming.quick, ease: motionEase.out }}
              className="space-y-3"
            >
              <div className="rounded-xl border border-pd-border bg-pd-elevated p-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-pd-muted">
                  Live Collaborators
                </p>
                <div className="mt-3 space-y-2">
                  {collaborators.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between rounded-lg p-1.5 transition hover:bg-pd-sunken"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <span
                            className="grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: participant.color }}
                          >
                            {participant.avatar}
                          </span>
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-pd-elevated bg-pd-success" />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-pd-text">
                            {participant.name}
                          </span>
                          {participant.isTyping && (
                            <span className="ml-1.5 text-[10px] text-pd-accent">typing…</span>
                          )}
                        </div>
                      </div>
                      <span className="rounded-md bg-pd-sunken px-1.5 py-0.5 text-[10px] text-pd-muted">
                        {participant.activeTool}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typing indicator */}
              <div className="rounded-xl border border-pd-border bg-pd-elevated p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs text-pd-text">
                  <Zap className="h-3.5 w-3.5 text-pd-accent" />
                  Activity
                </p>
                <p className="text-xs text-pd-text-secondary">
                  {typingNames.length > 0 ? (
                    <>
                      <span className="font-medium text-pd-text">{typingNames.join(", ")}</span>
                      {" "}
                      {typingNames.length === 1 ? "is" : "are"} typing
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="ml-1"
                      >
                        •••
                      </motion.span>
                    </>
                  ) : (
                    "No one is actively editing"
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
