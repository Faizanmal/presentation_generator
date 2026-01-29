'use client';

import { createContext, useContext, useEffect, useCallback, useState, ReactNode } from 'react';
import { toast } from 'sonner';

export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  category: 'navigation' | 'editing' | 'formatting' | 'view' | 'general';
  action: () => void;
  enabled?: boolean;
}

interface KeyboardShortcutsContextType {
  shortcuts: KeyboardShortcut[];
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (id: string) => void;
  enableShortcut: (id: string) => void;
  disableShortcut: (id: string) => void;
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  }
  return context;
}

const formatKey = (key: string): string => {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  
  const keyMap: Record<string, string> = {
    mod: isMac ? '⌘' : 'Ctrl',
    alt: isMac ? '⌥' : 'Alt',
    shift: '⇧',
    ctrl: isMac ? '⌃' : 'Ctrl',
    enter: '↵',
    escape: 'Esc',
    backspace: '⌫',
    delete: 'Del',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    space: 'Space',
  };

  return keyMap[key.toLowerCase()] || key.toUpperCase();
};

export function formatShortcut(keys: string[]): string {
  return keys.map(formatKey).join(' + ');
}

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
}

export function KeyboardShortcutsProvider({ children }: KeyboardShortcutsProviderProps) {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setShortcuts((prev) => {
      const existing = prev.find((s) => s.id === shortcut.id);
      if (existing) {
        return prev.map((s) => (s.id === shortcut.id ? shortcut : s));
      }
      return [...prev, { ...shortcut, enabled: shortcut.enabled ?? true }];
    });
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const enableShortcut = useCallback((id: string) => {
    setShortcuts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: true } : s))
    );
  }, []);

  const disableShortcut = useCallback((id: string) => {
    setShortcuts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: false } : s))
    );
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow some shortcuts even in inputs
        if (!event.metaKey && !event.ctrlKey) {
          return;
        }
      }

      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const keys = shortcut.keys.map((k) => k.toLowerCase());
        let matches = true;

        for (const key of keys) {
          if (key === 'mod') {
            if (!modKey) matches = false;
          } else if (key === 'shift') {
            if (!event.shiftKey) matches = false;
          } else if (key === 'alt') {
            if (!event.altKey) matches = false;
          } else if (key === 'ctrl') {
            if (!event.ctrlKey) matches = false;
          } else {
            if (event.key.toLowerCase() !== key) matches = false;
          }
        }

        // Check for extra modifiers not in the shortcut
        if (keys.indexOf('mod') === -1 && modKey) matches = false;
        if (keys.indexOf('shift') === -1 && event.shiftKey) matches = false;
        if (keys.indexOf('alt') === -1 && event.altKey) matches = false;

        if (matches) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Register help shortcut
  useEffect(() => {
    registerShortcut({
      id: 'show-help',
      keys: ['mod', '?'],
      description: 'Show keyboard shortcuts',
      category: 'general',
      action: () => setIsHelpOpen(true),
    });

    registerShortcut({
      id: 'close-help',
      keys: ['escape'],
      description: 'Close dialogs',
      category: 'general',
      action: () => setIsHelpOpen(false),
    });
  }, [registerShortcut]);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        shortcuts,
        registerShortcut,
        unregisterShortcut,
        enableShortcut,
        disableShortcut,
        isHelpOpen,
        setIsHelpOpen,
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

// Default editor shortcuts
export const DEFAULT_EDITOR_SHORTCUTS: Omit<KeyboardShortcut, 'action'>[] = [
  // Navigation
  { id: 'next-slide', keys: ['arrowdown'], description: 'Next slide', category: 'navigation' },
  { id: 'prev-slide', keys: ['arrowup'], description: 'Previous slide', category: 'navigation' },
  { id: 'first-slide', keys: ['mod', 'arrowup'], description: 'First slide', category: 'navigation' },
  { id: 'last-slide', keys: ['mod', 'arrowdown'], description: 'Last slide', category: 'navigation' },
  
  // Editing
  { id: 'new-slide', keys: ['mod', 'enter'], description: 'Add new slide', category: 'editing' },
  { id: 'duplicate-slide', keys: ['mod', 'd'], description: 'Duplicate slide', category: 'editing' },
  { id: 'delete-slide', keys: ['mod', 'backspace'], description: 'Delete slide', category: 'editing' },
  { id: 'undo', keys: ['mod', 'z'], description: 'Undo', category: 'editing' },
  { id: 'redo', keys: ['mod', 'shift', 'z'], description: 'Redo', category: 'editing' },
  { id: 'copy', keys: ['mod', 'c'], description: 'Copy', category: 'editing' },
  { id: 'paste', keys: ['mod', 'v'], description: 'Paste', category: 'editing' },
  { id: 'cut', keys: ['mod', 'x'], description: 'Cut', category: 'editing' },
  { id: 'select-all', keys: ['mod', 'a'], description: 'Select all', category: 'editing' },
  
  // Formatting
  { id: 'bold', keys: ['mod', 'b'], description: 'Bold', category: 'formatting' },
  { id: 'italic', keys: ['mod', 'i'], description: 'Italic', category: 'formatting' },
  { id: 'underline', keys: ['mod', 'u'], description: 'Underline', category: 'formatting' },
  { id: 'heading-1', keys: ['mod', 'alt', '1'], description: 'Heading 1', category: 'formatting' },
  { id: 'heading-2', keys: ['mod', 'alt', '2'], description: 'Heading 2', category: 'formatting' },
  { id: 'heading-3', keys: ['mod', 'alt', '3'], description: 'Heading 3', category: 'formatting' },
  { id: 'bullet-list', keys: ['mod', 'shift', '8'], description: 'Bullet list', category: 'formatting' },
  { id: 'numbered-list', keys: ['mod', 'shift', '7'], description: 'Numbered list', category: 'formatting' },
  
  // View
  { id: 'present', keys: ['mod', 'shift', 'p'], description: 'Start presentation', category: 'view' },
  { id: 'zoom-in', keys: ['mod', '='], description: 'Zoom in', category: 'view' },
  { id: 'zoom-out', keys: ['mod', '-'], description: 'Zoom out', category: 'view' },
  { id: 'fit-to-screen', keys: ['mod', '0'], description: 'Fit to screen', category: 'view' },
  { id: 'toggle-sidebar', keys: ['mod', '\\'], description: 'Toggle sidebar', category: 'view' },
  { id: 'toggle-grid', keys: ['mod', "'"], description: 'Toggle grid', category: 'view' },
  
  // General
  { id: 'save', keys: ['mod', 's'], description: 'Save', category: 'general' },
  { id: 'search', keys: ['mod', 'f'], description: 'Search', category: 'general' },
  { id: 'export', keys: ['mod', 'e'], description: 'Export', category: 'general' },
  { id: 'share', keys: ['mod', 'shift', 's'], description: 'Share', category: 'general' },
];
