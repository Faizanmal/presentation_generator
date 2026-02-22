"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DragEndEvent } from "@dnd-kit/core";
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    arrayMove,
} from "@dnd-kit/sortable";
import {
    Loader2,
} from "lucide-react"; // Fallback icons
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useCollaboration } from "@/hooks/use-collaboration";
import { useAuthStore } from "@/stores/auth-store";
import { useEditorStore } from "@/stores/editor-store";
import type { Project, Theme, Slide, Block, Comment } from "@/types";
import SlidePanel from "@/components/editor/SlidePanel";
import SlideCanvas from "@/components/editor/SlideCanvas";
import BlockToolbar from "@/components/editor/BlockToolbar";

// New usability components
import { CommandPalette } from "@/components/ui/command-palette";
import { KeyboardShortcutsDialog } from "@/components/ui/keyboard-shortcuts";
import { useUndoHistory } from "@/components/editor/undo-history";
import { QuickActionsToolbar } from "@/components/editor/quick-actions-toolbar";
import { SlideTemplatesDialog } from "@/components/editor/slide-templates";
import { useRecentProjects } from "@/components/ui/favorites-recent";
import { AIChatAssistant, AIChatTrigger } from "@/components/editor/ai-chat-assistant";
import { ViewerAnalyticsWidget } from "@/components/editor/viewer-analytics-widget";
import { BrandKitManager } from "@/components/editor/brand-kit-manager";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// New feature components
import { AISuggestionsPanel } from "@/components/editor/ai-suggestions-panel";
import { AIRefineButton } from "@/components/editor/ai-refine-button";
import { MagicLayoutButton } from "@/components/editor/magic-layout-button";
import { SlideDesignControls } from "@/components/editor/slide-design-controls";
import { CommentsPanel } from "@/components/editor/comments-panel";
import { CollaboratorPresence } from "@/components/editor/collaborator-presence";


