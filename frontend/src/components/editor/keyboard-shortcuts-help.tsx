'use client';

import { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  useKeyboardShortcuts,
  formatShortcut,
  KeyboardShortcut,
} from '@/hooks/use-keyboard-shortcuts';
import { cn } from '@/lib/utils';

const categoryLabels: Record<string, { label: string; color: string }> = {
  navigation: { label: 'Navigation', color: 'bg-blue-100 text-blue-700' },
  editing: { label: 'Editing', color: 'bg-green-100 text-green-700' },
  formatting: { label: 'Formatting', color: 'bg-purple-100 text-purple-700' },
  view: { label: 'View', color: 'bg-orange-100 text-orange-700' },
  general: { label: 'General', color: 'bg-slate-100 text-slate-700' },
};

export function KeyboardShortcutsHelp() {
  const { shortcuts, isHelpOpen, setIsHelpOpen } = useKeyboardShortcuts();

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, KeyboardShortcut[]>
  );

  const categoryOrder = ['general', 'navigation', 'editing', 'formatting', 'view'];

  return (
    <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {categoryOrder.map((category) => {
              const categoryShortcuts = groupedShortcuts[category];
              if (!categoryShortcuts?.length) return null;

              const { label, color } = categoryLabels[category] || {
                label: category,
                color: 'bg-slate-100 text-slate-700',
              };

              return (
                <div key={category}>
                  <Badge className={cn('mb-3', color)}>{label}</Badge>
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className={cn(
                          'flex items-center justify-between py-2 px-3 rounded-lg',
                          shortcut.enabled === false
                            ? 'bg-slate-50 opacity-50'
                            : 'hover:bg-slate-50'
                        )}
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <kbd className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-slate-100 border border-slate-200 rounded">
                          {formatShortcut(shortcut.keys)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t text-sm text-slate-500">
          <span>
            Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">?</kbd> to
            show/hide this dialog
          </span>
          <Button variant="ghost" size="sm" onClick={() => setIsHelpOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Floating button to show shortcuts
export function KeyboardShortcutsButton() {
  const { setIsHelpOpen } = useKeyboardShortcuts();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="fixed bottom-4 right-4 rounded-full shadow-lg bg-white hover:bg-slate-50"
      onClick={() => setIsHelpOpen(true)}
    >
      <Keyboard className="h-4 w-4" />
    </Button>
  );
}
