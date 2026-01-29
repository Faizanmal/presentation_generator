"use client";

import { useState, useCallback, useEffect } from "react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    History,
    Undo,
    Redo,
    FileText,
    Image,
    Type,
    List,
    Code,
    Quote,
    Table,
    Trash2,
    Plus,
    Pencil,
    Move,
    RotateCcw,
    Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// History action types
export type HistoryActionType =
    | "add_slide"
    | "delete_slide"
    | "reorder_slide"
    | "update_slide"
    | "add_block"
    | "delete_block"
    | "update_block"
    | "reorder_block"
    | "update_theme"
    | "batch_update";

export interface HistoryEntry {
    id: string;
    actionType: HistoryActionType;
    description: string;
    timestamp: Date;
    data: {
        before: Record<string, unknown>;
        after: Record<string, unknown>;
    };
    slideId?: string;
    blockId?: string;
}

interface UndoHistoryState {
    past: HistoryEntry[];
    future: HistoryEntry[];
    maxHistoryLength: number;
}

// Hook to manage undo/redo state
export function useUndoHistory(maxLength = 50) {
    const [state, setState] = useState<UndoHistoryState>({
        past: [],
        future: [],
        maxHistoryLength: maxLength,
    });

    const pushAction = useCallback((entry: Omit<HistoryEntry, "id" | "timestamp">) => {
        setState((prev) => {
            const newEntry: HistoryEntry = {
                ...entry,
                id: crypto.randomUUID(),
                timestamp: new Date(),
            };

            return {
                ...prev,
                past: [...prev.past.slice(-(prev.maxHistoryLength - 1)), newEntry],
                future: [], // Clear future when new action is added
            };
        });
    }, []);

    const undo = useCallback(() => {
        setState((prev) => {
            if (prev.past.length === 0) return prev;

            const lastEntry = prev.past[prev.past.length - 1];
            return {
                ...prev,
                past: prev.past.slice(0, -1),
                future: [lastEntry, ...prev.future],
            };
        });

        // Return the entry that was undone
        return state.past[state.past.length - 1];
    }, [state.past]);

    const redo = useCallback(() => {
        setState((prev) => {
            if (prev.future.length === 0) return prev;

            const nextEntry = prev.future[0];
            return {
                ...prev,
                past: [...prev.past, nextEntry],
                future: prev.future.slice(1),
            };
        });

        // Return the entry that was redone
        return state.future[0];
    }, [state.future]);

    const canUndo = state.past.length > 0;
    const canRedo = state.future.length > 0;

    const jumpToState = useCallback((entryId: string) => {
        setState((prev) => {
            const pastIndex = prev.past.findIndex((e) => e.id === entryId);
            if (pastIndex !== -1) {
                // Jump to a past state
                return {
                    ...prev,
                    past: prev.past.slice(0, pastIndex + 1),
                    future: [...prev.past.slice(pastIndex + 1).reverse(), ...prev.future],
                };
            }

            const futureIndex = prev.future.findIndex((e) => e.id === entryId);
            if (futureIndex !== -1) {
                // Jump to a future state
                return {
                    ...prev,
                    past: [...prev.past, ...prev.future.slice(0, futureIndex + 1).reverse()],
                    future: prev.future.slice(futureIndex + 1),
                };
            }

            return prev;
        });
    }, []);

    const clearHistory = useCallback(() => {
        setState((prev) => ({
            ...prev,
            past: [],
            future: [],
        }));
    }, []);

    return {
        history: state.past,
        future: state.future,
        pushAction,
        undo,
        redo,
        canUndo,
        canRedo,
        jumpToState,
        clearHistory,
    };
}

// Get icon for action type
function getActionIcon(actionType: HistoryActionType) {
    switch (actionType) {
        case "add_slide":
            return <Plus className="h-3 w-3" />;
        case "delete_slide":
            return <Trash2 className="h-3 w-3" />;
        case "reorder_slide":
        case "reorder_block":
            return <Move className="h-3 w-3" />;
        case "update_slide":
        case "update_block":
            return <Pencil className="h-3 w-3" />;
        case "add_block":
            return <Plus className="h-3 w-3" />;
        case "delete_block":
            return <Trash2 className="h-3 w-3" />;
        case "update_theme":
            return <Image className="h-3 w-3" />;
        case "batch_update":
            return <List className="h-3 w-3" />;
        default:
            return <FileText className="h-3 w-3" />;
    }
}