export default function EditorPageV2() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;
    const queryClient = useQueryClient();
    const { isAuthenticated, isLoading: authLoading, user } = useAuthStore();

    const {
        project,
        currentSlideIndex,
        loadProject,
        setCurrentSlideIndex,
        updateProject,
        addSlide,
        deleteSlide,
        reorderSlides,
        setTheme,
    } = useEditorStore();

    const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
    const [activeTab, setActiveTab] = useState<"design" | "properties">("design");
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState("");

    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
    const [showBrandKitDialog, setShowBrandKitDialog] = useState(false);
    const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);

    // Real-time collaboration hook
    const token = api.getToken() || '';
    const {
        isConnected: isCollaborationConnected,
        collaborators: wsCollaborators,
        cursors,
        sendCursorPosition,
        sendBlockUpdate: _sendBlockUpdate,
        sendSlideAdd,
        sendSlideDelete,
        sendSlideReorder,
        addComment: _addCollaborationComment,
    } = useCollaboration({
        projectId,
        token,
        onUserJoined: (user) => {
            toast.info(`${user.userName} joined the presentation`);
        },
        onUserLeft: (user) => {
            toast.info(`${user.userName} left the presentation`);
        },
    });

    // Map WebSocket collaborators to UI format
    const collaborators = useMemo(() => {
        return wsCollaborators.map((c) => ({
            id: c.userId,
            name: c.userName,
            email: '',
            avatar: '',
            color: c.color,
            status: 'online' as const,
            activity: 'viewing' as const,
            lastSeen: new Date(),
            cursor: c.cursorX !== undefined && c.cursorY !== undefined
                ? { x: c.cursorX, y: c.cursorY }
                : undefined,
            currentSlideId: c.cursorSlide !== undefined
                ? project?.slides?.[c.cursorSlide]?.id
                : undefined,
        }));
    }, [wsCollaborators, project?.slides]);

    const {
        undo,
        redo,
        canUndo,
        canRedo,
    } = useUndoHistory();

    const { addToRecent } = useRecentProjects();

    // Fetch project
    const { data: projectData, isLoading: projectLoading } = useQuery({
        queryKey: ["project", projectId],
        queryFn: () => api.projects.getById(projectId),
        enabled: isAuthenticated && !!projectId,
    });

    // Fetch themes
    const { data: themes } = useQuery({
        queryKey: ["themes"],
        queryFn: () => api.themes.getAll(),
        enabled: isAuthenticated,
    });

    useEffect(() => {
        if (projectData) {
            loadProject(projectData);
            addToRecent(projectData.id);
        }
    }, [projectData, loadProject, addToRecent]);

    const [prevProjectTitle, setPrevProjectTitle] = useState(projectData?.title);
    if (projectData?.title !== prevProjectTitle) {
        setPrevProjectTitle(projectData?.title);
        if (projectData?.title) {
            setTitleInput(projectData.title);
        }
    }

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push("/login");
        }
    }, [authLoading, isAuthenticated, router]);

    const saveMutation = useMutation({
        mutationFn: (data: Partial<Project>) => api.projects.update(projectId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project", projectId] });
        },
        onError: () => {
            toast.error("Failed to save project");
        },
    });

    const handleTitleSave = () => {
        if (titleInput.trim() && titleInput !== project?.title) {
            updateProject({ title: titleInput.trim() });
            saveMutation.mutate({ title: titleInput.trim() });
        }
        setIsEditingTitle(false);
    };

    const currentSlide = project?.slides?.[currentSlideIndex];

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleSlideReorder = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !project?.slides) { return; }

        const oldIndex = project.slides.findIndex((s) => s.id === active.id);
        const newIndex = project.slides.findIndex((s) => s.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            reorderSlides(oldIndex, newIndex);
            const reordered = arrayMove(project.slides, oldIndex, newIndex);
            api.slides.reorder(
                projectId,
                reordered.map((s, i) => ({ id: s.id, order: i }))
            );
            // Broadcast reorder to collaborators
            sendSlideReorder(oldIndex, newIndex);
        }
    };

    const handleAddSlide = async () => {
        try {
            const newSlide = await api.slides.create(projectId, {
                title: `Slide ${(project?.slides?.length || 0) + 1}`,
                order: project?.slides?.length || 0,
            });
            addSlide(newSlide);
            setCurrentSlideIndex((project?.slides?.length || 0));
            // Broadcast new slide to collaborators
            sendSlideAdd(newSlide);
        } catch {
            toast.error("Failed to add slide");
        }
    };

    const handleDeleteSlide = async (slideId: string) => {
        if (project?.slides?.length === 1) {
            toast.error("Cannot delete the last slide");
            return;
        }
        try {
            await api.slides.delete(projectId, slideId);
            deleteSlide(slideId);
            // Broadcast delete to collaborators
            sendSlideDelete(slideId);
        } catch {
            toast.error("Failed to delete slide");
        }
    };

    const handleDuplicateSlide = async (slide: Slide) => {
        try {
            const newSlide = await api.slides.create(projectId, {
                title: `${slide.title} (copy)`,
                order: (project?.slides?.length || 0),
            });
            if (slide.blocks) {
                for (const block of slide.blocks) {
                    await api.blocks.create(projectId, newSlide.id, {
                        projectId,
                        blockType: block.type,
                        content: block.content,
                        order: block.order,
                    });
                }
            }
            queryClient.invalidateQueries({ queryKey: ["project", projectId] });
        } catch {
            toast.error("Failed to duplicate slide");
        }
    };

    const handleThemeChange = async (theme: Theme) => {
        try {
            await api.projects.update(projectId, { themeId: theme.id });
            setTheme(theme);
            toast.success("Theme applied");
        } catch {
            toast.error("Failed to apply theme");
        }
    };

    const handleExport = async (format: "html" | "json" | "pdf") => {
        try {
            const data = await api.export.export(projectId, format);
            const mimeType = format === "json" ? "application/json" : (format === "pdf" ? "application/pdf" : "text/html");
            const blobData = typeof data === 'string' ? data : data.blob;
            const blob = new Blob([format === "json" ? JSON.stringify(blobData, null, 2) : blobData], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${project?.title || "presentation"}.${format}`;
            a.click();
            toast.success(`Exported as ${format.toUpperCase()}`);
        } catch {
            toast.error("Failed to export");
        }
    };

    const handlePresent = () => {
        window.open(`/present/${projectId}`, "_blank");
    };

    // Comment handlers
    const handleAddComment = (content: string, slideId?: string, blockId?: string, parentId?: string) => {
        const newComment: Comment = {
            id: `comment-${Date.now()}`,
            projectId,
            userId: user?.id || 'current-user',
            user: {
                id: user?.id || 'current-user',
                name: user?.name || 'You',
                image: user?.image || null,
            },
            slideId,
            blockId,
            content,
            resolved: false,
            parentId,
            replies: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if (parentId) {
            setComments(prev => prev.map(c => {
                if (c.id === parentId) {
                    return { ...c, replies: [...(c.replies || []), newComment] };
                }
                return c;
            }));
        } else {
            setComments(prev => [...prev, newComment]);
        }
        toast.success("Comment added");
    };

    const handleResolveComment = (commentId: string) => {
        setComments(prev => prev.map(c =>
            c.id === commentId ? { ...c, resolved: true } : c
        ));
    };

    const handleDeleteComment = (commentId: string) => {
        setComments(prev => prev.filter(c => c.id !== commentId));
        toast.success("Comment deleted");
    };

    // AI Refine handler
    const handleRefineComplete = (_result: unknown) => {
        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    };

    // AI Suggestion handler
    const handleApplySuggestion = (action: string, _data?: Record<string, unknown>) => {
        toast.success(`Applying: ${action}`);
        // Future: apply the action to the slide
    };

    if (authLoading || projectLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                <p>Project not found</p>
                <Link href="/dashboard-v2" className="text-blue-600 underline ml-2">Back to Dashboard</Link>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans text-slate-900 dark:text-white">
            {/* Top Navigation */}
            <header className="flex h-14 items-center justify-between border-b border-solid border-slate-200 dark:border-slate-800 px-4 py-2 bg-white dark:bg-slate-950 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard-v2" className="flex items-center justify-center size-8 bg-blue-600 rounded-lg text-white hover:bg-blue-700 transition-colors">
                        <span className="material-symbols-outlined text-xl">auto_awesome</span>
                    </Link>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 group cursor-pointer">
                            {isEditingTitle ? (
                                <input
                                    value={titleInput}
                                    onChange={(e) => setTitleInput(e.target.value)}
                                    onBlur={handleTitleSave}
                                    onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                                    className="text-sm font-semibold dark:bg-slate-800 border-none p-0 focus:ring-0"
                                    autoFocus
                                />
                            ) : (
                                <div onClick={() => setIsEditingTitle(true)} className="flex items-center gap-2">
                                    <h1 className="text-sm font-semibold dark:text-white leading-tight">{project.title}</h1>
                                    <span className="material-symbols-outlined text-[16px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                                </div>
                            )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Last edited just now by {user?.name || "you"}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Connection Status */}
                    <div className="flex items-center gap-2">
                        <span
                            className={`h-2 w-2 rounded-full ${isCollaborationConnected ? 'bg-green-500' : 'bg-gray-400'}`}
                            title={isCollaborationConnected ? 'Connected' : 'Disconnected'}
                        />
                        <span className="text-xs text-gray-500">
                            {isCollaborationConnected ? 'Live' : 'Offline'}
                        </span>
                    </div>

                    {/* Real Collaborator Presence */}
                    <CollaboratorPresence
                        collaborators={collaborators}
                        currentUserId={user?.id || 'current-user'}
                        maxVisible={3}
                    />
                    <div className="h-6 w-px bg-gray-200 dark:bg-slate-800 mx-1" />

                    {/* Undo/Redo */}
                    <div className="flex items-center">
                        <button onClick={undo} disabled={!canUndo} className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white disabled:opacity-30">
                            <span className="material-symbols-outlined text-[20px]">undo</span>
                        </button>
                        <button onClick={redo} disabled={!canRedo} className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white disabled:opacity-30">
                            <span className="material-symbols-outlined text-[20px]">redo</span>
                        </button>
                    </div>

                    {/* Comments Toggle */}
                    <button
                        onClick={() => setIsCommentsPanelOpen(!isCommentsPanelOpen)}
                        className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">add_comment</span>
                        <span className="hidden sm:inline">Comments</span>
                        {comments.filter(c => !c.resolved).length > 0 && (
                            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                                {comments.filter(c => !c.resolved).length}
                            </span>
                        )}
                    </button>

                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">share</span>
                        <span className="hidden sm:inline">Share</span>
                    </button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                                <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setShowAnalyticsDialog(true)}>
                                <span className="material-symbols-outlined text-[18px] mr-2">bar_chart</span>
                                Analytics
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowBrandKitDialog(true)}>
                                <span className="material-symbols-outlined text-[18px] mr-2">palette</span>
                                Brand Kit
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                        onClick={() => setShowTemplatesDialog(true)}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-blue-600/10 text-blue-600 hover:bg-blue-600/20 transition-colors border border-blue-600/20"
                    >
                        <span className="material-symbols-outlined text-[18px]">style</span>
                        <span className="hidden sm:inline">Templates</span>
                    </button>

                    {/* AI Refine Button */}
                    <AIRefineButton
                        projectId={projectId}
                        slideId={currentSlide?.id}
                        blocks={currentSlide?.blocks}
                        slideTitle={currentSlide?.title}
                        onRefineComplete={handleRefineComplete}
                    />

                    <button
                        onClick={handlePresent}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                    >
                        <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                        <span>Present</span>
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Left Sidebar: Slides */}
                <aside className={`${isSidePanelOpen ? "w-60" : "w-0"} bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col z-10 transition-all duration-300 overflow-hidden`}>
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center w-60">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Slides</span>
                        <button onClick={handleAddSlide} className="text-gray-500 hover:text-blue-600 transition-colors">
                            <span className="material-symbols-outlined text-[20px]">add</span>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-4 w-60">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSlideReorder}>
                            <SortableContext items={project.slides?.map((s) => s.id) || []} strategy={verticalListSortingStrategy}>
                                {project.slides?.map((slide, index) => (
                                    <SlidePanel
                                        key={slide.id}
                                        slide={slide}
                                        index={index}
                                        isActive={index === currentSlideIndex}
                                        onClick={() => setCurrentSlideIndex(index)}
                                        onDelete={() => handleDeleteSlide(slide.id)}
                                        onDuplicate={() => handleDuplicateSlide(slide)}
                                        theme={project.theme || undefined}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 w-60">
                        <button onClick={handleAddSlide} className="w-full py-2 flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 hover:text-blue-600 hover:border-blue-600 hover:bg-blue-600/5 transition-all text-sm font-medium">
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            New Slide
                        </button>
                    </div>
                </aside>

                {/* Toggle Panel Button (Floating) */}
                {!isSidePanelOpen && (
                    <button
                        onClick={() => setIsSidePanelOpen(true)}
                        className="absolute left-0 top-1/2 z-20 p-2 bg-white dark:bg-slate-800 rounded-r-lg shadow-md border border-l-0 border-slate-200 dark:border-slate-700"
                    >
                        <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                )}

                {/* Central Canvas */}
                <main
                    className="flex-1 bg-slate-100 dark:bg-slate-900 relative flex flex-col items-center justify-center p-8 overflow-hidden"
                    onMouseMove={(e) => {
                        // Send cursor position to collaborators
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;
                        sendCursorPosition({ x, y, slideIndex: currentSlideIndex });
                    }}
                >
                    {/* Collaborator Cursors */}
                    {Array.from(cursors.entries()).map(([cursorUserId, cursor]) => (
                        cursor.slideIndex === currentSlideIndex && (
                            <div
                                key={cursorUserId}
                                className="absolute pointer-events-none z-50 transition-all duration-75"
                                style={{
                                    left: `${cursor.x}%`,
                                    top: `${cursor.y}%`,
                                }}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill={cursor.color}>
                                    <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.87a.5.5 0 00.35-.85L6.35 2.86a.5.5 0 00-.85.35z" />
                                </svg>
                                <span
                                    className="ml-2 px-2 py-0.5 text-xs text-white rounded whitespace-nowrap"
                                    style={{ backgroundColor: cursor.color }}
                                >
                                    {cursor.userName}
                                </span>
                            </div>
                        )
                    ))}

                    {/* Block Toolbar - Floating */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                        <BlockToolbar projectId={projectId} slide={currentSlide} />
                    </div>

                    {/* Slide Container */}
                    <div className="relative w-full max-w-5xl shadow-2xl transition-transform duration-300 ease-out origin-center">
                        {currentSlide ? (
                            <SlideCanvas
                                projectId={projectId}
                                slide={currentSlide}
                                theme={project.theme || undefined}
                            />
                        ) : (
                            <div className="aspect-video bg-white dark:bg-slate-800 flex items-center justify-center rounded-lg">
                                <p className="text-slate-500">No slide selected</p>
                            </div>
                        )}
                    </div>

                    {/* Floating Quick Actions Toolbar */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
                        <QuickActionsToolbar
                            onUndo={undo}
                            onRedo={redo}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            onAddSlide={handleAddSlide}
                            onPresent={handlePresent}
                            onExport={() => handleExport("pdf")}
                            isSaving={saveMutation.isPending}
                            position="bottom"
                        />

                        {/* Magic Layout Button */}
                        <MagicLayoutButton
                            projectId={projectId}
                            slideId={currentSlide?.id}
                            blocks={currentSlide?.blocks}
                            heading={currentSlide?.title}
                            onApplyLayout={(layout) => {
                                toast.success(`Applied "${layout.name}" layout`);
                                queryClient.invalidateQueries({ queryKey: ["project", projectId] });
                            }}
                        />
                    </div>
                </main>

                {/* Right Sidebar: Inspector & AI */}
                <aside className={`${isCommentsPanelOpen ? 'w-0 overflow-hidden' : 'w-80'} bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 flex flex-col z-10 shadow-xl transition-all duration-300`}>
                    <div className="flex border-b border-slate-200 dark:border-slate-800">
                        <button
                            onClick={() => setActiveTab("design")}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "design" ? "text-blue-600 border-b-2 border-blue-600 bg-blue-600/5" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
                        >
                            Design & AI
                        </button>
                        <button
                            onClick={() => setActiveTab("properties")}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "properties" ? "text-blue-600 border-b-2 border-blue-600 bg-blue-600/5" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
                        >
                            Properties
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-8">
                        {activeTab === "design" ? (
                            <>
                                {/* AI Suggestions Panel */}
                                <AISuggestionsPanel
                                    projectId={projectId}
                                    slideId={currentSlide?.id}
                                    blocks={currentSlide?.blocks}
                                    slideTitle={currentSlide?.title}
                                    onApplySuggestion={handleApplySuggestion}
                                    onOpenChat={() => setIsAIChatOpen(true)}
                                />

                                <hr className="border-slate-100 dark:border-slate-800" />

                                {/* Slide Design Controls (Theme, Density, Tone, Export) */}
                                <SlideDesignControls
                                    projectId={projectId}
                                    slideId={currentSlide?.id}
                                    themes={themes?.map(t => ({
                                        id: t.id,
                                        name: t.name,
                                        colors: { background: t.colors.background, primary: t.colors.primary, text: t.colors.text },
                                    }))}
                                    currentThemeId={project?.themeId || undefined}
                                    onThemeChange={(themeId) => {
                                        const theme = themes?.find(t => t.id === themeId);
                                        if (theme) { handleThemeChange(theme); }
                                    }}
                                    onExportPdf={() => handleExport("pdf")}
                                />
                            </>
                        ) : (
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Properties</h3>
                                <p className="text-sm text-gray-500">Select an element to view and edit its properties.</p>

                                {/* Block properties when a block is selected */}
                                {currentSlide?.blocks && currentSlide.blocks.length > 0 && (
                                    <div className="space-y-3 mt-4">
                                        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Blocks on this slide</h4>
                                        {currentSlide.blocks.map((block, i) => (
                                            <div key={block.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {block.type.replace('_', ' ')}
                                                    </span>
                                                    <span className="text-xs text-slate-400">#{i + 1}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1 truncate">
                                                    {block.content?.text || block.content?.url || `${block.content?.items?.length || 0} items`}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </aside>

                {/* Comments Panel (slides out from right) */}
                {isCommentsPanelOpen && (
                    <CommentsPanel
                        comments={comments}
                        currentUserId={user?.id || 'current-user'}
                        onAddComment={handleAddComment}
                        onResolveComment={handleResolveComment}
                        onDeleteComment={handleDeleteComment}
                        selectedSlideId={currentSlide?.id}
                        isOpen={isCommentsPanelOpen}
                        onClose={() => setIsCommentsPanelOpen(false)}
                    />
                )}
            </div>

            {/* Command Palette */}
            <CommandPalette
                projectId={projectId}
                isEditorMode
                onUndo={undo}
                onRedo={redo}
                onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
            />

            {/* Keyboard Shortcuts Dialog */}
            <KeyboardShortcutsDialog
                open={showKeyboardShortcuts}
                onOpenChange={setShowKeyboardShortcuts}
            />

            {/* Slide Templates Dialog */}
            <SlideTemplatesDialog
                open={showTemplatesDialog}
                onOpenChange={setShowTemplatesDialog}
                onSelectTemplate={(template) => {
                    toast.success(`Template "${template.name}" applied!`);
                    setShowTemplatesDialog(false);
                }}
                onSelectStarterTemplate={(template) => {
                    toast.success(`Starting from "${template.name}" template!`);
                    setShowTemplatesDialog(false);
                }}
            />

            {/* AI Chat Assistant */}
            {currentSlide && (
                <>
                    <AIChatAssistant
                        projectId={projectId}
                        slideContext={{
                            slideId: currentSlide.id,
                            heading: currentSlide.title,
                            blocks: currentSlide.blocks?.map((b: Block) => ({ type: b.type, content: JSON.stringify(b.content) })),
                        }}
                        isOpen={isAIChatOpen}
                        onClose={() => setIsAIChatOpen(false)}
                    />
                    {!isAIChatOpen && (
                        <AIChatTrigger onClick={() => setIsAIChatOpen(true)} />
                    )}
                </>
            )}

            {/* Analytics Dialog */}
            <Dialog open={showAnalyticsDialog} onOpenChange={setShowAnalyticsDialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <ViewerAnalyticsWidget projectId={projectId} />
                </DialogContent>
            </Dialog>

            {/* Brand Kit Dialog */}
            <Dialog open={showBrandKitDialog} onOpenChange={setShowBrandKitDialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <BrandKitManager onApplyBrandKit={(kit) => {
                        toast.success(`Applied brand kit: ${kit.name}`);
                        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
                        setShowBrandKitDialog(false);
                    }} />
                </DialogContent>
            </Dialog>
        </div>
    );
}
