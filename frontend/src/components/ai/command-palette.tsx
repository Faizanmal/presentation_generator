/**
 * AI Command Palette
 * 
 * ⌘+K / Ctrl+K powered command palette for AI generation,
 * slide operations, export, and editor shortcuts.
 */
'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGeneration } from '@/hooks/use-generation';

// ============================================
// COMMAND DEFINITIONS
// ============================================

interface Command {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'ai' | 'slide' | 'export' | 'edit' | 'navigation';
  shortcut?: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  /** Inject editor actions from the parent */
  editorActions?: {
    addSlide?: () => void;
    deleteSlide?: (id: string) => void;
    duplicateSlide?: (id: string) => void;
    exportPdf?: () => void;
    exportPptx?: () => void;
    exportHtml?: () => void;
    togglePresent?: () => void;
    undo?: () => void;
    redo?: () => void;
    activeSlideId?: string;
  };
}

export function AICommandPalette({ isOpen, onClose, editorActions }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [subMode, setSubMode] = useState<'main' | 'generate' | 'rewrite' | null>('main');
  const [generationTopic, setGenerationTopic] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { generate } = useGeneration();

  // Focus input when opened
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      setQuery('');
      setSelectedIndex(0);
      setSubMode('main');
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  // Build command list
  const commands: Command[] = useMemo(() => {
    const cmds: Command[] = [
      // AI Commands
      {
        id: 'ai-generate',
        label: 'Generate Presentation',
        description: 'Create an AI-powered presentation from a topic',
        icon: '✨',
        category: 'ai',
        shortcut: '⌘⇧G',
        action: () => setSubMode('generate'),
      },
      {
        id: 'ai-rewrite',
        label: 'Rewrite Current Slide',
        description: 'AI rewrites the active slide content',
        icon: '✏️',
        category: 'ai',
        shortcut: '⌘⇧R',
        action: () => setSubMode('rewrite'),
        disabled: !editorActions?.activeSlideId,
      },
      {
        id: 'ai-improve',
        label: 'Improve Writing',
        description: 'Enhance clarity, tone, and impact of selected text',
        icon: '💡',
        category: 'ai',
        action: () => { /* TODO: connect to inline AI editing */ onClose(); },
      },
      {
        id: 'ai-summarize',
        label: 'Summarize Content',
        description: 'Create a concise summary of verbose slides',
        icon: '📝',
        category: 'ai',
        action: () => { onClose(); },
      },
      {
        id: 'ai-add-visuals',
        label: 'Add Visuals to Slide',
        description: 'Generate images or icons for the current slide',
        icon: '🖼️',
        category: 'ai',
        action: () => { onClose(); },
        disabled: !editorActions?.activeSlideId,
      },

      // Slide Commands
      {
        id: 'slide-add',
        label: 'Add New Slide',
        description: 'Insert a blank slide after the current one',
        icon: '➕',
        category: 'slide',
        shortcut: '⌘⇧N',
        action: () => { editorActions?.addSlide?.(); onClose(); },
      },
      {
        id: 'slide-duplicate',
        label: 'Duplicate Slide',
        description: 'Create a copy of the current slide',
        icon: '📋',
        category: 'slide',
        shortcut: '⌘D',
        action: () => {
          if (editorActions?.activeSlideId) {
            editorActions.duplicateSlide?.(editorActions.activeSlideId);
          }
          onClose();
        },
        disabled: !editorActions?.activeSlideId,
      },
      {
        id: 'slide-delete',
        label: 'Delete Slide',
        description: 'Remove the current slide',
        icon: '🗑️',
        category: 'slide',
        shortcut: '⌘⌫',
        action: () => {
          if (editorActions?.activeSlideId) {
            editorActions.deleteSlide?.(editorActions.activeSlideId);
          }
          onClose();
        },
        disabled: !editorActions?.activeSlideId,
      },

      // Export Commands
      {
        id: 'export-pdf',
        label: 'Export to PDF',
        description: 'Download presentation as PDF',
        icon: '📄',
        category: 'export',
        shortcut: '⌘⇧P',
        action: () => { editorActions?.exportPdf?.(); onClose(); },
      },
      {
        id: 'export-pptx',
        label: 'Export to PowerPoint',
        description: 'Download as .pptx file',
        icon: '📊',
        category: 'export',
        action: () => { editorActions?.exportPptx?.(); onClose(); },
      },
      {
        id: 'export-html',
        label: 'Export to HTML',
        description: 'Standalone HTML presentation',
        icon: '🌐',
        category: 'export',
        action: () => { editorActions?.exportHtml?.(); onClose(); },
      },

      // Navigation
      {
        id: 'nav-present',
        label: 'Start Presentation',
        description: 'Enter fullscreen presentation mode',
        icon: '▶️',
        category: 'navigation',
        shortcut: 'F5',
        action: () => { editorActions?.togglePresent?.(); onClose(); },
      },

      // Edit
      {
        id: 'edit-undo',
        label: 'Undo',
        description: 'Undo last action',
        icon: '↩️',
        category: 'edit',
        shortcut: '⌘Z',
        action: () => { editorActions?.undo?.(); onClose(); },
      },
      {
        id: 'edit-redo',
        label: 'Redo',
        description: 'Redo last undone action',
        icon: '↪️',
        category: 'edit',
        shortcut: '⌘⇧Z',
        action: () => { editorActions?.redo?.(); onClose(); },
      },
    ];

    return cmds;
  }, [editorActions, onClose]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {return commands;}
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.category.includes(q),
    );
  }, [commands, query]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (subMode !== 'main') {
          setSubMode('main');
          setQuery('');
        } else {
          onClose();
        }
        return;
      }

      if (subMode !== 'main') {
        if (e.key === 'Enter' && subMode === 'generate' && generationTopic.trim()) {
          generate({ topic: generationTopic.trim(), qualityTier: 'balanced' });
          onClose();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd && !cmd.disabled) {
          cmd.action();
        }
      }
    },
    [filteredCommands, selectedIndex, subMode, generationTopic, generate, onClose],
  );

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) {return;}
    const item = list.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => setSelectedIndex(0));
    return () => cancelAnimationFrame(frame);
  }, [isOpen, query]);

  if (!isOpen) {return null;}

  const categoryOrder = ['ai', 'slide', 'export', 'edit', 'navigation'] as const;
  const groupedCommands = categoryOrder
    .map((cat) => ({
      category: cat,
      commands: filteredCommands.filter((c) => c.category === cat),
    }))
    .filter((g) => g.commands.length > 0);

  // Flatten for index tracking
  let flatIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div className="cmd-backdrop" onClick={onClose} />

      {/* Palette */}
      <div className="cmd-palette" onKeyDown={handleKeyDown}>
        {/* Search */}
        <div className="cmd-search">
          <span className="cmd-search-icon">⌘</span>
          {subMode === 'main' ? (
            <input
              ref={inputRef}
              className="cmd-input"
              type="text"
              placeholder="Type a command..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          ) : subMode === 'generate' ? (
            <input
              ref={inputRef}
              className="cmd-input"
              type="text"
              placeholder="Enter your presentation topic..."
              value={generationTopic}
              onChange={(e) => setGenerationTopic(e.target.value)}
              autoFocus
            />
          ) : (
            <input
              ref={inputRef}
              className="cmd-input"
              type="text"
              placeholder="Describe how to rewrite the slide..."
              autoFocus
            />
          )}
        </div>

        {subMode !== 'main' && (
          <div className="cmd-sub-header">
            <button className="cmd-back" onClick={() => { setSubMode('main'); setQuery(''); }}>
              ← Back
            </button>
            <span className="cmd-sub-title">
              {subMode === 'generate' ? '✨ Generate Presentation' : '✏️ Rewrite Slide'}
            </span>
          </div>
        )}

        {/* Command List */}
        {subMode === 'main' && (
          <div className="cmd-list" ref={listRef}>
            {groupedCommands.map((group) => (
              <div key={group.category}>
                <div className="cmd-category-label">
                  {group.category.charAt(0).toUpperCase() + group.category.slice(1)}
                </div>
                {group.commands.map((cmd) => {
                  const idx = flatIndex++;
                  return (
                    <div
                      key={cmd.id}
                      className={`cmd-item ${idx === selectedIndex ? 'selected' : ''} ${cmd.disabled ? 'disabled' : ''}`}
                      onClick={() => !cmd.disabled && cmd.action()}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <span className="cmd-icon">{cmd.icon}</span>
                      <div className="cmd-text">
                        <span className="cmd-label">{cmd.label}</span>
                        <span className="cmd-desc">{cmd.description}</span>
                      </div>
                      {cmd.shortcut && (
                        <span className="cmd-shortcut">{cmd.shortcut}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {filteredCommands.length === 0 && (
              <div className="cmd-empty">No commands match &quot;{query}&quot;</div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="cmd-footer">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>

      <style jsx>{`
        .cmd-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          z-index: 9998;
        }

        .cmd-palette {
          position: fixed;
          top: 20%;
          left: 50%;
          transform: translateX(-50%);
          width: 580px;
          max-height: 480px;
          background: #0F172A;
          border: 1px solid rgba(148,163,184,0.15);
          border-radius: 16px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.5);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: paletteIn 0.15s ease;
          font-family: 'Inter', system-ui, sans-serif;
        }

        @keyframes paletteIn {
          from { opacity: 0; transform: translateX(-50%) scale(0.96); }
          to { opacity: 1; transform: translateX(-50%) scale(1); }
        }

        .cmd-search {
          display: flex;
          align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(148,163,184,0.1);
          gap: 10px;
        }

        .cmd-search-icon {
          font-size: 16px;
          color: #64748B;
          background: rgba(148,163,184,0.1);
          padding: 4px 8px;
          border-radius: 6px;
        }

        .cmd-input {
          flex: 1;
          background: none;
          border: none;
          color: #F1F5F9;
          font-size: 15px;
          outline: none;
          font-family: inherit;
        }

        .cmd-input::placeholder { color: #475569; }

        .cmd-sub-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          border-bottom: 1px solid rgba(148,163,184,0.1);
        }

        .cmd-back {
          background: none; border: none; color: #64748B;
          cursor: pointer; font-size: 13px;
          padding: 4px 8px; border-radius: 6px;
        }

        .cmd-back:hover { color: #F1F5F9; background: rgba(148,163,184,0.1); }

        .cmd-sub-title { color: #94A3B8; font-size: 14px; font-weight: 500; }

        .cmd-list {
          overflow-y: auto;
          max-height: 340px;
          padding: 8px;
        }

        .cmd-category-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #475569;
          padding: 8px 12px 4px;
        }

        .cmd-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.1s;
        }

        .cmd-item.selected { background: rgba(59,130,246,0.15); }
        .cmd-item.disabled { opacity: 0.4; cursor: not-allowed; }
        .cmd-item:not(.disabled):hover { background: rgba(148,163,184,0.08); }

        .cmd-icon { font-size: 18px; width: 24px; text-align: center; }

        .cmd-text {
          flex: 1; display: flex; flex-direction: column; gap: 1px;
        }

        .cmd-label { color: #F1F5F9; font-size: 14px; font-weight: 500; }
        .cmd-desc { color: #64748B; font-size: 12px; }

        .cmd-shortcut {
          font-size: 11px;
          color: #64748B;
          background: rgba(148,163,184,0.1);
          padding: 3px 7px;
          border-radius: 5px;
          font-family: inherit;
        }

        .cmd-empty {
          text-align: center;
          color: #475569;
          font-size: 14px;
          padding: 32px;
        }

        .cmd-footer {
          display: flex;
          gap: 16px;
          padding: 10px 16px;
          border-top: 1px solid rgba(148,163,184,0.1);
          justify-content: center;
        }

        .cmd-footer span {
          font-size: 11px;
          color: #475569;
        }
      `}</style>
    </>
  );
}

// ============================================
// KEYBOARD SHORTCUT HOOK
// ============================================

/**
 * Hook to manage ⌘+K / Ctrl+K command palette activation
 * and global keyboard shortcuts.
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘+K or Ctrl+K to toggle
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}
