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
