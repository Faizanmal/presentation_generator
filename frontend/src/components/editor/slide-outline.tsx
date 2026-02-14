"use client";

import { useState, useEffect } from "react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    List,
    Search,
    ChevronRight,
    FileText,
    GripVertical,
    Eye,
    EyeOff,
    Trash2,
    MoreVertical,
    Copy,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Slide } from "@/types";

interface SlideOutlineProps {
    slides: Slide[];
    currentSlideId?: string;
    onSlideSelect: (slideId: string) => void;
    onSlideDelete?: (slideId: string) => void;
    onSlideDuplicate?: (slideId: string) => void;
    onSlideReorder?: (slideId: string, newPosition: number) => void;
}

interface OutlineItem {
    slideId: string;
    slideNumber: number;
    title: string;
    subtitle?: string;
    hasContent: boolean;
    blockCount: number;
}

function extractSlideTitle(slide: Slide): { title: string; subtitle?: string } {
    const blocks = slide.blocks || [];

    // Find heading block for title
    const headingBlock = blocks.find(
        (b) => b.blockType === "HEADING" || b.blockType === "SUBHEADING"
    );

    // Find paragraph or other content for subtitle
    const contentBlock = blocks.find(
        (b) => b.blockType === "PARAGRAPH" && b.id !== headingBlock?.id
    );

    const title = headingBlock?.content?.text as string || `Slide ${slide.order + 1}`;
    const subtitle = contentBlock?.content?.text as string | undefined;

    return {
        title: title.length > 50 ? `${title.substring(0, 47)  }...` : title,
        subtitle: subtitle ? (subtitle.length > 80 ? `${subtitle.substring(0, 77)  }...` : subtitle) : undefined,
    };
}

