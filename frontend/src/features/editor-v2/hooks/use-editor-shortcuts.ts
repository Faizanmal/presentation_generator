import { useEffect } from "react";

interface EditorShortcutOptions {
  onOpenPalette: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onNextSlide: () => void;
  onPrevSlide: () => void;
  onAddSlide: () => void;
  onOpenAI: () => void;
  onTogglePresenter: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

const isFormField = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
};

export function useEditorShortcuts({
  onOpenPalette,
  onZoomIn,
  onZoomOut,
  onNextSlide,
  onPrevSlide,
  onAddSlide,
  onOpenAI,
  onTogglePresenter,
  onUndo,
  onRedo,
}: EditorShortcutOptions): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (isFormField(event.target) && !mod) {
        return;
      }

      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenPalette();
        return;
      }

      if (mod && event.key === "=") {
        event.preventDefault();
        onZoomIn();
        return;
      }

      if (mod && event.key === "-") {
        event.preventDefault();
        onZoomOut();
        return;
      }

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNextSlide();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrevSlide();
        return;
      }

      if (event.key === "n" && event.altKey) {
        event.preventDefault();
        onAddSlide();
        return;
      }

      if (event.key.toLowerCase() === "a" && event.shiftKey) {
        event.preventDefault();
        onOpenAI();
        return;
      }

      if (event.code === "Space" && !isFormField(event.target)) {
        event.preventDefault();
        onTogglePresenter();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onAddSlide, onNextSlide, onOpenAI, onOpenPalette, onPrevSlide, onRedo, onTogglePresenter, onUndo, onZoomIn, onZoomOut]);
}

