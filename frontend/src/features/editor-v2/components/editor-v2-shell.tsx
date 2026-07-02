"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { editorV2Api } from "../api/editor-v2-api";
import { EDITOR_LIMITS } from "../constants/editor";
import { useAIComposer } from "../hooks/use-ai-composer";
import { useCollaborationChannel } from "../hooks/use-collaboration-channel";
import { useEditorCommands } from "../hooks/use-editor-commands";
import { useEditorShortcuts } from "../hooks/use-editor-shortcuts";
import { buildLayoutBlueprint, computeBalancedFrames, scoreLayout } from "../lib/slide-design-engine";
import { motionTiming, motionEase } from "../lib/motion";
import { useAIGenerationStore } from "../stores/use-ai-generation-store";
import { useCollaborationStore } from "../stores/use-collaboration-store";
import { useCommandPaletteStore } from "../stores/use-command-palette-store";
import { useEditorV2Store } from "../stores/use-editor-v2-store";
import type { EditorBlock, EditorDocument } from "../types";
import { AppSidebar } from "./app-sidebar";
import { CanvasStage } from "./canvas-stage";
import { EditorCommandPalette } from "./editor-command-palette";
import { EditorTopbar } from "./editor-topbar";
import { FloatingToolbar } from "./floating-toolbar";
import { RightInspector } from "./right-inspector";
import { SlideThumbnailRail } from "./slide-thumbnail-rail";
import { PresenceStrip } from "./collaboration/presence-strip";

const AIGenerationModal = dynamic(
  () => import("./ai/ai-generation-modal").then((module) => module.AIGenerationModal),
  { ssr: false },
);

const PresentationPlayer = dynamic(
  () => import("./presentation/presentation-player").then((module) => module.PresentationPlayer),
  { ssr: false },
);

interface EditorV2ShellProps {
  document: EditorDocument;
}

