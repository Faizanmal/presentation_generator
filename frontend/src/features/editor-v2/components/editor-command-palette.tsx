"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Sparkles,
  Plus,
  Play,
  Sun,
  MessageSquare,
  Layout,
  Type,
  Pilcrow,
  Image as ImageIcon,
  Command,
  ArrowUp,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { scaleInVariants, motionTiming, motionEase, staggerContainerFast, staggerChild } from "../lib/motion";
import { fuzzyMatch } from "../lib/fuzzy-search";
import type { CommandDefinition } from "../types";

interface EditorCommandPaletteProps {
  open: boolean;
  query: string;
  commands: CommandDefinition[];
  onQueryChange: (query: string) => void;
  onClose: () => void;
}

const GROUP_ICONS: Record<string, typeof Search> = {
  Global: Command,
  Insert: Plus,
  AI: Sparkles,
  Navigation: Layout,
  View: Sun,
};

export function EditorCommandPalette({
  open,
  query,
  commands,
  onQueryChange,
  onClose,
}: EditorCommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }
    return commands.filter(
      (cmd) =>
        fuzzyMatch(query, cmd.label) ||
        cmd.keywords.some((kw) => fuzzyMatch(query, kw)),
    );
  }, [commands, query]);

  const groupedCommands = useMemo(() => {
    const groups = new Map<string, CommandDefinition[]>();
    for (const cmd of filteredCommands) {
      const list = groups.get(cmd.group) ?? [];
      list.push(cmd);
      groups.set(cmd.group, list);
    }
    return groups;
  }, [filteredCommands]);

  // Reset selection on filter change
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSelectedIndex(0));
    return () => cancelAnimationFrame(frame);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const runCommand = useCallback(
    (command: CommandDefinition) => {
      command.run();
      onClose();
    },
    [onClose],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          runCommand(cmd);
        }
      }
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredCommands, onClose, open, runCommand, selectedIndex]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) {
      return;
    }
    const selected = listRef.current.querySelector("[data-selected='true']");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) {
    return null;
  }

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionTiming.quick }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            variants={scaleInVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed left-1/2 top-[18%] z-[61] w-full max-w-[560px] -translate-x-1/2 overflow-hidden rounded-2xl border border-pd-border bg-pd-panel shadow-modal"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-pd-border px-4 py-3">
              <Search className="h-4 w-4 flex-shrink-0 text-pd-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Type a command or search…"
                className="h-7 flex-1 bg-transparent text-sm text-pd-text outline-none placeholder:text-pd-muted"
              />
              <kbd className="rounded border border-pd-border bg-pd-sunken px-1.5 py-0.5 text-[10px] text-pd-muted">
                esc
              </kbd>
            </div>

            {/* Command list */}
            <div
              ref={listRef}
              className="max-h-[360px] overflow-y-auto p-2 pd-scrollbar-thin"
            >
              {filteredCommands.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Search className="mb-2 h-6 w-6 text-pd-muted opacity-40" />
                  <p className="text-sm text-pd-text-secondary">No commands found</p>
                  <p className="mt-1 text-xs text-pd-muted">Try a different search term</p>
                </div>
              ) : (
                Array.from(groupedCommands.entries()).map(([group, cmds]) => {
                  const GroupIcon = GROUP_ICONS[group] ?? Command;
                  return (
                    <div key={group} className="mb-1">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <GroupIcon className="h-3 w-3 text-pd-muted" />
                        <span className="text-[10px] uppercase tracking-[0.12em] text-pd-muted">
                          {group}
                        </span>
                      </div>
                      {cmds.map((cmd) => {
                        flatIndex++;
                        const isSelected = flatIndex === selectedIndex;
                        const currentIdx = flatIndex;

                        return (
                          <button
                            key={cmd.id}
                            type="button"
                            data-selected={isSelected}
                            onMouseEnter={() => setSelectedIndex(currentIdx)}
                            onClick={() => runCommand(cmd)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition",
                              isSelected
                                ? "bg-pd-accent text-white"
                                : "text-pd-text hover:bg-pd-elevated",
                            )}
                          >
                            <span>{cmd.label}</span>
                            {cmd.shortcut && (
                              <kbd
                                className={cn(
                                  "rounded border px-1.5 py-0.5 text-[10px]",
                                  isSelected
                                    ? "border-white/30 bg-white/15 text-white/80"
                                    : "border-pd-border bg-pd-sunken text-pd-muted",
                                )}
                              >
                                {cmd.shortcut}
                              </kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center justify-between border-t border-pd-border px-4 py-2 text-[10px] text-pd-muted">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <ArrowUp className="h-2.5 w-2.5" />
                  <ArrowUp className="h-2.5 w-2.5 rotate-180" />
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <CornerDownLeft className="h-2.5 w-2.5" />
                  Execute
                </span>
              </div>
              <span>{filteredCommands.length} commands</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
