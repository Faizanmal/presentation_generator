"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
    Type,
    Image,
    List,
    ListOrdered,
    Quote,
    Code,
    Table,
    LayoutGrid,
    Minus,
    BarChart2,
    Video,
    Link,
    FileText,
    Sparkles,
    ChevronRight,
    Search,
    LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SlashCommand {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    keywords: string[];
    category: "text" | "media" | "layout" | "embed" | "ai";
    action: () => void;
}

interface SlashCommandMenuProps {
    isOpen: boolean;
    position: { x: number; y: number };
    onClose: () => void;
    onSelect: (command: SlashCommand) => void;
}

const defaultCommands: Omit<SlashCommand, "action">[] = [
    // Text
    {
        id: "heading1",
        name: "Heading 1",
        description: "Large heading",
        icon: Type,
        keywords: ["h1", "title", "heading", "big"],
        category: "text",
    },
    {
        id: "heading2",
        name: "Heading 2",
        description: "Medium heading",
        icon: Type,
        keywords: ["h2", "subtitle", "heading"],
        category: "text",
    },
    {
        id: "paragraph",
        name: "Paragraph",
        description: "Plain text",
        icon: FileText,
        keywords: ["text", "paragraph", "body"],
        category: "text",
    },
    {
        id: "bulletList",
        name: "Bullet List",
        description: "Unordered list",
        icon: List,
        keywords: ["bullet", "list", "ul", "unordered"],
        category: "text",
    },
    {
        id: "numberedList",
        name: "Numbered List",
        description: "Ordered list",
        icon: ListOrdered,
        keywords: ["number", "list", "ol", "ordered"],
        category: "text",
    },
    {
        id: "quote",
        name: "Quote",
        description: "Blockquote",
        icon: Quote,
        keywords: ["quote", "blockquote", "citation"],
        category: "text",
    },
    {
        id: "code",
        name: "Code Block",
        description: "Code snippet",
        icon: Code,
        keywords: ["code", "snippet", "programming"],
        category: "text",
    },
    // Media
    {
        id: "image",
        name: "Image",
        description: "Upload or embed image",
        icon: Image,
        keywords: ["image", "picture", "photo", "img"],
        category: "media",
    },
    {
        id: "video",
        name: "Video",
        description: "Embed video",
        icon: Video,
        keywords: ["video", "youtube", "vimeo", "embed"],
        category: "media",
    },
    {
        id: "chart",
        name: "Chart",
        description: "Data visualization",
        icon: BarChart2,
        keywords: ["chart", "graph", "data", "visualization"],
        category: "media",
    },
    // Layout
    {
        id: "table",
        name: "Table",
        description: "Insert table",
        icon: Table,
        keywords: ["table", "grid", "spreadsheet"],
        category: "layout",
    },
    {
        id: "columns",
        name: "Columns",
        description: "Multi-column layout",
        icon: LayoutGrid,
        keywords: ["columns", "layout", "grid", "two"],
        category: "layout",
    },
    {
        id: "divider",
        name: "Divider",
        description: "Horizontal line",
        icon: Minus,
        keywords: ["divider", "line", "separator", "hr"],
        category: "layout",
    },
    // Embed
    {
        id: "link",
        name: "Link",
        description: "Add a hyperlink",
        icon: Link,
        keywords: ["link", "url", "hyperlink"],
        category: "embed",
    },
    // AI
    {
        id: "aiGenerate",
        name: "AI Generate",
        description: "Generate content with AI",
        icon: Sparkles,
        keywords: ["ai", "generate", "write", "create", "magic"],
        category: "ai",
    },
];

const categoryLabels: Record<string, string> = {
    text: "Text",
    media: "Media",
    layout: "Layout",
    embed: "Embed",
    ai: "AI",
};

const categoryOrder = ["ai", "text", "media", "layout", "embed"];

