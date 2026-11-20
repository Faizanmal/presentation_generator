"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  DragEndEvent
} from "@dnd-kit/core";
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
  Check,
  AlertCircle,
  HelpCircle,
  Layout,
  AlignLeft,
  X,
  FileUp,
  ExternalLink,
  RefreshCw,
  MoreVertical,
} from "lucide-react";
import Link from "next/link";
import { resolveTopicImageUrl, upgradeLegacyImageUrl, mediaUrlFromBlockContent } from "@/lib/slide-media";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import type { Project, Theme, Slide, Block, BlockType, BlockStyle } from "@/types";
import dynamic from "next/dynamic";
import SlidePanel from "@/components/editor/SlidePanel";
import SlideCanvas from "@/components/editor/SlideCanvas";
import BlockToolbar from "@/components/editor/BlockToolbar";

// Usability and dialog components dynamically loaded for fast initial paint
const ThemeSelector = dynamic(() => import("@/components/editor/ThemeSelector"), { ssr: false });
const SlideDesignControls = dynamic(
  () => import("@/components/editor/slide-design-controls").then((m) => m.SlideDesignControls),
  { ssr: false },
);
const CommandPalette = dynamic(
  () => import("@/components/ui/command-palette").then((m) => m.CommandPalette),
  { ssr: false },
);
const KeyboardShortcutsDialog = dynamic(
  () => import("@/components/ui/keyboard-shortcuts").then((m) => m.KeyboardShortcutsDialog),
  { ssr: false },
);
const SlideTemplatesDialog = dynamic(
  () => import("@/components/editor/slide-templates").then((m) => m.SlideTemplatesDialog),
  { ssr: false },
);
const DocumentUploadDialog = dynamic(
  () => import("@/components/editor/document-upload-panel").then((m) => m.DocumentUploadDialog),
  { ssr: false },
);
const MasterSlidePanel = dynamic(
  () => import("@/components/editor/master-slide-panel").then((m) => m.MasterSlidePanel),
  { ssr: false },
);
const EmbedSharePanel = dynamic(
  () => import("@/components/editor/embed-share-panel").then((m) => m.EmbedSharePanel),
  { ssr: false },
);
const UndoHistoryPanel = dynamic(
  () => import("@/components/editor/undo-history").then((m) => m.UndoHistoryPanel),
  { ssr: false },
);
const UpgradePrompt = dynamic(
  () => import("@/components/ui/pro-badge").then((m) => m.UpgradePrompt),
  { ssr: false },
);

import { SlideOutline } from "@/components/editor/slide-outline";
import { UndoRedoButtons, useUndoHistory } from "@/components/editor/undo-history";
import { QuickActionsToolbar } from "@/components/editor/quick-actions-toolbar";
import { useRecentProjects } from "@/components/ui/favorites-recent";
import type { MasterSlideTemplate } from "@/components/editor/master-slide-panel";
import { useEditorAiActions } from "@/hooks/use-editor-ai-actions";
import { Shield, SlidersHorizontal } from "lucide-react";
import { canExportFormat } from "@/lib/plans";
import { FEATURES } from "@/lib/features";
import { ProBadge } from "@/components/ui/pro-badge";

type EditorCommandDetail = {
  type: "insert-block" | "ai-action" | "open-export" | "open-share" | "add-slide";
  payload?: Record<string, unknown>;
};

const COMMAND_BLOCK_MAP: Record<string, { blockType: BlockType; content: Record<string, unknown> }> = {
  heading1: { blockType: "HEADING", content: { text: "Heading" } },
  paragraph: { blockType: "PARAGRAPH", content: { text: "Start typing..." } },
  image: { blockType: "IMAGE", content: { url: "", alt: "" } },
  code: { blockType: "CODE", content: { code: "// Your code here", language: "javascript" } },
};


