"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import {
    Plus,
    FileText,
    Wand2,
    Settings,
    CreditCard,
    Search,
    Home,
    User,
    LogOut,
    Palette,
    Download,
    Share2,
    Play,
    Undo,
    Redo,
    Copy,
    Trash2,
    Upload,
    Mic,
    BarChart3,
    Users,
    Building2,
    Keyboard,
    Moon,
    Sun,
    HelpCircle,
    MessageSquare,
    Link,
    Image,
    Code,
    Layout,
    Sparkles,
    Zap,
    History,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

interface CommandPaletteProps {
    onNewProject?: () => void;
    onNewAIProject?: () => void;
    onToggleTheme?: () => void;
    onShowKeyboardShortcuts?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    projectId?: string;
    isEditorMode?: boolean;
}

export function CommandPalette({
    onNewProject,
    onNewAIProject,
    onToggleTheme,
    onShowKeyboardShortcuts,
    onUndo,
    onRedo,
    projectId,
    isEditorMode = false,
}: CommandPaletteProps) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const { logout, user } = useAuthStore();

    // Listen for keyboard shortcut (Cmd/Ctrl + K)
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = useCallback((command: () => void) => {
        setOpen(false);
        command();
    }, []);

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <Command className="rounded-lg border shadow-md">
                <CommandInput placeholder="Type a command or search..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>

                    {/* Quick Actions */}
                    <CommandGroup heading="Quick Actions">
                        <CommandItem onSelect={() => runCommand(() => onNewProject?.())}>
                            <Plus className="mr-2 h-4 w-4" />
                            <span>New Blank Presentation</span>
                            <CommandShortcut>⌘N</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => onNewAIProject?.())}>
                            <Wand2 className="mr-2 h-4 w-4" />
                            <span>Generate with AI</span>
                            <CommandShortcut>⌘G</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
                            <Home className="mr-2 h-4 w-4" />
                            <span>Go to Dashboard</span>
                            <CommandShortcut>⌘D</CommandShortcut>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Editor Actions (only in editor mode) */}
                    {isEditorMode && projectId && (
                        <>
                            <CommandGroup heading="Editor Actions">
                                <CommandItem onSelect={() => runCommand(() => onUndo?.())}>
                                    <Undo className="mr-2 h-4 w-4" />
                                    <span>Undo</span>
                                    <CommandShortcut>⌘Z</CommandShortcut>
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => onRedo?.())}>
                                    <Redo className="mr-2 h-4 w-4" />
                                    <span>Redo</span>
                                    <CommandShortcut>⌘⇧Z</CommandShortcut>
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => router.push(`/present/${projectId}`))}>
                                    <Play className="mr-2 h-4 w-4" />
                                    <span>Present</span>
                                    <CommandShortcut>⌘P</CommandShortcut>
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => {/* Open export modal */ })}>
                                    <Download className="mr-2 h-4 w-4" />
                                    <span>Export Presentation</span>
                                    <CommandShortcut>⌘E</CommandShortcut>
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => {/* Open share modal */ })}>
                                    <Share2 className="mr-2 h-4 w-4" />
                                    <span>Share Presentation</span>
                                    <CommandShortcut>⌘S</CommandShortcut>
                                </CommandItem>
                            </CommandGroup>

                            <CommandSeparator />

                            <CommandGroup heading="Insert Element">
                                <CommandItem onSelect={() => runCommand(() => {/* Insert heading */ })}>
                                    <Layout className="mr-2 h-4 w-4" />
                                    <span>Add Heading</span>
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => {/* Insert paragraph */ })}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    <span>Add Paragraph</span>
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => {/* Insert image */ })}>
                                    <Image className="mr-2 h-4 w-4" />
                                    <span>Add Image</span>
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => {/* Insert code block */ })}>
                                    <Code className="mr-2 h-4 w-4" />
                                    <span>Add Code Block</span>
                                </CommandItem>
                            </CommandGroup>

                            <CommandSeparator />

                            <CommandGroup heading="AI Tools">
                                <CommandItem onSelect={() => runCommand(() => {/* AI enhance */ })}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    <span>Enhance with AI</span>
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => {/* AI shorten */ })}>
                                    <Zap className="mr-2 h-4 w-4" />
                                    <span>Shorten Text</span>
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => {/* AI expand */ })}>
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    <span>Expand Text</span>
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => {/* Generate speaker notes */ })}>
                                    <Mic className="mr-2 h-4 w-4" />
                                    <span>Generate Speaker Notes</span>
                                </CommandItem>
                            </CommandGroup>

                            <CommandSeparator />
                        </>
                    )}

                    {/* Navigation */}
                    <CommandGroup heading="Navigation">
                        <CommandItem onSelect={() => runCommand(() => router.push("/settings/billing"))}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            <span>Billing & Subscription</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/settings/integrations"))}>
                            <Link className="mr-2 h-4 w-4" />
                            <span>Integrations</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/settings/branding"))}>
                            <Palette className="mr-2 h-4 w-4" />
                            <span>Brand Settings</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/settings/organization"))}>
                            <Building2 className="mr-2 h-4 w-4" />
                            <span>Organization</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Preferences */}
                    <CommandGroup heading="Preferences">
                        <CommandItem onSelect={() => runCommand(() => onToggleTheme?.())}>
                            <Sun className="mr-2 h-4 w-4" />
                            <span>Toggle Theme</span>
                            <CommandShortcut>⌘T</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => onShowKeyboardShortcuts?.())}>
                            <Keyboard className="mr-2 h-4 w-4" />
                            <span>Keyboard Shortcuts</span>
                            <CommandShortcut>⌘/</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => {/* Open help */ })}>
                            <HelpCircle className="mr-2 h-4 w-4" />
                            <span>Help & Support</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Account */}
                    <CommandGroup heading="Account">
                        <CommandItem>
                            <User className="mr-2 h-4 w-4" />
                            <span>{user?.name || "Profile"}</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => { logout(); router.push("/"); })}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Log out</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </Command>
        </CommandDialog>
    );
}

// Export a button to trigger the command palette
export function CommandPaletteTrigger() {
    return (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Keyboard className="h-4 w-4" />
            <span>Press</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-100 dark:bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-600 dark:text-slate-400">
                <span className="text-xs">⌘</span>K
            </kbd>
            <span>for commands</span>
        </div>
    );
}
