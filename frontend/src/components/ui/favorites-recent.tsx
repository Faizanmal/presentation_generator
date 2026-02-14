"use client";

import { useState, useEffect, useCallback } from "react";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Clock, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { Project } from "@/types";
import { formatDistanceToNow } from "date-fns";

// Local storage key for favorites
const FAVORITES_KEY = "presentation-designer-favorites";
const RECENT_KEY = "presentation-designer-recent";
const MAX_RECENT = 10;

// Get favorites from localStorage
function getFavoritesFromStorage(): string[] {
    if (typeof window === "undefined") { return []; }
    try {
        const stored = localStorage.getItem(FAVORITES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Save favorites to localStorage
function saveFavoritesToStorage(favorites: string[]) {
    if (typeof window === "undefined") { return; }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

// Get recent from localStorage
function getRecentFromStorage(): { id: string; visitedAt: string }[] {
    if (typeof window === "undefined") { return []; }
    try {
        const stored = localStorage.getItem(RECENT_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Save recent to localStorage
function saveRecentToStorage(recent: { id: string; visitedAt: string }[]) {
    if (typeof window === "undefined") { return; }
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

// Hook to manage favorites
export function useFavorites() {
    const [favorites, setFavorites] = useState<string[]>([]);

    useEffect(() => {
        // Load initial data asynchronously to avoid synchronous setState warning
        Promise.resolve().then(() => {
            setFavorites(getFavoritesFromStorage());
        });
    }, []);

    const toggleFavorite = (projectId: string) => {
        setFavorites((prev) => {
            const next = prev.includes(projectId)
                ? prev.filter((id) => id !== projectId)
                : [...prev, projectId];
            saveFavoritesToStorage(next);
            return next;
        });
    };

    const isFavorite = (projectId: string) => favorites.includes(projectId);

    return { favorites, toggleFavorite, isFavorite };
}

// Hook to manage recent projects
export function useRecentProjects() {
    const [recent, setRecent] = useState<{ id: string; visitedAt: string }[]>([]);

    useEffect(() => {
        // Load initial data asynchronously to avoid synchronous setState warning
        Promise.resolve().then(() => {
            setRecent(getRecentFromStorage());
        });
    }, []);

    const addToRecent = useCallback((projectId: string) => {
        setRecent((prev) => {
            // Remove if already exists
            const filtered = prev.filter((r) => r.id !== projectId);
            // Add to front
            const next = [{ id: projectId, visitedAt: new Date().toISOString() }, ...filtered];
            saveRecentToStorage(next);
            return next.slice(0, MAX_RECENT);
        });
    }, []);

    const removeFromRecent = useCallback((projectId: string) => {
        setRecent((prev) => {
            const next = prev.filter((r) => r.id !== projectId);
            saveRecentToStorage(next);
            return next;
        });
    }, []);

    const clearRecent = useCallback(() => {
        setRecent([]);
        saveRecentToStorage([]);
    }, []);

    return { recent, addToRecent, removeFromRecent, clearRecent };
}

// Favorite button component
export function FavoriteButton({
    projectId,
    isFavorite,
    onToggle,
    size = "default",
}: {
    projectId: string;
    isFavorite: boolean;
    onToggle: (projectId: string) => void;
    size?: "sm" | "default";
}) {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggle(projectId);
            }}
            className={cn(
                "transition-all",
                size === "sm" ? "p-1" : "p-2",
                isFavorite
                    ? "text-yellow-500 hover:text-yellow-600"
                    : "text-slate-400 hover:text-yellow-500"
            )}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
            <Star
                className={cn(
                    size === "sm" ? "h-4 w-4" : "h-5 w-5",
                    isFavorite && "fill-current"
                )}
            />
        </button>
    );
}

// Recent and Favorites Panel
interface FavoritesRecentPanelProps {
    projects: Project[];
    favorites: string[];
    recent: { id: string; visitedAt: string }[];
    onToggleFavorite: (projectId: string) => void;
    onRemoveRecent: (projectId: string) => void;
    onClearRecent: () => void;
}

export function FavoritesRecentPanel({
    projects,
    favorites,
    recent,
    onToggleFavorite,
    onRemoveRecent,
    onClearRecent,
}: FavoritesRecentPanelProps) {
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    const favoriteProjects = favorites
        .map((id) => projectMap.get(id))
        .filter(Boolean) as Project[];

    const recentProjects = recent
        .map((r) => {
            const project = projectMap.get(r.id);
            return project ? { ...project, visitedAt: r.visitedAt } : null;
        })
        .filter(Boolean) as (Project & { visitedAt: string })[];

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <Tabs defaultValue="favorites" className="w-full">
                <div className="border-b border-slate-200 dark:border-slate-800 px-4 pt-3">
                    <TabsList className="grid w-full grid-cols-2 h-9">
                        <TabsTrigger value="favorites" className="gap-1.5 text-sm">
                            <Star className="h-3.5 w-3.5" />
                            Favorites
                            {favoriteProjects.length > 0 && (
                                <span className="ml-1 text-xs bg-slate-100 dark:bg-slate-800 px-1.5 rounded-full">
                                    {favoriteProjects.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="recent" className="gap-1.5 text-sm">
                            <Clock className="h-3.5 w-3.5" />
                            Recent
                            {recentProjects.length > 0 && (
                                <span className="ml-1 text-xs bg-slate-100 dark:bg-slate-800 px-1.5 rounded-full">
                                    {recentProjects.length}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="favorites" className="m-0">
                    <div className="max-h-64 overflow-y-auto">
                        {favoriteProjects.length === 0 ? (
                            <div className="text-center py-8 px-4">
                                <Star className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-500">No favorites yet</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Star presentations to access them quickly
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {favoriteProjects.map((project) => (
                                    <ProjectQuickLink
                                        key={project.id}
                                        project={project}
                                        isFavorite
                                        onToggleFavorite={() => onToggleFavorite(project.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="recent" className="m-0">
                    <div className="max-h-64 overflow-y-auto">
                        {recentProjects.length === 0 ? (
                            <div className="text-center py-8 px-4">
                                <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-500">No recent presentations</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Open a presentation to see it here
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {recentProjects.map((project) => (
                                        <ProjectQuickLink
                                            key={project.id}
                                            project={project}
                                            isFavorite={favorites.includes(project.id)}
                                            onToggleFavorite={() => onToggleFavorite(project.id)}
                                            visitedAt={project.visitedAt}
                                            onRemove={() => onRemoveRecent(project.id)}
                                        />
                                    ))}
                                </div>
                                <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-xs text-slate-500"
                                        onClick={onClearRecent}
                                    >
                                        Clear recent
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Quick link for a project
function ProjectQuickLink({
    project,
    isFavorite,
    onToggleFavorite,
    visitedAt,
    onRemove,
}: {
    project: Project;
    isFavorite: boolean;
    onToggleFavorite: () => void;
    visitedAt?: string;
    onRemove?: () => void;
}) {
    return (
        <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
            {/* Icon */}
            <div className="h-8 w-8 rounded bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-slate-400" />
            </div>

            {/* Content */}
            <Link
                href={`/editor/${project.id}`}
                className="flex-1 min-w-0"
            >
                <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {project.title}
                </h4>
                <p className="text-xs text-slate-500 truncate">
                    {visitedAt
                        ? `Opened ${formatDistanceToNow(new Date(visitedAt), { addSuffix: true })}`
                        : `Updated ${formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}`}
                </p>
            </Link>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <FavoriteButton
                    projectId={project.id}
                    isFavorite={isFavorite}
                    onToggle={onToggleFavorite}
                    size="sm"
                />
                {onRemove && (
                    <button
                        onClick={onRemove}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

// Compact favorites bar for header
export function FavoritesBar({
    projects,
    favorites,
}: {
    projects: Project[];
    favorites: string[];
}) {
    const favoriteProjects = favorites
        .map((id) => projects.find((p) => p.id === id))
        .filter(Boolean)
        .slice(0, 5) as Project[];

    if (favoriteProjects.length === 0) { return null; }

    return (
        <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <div className="flex gap-1">
                {favoriteProjects.map((project) => (
                    <Link
                        key={project.id}
                        href={`/editor/${project.id}`}
                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors truncate max-w-[120px]"
                        title={project.title}
                    >
                        {project.title}
                    </Link>
                ))}
                {favorites.length > 5 && (
                    <span className="px-2 py-1 text-xs text-slate-500">
                        +{favorites.length - 5} more
                    </span>
                )}
            </div>
        </div>
    );
}