export function EditorV2Shell({ document }: EditorV2ShellProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showCommentsInInspector, setShowCommentsInInspector] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);

  const { setTheme, resolvedTheme } = useTheme();

  const currentDocument = useEditorV2Store((state) => state.document);
  const activeSlideId = useEditorV2Store((state) => state.activeSlideId);
  const selection = useEditorV2Store((state) => state.selection);
  const tool = useEditorV2Store((state) => state.tool);
  const viewport = useEditorV2Store((state) => state.viewport);
  const showLeftRail = useEditorV2Store((state) => state.showLeftRail);
  const showRightRail = useEditorV2Store((state) => state.showRightRail);
  const playback = useEditorV2Store((state) => state.playback);

  const loadDocument = useEditorV2Store((state) => state.loadDocument);
  const setTool = useEditorV2Store((state) => state.setTool);
  const setActiveSlide = useEditorV2Store((state) => state.setActiveSlide);
  const selectBlock = useEditorV2Store((state) => state.selectBlock);
  const panBy = useEditorV2Store((state) => state.panBy);
  const zoomBy = useEditorV2Store((state) => state.zoomBy);
  const toggleLeftRail = useEditorV2Store((state) => state.toggleLeftRail);
  const toggleRightRail = useEditorV2Store((state) => state.toggleRightRail);
  const updateTitle = useEditorV2Store((state) => state.updateTitle);
  const addSlideLocal = useEditorV2Store((state) => state.addSlide);
  const reorderSlides = useEditorV2Store((state) => state.reorderSlides);
  const updateBlockContent = useEditorV2Store((state) => state.updateBlockContent);
  const updateBlockFrame = useEditorV2Store((state) => state.updateBlockFrame);
  const addBlock = useEditorV2Store((state) => state.addBlock);
  const setPresenterMode = useEditorV2Store((state) => state.setPresenterMode);
  const setShowNotes = useEditorV2Store((state) => state.setShowNotes);
  const setLaserEnabled = useEditorV2Store((state) => state.setLaserEnabled);
  const setPlaybackSlide = useEditorV2Store((state) => state.setPlaybackSlide);

  const aiState = useAIGenerationStore((state) => state.state);
  const setAIPhase = useAIGenerationStore((state) => state.setPhase);
  const openAIModal = useAIGenerationStore((state) => state.open);
  const closeAIModal = useAIGenerationStore((state) => state.close);

  const commandPaletteOpen = useCommandPaletteStore((state) => state.isOpen);
  const commandPaletteQuery = useCommandPaletteStore((state) => state.query);
  const openCommandPalette = useCommandPaletteStore((state) => state.open);
  const closeCommandPalette = useCommandPaletteStore((state) => state.close);
  const setCommandPaletteQuery = useCommandPaletteStore((state) => state.setQuery);

  const collaborationConnected = useCollaborationStore((state) => state.connected);
  const participants = useCollaborationStore((state) => state.participants);
  const comments = useCollaborationStore((state) => state.comments);
  const addComment = useCollaborationStore((state) => state.addComment);
  const resolveComment = useCollaborationStore((state) => state.resolveComment);

  const { startGeneration, applySuggestion } = useAIComposer();

  const titlePersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentDocumentId = currentDocument?.id;
  const currentDocumentTitle = currentDocument?.title;

  useEffect(() => {
    loadDocument(document);
  }, [document, loadDocument]);

  const activeSlide = useMemo(() => {
    if (!currentDocument || !activeSlideId) {
      return null;
    }

    return currentDocument.slides.find((slide) => slide.id === activeSlideId) ?? null;
  }, [activeSlideId, currentDocument]);

  const selectedBlock = useMemo(() => {
    if (!activeSlide || !selection.blockId) {
      return null;
    }

    return activeSlide.blocks.find((block) => block.id === selection.blockId) ?? null;
  }, [activeSlide, selection.blockId]);

  useCollaborationChannel(document.id, activeSlide?.id ?? null);

  useEffect(() => {
    if (!currentDocumentId || !currentDocumentTitle) {
      return;
    }

    if (titlePersistTimerRef.current) {
      clearTimeout(titlePersistTimerRef.current);
    }

    titlePersistTimerRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        await editorV2Api.saveTitle(currentDocumentId, currentDocumentTitle);
      } catch {
        toast.error("Failed to sync title");
      } finally {
        setIsSaving(false);
      }
    }, EDITOR_LIMITS.titlePersistDelayMs);

    return () => {
      if (titlePersistTimerRef.current) {
        clearTimeout(titlePersistTimerRef.current);
      }
    };
  }, [currentDocumentId, currentDocumentTitle]);

  const insertBlock = useCallback(
    (type: EditorBlock["type"]) => {
      if (!activeSlide) {
        return;
      }

      const block: EditorBlock = {
        id: crypto.randomUUID(),
        type,
        frame: {
          x: 120 + activeSlide.blocks.length * 14,
          y: type === "heading" ? 96 : 210 + activeSlide.blocks.length * 10,
          width: type === "heading" ? 920 : type === "stat" ? 320 : 640,
          height: type === "image" ? 320 : type === "heading" ? 132 : type === "stat" ? 200 : 180,
          rotation: 0,
        },
        content:
          type === "heading"
            ? { text: "Compelling section title" }
            : type === "stat"
              ? { statValue: "42%", statLabel: "Key metric" }
              : type === "quote"
                ? { text: "Add an impactful quote here.", quoteAuthor: "" }
                : type === "image"
                  ? { text: "" }
                  : { text: "Add the supporting narrative and key proof points." },
      };

      addBlock(activeSlide.id, block);
    },
    [activeSlide, addBlock],
  );

  const addSlide = useCallback(async () => {
    if (!currentDocument) {
      return;
    }

    try {
      const slide = await editorV2Api.addSlide(currentDocument.id, currentDocument.slides.length);
      addSlideLocal(slide);
      toast.success("Slide created");
    } catch {
      toast.error("Unable to create slide");
    }
  }, [addSlideLocal, currentDocument]);

  const layoutBlueprint = useMemo(
    () => buildLayoutBlueprint(EDITOR_LIMITS.canvasWidth, EDITOR_LIMITS.canvasHeight),
    [],
  );

  const applyAutoLayout = useCallback(() => {
    if (!activeSlide) {
      return;
    }

    const nextFrames = computeBalancedFrames(activeSlide.blocks, layoutBlueprint);

    activeSlide.blocks.forEach((block) => {
      const frame = nextFrames[block.id];
      if (frame) {
        updateBlockFrame(activeSlide.id, block.id, frame);
      }
    });

    const score = scoreLayout(activeSlide.blocks, layoutBlueprint);
    toast.success(`Layout balanced — score ${score.overall}`);
  }, [activeSlide, layoutBlueprint, updateBlockFrame]);

  const inspectorScore = useMemo(() => {
    if (!activeSlide) {
      return { whitespace: 0, hierarchy: 0, visualBalance: 0, overall: 0 };
    }

    return scoreLayout(activeSlide.blocks, layoutBlueprint);
  }, [activeSlide, layoutBlueprint]);

  const openPresentation = useCallback(() => {
    setPresenterMode(true);
    setPresentationOpen(true);
  }, [setPresenterMode]);

  const goNextSlide = useCallback(() => {
    if (!currentDocument) {
      return;
    }

    const currentIndex = currentDocument.slides.findIndex((slide) => slide.id === activeSlideId);
    if (currentIndex < 0 || currentIndex >= currentDocument.slides.length - 1) {
      return;
    }

    const nextSlide = currentDocument.slides[currentIndex + 1];
    setActiveSlide(nextSlide.id);
    setPlaybackSlide(currentIndex + 1);
  }, [activeSlideId, currentDocument, setActiveSlide, setPlaybackSlide]);

  const goPreviousSlide = useCallback(() => {
    if (!currentDocument) {
      return;
    }

    const currentIndex = currentDocument.slides.findIndex((slide) => slide.id === activeSlideId);
    if (currentIndex <= 0) {
      return;
    }

    const previousSlide = currentDocument.slides[currentIndex - 1];
    setActiveSlide(previousSlide.id);
    setPlaybackSlide(currentIndex - 1);
  }, [activeSlideId, currentDocument, setActiveSlide, setPlaybackSlide]);

  const commands = useEditorCommands({
    onAddSlide: () => void addSlide(),
    onInsertHeading: () => insertBlock("heading"),
    onInsertParagraph: () => insertBlock("paragraph"),
    onInsertImage: () => insertBlock("image"),
    onOpenAI: () => {
      openAIModal();
      setAIPhase("idle", 0);
    },
    onGenerateOutline: () => {
      openAIModal();
      void startGeneration("Generate a strategic executive outline with 5 high-impact slides.");
    },
    onApplyAutoLayout: applyAutoLayout,
    onPresent: openPresentation,
    onToggleTheme: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    onToggleComments: () => setShowCommentsInInspector((value) => !value),
  });

  useEditorShortcuts({
    onOpenPalette: () => openCommandPalette(activeSlide?.id),
    onZoomIn: () => zoomBy(EDITOR_LIMITS.zoomStep),
    onZoomOut: () => zoomBy(-EDITOR_LIMITS.zoomStep),
    onNextSlide: goNextSlide,
    onPrevSlide: goPreviousSlide,
    onAddSlide: () => void addSlide(),
    onOpenAI: () => openAIModal(),
    onTogglePresenter: openPresentation,
  });

  if (!currentDocument || !activeSlide) {
    return (
      <div className="grid h-screen place-items-center bg-pd-app text-pd-text">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: motionTiming.smooth, ease: motionEase.smooth }}
          className="flex flex-col items-center gap-4"
        >
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-pd-border border-t-pd-accent" />
          <p className="text-sm text-pd-muted">Loading editor…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-pd-app text-pd-text text-render-premium pd-motion-safe">
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="hidden xl:block">
          <AppSidebar
            activeTool={tool}
            onToolSelect={setTool}
            onQuickNewProject={() => toast.info("Project quick-create flow can route to /dashboard")}
          />
        </div>

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <EditorTopbar
            title={currentDocument.title}
            subtitle={currentDocument.subtitle}
            zoom={viewport.zoom}
            isSaving={isSaving}
            showLeftRail={showLeftRail}
            showRightRail={showRightRail}
            participants={participants}
            onChangeTitle={updateTitle}
            onToggleLeftRail={toggleLeftRail}
            onToggleRightRail={toggleRightRail}
            onOpenPalette={() => openCommandPalette(activeSlide.id)}
            onOpenAI={openAIModal}
            onPresent={openPresentation}
          />

          <div className="flex min-h-0 flex-1">
            {/* Left rail — slide thumbnails */}
            <AnimatePresence>
              {showLeftRail && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "var(--pd-comp-rail-w)", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: motionTiming.normal, ease: motionEase.smooth }}
                  className="overflow-hidden"
                >
                  <SlideThumbnailRail
                    slides={currentDocument.slides}
                    activeSlideId={activeSlideId}
                    onSelect={setActiveSlide}
                    onAddSlide={() => void addSlide()}
                    onReorder={reorderSlides}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Canvas */}
            <div className="relative flex min-w-0 flex-1">
              <CanvasStage
                slide={activeSlide}
                viewport={viewport}
                selection={selection}
                collaborators={participants}
                editable={!presentationOpen}
                onPan={panBy}
                onZoomDelta={zoomBy}
                onSelectBlock={(blockId) => selectBlock(activeSlide.id, blockId)}
                onUpdateBlockContent={(blockId, text) => updateBlockContent(activeSlide.id, blockId, text)}
                onUpdateBlockFrame={(blockId, frame) => updateBlockFrame(activeSlide.id, blockId, frame)}
                onAutoLayout={applyAutoLayout}
              />

              <FloatingToolbar
                activeTool={tool}
                onSetTool={setTool}
                onInsertHeading={() => insertBlock("heading")}
                onInsertParagraph={() => insertBlock("paragraph")}
                onInsertImage={() => insertBlock("image")}
                onInsertStat={() => insertBlock("stat")}
                onInsertQuote={() => insertBlock("quote")}
                onInsertChart={() => insertBlock("chart")}
                onOpenAI={openAIModal}
                onAddComment={() => {
                  addComment({
                    id: crypto.randomUUID(),
                    authorName: "You",
                    authorColor: "oklch(0.72 0.17 245)",
                    slideId: activeSlide.id,
                    blockId: selectedBlock?.id,
                    content: "Please revise this section for a stronger value proposition.",
                    createdAt: new Date().toISOString(),
                    resolved: false,
                  });
                  toast.success("Comment added");
                }}
              />
            </div>

            {/* Right rail — inspector */}
            <AnimatePresence>
              {showRightRail && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "var(--pd-comp-inspector-w)", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: motionTiming.normal, ease: motionEase.smooth }}
                  className="overflow-hidden"
                >
                  <RightInspector
                    selectedBlock={selectedBlock}
                    layoutScore={inspectorScore}
                    collaborators={participants}
                    comments={showCommentsInInspector ? comments : comments.filter((comment) => comment.slideId === activeSlide.id)}
                    onAddInlineComment={(content) => {
                      addComment({
                        id: crypto.randomUUID(),
                        authorName: "You",
                        authorColor: "oklch(0.72 0.17 245)",
                        slideId: activeSlide.id,
                        blockId: selectedBlock?.id,
                        content,
                        createdAt: new Date().toISOString(),
                        resolved: false,
                      });
                    }}
                    onResolveComment={resolveComment}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <PresenceStrip connected={collaborationConnected} participants={participants} />
        </div>
      </div>

      {/* Overlays */}
      <EditorCommandPalette
        open={commandPaletteOpen}
        query={commandPaletteQuery}
        commands={commands}
        onQueryChange={setCommandPaletteQuery}
        onClose={closeCommandPalette}
      />

      <AIGenerationModal
        state={aiState}
        onClose={closeAIModal}
        onSubmitPrompt={startGeneration}
        onApplySuggestion={(suggestion) => {
          const text = applySuggestion(suggestion);
          if (selectedBlock?.id) {
            updateBlockContent(activeSlide.id, selectedBlock.id, text);
          } else {
            insertBlock("paragraph");
          }
          toast.success("Suggestion applied");
        }}
      />

      <PresentationPlayer
        open={presentationOpen}
        slides={currentDocument.slides}
        currentSlideIndex={playback.currentSlideIndex}
        showNotes={playback.showNotes}
        laserEnabled={playback.laserEnabled}
        presenterMode={playback.isPresenterMode}
        onClose={() => {
          setPresentationOpen(false);
          setPresenterMode(false);
        }}
        onNext={() => {
          setPlaybackSlide(playback.currentSlideIndex + 1);
        }}
        onPrevious={() => {
          setPlaybackSlide(playback.currentSlideIndex - 1);
        }}
        onToggleNotes={() => setShowNotes(!playback.showNotes)}
        onToggleLaser={() => setLaserEnabled(!playback.laserEnabled)}
      />
    </div>
  );
}
