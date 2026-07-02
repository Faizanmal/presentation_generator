import { useMemo } from "react";
import type { CommandDefinition } from "../types";

interface UseEditorCommandsOptions {
  onAddSlide: () => void;
  onInsertHeading: () => void;
  onInsertParagraph: () => void;
  onInsertImage: () => void;
  onOpenAI: () => void;
  onGenerateOutline: () => void;
  onApplyAutoLayout: () => void;
  onPresent: () => void;
  onToggleTheme: () => void;
  onToggleComments: () => void;
}

export function useEditorCommands({
  onAddSlide,
  onInsertHeading,
  onInsertParagraph,
  onInsertImage,
  onOpenAI,
  onGenerateOutline,
  onApplyAutoLayout,
  onPresent,
  onToggleTheme,
  onToggleComments,
}: UseEditorCommandsOptions): CommandDefinition[] {
  return useMemo(
    () => [
      {
        id: "global.add-slide",
        group: "Global",
        label: "Add slide",
        keywords: ["new", "create", "slide"],
        shortcut: "Alt+N",
        run: onAddSlide,
      },
      {
        id: "global.present",
        group: "Global",
        label: "Start presentation",
        keywords: ["present", "play", "fullscreen"],
        shortcut: "Space",
        run: onPresent,
      },
      {
        id: "global.theme",
        group: "Global",
        label: "Toggle light and dark theme",
        keywords: ["theme", "appearance", "mode"],
        run: onToggleTheme,
      },
      {
        id: "insert.heading",
        group: "Insert",
        label: "Insert heading block",
        keywords: ["title", "headline", "heading"],
        run: onInsertHeading,
      },
      {
        id: "insert.paragraph",
        group: "Insert",
        label: "Insert paragraph block",
        keywords: ["text", "body", "paragraph"],
        run: onInsertParagraph,
      },
      {
        id: "insert.image",
        group: "Insert",
        label: "Insert image block",
        keywords: ["photo", "media", "visual"],
        run: onInsertImage,
      },
      {
        id: "ai.modal",
        group: "AI",
        label: "Open AI composer",
        keywords: ["rewrite", "prompt", "copilot"],
        shortcut: "Shift+A",
        run: onOpenAI,
      },
      {
        id: "ai.outline",
        group: "AI",
        label: "Generate strategic outline",
        keywords: ["ai", "outline", "story arc"],
        run: onGenerateOutline,
      },
      {
        id: "ai.layout",
        group: "AI",
        label: "Auto balance slide layout",
        keywords: ["balance", "space", "alignment"],
        run: onApplyAutoLayout,
      },
      {
        id: "view.comments",
        group: "View",
        label: "Toggle comments",
        keywords: ["review", "feedback", "collab"],
        run: onToggleComments,
      },
    ],
    [
      onAddSlide,
      onApplyAutoLayout,
      onGenerateOutline,
      onInsertHeading,
      onInsertImage,
      onInsertParagraph,
      onOpenAI,
      onPresent,
      onToggleComments,
      onToggleTheme,
    ],
  );
}

