"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
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
  ArrowLeft,
  Play,
  Download,
  Share2,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Palette,
  Save,
  Layout,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useEditorStore } from "@/stores/editor-store";
import { Project, Theme, Slide, Block } from "@/types";
import SlidePanel from "@/components/editor/SlidePanel";
import SlideCanvas from "@/components/editor/SlideCanvas";
import ThemeSelector from "@/components/editor/ThemeSelector";
import BlockToolbar from "@/components/editor/BlockToolbar";

// New usability components
import { CommandPalette } from "@/components/ui/command-palette";
import { KeyboardShortcutsDialog } from "@/components/ui/keyboard-shortcuts";
import { SlideOutline } from "@/components/editor/slide-outline";
import { UndoHistoryPanel, UndoRedoButtons, useUndoHistory } from "@/components/editor/undo-history";
import { QuickActionsToolbar } from "@/components/editor/quick-actions-toolbar";
import { SlideTemplatesDialog } from "@/components/editor/slide-templates";
import { useRecentProjects } from "@/components/ui/favorites-recent";


export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  const {
    project,
    currentSlideIndex,
    isDirty,
    loadProject,
    setCurrentSlideIndex,
    updateProject,
    addSlide,
    deleteSlide,
    duplicateSlide,
    reorderSlides,
    setTheme,
  } = useEditorStore();

  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  // New usability feature states
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);

  // Undo/Redo history
  const {
    history,
    future,
    pushAction,
    undo,
    redo,
    canUndo,
    canRedo,
    jumpToState,
    clearHistory,
  } = useUndoHistory();

  // Recent projects tracking
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

  // Load project into store and add to recent
  useEffect(() => {
    if (projectData) {
      loadProject(projectData);
      setTitleInput(projectData.title);
      addToRecent(projectData.id);
    }
  }, [projectData, loadProject, addToRecent]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);


  // Save project mutation
  const saveMutation = useMutation({
    mutationFn: (data: Partial<Project>) => api.projects.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: () => {
      toast.error("Failed to save project");
    },
  });

  // Handle title update
  const handleTitleSave = () => {
    if (titleInput.trim() && titleInput !== project?.title) {
      updateProject({ title: titleInput.trim() });
      saveMutation.mutate({ title: titleInput.trim() });
    }
    setIsEditingTitle(false);
  };

  // Current slide
  const currentSlide = project?.slides?.[currentSlideIndex];

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Handle slide reorder
  const handleSlideReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !project?.slides) return;

    const oldIndex = project.slides.findIndex((s) => s.id === active.id);
    const newIndex = project.slides.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderSlides(oldIndex, newIndex);
      // Update via API
      const reordered = arrayMove(project.slides, oldIndex, newIndex);
      api.slides.reorder(
        projectId,
        reordered.map((s, i) => ({ id: s.id, order: i }))
      );
    }
  };

  // Handle add slide
  const handleAddSlide = async () => {
    try {
      const newSlide = await api.slides.create(projectId, {
        title: `Slide ${(project?.slides?.length || 0) + 1}`,
        order: project?.slides?.length || 0,
      });
      addSlide(newSlide);
      setCurrentSlideIndex((project?.slides?.length || 0));
    } catch (error) {
      toast.error("Failed to add slide");
    }
  };

  // Handle delete slide
  const handleDeleteSlide = async (slideId: string) => {
    if (project?.slides?.length === 1) {
      toast.error("Cannot delete the last slide");
      return;
    }
    try {
      await api.slides.delete(projectId, slideId);
      deleteSlide(slideId);
    } catch (error) {
      toast.error("Failed to delete slide");
    }
  };

  // Handle duplicate slide
  const handleDuplicateSlide = async (slide: Slide) => {
    try {
      const newSlide = await api.slides.create(projectId, {
        title: `${slide.title} (copy)`,
        order: (project?.slides?.length || 0),
      });
      // Also duplicate blocks
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
      // Refetch project to get updated data
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    } catch (error) {
      toast.error("Failed to duplicate slide");
    }
  };

  // Handle theme change
  const handleThemeChange = async (theme: Theme) => {
    try {
      await api.projects.update(projectId, { themeId: theme.id });
      setTheme(theme);
      setIsThemePanelOpen(false);
      toast.success("Theme applied");
    } catch (error) {
      toast.error("Failed to apply theme");
    }
  };

  // Handle export
  const handleExport = async (format: "html" | "json" | "pdf") => {
    try {
      const data = await api.export.export(projectId, format);
      if (format === "json") {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project?.title || "presentation"}.json`;
        a.click();
      } else {
        const blob = new Blob([data], { type: format === "pdf" ? "application/pdf" : "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project?.title || "presentation"}.${format}`;
        a.click();
      }
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to export");
    }
  };

  // Handle present
  const handlePresent = () => {
    window.open(`/present/${projectId}`, "_blank");
  };

  if (authLoading || projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">Project not found</p>
          <Button asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <header className="h-14 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>

          {isEditingTitle ? (
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
              className="w-64"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-lg font-medium text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded"
            >
              {project.title}
            </button>
          )}

          {isDirty && (
            <span className="text-sm text-slate-500 flex items-center gap-1">
              <Save className="h-3 w-3" />
              Saving...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo with history */}
          <UndoRedoButtons
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
          />

          {/* Undo History Panel */}
          <UndoHistoryPanel
            history={history}
            future={future}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onJumpToState={jumpToState}
            onClearHistory={clearHistory}
          />

          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2" />

          {/* Slide Outline */}
          <SlideOutline
            slides={project.slides || []}
            currentSlideId={currentSlide?.id}
            onSlideSelect={(slideId) => {
              const index = project.slides?.findIndex((s) => s.id === slideId) ?? -1;
              if (index !== -1) setCurrentSlideIndex(index);
            }}
            onSlideDelete={handleDeleteSlide}
            onSlideDuplicate={(slideId) => {
              const slide = project.slides?.find((s) => s.id === slideId);
              if (slide) handleDuplicateSlide(slide);
            }}
          />

          {/* Templates */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplatesDialog(true)}
          >
            <Layout className="h-4 w-4 mr-2" />
            Templates
          </Button>

          <Sheet open={isThemePanelOpen} onOpenChange={setIsThemePanelOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Palette className="h-4 w-4 mr-2" />
                Theme
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Choose Theme</SheetTitle>
                <SheetDescription>
                  Select a theme to apply to your presentation
                </SheetDescription>
              </SheetHeader>
              <ThemeSelector
                themes={themes || []}
                currentTheme={project.theme || undefined}
                onSelect={handleThemeChange}
              />
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport("html")}>
                Export as HTML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")}>
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>

          <Button size="sm" onClick={handlePresent}>
            <Play className="h-4 w-4 mr-2" />
            Present
          </Button>
        </div>
      </header>


      {/* Main editor area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Slide panel */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSlideReorder}
        >
          <div
            className={`${isSidePanelOpen ? "w-64" : "w-0"
              } bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all overflow-hidden flex-shrink-0`}
          >
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Slides ({project.slides?.length || 0})
              </span>
              <Button variant="ghost" size="icon" onClick={handleAddSlide}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <SortableContext
                items={project.slides?.map((s) => s.id) || []}
                strategy={verticalListSortingStrategy}
              >
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
            </div>
          </div>
        </DndContext>

        {/* Toggle side panel */}
        <button
          onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
          className="w-4 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 flex-shrink-0"
        >
          {isSidePanelOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Canvas area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Block toolbar */}
          <BlockToolbar projectId={projectId} slide={currentSlide} />

          {/* Slide canvas */}
          <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
            {currentSlide && (
              <SlideCanvas
                projectId={projectId}
                slide={currentSlide}
                theme={project.theme || undefined}
              />
            )}
          </div>

          {/* Slide navigation */}
          <div className="h-12 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-4 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              disabled={currentSlideIndex === 0}
              onClick={() => setCurrentSlideIndex(currentSlideIndex - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {currentSlideIndex + 1} / {project.slides?.length || 0}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={currentSlideIndex === (project.slides?.length || 1) - 1}
              onClick={() => setCurrentSlideIndex(currentSlideIndex + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Command Palette - Global keyboard command handler */}
      <CommandPalette
        projectId={projectId}
        isEditorMode={true}
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
          // Apply template to current slide
          toast.success(`Template "${template.name}" applied!`);
          setShowTemplatesDialog(false);
        }}
        onSelectStarterTemplate={(template) => {
          // Start new project from template
          toast.success(`Starting from "${template.name}" template!`);
          setShowTemplatesDialog(false);
        }}
      />

      {/* Quick Actions Toolbar */}
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
    </div>
  );
}

