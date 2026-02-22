"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface ShortcutCategory {
    name: string;
    shortcuts: {
        keys: string[];
        description: string;
    }[];
}

const shortcutCategories: ShortcutCategory[] = [
    {
        name: "General",
        shortcuts: [
            { keys: ["⌘", "K"], description: "Open Command Palette" },
            { keys: ["⌘", "N"], description: "New Presentation" },
            { keys: ["⌘", "G"], description: "Generate with AI" },
            { keys: ["⌘", "S"], description: "Save" },
            { keys: ["⌘", "/"], description: "Show Keyboard Shortcuts" },
            { keys: ["⌘", "T"], description: "Toggle Theme (Dark/Light)" },
        ],
    },
    {
        name: "Editor",
        shortcuts: [
            { keys: ["⌘", "Z"], description: "Undo" },
            { keys: ["⌘", "⇧", "Z"], description: "Redo" },
            { keys: ["⌘", "C"], description: "Copy" },
            { keys: ["⌘", "V"], description: "Paste" },
            { keys: ["⌘", "X"], description: "Cut" },
            { keys: ["⌘", "A"], description: "Select All" },
            { keys: ["⌘", "D"], description: "Duplicate Selection" },
            { keys: ["Delete"], description: "Delete Selection" },
        ],
    },
    {
        name: "Slides",
        shortcuts: [
            { keys: ["⌘", "Enter"], description: "Add New Slide" },
            { keys: ["⌘", "⇧", "D"], description: "Duplicate Slide" },
            { keys: ["↑"], description: "Previous Slide" },
            { keys: ["↓"], description: "Next Slide" },
            { keys: ["⌘", "↑"], description: "Move Slide Up" },
            { keys: ["⌘", "↓"], description: "Move Slide Down" },
        ],
    },
    {
        name: "Text Formatting",
        shortcuts: [
            { keys: ["⌘", "B"], description: "Bold" },
            { keys: ["⌘", "I"], description: "Italic" },
            { keys: ["⌘", "U"], description: "Underline" },
            { keys: ["⌘", "⇧", "S"], description: "Strikethrough" },
            { keys: ["⌘", "⇧", "H"], description: "Highlight" },
            { keys: ["⌘", "K"], description: "Add Link" },
        ],
    },
    {
        name: "Blocks",
        shortcuts: [
            { keys: ["/"], description: "Open Block Menu (in editor)" },
            { keys: ["⌘", "⇧", "1"], description: "Heading 1" },
            { keys: ["⌘", "⇧", "2"], description: "Heading 2" },
            { keys: ["⌘", "⇧", "3"], description: "Heading 3" },
            { keys: ["⌘", "⇧", "K"], description: "Code Block" },
            { keys: ["⌘", "⇧", "Q"], description: "Quote Block" },
        ],
    },
    {
        name: "Presentation Mode",
        shortcuts: [
            { keys: ["Space"], description: "Next Slide" },
            { keys: ["→"], description: "Next Slide" },
            { keys: ["←"], description: "Previous Slide" },
            { keys: ["Esc"], description: "Exit Presentation" },
            { keys: ["F"], description: "Toggle Fullscreen" },
            { keys: ["P"], description: "Toggle Pointer" },
            { keys: ["B"], description: "Toggle Blackout" },
        ],
    },
    {
        name: "Views & Panels",
        shortcuts: [
            { keys: ["⌘", "P"], description: "Present" },
            { keys: ["⌘", "E"], description: "Export" },
            { keys: ["⌘", "⇧", "C"], description: "Toggle Comments Panel" },
            { keys: ["⌘", "⇧", "H"], description: "Toggle History Panel" },
            { keys: ["⌘", "⇧", "O"], description: "Toggle Outline" },
        ],
    },
];

interface KeyboardShortcutsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({
    open,
    onOpenChange,
}: KeyboardShortcutsDialogProps) {
    // Listen for Cmd/Ctrl + / to toggle
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onOpenChange(!open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [open, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5" />
                        Keyboard Shortcuts
                    </DialogTitle>
                    <DialogDescription>
                        Master these shortcuts to speed up your workflow
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[60vh] p-1">
                    {shortcutCategories.map((category) => (
                        <div key={category.name} className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                {category.name}
                            </h3>
                            <div className="space-y-1">
                                {category.shortcuts.map((shortcut) => (
                                    <div
                                        key={shortcut.description}
                                        className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            {shortcut.description}
                                        </span>
                                        <div className="flex items-center gap-0.5">
                                            {shortcut.keys.map((key) => (
                                                <kbd
                                                    key={key}
                                                    className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm"
                                                >
                                                    {key}
                                                </kbd>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                        Tip: On Windows, use <kbd className="px-1 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 rounded">Ctrl</kbd> instead of <kbd className="px-1 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 rounded">⌘</kbd>
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Hook to manage keyboard shortcuts dialog state
export function useKeyboardShortcuts() {
    const [isOpen, setIsOpen] = useState(false);

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((prev) => !prev),
        setIsOpen,
    };
}