export function SlideOutline({
    slides,
    currentSlideId,
    onSlideSelect,
    onSlideDelete,
    onSlideDuplicate,
}: SlideOutlineProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [collapsedSlides, setCollapsedSlides] = useState<Set<string>>(new Set());

    // Convert slides to outline items
    const outlineItems: OutlineItem[] = slides
        .sort((a, b) => a.order - b.order)
        .map((slide, index) => {
            const { title, subtitle } = extractSlideTitle(slide);
            return {
                slideId: slide.id,
                slideNumber: index + 1,
                title,
                subtitle,
                hasContent: (slide.blocks?.length || 0) > 0,
                blockCount: slide.blocks?.length || 0,
            };
        });

    // Filter by search query
    const filteredItems = outlineItems.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Listen for keyboard shortcut (Cmd/Ctrl + Shift + O)
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "o" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
                e.preventDefault();
                setIsOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const toggleCollapse = (slideId: string) => {
        setCollapsedSlides((prev) => {
            const next = new Set(prev);
            if (next.has(slideId)) {
                next.delete(slideId);
            } else {
                next.add(slideId);
            }
            return next;
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    title="Open slide outline (⌘⇧O)"
                >
                    <List className="h-4 w-4" />
                    <span className="hidden sm:inline">Outline</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 sm:w-96 p-0">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <List className="h-5 w-5" />
                        Slide Outline
                    </SheetTitle>
                    <SheetDescription>
                        Navigate and manage your presentation slides
                    </SheetDescription>
                </SheetHeader>

                {/* Search */}
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search slides..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Slide List */}
                <ScrollArea className="h-[calc(100vh-180px)]">
                    <div className="p-2 space-y-1">
                        {filteredItems.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">
                                    {searchQuery ? "No slides match your search" : "No slides yet"}
                                </p>
                            </div>
                        ) : (
                            filteredItems.map((item) => (
                                <OutlineItemCard
                                    key={item.slideId}
                                    item={item}
                                    isActive={item.slideId === currentSlideId}
                                    isCollapsed={collapsedSlides.has(item.slideId)}
                                    onSelect={() => {
                                        onSlideSelect(item.slideId);
                                        setIsOpen(false);
                                    }}
                                    onToggleCollapse={() => toggleCollapse(item.slideId)}
                                    onDelete={onSlideDelete ? () => onSlideDelete(item.slideId) : undefined}
                                    onDuplicate={onSlideDuplicate ? () => onSlideDuplicate(item.slideId) : undefined}
                                />
                            ))
                        )}
                    </div>
                </ScrollArea>

                {/* Footer with summary */}
                <div className="p-4 border-t bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500 text-center">
                        {slides.length} slide{slides.length !== 1 ? "s" : ""} •{" "}
                        {slides.reduce((acc, s) => acc + (s.blocks?.length || 0), 0)} blocks
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function OutlineItemCard({
    item,
    isActive,
    isCollapsed,
    onSelect,
    onToggleCollapse,
    onDelete,
    onDuplicate,
}: {
    item: OutlineItem;
    isActive: boolean;
    isCollapsed: boolean;
    onSelect: () => void;
    onToggleCollapse: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
}) {
    return (
        <div
            className={cn(
                "group flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all",
                "hover:bg-slate-100 dark:hover:bg-slate-800",
                isActive && "bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800"
            )}
            onClick={onSelect}
        >
            {/* Drag Handle */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab pt-1">
                <GripVertical className="h-4 w-4 text-slate-400" />
            </div>

            {/* Slide Number */}
            <div
                className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-sm font-medium",
                    isActive
                        ? "bg-blue-500 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}
            >
                {item.slideNumber}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
                <h4
                    className={cn(
                        "text-sm font-medium truncate",
                        isActive ? "text-blue-900 dark:text-blue-100" : "text-slate-900 dark:text-white"
                    )}
                >
                    {item.title}
                </h4>
                {!isCollapsed && item.subtitle && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                    </p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {item.blockCount} block{item.blockCount !== 1 ? "s" : ""}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleCollapse();
                    }}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                    {isCollapsed ? (
                        <Eye className="h-3 w-3 text-slate-400" />
                    ) : (
                        <EyeOff className="h-3 w-3 text-slate-400" />
                    )}
                </button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                            <MoreVertical className="h-3 w-3 text-slate-400" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {onDuplicate && (
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDuplicate();
                                }}
                            >
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                            </DropdownMenuItem>
                        )}
                        {onDelete && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete();
                                    }}
                                    className="text-red-600"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

// Compact outline for embedding in sidebar
export function CompactSlideOutline({
    slides,
    currentSlideId,
    onSlideSelect,
}: {
    slides: Slide[];
    currentSlideId?: string;
    onSlideSelect: (slideId: string) => void;
}) {
    const sortedSlides = [...slides].sort((a, b) => a.order - b.order);

    return (
        <div className="space-y-1">
            {sortedSlides.map((slide, index) => {
                const { title } = extractSlideTitle(slide);
                const isActive = slide.id === currentSlideId;

                return (
                    <button
                        key={slide.id}
                        onClick={() => onSlideSelect(slide.id)}
                        className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                            "hover:bg-slate-100 dark:hover:bg-slate-800",
                            isActive && "bg-blue-50 dark:bg-blue-950/50"
                        )}
                    >
                        <span
                            className={cn(
                                "flex-shrink-0 w-5 h-5 rounded text-xs flex items-center justify-center",
                                isActive
                                    ? "bg-blue-500 text-white font-medium"
                                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                            )}
                        >
                            {index + 1}
                        </span>
                        <span
                            className={cn(
                                "flex-1 truncate text-sm",
                                isActive ? "text-blue-900 dark:text-blue-100 font-medium" : "text-slate-700 dark:text-slate-300"
                            )}
                        >
                            {title}
                        </span>
                        <ChevronRight
                            className={cn(
                                "h-3 w-3 flex-shrink-0 transition-opacity",
                                isActive ? "opacity-100" : "opacity-0"
                            )}
                        />
                    </button>
                );
            })}
        </div>
    );
}
