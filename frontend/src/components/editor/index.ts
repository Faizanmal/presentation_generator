export { default as SlidePanel } from "./SlidePanel";
export { default as SlideCanvas } from "./SlideCanvas";
export { default as BlockRenderer } from "./BlockRenderer";
export { default as ThemeSelector } from "./ThemeSelector";
export { default as BlockToolbar } from "./BlockToolbar";

// New usability components
export { AITextTools, AIFloatingToolbar } from "./ai-text-tools";
export { SlideTemplatesDialog, slideTemplates, starterTemplates } from "./slide-templates";
export { SlideOutline, CompactSlideOutline } from "./slide-outline";
export { UndoHistoryPanel, UndoRedoButtons, useUndoHistory } from "./undo-history";
export { QuickActionsToolbar, QuickActionsFAB } from "./quick-actions-toolbar";

// Additional editor components
export { ImageUploadZone, ImageInsertDialog, usePasteImage } from "./image-upload";
export { SpeakerNotesPanel, SpeakerNotesIndicator } from "./speaker-notes";
export { SlashCommandMenu, useSlashCommands } from "./slash-commands";
export { VersionHistory, AutoSaveStatus, useAutoSave } from "./version-history";

// Collaboration components
export { CommentsPanel, CommentIndicator } from "./comments";
export {
    CollaboratorPresence,
    CollaboratorCursors,
    CollaboratorSelection,
    TypingIndicator,
    useCollaboratorCursor,
    getCollaboratorColor,
} from "./collaborator-presence";

// Presentation mode
export { PresentationMode, PresenterView } from "./presentation-mode";
// Advanced AI components
export { AIImageGenerator } from "./ai-image-generator";
export { SmartLayoutSelector } from "./smart-layout-selector";

// Chart and embed blocks
export { ChartBlock } from "./chart-block";
export { EmbedBlock } from "./embed-block";

// Voice narration
export { VoiceNarrationPlayer, BatchNarrationGenerator } from "./voice-narration-player";

// Live presentation
export { LivePresentationPanel } from "./live-presentation-panel";

// Export options
export { ExportOptionsPanel } from "./export-options-panel";

// AI Presentation Coach
export { PresentationCoach } from "./presentation-coach";

// Keyboard shortcuts
export { KeyboardShortcutsHelp, KeyboardShortcutsButton } from "./keyboard-shortcuts-help";

// Slide transitions and animations
export { SlideTransitionsPanel } from "./slide-transitions-panel";

// Accessibility checker
export { AccessibilityChecker } from "./accessibility-checker";

// Presentation scheduler
export { PresentationScheduler } from "./presentation-scheduler";

// Magic resize
export { MagicResize } from "./magic-resize";

// Version history panel
export { VersionHistoryPanel } from "./version-history-panel";

// Smart suggestions
export { SmartSuggestionsPanel } from "./smart-suggestions-panel";

// Translation panel
export { TranslationPanel } from "./translation-panel";

// Slide notes editor
export { SlideNotesEditor } from "./slide-notes-editor";

// Quiz/Poll builder
export { QuizPollBuilder } from "./quiz-poll-builder";

// Smart chart builder
export { SmartChartBuilder } from "./smart-chart-builder";