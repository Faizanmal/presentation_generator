"use client";

import { useState, memo } from "react";
import { motion } from "framer-motion";
import {
    Star,
    Clock,
    Eye,
    Play,
    Share2,
    MoreHorizontal,
    Edit,
    Copy,
    Download,
    StarOff,
    Trash2,
} from "lucide-react";
import { Button } from "./button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "./dropdown-menu";

interface ProjectCardProps {
    project: {
        id: string;
        title: string;
        description?: string | null;
        thumbnail?: string | null;
        updatedAt: string | Date;
        slideCount?: number;
        viewCount?: number;
        isPublic?: boolean;
        collaborators?: Array<{
            id: string;
            name: string;
            avatar?: string | null;
        }>;
        _count?: {
            slides: number;
        };
    };
    isFavorite?: boolean;
    onOpen?: (id: string) => void;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
    onDuplicate?: (id: string) => void;
    onShare?: (id: string) => void;
    onToggleFavorite?: (id: string) => void;
    onPresent?: (id: string) => void;
    onExport?: (id: string) => void;
    variant?: "grid" | "list";
}

export const ProjectCard = memo(({
    project,
    isFavorite = false,
    onOpen,
    onEdit,
    onDelete,
    onDuplicate,
    onShare,
    onToggleFavorite,
    onPresent,
    onExport,
    variant = "grid",
}: ProjectCardProps) => {
    const [isHovered, setIsHovered] = useState(false);

    const formatDate = (date: Date | string) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) { return "Today"; }
        if (days === 1) { return "Yesterday"; }
        if (days < 7) { return `${days} days ago`; }
        if (days < 30) { return `${Math.floor(days / 7)} weeks ago`; }
        return d.toLocaleDateString();
    };

    if (variant === "list") {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.02)" }}
                className="flex items-center gap-4 p-4 border-b border-slate-200 dark:border-slate-800 group"
            >
                {/* Thumbnail */}
                <div className="relative h-16 w-28 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                    {project.thumbnail ? (
                        <img
                            src={project.thumbnail}
                            alt={project.title}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center bg-linear-to-br from-blue-500/20 to-purple-500/20">
                            <span className="text-2xl">📊</span>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900 dark:text-white truncate">
                            {project.title}
                        </h3>
                        {isFavorite && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(project.updatedAt)}
                        </span>
                        {(project.slideCount !== undefined || project._count?.slides !== undefined) && (
                            <span>{project.slideCount ?? project._count?.slides} slides</span>
                        )}
                        {project.viewCount !== undefined && project.viewCount > 0 && (
                            <span className="flex items-center gap-1">
                                <Eye className="h-3.5 w-3.5" />
                                {project.viewCount}
                            </span>
                        )}
                    </div>
                </div>

                {/* Collaborators */}
                {project.collaborators && project.collaborators.length > 0 && (
                    <div className="flex -space-x-2">
                        {project.collaborators.slice(0, 3).map((collaborator) => (
                            <div
                                key={collaborator.id}
                                className="h-8 w-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium"
                                title={collaborator.name}
                            >
                                {collaborator.avatar ? (
                                    <img
                                        src={collaborator.avatar}
                                        alt={collaborator.name}
                                        className="h-full w-full rounded-full object-cover"
                                    />
                                ) : (
                                    collaborator.name.charAt(0).toUpperCase()
                                )}
                            </div>
                        ))}
                        {project.collaborators.length > 3 && (
                            <div className="h-8 w-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium">
                                +{project.collaborators.length - 3}
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => onPresent?.(project.id)}>
                        <Play className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onShare?.(project.id)}>
                        <Share2 className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit?.(project.id)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDuplicate?.(project.id)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onExport?.(project.id)}>
                                <Download className="h-4 w-4 mr-2" />
                                Export
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onToggleFavorite?.(project.id)}>
                                {isFavorite ? (
                                    <>
                                        <StarOff className="h-4 w-4 mr-2" />
                                        Remove from favorites
                                    </>
                                ) : (
                                    <>
                                        <Star className="h-4 w-4 mr-2" />
                                        Add to favorites
                                    </>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => onDelete?.(project.id)}
                                className="text-red-600 focus:text-red-600"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </motion.div>
        );
    }

    // Grid variant
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-lg transition-all"
        >
            {/* Thumbnail */}
            <div className="relative aspect-16/10 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                {project.thumbnail ? (
                    <img
                        src={project.thumbnail}
                        alt={project.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center bg-linear-to-br from-blue-500/10 to-purple-500/10">
                        <div className="text-center">
                            <span className="text-4xl">📊</span>
                            <p className="text-sm text-slate-400 mt-2">No preview</p>
                        </div>
                    </div>
                )}

                {/* Hover overlay */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center gap-3"
                >
                    <Button
                        size="sm"
                        onClick={() => onOpen?.(project.id)}
                        className="bg-white text-slate-900 hover:bg-slate-100"
                    >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPresent?.(project.id)}
                        className="border-white text-white hover:bg-white/10"
                    >
                        <Play className="h-4 w-4 mr-2" />
                        Present
                    </Button>
                </motion.div>

                {/* Favorite button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite?.(project.id);
                    }}
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-slate-800"
                >
                    <Star
                        className={`h-4 w-4 ${isFavorite ? "text-yellow-500 fill-yellow-500" : "text-slate-600 dark:text-slate-400"
                            }`}
                    />
                </button>

                {/* Public badge */}
                {project.isPublic && (
                    <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-green-500/90 text-white text-xs font-medium flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Public
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                            {project.title}
                        </h3>
                        {project.description && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1">
                                {project.description}
                            </p>
                        )}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit?.(project.id)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDuplicate?.(project.id)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onShare?.(project.id)}>
                                <Share2 className="h-4 w-4 mr-2" />
                                Share
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onExport?.(project.id)}>
                                <Download className="h-4 w-4 mr-2" />
                                Export
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => onDelete?.(project.id)}
                                className="text-red-600 focus:text-red-600"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Meta info */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(project.updatedAt)}
                        </span>
                        {(project.slideCount !== undefined || project._count?.slides !== undefined) && (
                            <span>{project.slideCount ?? project._count?.slides} slides</span>
                        )}
                    </div>

                    {/* Collaborators */}
                    {project.collaborators && project.collaborators.length > 0 && (
                        <div className="flex items-center">
                            <div className="flex -space-x-2">
                                {project.collaborators.slice(0, 3).map((collaborator) => (
                                    <div
                                        key={collaborator.id}
                                        className="h-6 w-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium"
                                        title={collaborator.name}
                                    >
                                        {collaborator.avatar ? (
                                            <img
                                                src={collaborator.avatar}
                                                alt={collaborator.name}
                                                className="h-full w-full rounded-full object-cover"
                                            />
                                        ) : (
                                            collaborator.name.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                ))}
                            </div>
                            {project.collaborators.length > 3 && (
                                <span className="text-xs text-slate-400 ml-1">
                                    +{project.collaborators.length - 3}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
});

ProjectCard.displayName = "ProjectCard";

// Create new project card (placeholder)
interface CreateProjectCardProps {
    onClick: () => void;
    variant?: "grid" | "list";
}

export function CreateProjectCard({ onClick, variant = "grid" }: CreateProjectCardProps) {
    if (variant === "list") {
        return (
            <button
                onClick={onClick}
                className="flex items-center gap-4 p-4 w-full text-left border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors group"
            >
                <div className="h-16 w-28 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                    <span className="text-2xl">➕</span>
                </div>
                <div>
                    <p className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        Create New Presentation
                    </p>
                    <p className="text-sm text-slate-500">Start from scratch or use AI</p>
                </div>
            </button>
        );
    }

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="aspect-16/14 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors flex flex-col items-center justify-center gap-4 group w-full"
        >
            <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                <span className="text-3xl group-hover:scale-110 transition-transform">➕</span>
            </div>
            <div className="text-center">
                <p className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    New Presentation
                </p>
                <p className="text-sm text-slate-500 mt-1">
                    Create from scratch or AI
                </p>
            </div>
        </motion.button>
    );
}