export function SlashCommandMenu({
    isOpen,
    position,
    onClose,
    onSelect,
}: SlashCommandMenuProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter commands based on search
    const filteredCommands = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (!query) return defaultCommands;

        return defaultCommands.filter(
            (cmd) =>
                cmd.name.toLowerCase().includes(query) ||
                cmd.description.toLowerCase().includes(query) ||
                cmd.keywords.some((k) => k.includes(query))
        );
    }, [searchQuery]);

    // Group commands by category
    const groupedCommands = useMemo(() => {
        const groups: Record<string, typeof defaultCommands> = {};

        for (const cmd of filteredCommands) {
            if (!groups[cmd.category]) {
                groups[cmd.category] = [];
            }
            groups[cmd.category].push(cmd);
        }

        // Sort by category order
        return categoryOrder
            .filter((cat) => groups[cat]?.length > 0)
            .map((cat) => ({
                category: cat,
                label: categoryLabels[cat],
                commands: groups[cat],
            }));
    }, [filteredCommands]);

    // Flatten for keyboard navigation
    const flatCommands = useMemo(() => {
        return groupedCommands.flatMap((g) => g.commands);
    }, [groupedCommands]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSearchQuery("");
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedIndex(0);
            inputRef.current?.focus();
        }
    }, [isOpen]);

    // Handle keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                        prev < flatCommands.length - 1 ? prev + 1 : 0
                    );
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                        prev > 0 ? prev - 1 : flatCommands.length - 1
                    );
                    break;
                case "Enter":
                    e.preventDefault();
                    if (flatCommands[selectedIndex]) {
                        onSelect(flatCommands[selectedIndex] as SlashCommand);
                    }
                    break;
                case "Escape":
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, flatCommands, selectedIndex, onSelect, onClose]);

    // Click outside to close
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="absolute z-50 w-72 bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            style={{
                left: position.x,
                top: position.y,
            }}
        >
            {/* Search Input */}
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        placeholder="Filter options..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-transparent border-0 focus:outline-none focus:ring-0"
                    />
                </div>
            </div>

            {/* Commands List */}
            <div className="max-h-64 overflow-y-auto py-1">
                {groupedCommands.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-slate-500">
                        No matching commands
                    </div>
                ) : (
                    groupedCommands.map((group) => (
                        <div key={group.category}>
                            <div className="px-3 py-1.5 text-xs font-medium text-slate-500 uppercase">
                                {group.label}
                            </div>
                            {group.commands.map((cmd) => {
                                const index = flatCommands.indexOf(cmd);
                                const Icon = cmd.icon;

                                return (
                                    <button
                                        key={cmd.id}
                                        onClick={() => onSelect(cmd as SlashCommand)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                                            index === selectedIndex
                                                ? "bg-blue-50 dark:bg-blue-950/50"
                                                : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "p-1.5 rounded",
                                                index === selectedIndex
                                                    ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                                                {cmd.name}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate">
                                                {cmd.description}
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                                    </button>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">
                    <kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 rounded text-[10px]">
                        ↑↓
                    </kbd>{" "}
                    to navigate •{" "}
                    <kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 rounded text-[10px]">
                        ↵
                    </kbd>{" "}
                    to select •{" "}
                    <kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 rounded text-[10px]">
                        Esc
                    </kbd>{" "}
                    to close
                </p>
            </div>
        </div>
    );
}

// Hook to trigger slash command menu
export function useSlashCommands(
    onInsertBlock: (type: string) => void
) {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === "/" && !isOpen) {
            // Get cursor position for menu placement
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setPosition({
                    x: rect.left,
                    y: rect.bottom + 8,
                });
                setIsOpen(true);
            }
        }
    }, [isOpen]);

    const handleSelect = useCallback((command: SlashCommand) => {
        setIsOpen(false);
        onInsertBlock(command.id);
    }, [onInsertBlock]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    return {
        isOpen,
        position,
        handleKeyDown,
        handleSelect,
        handleClose,
    };
}
