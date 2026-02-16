"use client";

import { useState, useEffect, useRef } from "react";
import {
    Loader2,
    SlidersHorizontal,
    X,
    Search,
    Clock,
    FileText,
} from "lucide-react";
import type { Slide } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchResult {
    id: string;
    type: "project" | "slide" | "block";
    projectId: string;
    projectTitle: string;
    slideId?: string;
    slideTitle?: string;
    content: string;
    highlights: string[];
    updatedAt: string;
}

interface AdvancedSearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projects: { id: string; title: string; updatedAt: string; slides?: Slide[] }[];
}

type SortOption = "relevance" | "recent" | "oldest" | "title";
type FilterOption = "all" | "projects" | "slides" | "content";

export function AdvancedSearch({
    open,
    onOpenChange,
    projects,
}: AdvancedSearchProps) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [sortBy, setSortBy] = useState<SortOption>("relevance");
    const [filterType, setFilterType] = useState<FilterOption>("all");
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const debouncedQuery = useDebounce(query, 300);

    // Focus input when opened and reset state
    const [prevOpen, setPrevOpen] = useState(open);
    if (open !== prevOpen) {
        setPrevOpen(open);
        if (!open) {
            setQuery("");

            setResults([]);
        }
    }

    useEffect(() => {
        if (open) {
            inputRef.current?.focus();
        }
    }, [open]);

    // Perform search
    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedQuery.trim()) {
                // Avoid synchronous setState warning
                await Promise.resolve();
                setResults([]);
                return;
            }


            setIsSearching(true);

            // Simulate search across projects and slides
            const searchResults: SearchResult[] = [];
            const searchLower = debouncedQuery.toLowerCase();

            for (const project of projects) {
                // Search project title
                if (project.title.toLowerCase().includes(searchLower)) {
                    searchResults.push({
                        id: `project-${project.id}`,
                        type: "project",
                        projectId: project.id,
                        projectTitle: project.title,
                        content: project.title,
                        highlights: highlightMatches(project.title, debouncedQuery),
                        updatedAt: project.updatedAt,
                    });
                }

                // Search slides
                if (project.slides) {
                    for (const slide of project.slides) {
                        const slideTitle = slide.title || `Slide ${slide.order + 1}`;

                        if (slideTitle.toLowerCase().includes(searchLower)) {
                            searchResults.push({
                                id: `slide-${slide.id}`,
                                type: "slide",
                                projectId: project.id,
                                projectTitle: project.title,
                                slideId: slide.id,
                                slideTitle,
                                content: slideTitle,
                                highlights: highlightMatches(slideTitle, debouncedQuery),
                                updatedAt: slide.updatedAt || project.updatedAt,
                            });
                        }

                        // Search blocks
                        if (slide.blocks) {
                            for (const block of slide.blocks) {
                                const blockContent = typeof block.content === "string"
                                    ? block.content
                                    : JSON.stringify(block.content);

                                if (blockContent.toLowerCase().includes(searchLower)) {
                                    searchResults.push({
                                        id: `block-${block.id}`,
                                        type: "block",
                                        projectId: project.id,
                                        projectTitle: project.title,
                                        slideId: slide.id,
                                        slideTitle,
                                        content: blockContent.slice(0, 100),
                                        highlights: highlightMatches(blockContent.slice(0, 100), debouncedQuery),
                                        updatedAt: block.updatedAt || project.updatedAt,
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Apply filters
            const filtered = filterType === "all"
                ? searchResults
                : searchResults.filter((r) => {
                    if (filterType === "projects") {return r.type === "project";}
                    if (filterType === "slides") {return r.type === "slide";}
                    if (filterType === "content") {return r.type === "block";}
                    return true;
                });

            // Apply sorting
            const sorted = [...filtered].sort((a, b) => {
                switch (sortBy) {
                    case "recent":
                        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                    case "oldest":
                        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
                    case "title":
                        return a.projectTitle.localeCompare(b.projectTitle);
                    default: // relevance - already by match quality
                        return 0;
                }
            });

            setResults(sorted);
            setIsSearching(false);
        };
        performSearch();
    }, [debouncedQuery, projects, sortBy, filterType]);

    // Navigate to result
    const handleResultClick = (result: SearchResult) => {
        const url = result.slideId
            ? `/editor/${result.projectId}?slide=${result.slideId}`
            : `/editor/${result.projectId}`;
        router.push(url);
        onOpenChange(false);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
                e.preventDefault();
                onOpenChange(true);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
                <DialogHeader className="px-4 pt-4 pb-0">
                    <DialogTitle className="sr-only">Search Presentations</DialogTitle>
                    <DialogDescription className="sr-only">
                        Search across all your presentations, slides, and content
                    </DialogDescription>
                </DialogHeader>

                {/* Search Input */}
                <div className="px-4 pb-3 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search presentations, slides, content..."
                            className="pl-10 pr-10 h-12 text-base"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                            >
                                <X className="h-4 w-4 text-slate-400" />
                            </button>
                        )}
                    </div>

                    {/* Filters Toggle */}
                    <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                            <Button
                                variant={showFilters ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className="gap-2"
                            >
                                <SlidersHorizontal className="h-4 w-4" />
                                Filters
                            </Button>

                            {/* Active Filters */}
                            {filterType !== "all" && (
                                <Badge variant="secondary" className="gap-1">
                                    {filterType}
                                    <button onClick={() => setFilterType("all")}>
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            )}
                        </div>

                        <div className="text-sm text-slate-500">
                            {results.length > 0 && (
                                <span>{results.length} results</span>
                            )}
                        </div>
                    </div>

                    {/* Expanded Filters */}
                    {showFilters && (
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-500">Type:</span>
                                <Select
                                    value={filterType}
                                    onValueChange={(v) => setFilterType(v as FilterOption)}
                                >
                                    <SelectTrigger className="w-32 h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="projects">Projects</SelectItem>
                                        <SelectItem value="slides">Slides</SelectItem>
                                        <SelectItem value="content">Content</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-500">Sort:</span>
                                <Select
                                    value={sortBy}
                                    onValueChange={(v) => setSortBy(v as SortOption)}
                                >
                                    <SelectTrigger className="w-32 h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="relevance">Relevance</SelectItem>
                                        <SelectItem value="recent">Most Recent</SelectItem>
                                        <SelectItem value="oldest">Oldest</SelectItem>
                                        <SelectItem value="title">Title A-Z</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Results */}
                <ScrollArea className="flex-1 min-h-0">
                    <div className="px-2 py-2">
                        {!query.trim() ? (
                            <div className="text-center py-12 text-slate-500">
                                <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">Search your presentations</p>
                                <p className="text-sm mt-1">
                                    Find projects, slides, or any content
                                </p>
                            </div>
                        ) : isSearching ? (
                            <div className="text-center py-12">
                                <Loader2 className="h-8 w-8 mx-auto animate-spin text-blue-600" />
                                <p className="text-sm text-slate-500 mt-2">Searching...</p>
                            </div>
                        ) : results.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No results found</p>
                                <p className="text-sm mt-1">
                                    Try different keywords or filters
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {results.map((result) => (
                                    <SearchResultItem
                                        key={result.id}
                                        result={result}
                                        onClick={() => handleResultClick(result)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="px-4 py-2 border-t bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded">
                        ⌘⇧F
                    </kbd>{" "}
                    to open search •{" "}
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded">
                        ↵
                    </kbd>{" "}
                    to open •{" "}
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded">
                        Esc
                    </kbd>{" "}
                    to close
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Individual search result item
function SearchResultItem({
    result,
    onClick,
}: {
    result: SearchResult;
    onClick: () => void;
}) {
    const typeIcon = {
        project: FileText,
        slide: FileText,
        block: FileText,
    }[result.type];

    const typeLabel = {
        project: "Project",
        slide: "Slide",
        block: "Content",
    }[result.type];

    const Icon = typeIcon;

    return (
        <button
            onClick={onClick}
            className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
        >
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                <Icon className="h-4 w-4 text-slate-500" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white truncate">
                        {result.projectTitle}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5">
                        {typeLabel}
                    </Badge>
                </div>

                {result.slideTitle && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                        {result.slideTitle}
                    </p>
                )}

                {result.highlights.length > 0 && (
                    <p
                        className="text-sm text-slate-500 truncate mt-0.5"
                        dangerouslySetInnerHTML={{
                            __html: result.highlights.join("... "),
                        }}
                    />
                )}

                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    {new Date(result.updatedAt).toLocaleDateString()}
                </div>
            </div>
        </button>
    );
}

// Helper to escape HTML to prevent XSS
function escapeHtml(text: string): string {
    const div = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (div) {
        div.textContent = text;
        return div.innerHTML;
    }
    // Server-side fallback
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Helper to highlight search matches (XSS-safe)
function highlightMatches(text: string, query: string): string[] {
    if (!query) {return [escapeHtml(text)];}

    // First escape HTML in the text to prevent XSS
    const safeText = escapeHtml(text);
    const safeQuery = escapeHtml(query);
    
    const regex = new RegExp(`(${escapeRegExp(safeQuery)})`, "gi");
    const highlighted = safeText.replace(
        regex,
        '<mark class="bg-yellow-200 dark:bg-yellow-900/50">$1</mark>'
    );

    return [highlighted];
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Hook for debouncing
// Note: This should be in a separate hooks file, included here for completeness