// Get color for action type
function getActionColor(actionType: HistoryActionType): string {
    switch (actionType) {
        case "add_slide":
        case "add_block":
            return "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
        case "delete_slide":
        case "delete_block":
            return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
        case "update_slide":
        case "update_block":
        case "update_theme":
            return "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
        case "reorder_slide":
        case "reorder_block":
            return "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400";
        default:
            return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
    }
}

interface UndoHistoryPanelProps {
    history: HistoryEntry[];
    future: HistoryEntry[];
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onJumpToState: (entryId: string) => void;
    onClearHistory: () => void;
}

export function UndoHistoryPanel({
    history,
    future,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onJumpToState,
    onClearHistory,
}: UndoHistoryPanelProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Listen for keyboard shortcut (Cmd/Ctrl + Shift + H)
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "h" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
                e.preventDefault();
                setIsOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    // Combined timeline: past (in order) + current position + future (reversed)
    const allEntries = [
        ...history.map((e) => ({ ...e, isPast: true, isFuture: false })),
        ...future.slice().reverse().map((e) => ({ ...e, isPast: false, isFuture: true })),
    ];

    const currentPosition = history.length;

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    title="History (⌘⇧H)"
                >
                    <History className="h-4 w-4" />
                    <span className="hidden sm:inline">History</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 sm:w-96 p-0">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Edit History
                    </SheetTitle>
                    <SheetDescription>
                        View and restore previous states
                    </SheetDescription>
                </SheetHeader>

                {/* Undo/Redo Controls */}
                <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onUndo}
                            disabled={!canUndo}
                            className="gap-1.5"
                        >
                            <Undo className="h-4 w-4" />
                            Undo
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRedo}
                            disabled={!canRedo}
                            className="gap-1.5"
                        >
                            <Redo className="h-4 w-4" />
                            Redo
                        </Button>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearHistory}
                        className="text-slate-500 hover:text-red-600"
                        disabled={history.length === 0 && future.length === 0}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>

                {/* History Timeline */}
                <ScrollArea className="h-[calc(100vh-220px)]">
                    <div className="p-4">
                        {allEntries.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">No history yet</p>
                                <p className="text-xs mt-1">
                                    Your changes will appear here
                                </p>
                            </div>
                        ) : (
                            <div className="relative">
                                {/* Timeline line */}
                                <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-slate-200 dark:bg-slate-700" />

                                <div className="space-y-2">
                                    {/* Current state indicator */}
                                    {history.length > 0 && (
                                        <div className="flex items-center gap-3 py-2">
                                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center z-10 ring-4 ring-white dark:ring-slate-900">
                                                <RotateCcw className="h-4 w-4 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                    Current State
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {history.length} change{history.length !== 1 ? "s" : ""} made
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* History entries */}
                                    {allEntries.map((entry, index) => {
                                        const isCurrentBoundary = entry.isPast && index === history.length - 1;

                                        return (
                                            <button
                                                key={entry.id}
                                                onClick={() => onJumpToState(entry.id)}
                                                className={cn(
                                                    "w-full flex items-start gap-3 p-2 rounded-lg text-left transition-all",
                                                    "hover:bg-slate-100 dark:hover:bg-slate-800",
                                                    entry.isFuture && "opacity-50"
                                                )}
                                            >
                                                {/* Icon */}
                                                <div
                                                    className={cn(
                                                        "w-10 h-10 rounded-full flex items-center justify-center z-10",
                                                        getActionColor(entry.actionType)
                                                    )}
                                                >
                                                    {getActionIcon(entry.actionType)}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0 pt-1">
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                        {entry.description}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                                                    </p>
                                                </div>

                                                {/* Future indicator */}
                                                {entry.isFuture && (
                                                    <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                        Redoable
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="p-4 border-t bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500 text-center">
                        Click any entry to restore that state
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// Compact undo/redo buttons for toolbar
export function UndoRedoButtons({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
}: {
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
}) {
    return (
        <div className="flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (⌘Z)"
                className="h-8 w-8"
            >
                <Undo className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (⌘⇧Z)"
                className="h-8 w-8"
            >
                <Redo className="h-4 w-4" />
            </Button>
        </div>
    );
}