export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, subscription } = useAuthStore();
  const [exportUpgradeOpen, setExportUpgradeOpen] = useState(false);
  const [exportUpgradeFeature, setExportUpgradeFeature] = useState("PDF export");
  const userPlan = subscription?.plan || "FREE";

  const project = useEditorStore((state) => state.project);
  const currentSlideIndex = useEditorStore((state) => state.currentSlideIndex);
  const isDirty = useEditorStore((state) => state.isDirty);
  const loadProject = useEditorStore((state) => state.loadProject);
  const setCurrentSlideIndex = useEditorStore((state) => state.setCurrentSlideIndex);
  const updateProject = useEditorStore((state) => state.updateProject);
  const addSlide = useEditorStore((state) => state.addSlide);
  const addBlock = useEditorStore((state) => state.addBlock);
  const deleteSlide = useEditorStore((state) => state.deleteSlide);
  const reorderSlides = useEditorStore((state) => state.reorderSlides);
  const setTheme = useEditorStore((state) => state.setTheme);
  const updateSlide = useEditorStore((state) => state.updateSlide);
  const currentSlide = project?.slides?.[currentSlideIndex];

  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsSidePanelOpen(true);
    }
  }, []);
  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);

  // New usability feature states
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [showMasterSlides, setShowMasterSlides] = useState(false);
  const [showDesignControls, setShowDesignControls] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [layoutDensity, setLayoutDensity] = useState(62);
  const [toneOfVoice, setToneOfVoice] = useState(74);
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo/Redo history
  const {
    history,
    future,
    undo,
    redo,
    canUndo,
    canRedo,
    jumpToState,
    clearHistory,
    pushAction,
  } = useUndoHistory();

  // Recent projects tracking
  const { addToRecent } = useRecentProjects();



  const { runAiAction } = useEditorAiActions(projectId);

  // Fetch project
  const {
    data: projectData,
    isLoading: projectLoading,
    isError: projectError,
    refetch: refetchProject,
  } = useQuery({
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

  const [isRegeneratingLayout, setIsRegeneratingLayout] = useState(false);

  const migrateDeckSlidesClientSide = useCallback(
    (proj: Project, forceRegenerate = false): Project => {
      if (!proj?.slides || !Array.isArray(proj.slides)) {
        return proj;
      }

      const deckContext = [proj.title || "", proj.description || ""]
        .filter(Boolean)
        .join(" ");

      const updatedSlides = proj.slides.map((slide, sIdx) => {
        const blocks = Array.isArray(slide.blocks) ? slide.blocks : [];
        const slideTextContext = [
          deckContext,
          ...blocks.map((b) => {
            const c = b.content || {};
            const items = Array.isArray(c.items)
              ? c.items.map((it) => (typeof it === "string" ? it : "")).join(" ")
              : "";
            return [
              typeof c.text === "string" ? c.text : "",
              typeof c.alt === "string" ? c.alt : "",
              typeof c.label === "string" ? c.label : "",
              items,
            ]
              .filter(Boolean)
              .join(" ");
          }),
        ]
          .filter(Boolean)
          .join(" ");

        let hasTimeline = false;
        let hasComparison = false;
        let hasCta = false;
        let hasStats = false;

        const updatedBlocks = blocks.map((b) => {
          const bType = String(b.type || b.blockType || "").toUpperCase();
          if (bType === "TIMELINE") {hasTimeline = true;}
          if (bType === "COMPARISON") {hasComparison = true;}
          if (bType === "CALL_TO_ACTION") {hasCta = true;}
          if (bType === "STATS_GRID" || bType === "STATISTIC") {hasStats = true;}

          const nextContent = { ...(b.content || {}) };
          const nextStyle = { ...(b.style || {}) };

          if (bType === "IMAGE") {
            const rawUrl = String(nextContent.url || nextContent.src || nextContent.imageUrl || "");
            const upgraded = forceRegenerate
              ? resolveTopicImageUrl(slideTextContext, slide.order ?? sIdx)
              : upgradeLegacyImageUrl(rawUrl, slideTextContext, slide.order ?? sIdx);
            if (upgraded && upgraded !== rawUrl) {
              nextContent.url = upgraded;
              if (nextContent.src) {nextContent.src = upgraded;}
              if (nextContent.imageUrl) {nextContent.imageUrl = upgraded;}
            }
          }

          const rawStyle = nextStyle as Record<string, unknown>;
          if (
            bType === "PARAGRAPH" &&
            (rawStyle.fontSize === 21 ||
              rawStyle.fontSize === 22 ||
              rawStyle.fontSize === "21" ||
              rawStyle.fontSize === "22" ||
              rawStyle.fontSize === "21px" ||
              rawStyle.fontSize === "22px" ||
              rawStyle.maxWidth === "88%")
          ) {
            delete rawStyle.fontSize;
            delete rawStyle.maxWidth;
          }

          return {
            ...b,
            content: nextContent,
            style: nextStyle,
          };
        });

        let nextLayout = slide.layout || "single-column";
        if (hasTimeline && nextLayout !== "timeline") {
          nextLayout = "timeline";
        } else if (hasCta && nextLayout !== "bento-grid") {
          nextLayout = "bento-grid";
        } else if (hasStats && nextLayout !== "stats-grid") {
          nextLayout = "stats-grid";
        } else if (hasComparison && !["stats-grid", "comparison"].includes(nextLayout)) {
          nextLayout = "comparison";
        }

        return {
          ...slide,
          layout: nextLayout,
          blocks: updatedBlocks,
        };
      });

      return {
        ...proj,
        slides: updatedSlides,
      };
    },
    [],
  );

  // Save state tracking
  type SaveStatus = "idle" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const dirtySlideIdsRef = useRef<Set<string>>(new Set());
  const lastSavedSnapshotsRef = useRef<Map<string, string>>(new Map());
  const autoSaveDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load project into store and add to recent
  useEffect(() => {
    if (projectData) {
      const migrated = migrateDeckSlidesClientSide(projectData, false);
      loadProject(migrated);
      addToRecent(projectData.id);

      // Initialize snapshots
      if (migrated.slides) {
        migrated.slides.forEach((s) => {
          lastSavedSnapshotsRef.current.set(
            s.id,
            JSON.stringify({ title: s.title, layout: s.layout, order: s.order, speakerNotes: s.speakerNotes })
          );
        });
      }
    }
  }, [projectData, loadProject, addToRecent, migrateDeckSlidesClientSide]);

  // Execute debounced autosave of changed slides (~800ms)
  const executeAutosave = useCallback(async () => {
    if (!project || dirtySlideIdsRef.current.size === 0) {
      setSaveStatus("idle");
      return;
    }

    const slideIdsToSave = Array.from(dirtySlideIdsRef.current);
    setSaveStatus("saving");

    try {
      await Promise.all(
        slideIdsToSave.map(async (slideId) => {
          const slide = project.slides?.find((s) => s.id === slideId);
          if (slide) {
            await api.updateSlide(slideId, {
              title: slide.title,
              layout: slide.layout,
              order: slide.order,
              speakerNotes: slide.speakerNotes,
            });
            lastSavedSnapshotsRef.current.set(
              slideId,
              JSON.stringify({ title: slide.title, layout: slide.layout, order: slide.order, speakerNotes: slide.speakerNotes })
            );
            dirtySlideIdsRef.current.delete(slideId);
          }
        })
      );

      useEditorStore.setState({ isDirty: false });
      setSaveStatus("saved");
      setTimeout(() => {
        setSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
      }, 2500);
    } catch (err) {
      console.error("[Autosave] Failed to save slides", err);
      setSaveStatus("error");
    }
  }, [project]);

  // Track project changes and trigger debounced 800ms autosave
  useEffect(() => {
    if (!project?.slides || !projectData) return;

    let hasNewChanges = false;
    for (const slide of project.slides) {
      const snap = JSON.stringify({
        title: slide.title,
        layout: slide.layout,
        order: slide.order,
        speakerNotes: slide.speakerNotes,
      });
      const previousSnap = lastSavedSnapshotsRef.current.get(slide.id);
      if (previousSnap && previousSnap !== snap) {
        dirtySlideIdsRef.current.add(slide.id);
        hasNewChanges = true;
      }
    }

    if (hasNewChanges || isDirty) {
      setSaveStatus("saving");
      if (autoSaveDebounceTimerRef.current) {
        clearTimeout(autoSaveDebounceTimerRef.current);
      }
      autoSaveDebounceTimerRef.current = setTimeout(() => {
        void executeAutosave();
      }, 800);
    }
  }, [project, projectData, isDirty, executeAutosave]);

  useEffect(() => {
    return () => {
      if (autoSaveDebounceTimerRef.current) {
        clearTimeout(autoSaveDebounceTimerRef.current);
      }
    };
  }, []);

  const handleRegenerateLayout = useCallback(async () => {
    if (!project) return;
    if (autoSaveDebounceTimerRef.current) {
      clearTimeout(autoSaveDebounceTimerRef.current);
    }
    const previousProject = project;
    setIsRegeneratingLayout(true);
    setSaveStatus("saving");

    try {
      let updated: Project;
      try {
        const fromApi = await api.regenerateProjectLayout(projectId);
        updated = migrateDeckSlidesClientSide(fromApi, true);
      } catch {
        updated = migrateDeckSlidesClientSide(project, true);
      }

      // Persist regenerated layouts to server atomically BEFORE updating canvas/store
      if (updated.slides) {
        await Promise.all(
          updated.slides.map((s) =>
            api.updateSlide(s.id, {
              title: s.title,
              layout: s.layout,
              order: s.order,
              speakerNotes: s.speakerNotes,
              transition: s.transition,
              ...((s as unknown as Record<string, unknown>).thumbnailUrl
                ? { thumbnailUrl: String((s as unknown as Record<string, unknown>).thumbnailUrl) }
                : {}),
              blocks: (s.blocks || []).map((b) => ({
                id: b.id,
                blockType: b.type || (b as unknown as Record<string, unknown>).blockType,
                type: b.type || (b as unknown as Record<string, unknown>).blockType,
                content: b.content,
                style: b.style,
                order: b.order,
              })) as unknown as Block[],
            })
          )
        );
        updated.slides.forEach((s) => {
          lastSavedSnapshotsRef.current.set(
            s.id,
            JSON.stringify({ title: s.title, layout: s.layout, order: s.order, speakerNotes: s.speakerNotes })
          );
        });
      }

      // Update store and canvas ONLY after successful save
      loadProject(updated);
      queryClient.setQueryData(["project", projectId], updated);
      pushAction({
        actionType: "batch_update",
        description: "Regenerate layout",
        data: {
          before: { slides: previousProject.slides },
          after: { slides: updated.slides },
        },
      });

      dirtySlideIdsRef.current.clear();
      useEditorStore.setState({ isDirty: false });
      setSaveStatus("saved");
      setTimeout(() => {
        setSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
      }, 2500);
      toast.success("Rebuilds layouts and visuals. Your text edits are kept.");
    } catch (err: unknown) {
      console.error("[Regenerate] Failed to save regenerated layouts", err);
      // Rollback store and UI
      loadProject(previousProject);
      setSaveStatus("error");
      const validationMsg = (err as any)?.response?.data?.message || (err as Error)?.message || "Validation error";
      const formattedMsg = Array.isArray(validationMsg) ? validationMsg.join(", ") : String(validationMsg);
      toast.error(`Failed to save layout: ${formattedMsg}`, {
        action: {
          label: "Retry",
          onClick: () => void handleRegenerateLayout(),
        },
      });
    } finally {
      setIsRegeneratingLayout(false);
    }
  }, [project, projectId, migrateDeckSlidesClientSide, loadProject, queryClient, pushAction]);

  const handleRegenerateSingleSlide = useCallback(async (slideId: string) => {
    if (!project?.slides) return;
    const slideIdx = project.slides.findIndex((s) => s.id === slideId);
    if (slideIdx === -1) return;
    const targetSlide = project.slides[slideIdx];
    const previousSlide = { ...targetSlide };

    const deckTopicContext = [project.title, targetSlide.title].filter(Boolean).join(" ");
    const nextBlocks = (targetSlide.blocks || []).map((b) => {
      const bType = String(b.type || (b as any).blockType || "").toUpperCase();
      if (bType === "IMAGE") {
        const newUrl = resolveTopicImageUrl(deckTopicContext, targetSlide.order ?? slideIdx);
        return { ...b, content: { ...(b.content || {}), url: newUrl, src: newUrl, imageUrl: newUrl } };
      }
      return b;
    });

    const updatedSlide: Slide = {
      ...targetSlide,
      blocks: nextBlocks,
    };

    setSaveStatus("saving");
    try {
      await api.updateSlide(targetSlide.id, {
        title: updatedSlide.title,
        layout: updatedSlide.layout,
        order: updatedSlide.order,
        speakerNotes: updatedSlide.speakerNotes,
        blocks: nextBlocks.map((b) => ({
          id: b.id,
          blockType: b.type || (b as unknown as Record<string, unknown>).blockType,
          type: b.type || (b as unknown as Record<string, unknown>).blockType,
          content: b.content,
          style: b.style,
          order: b.order,
        })) as unknown as Block[],
      });

      updateSlide(targetSlide.id, updatedSlide);
      pushAction({
        actionType: "update_slide",
        description: `Regenerate slide ${slideIdx + 1}`,
        slideId: targetSlide.id,
        data: { before: previousSlide as any, after: updatedSlide as any },
      });
      setSaveStatus("saved");
      toast.success(`Slide ${slideIdx + 1} visuals updated`);
    } catch (err) {
      console.error("[RegenerateSlide] Failed", err);
      updateSlide(targetSlide.id, previousSlide);
      setSaveStatus("error");
      toast.error("Failed to regenerate slide");
    }
  }, [project, updateSlide, pushAction]);

  const handleQuickLayoutChange = useCallback(async (layout: string) => {
    if (!currentSlide) return;
    const previousLayout = currentSlide.layout;
    updateSlide(currentSlide.id, { layout });
    setSaveStatus("saving");
    try {
      await api.updateSlide(currentSlide.id, { layout });
      setSaveStatus("saved");
      toast.success(`Layout changed to ${layout}`);
    } catch (err) {
      console.error("[QuickLayout] Failed", err);
      updateSlide(currentSlide.id, { layout: previousLayout });
      setSaveStatus("error");
      toast.error("Failed to change layout");
    }
  }, [currentSlide, updateSlide]);

  // Keyboard navigation for next/previous slide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')
      ) {
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "PageUp" || (e.key.toLowerCase() === "k" && !e.metaKey && !e.ctrlKey)) {
        if (currentSlideIndex > 0) {
          e.preventDefault();
          setCurrentSlideIndex(currentSlideIndex - 1);
        }
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key.toLowerCase() === "j" && !e.metaKey && !e.ctrlKey)) {
        if (project?.slides && currentSlideIndex < project.slides.length - 1) {
          e.preventDefault();
          setCurrentSlideIndex(currentSlideIndex + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, project?.slides, setCurrentSlideIndex]);

  // Preload first slide image
  const firstSlideImageUrl = useMemo(() => {
    const firstSlide = project?.slides?.[0];
    if (!firstSlide?.blocks) return null;
    const imgBlock = firstSlide.blocks.find((b) => {
      const t = (b.type || (b as Block & { blockType?: string }).blockType)?.toUpperCase();
      return t === "IMAGE";
    });
    if (!imgBlock) return null;
    const context = [project?.title, firstSlide.title].filter(Boolean).join(" ");
    return mediaUrlFromBlockContent(imgBlock.content, context, 0);
  }, [project?.slides, project?.title]);

  // Sync title input with project title
  const [prevProjectTitle, setPrevProjectTitle] = useState(projectData?.title);
  if (projectData?.title !== prevProjectTitle) {
    setPrevProjectTitle(projectData?.title);
    if (projectData?.title) {
      setTitleInput(projectData.title);
    }
  }

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);


  // Save project mutation
  const saveMutation = useMutation({
    mutationFn: (data: Partial<Project>) => api.updateProject(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: () => {
      toast.error("Failed to save project");
    },
  });

  // Handle title update
  const handleTitleSave = useCallback(() => {
    if (titleInput.trim() && titleInput !== project?.title) {
      updateProject({ title: titleInput.trim() });
      saveMutation.mutate({ title: titleInput.trim() });
    }
    setIsEditingTitle(false);
  }, [titleInput, project?.title, updateProject, saveMutation]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Handle slide reorder
  const handleSlideReorder = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !project?.slides) { return; }

    const oldIndex = project.slides.findIndex((s) => s.id === active.id);
    const newIndex = project.slides.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderSlides(oldIndex, newIndex);
      // Update via API
      const reordered = arrayMove(project.slides, oldIndex, newIndex);
      api.reorderSlides(
        projectId,
        reordered.map((s, i) => ({ id: s.id, order: i }))
      );
    }
  }, [project, reorderSlides, projectId]);

  // Handle add slide
  const handleAddSlide = useCallback(async () => {
    try {
      const newSlide = await api.createSlide({
        projectId,
        title: `Slide ${(project?.slides?.length || 0) + 1}`,
        order: project?.slides?.length || 0,
      });
      addSlide(newSlide);
      setCurrentSlideIndex((project?.slides?.length || 0));
    } catch {
      toast.error("Failed to add slide");
    }
  }, [project, projectId, addSlide, setCurrentSlideIndex]);

  // Handle delete slide
  const handleDeleteSlide = useCallback(async (slideId: string) => {
    if (project?.slides?.length === 1) {
      toast.error("Cannot delete the last slide");
      return;
    }
    try {
      await api.deleteSlide(slideId);
      deleteSlide(slideId);
    } catch {
      toast.error("Failed to delete slide");
    }
  }, [project?.slides?.length, deleteSlide]);

  // Handle speaker notes change
  const handleNotesChange = useCallback((notes: string) => {
    if (!currentSlide) { return; }
    const updateSlideStore = useEditorStore.getState().updateSlide;
    updateSlideStore(currentSlide.id, { speakerNotes: notes });

    if (notesSaveTimerRef.current) {
      clearTimeout(notesSaveTimerRef.current);
    }

    notesSaveTimerRef.current = setTimeout(() => {
      api.updateSlide(currentSlide.id, { speakerNotes: notes }).catch((error) => {
        console.error("Failed to save speaker notes", error);
      });
    }, 500);
  }, [currentSlide]);

  useEffect(() => {
    return () => {
      if (notesSaveTimerRef.current) {
        clearTimeout(notesSaveTimerRef.current);
        notesSaveTimerRef.current = null;
      }
    };
  }, []);

  // Handle duplicate slide
  const handleDuplicateSlide = useCallback(async (slide: Slide) => {
    try {
      const newSlide = await api.createSlide({
        projectId,
        title: `${slide.title} (copy)`,
        order: (project?.slides?.length || 0),
      });
      // Also duplicate blocks
      if (slide.blocks) {
        for (const block of slide.blocks) {
          await api.createBlock({
            projectId,
            slideId: newSlide.id,
            blockType: block.type,
            content: block.content,
            order: block.order,
          });
        }
      }
      // Refetch project to get updated data
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    } catch {
      toast.error("Failed to duplicate slide");
    }
  }, [project, projectId, queryClient]);

  // Handle theme change
  const handleThemeChange = useCallback(async (theme: Theme) => {
    try {
      await api.updateProject(projectId, { themeId: theme.id });
      setTheme(theme);
      setIsThemePanelOpen(false);
      toast.success("Theme applied");
    } catch {
      toast.error("Failed to apply theme");
    }
  }, [projectId, setTheme]);

  const handleDesignThemeChange = useCallback((themeId: string) => {
    const selectedTheme = themes?.find((theme) => theme.id === themeId);
    if (selectedTheme) {
      void handleThemeChange(selectedTheme);
    }
  }, [handleThemeChange, themes]);

  // Handle export
  const handleExport = useCallback(async (format: "html" | "json" | "pdf" | "pptx") => {
    try {
      if (format === "pdf") {
        const blob = await api.downloadWysiwygPdf(projectId, "standard");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project?.title || "presentation"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "pptx") {
        const data = await api.exportToPptx(projectId, {
          includeNotes: false,
          includeAnimations: true,
        });
        const url = URL.createObjectURL(data.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || `${project?.title || "presentation"}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await api.export.export(projectId, format);
        if (format === "json") {
          const blobData = typeof data === 'string' ? data : data.blob;
          const blob = new Blob([JSON.stringify(blobData, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${project?.title || "presentation"}.json`;
          a.click();
        } else {
          const blobData = typeof data === 'string' ? data : data.blob;
          const blob = new Blob([blobData], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${project?.title || "presentation"}.${format}`;
          a.click();
        }
      }
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Failed to export");
    }
  }, [project, projectId]);

  const requestExport = useCallback(
    (format: "html" | "json" | "pdf" | "pptx") => {
      if (!canExportFormat(userPlan, format)) {
        setExportUpgradeFeature(
          format === "pptx" ? "PowerPoint export" : "PDF export",
        );
        setExportUpgradeOpen(true);
        return;
      }
      void handleExport(format);
    },
    [handleExport, userPlan],
  );

  // Handle present
  const handlePresent = useCallback(() => {
    window.open(`/present/${projectId}`, "_blank");
  }, [projectId]);

  useEffect(() => {
    const handleEditorCommand = async (event: Event) => {
      const customEvent = event as CustomEvent<EditorCommandDetail>;
      const detail = customEvent.detail;
      if (!detail) {
        return;
      }

      if (detail.type === "add-slide") {
        await handleAddSlide();
        return;
      }

      if (detail.type === "open-export") {
        requestExport("pdf");
        return;
      }

      if (detail.type === "open-share") {
        setShowShare(true);
        return;
      }

      if (detail.type === "ai-action") {
        const action = typeof detail.payload?.action === "string" ? detail.payload.action : "enhance";
        const prompt = typeof detail.payload?.prompt === "string" ? detail.payload.prompt : undefined;
        await runAiAction(action, prompt);
        return;
      }

      if (detail.type === "insert-block") {
        const commandId = typeof detail.payload?.commandId === "string" ? detail.payload.commandId : "paragraph";
        const mapped = COMMAND_BLOCK_MAP[commandId];
        if (!currentSlide || !mapped) {
          return;
        }

        try {
          const newBlock = await api.blocks.create(projectId, currentSlide.id, {
            projectId,
            blockType: mapped.blockType,
            content: mapped.content,
            order: currentSlide.blocks?.length || 0,
          });
          addBlock(currentSlide.id, newBlock);
          toast.success("Block added");
        } catch {
          toast.error("Failed to add block");
        }
      }
    };

    window.addEventListener("presentation:editor-command", handleEditorCommand as EventListener);
    return () => {
      window.removeEventListener("presentation:editor-command", handleEditorCommand as EventListener);
    };
  }, [addBlock, currentSlide, handleAddSlide, projectId, requestExport, runAiAction]);

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

  if (projectError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
        <div className="text-center p-8 max-w-md bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Failed to load presentation</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">There was a problem loading this presentation. Please try again.</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" asChild>
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
            <Button onClick={() => void refetchProject()}>Retry</Button>
          </div>
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
      {/* Preload first slide image for speed */}
      {firstSlideImageUrl && (
        <link rel="preload" as="image" href={firstSlideImageUrl} />
      )}

      {/* Header */}
      <header className="h-14 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 relative">
        {FEATURES.editorV2 && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-0.5 rounded-b-md text-xs font-medium z-50">
            <Link href={`/editor-v2/${projectId}`} className="hover:underline flex items-center gap-1">
              Try New Editor
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </Link>
          </div>
        )}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild aria-label="Back to dashboard">
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
              className="w-40 sm:w-64"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-base sm:text-lg font-medium text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs text-left"
            >
              {project.title}
            </button>
          )}

          {/* Save Status Indicator */}
          {saveStatus === "saving" && (
            <span className="text-sm text-slate-500 flex items-center gap-1.5 font-medium animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-sm text-green-600 flex items-center gap-1.5 font-medium">
              <Check className="h-3.5 w-3.5 text-green-600" />
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-sm text-red-500 flex items-center gap-2 font-medium">
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              Failed to save
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => void executeAutosave()}
              >
                Retry
              </Button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop-only secondary actions (hidden below 900px) */}
          <div className="hidden min-[900px]:flex items-center gap-2">
            {/* Keyboard shortcuts help popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500"
                  aria-label="Keyboard shortcuts"
                  title="Keyboard shortcuts"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-68 p-3 text-xs space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white border-b pb-1">Keyboard Shortcuts</div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Next slide</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px]">→ / J / PgDn</kbd>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Previous slide</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px]">← / K / PgUp</kbd>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Undo / Redo</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px]">Ctrl+Z / Ctrl+Y</kbd>
                </div>
                <div className="text-[10px] text-slate-400 pt-1 border-t">Autosaved every ~800ms</div>
              </PopoverContent>
            </Popover>

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
                if (index !== -1) { setCurrentSlideIndex(index); }
              }}
              onSlideDelete={handleDeleteSlide}
              onSlideDuplicate={(slideId) => {
                const slide = project.slides?.find((s) => s.id === slideId);
                if (slide) { handleDuplicateSlide(slide); }
              }}
            />

            {/* Regenerate layout with exact required tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateLayout}
                    disabled={isRegeneratingLayout}
                    aria-label="Regenerate layout"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRegeneratingLayout ? "animate-spin" : ""}`} />
                    Regenerate layout
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  Rebuilds layouts and visuals. Your text edits are kept.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Templates */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplatesDialog(true)}
            >
              <Layout className="h-4 w-4 mr-2" />
              Templates
            </Button>

            {/* Import Document */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDocUpload(true)}
            >
              <FileUp className="h-4 w-4 mr-2" />
              Import
            </Button>

            {/* Master Slides */}
            <Sheet open={showMasterSlides} onOpenChange={setShowMasterSlides}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  Master
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto p-0 w-96">
                <MasterSlidePanel
                  isEnterprise
                  onApplyTemplate={(template: MasterSlideTemplate) => {
                    if (project?.slides?.[currentSlideIndex]) {
                      const slide = project.slides[currentSlideIndex];
                      template.regions.forEach(async (region, idx) => {
                        const blockType = region.allowedBlockTypes[0] || 'PARAGRAPH';
                        try {
                          await api.blocks.create(projectId, slide.id, {
                            projectId,
                            blockType: blockType as BlockType,
                            content: { text: region.placeholder },
                            order: idx,
                            style: {
                              x: Math.round((region.x / 100) * 1280),
                              y: Math.round((region.y / 100) * 720),
                              width: Math.round((region.width / 100) * 1280),
                              height: Math.round((region.height / 100) * 720),
                              locked: region.locked,
                            } as BlockStyle,
                          });
                        } catch {
                          // Continue
                        }
                      });
                      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
                      setShowMasterSlides(false);
                    }
                  }}
                />
              </SheetContent>
            </Sheet>

            <Sheet open={showDesignControls} onOpenChange={setShowDesignControls}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Design
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto p-0 w-96">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Presentation Design</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Control density and tone to shape the final presentation style.
                  </p>
                </div>
                <div className="p-5">
                  <SlideDesignControls
                    projectId={projectId}
                    themes={(themes || []).map((theme) => ({
                      id: theme.id,
                      name: theme.name,
                      colors: {
                        background: theme.colors.background,
                        primary: theme.colors.primary,
                        text: theme.colors.text,
                        accent: theme.colors.accent,
                      },
                    }))}
                    currentThemeId={project.theme?.id}
                    onThemeChange={handleDesignThemeChange}
                    onExportPdf={() => requestExport("pdf")}
                    onLayoutDensityChange={setLayoutDensity}
                    onToneChange={setToneOfVoice}
                  />
                </div>
              </SheetContent>
            </Sheet>

            <Sheet open={isThemePanelOpen} onOpenChange={setIsThemePanelOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Palette className="h-4 w-4 mr-2" />
                  Theme
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
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

            <Button variant="outline" size="sm" onClick={() => setShowShare(true)}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>

          {/* Collapsed "More" dropdown for screens below 900px */}
          <div className="flex min-[900px]:hidden items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2 text-xs" aria-label="More actions">
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span className="sr-only">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleRegenerateLayout} disabled={isRegeneratingLayout}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRegeneratingLayout ? "animate-spin" : ""}`} />
                  Regenerate layout
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowTemplatesDialog(true)}>
                  <Layout className="h-4 w-4 mr-2" />
                  Templates
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowDocUpload(true)}>
                  <FileUp className="h-4 w-4 mr-2" />
                  Import Document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowDesignControls(true)}>
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Design Controls
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsThemePanelOpen(true)}>
                  <Palette className="h-4 w-4 mr-2" />
                  Change Theme
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowShare(true)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Export & Present always reachable on all widths */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => requestExport("html")}>
                Export as HTML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => requestExport("json")}>
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => requestExport("pdf")}>
                <span className="flex w-full items-center justify-between gap-2">
                  Export as PDF
                  {!canExportFormat(userPlan, "pdf") && <ProBadge />}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => requestExport("pptx")}>
                <span className="flex w-full items-center justify-between gap-2">
                  Export as PowerPoint
                  {!canExportFormat(userPlan, "pptx") && <ProBadge />}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" onClick={handlePresent} className="h-8 px-2.5 text-xs">
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Present
          </Button>
        </div>
      </header>


      {/* Main editor area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Slide panel / drawer */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSlideReorder}
        >
          {/* Mobile backdrop */}
          {isSidePanelOpen && (
            <div
              className="min-[900px]:hidden fixed inset-0 bg-black/40 z-30 transition-opacity"
              onClick={() => setIsSidePanelOpen(false)}
              aria-hidden="true"
            />
          )}

          <div
            className={`${
              isSidePanelOpen ? "w-64" : "w-0"
            } bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-200 overflow-hidden shrink-0 max-[899px]:fixed max-[899px]:left-0 max-[899px]:top-14 max-[899px]:bottom-12 max-[899px]:z-40 max-[899px]:shadow-2xl`}
          >
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Slides ({project.slides?.length || 0})
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={handleAddSlide} aria-label="Add slide">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-[900px]:hidden"
                  onClick={() => setIsSidePanelOpen(false)}
                  aria-label="Close slides drawer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
                    onClick={() => {
                      setCurrentSlideIndex(index);
                      if (typeof window !== "undefined" && window.innerWidth < 900) {
                        setIsSidePanelOpen(false);
                      }
                    }}
                    onDelete={() => handleDeleteSlide(slide.id)}
                    onDuplicate={() => handleDuplicateSlide(slide)}
                    theme={project.theme || undefined}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
        </DndContext>

        {/* Toggle side panel button */}
        <button
          onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
          className="w-5 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 cursor-pointer text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          title={isSidePanelOpen ? "Collapse slides panel" : "Expand slides panel"}
          aria-label={isSidePanelOpen ? "Collapse slides panel" : "Expand slides panel"}
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
          <BlockToolbar
            projectId={projectId}
            slide={currentSlide}
            onRegenerateSlide={() => currentSlide && void handleRegenerateSingleSlide(currentSlide.id)}
            onLayoutChange={handleQuickLayoutChange}
          />

          {/* Slide canvas */}
          <div className="flex-1 overflow-auto p-2 sm:p-4 md:p-8 flex items-center justify-center">
            {currentSlide && (
              <SlideCanvas
                projectId={projectId}
                projectTitle={project.title}
                slide={currentSlide}
                theme={project.theme || undefined}
                presentationDensity={layoutDensity}
                presentationTone={toneOfVoice}
              />
            )}
          </div>

          {/* Speaker Notes */}
          {showSpeakerNotes && currentSlide && (
            <div className="h-48 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shrink-0 flex flex-col shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4" /> Speaker Notes
                </span>
                <Button variant="ghost" size="sm" onClick={() => setShowSpeakerNotes(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <textarea
                className="flex-1 w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Add speaker notes here... These will be visible when you present."
                value={currentSlide.speakerNotes || ""}
                onChange={(e) => handleNotesChange(e.target.value)}
              />
            </div>
          )}

          {/* Slide navigation */}
          <div className="h-12 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0">
            <div className="flex-1">
              <Button
                variant={showSpeakerNotes ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowSpeakerNotes(!showSpeakerNotes)}
                className="text-xs shrink-0"
              >
                <AlignLeft className="h-4 w-4 mr-1.5" />
                Notes
              </Button>
            </div>

            <div className="flex items-center justify-center gap-4 flex-1">
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
            <div className="flex-1" />
          </div>
        </div>
      </div>

      {/* Command Palette - Global keyboard command handler */}
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
        onExport={() => requestExport("pdf")}
        onShare={() => setShowShare(true)}
        isSaving={saveMutation.isPending}
        position="bottom"
      />

      <EmbedSharePanel
        presentationId={projectId}
        presentationTitle={project.title}
        shareToken={project.shareToken}
        isPublic={project.isPublic}
        open={showShare}
        onOpenChange={setShowShare}
        showTrigger={false}
        onProjectUpdated={(updated) => {
          updateProject({
            isPublic: updated.isPublic,
            shareToken: updated.shareToken,
          });
        }}
      />

      {/* Document Upload Dialog */}
      <DocumentUploadDialog
        open={showDocUpload}
        onOpenChange={setShowDocUpload}
        onSlidesGenerated={async (result) => {
          // Create slides from ingestion result
          try {
            for (const slide of result.slides) {
              const newSlide = await api.createSlide({
                projectId,
                title: slide.title,
                order: (project?.slides?.length || 0),
              });
              for (const block of slide.blocks) {
                await api.createBlock({
                  projectId,
                  slideId: newSlide.id,
                  blockType: block.blockType as BlockType,
                  content: block.content,
                  order: block.order,
                });
              }
            }
            queryClient.invalidateQueries({ queryKey: ["project", projectId] });
            toast.success(`Added ${result.slides.length} slides from document`);
            setShowDocUpload(false);
          } catch {
            toast.error("Failed to insert generated slides");
          }
        }}
      />

      <UpgradePrompt
        open={exportUpgradeOpen}
        onOpenChange={setExportUpgradeOpen}
        feature={exportUpgradeFeature}
      />
    </div>
  );
}

