"use client";

// import { useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/constants/button_variant";
import {
    Zap,
    Save,
    Download,
    Share2,
    Play,
    Undo,
    Redo,
    Plus,
    Wand2,
    Image as ImageIcon,
    Link,
    Settings,
    Maximize,
    Palette,
    MessageSquare,
    Users,
    BarChart3,
    Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface QuickAction {
    id: string;
    name: string;
    icon: React.ReactNode;
    shortcut?: string;
    action: () => void;
    variant?: "default" | "primary" | "danger";
    disabled?: boolean;
}

interface QuickActionsToolbarProps {
    onSave?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onAddSlide?: () => void;
    onAIGenerate?: () => void;
    onExport?: () => void;
    onShare?: () => void;
    onPresent?: () => void;
    onAddImage?: () => void;
    onAddLink?: () => void;
    onToggleVoice?: () => void;
    onToggleComments?: () => void;
    onToggleCollaborators?: () => void;
    onToggleAnalytics?: () => void;
    onToggleTheme?: () => void;
    onToggleFullscreen?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    isSaving?: boolean;
    isCollaborating?: boolean;
    position?: "bottom" | "top" | "left" | "right";
    compact?: boolean;
}

export function QuickActionsToolbar({
    onSave,
    onUndo,
    onRedo,
    onAddSlide,
    onAIGenerate,
    onExport,
    onShare,
    onPresent,
    onAddImage,
    onAddLink,
    onToggleVoice,
    onToggleComments,
    onToggleCollaborators,
    onToggleAnalytics,
    onToggleTheme,
    onToggleFullscreen,
    canUndo = false,
    canRedo = false,
    isSaving = false,
    isCollaborating = false,
    position = "bottom",
    compact = false,
}: QuickActionsToolbarProps) {
    const primaryActions: QuickAction[] = useMemo(() => [
        {
            id: "undo",
            name: "Undo",
            icon: <Undo className="h-4 w-4" />,
            shortcut: "⌘Z",
            action: onUndo || (() => { }),
            disabled: !canUndo,
        },
        {
            id: "redo",
            name: "Redo",
            icon: <Redo className="h-4 w-4" />,
            shortcut: "⌘⇧Z",
            action: onRedo || (() => { }),
            disabled: !canRedo,
        },
        {
            id: "add-slide",
            name: "Add Slide",
            icon: <Plus className="h-4 w-4" />,
            shortcut: "⌘Enter",
            action: onAddSlide || (() => { }),
            variant: "primary",
        },
        {
            id: "ai-generate",
            name: "AI Generate",
            icon: <Wand2 className="h-4 w-4" />,
            shortcut: "⌘G",
            action: onAIGenerate || (() => { }),
        },
        {
            id: "present",
            name: "Present",
            icon: <Play className="h-4 w-4" />,
            shortcut: "⌘P",
            action: onPresent || (() => { }),
            variant: "primary",
        },
    ], [onUndo, onRedo, onAddSlide, onAIGenerate, onPresent, canUndo, canRedo]);

    const secondaryActions: QuickAction[] = useMemo(() => [
        {
            id: "save",
            name: isSaving ? "Saving..." : "Save",
            icon: <Save className="h-4 w-4" />,
            shortcut: "⌘S",
            action: onSave || (() => { }),
            disabled: isSaving,
        },
        {
            id: "export",
            name: "Export",
            icon: <Download className="h-4 w-4" />,
            shortcut: "⌘E",
            action: onExport || (() => { }),
        },
        {
            id: "share",
            name: "Share",
            icon: <Share2 className="h-4 w-4" />,
            action: onShare || (() => { }),
        },
    ], [isSaving, onSave, onExport, onShare]);

    const insertActions: QuickAction[] = [
        {
            id: "add-image",
            name: "Add Image",
            icon: <ImageIcon className="h-4 w-4" />,
            action: onAddImage || (() => { }),
        },
        {
            id: "add-link",
            name: "Add Link",
            icon: <Link className="h-4 w-4" />,
            shortcut: "⌘K",
            action: onAddLink || (() => { }),
        },
        {
            id: "voice",
            name: "Voice Recording",
            icon: <Mic className="h-4 w-4" />,
            action: onToggleVoice || (() => { }),
        },
    ];

    const viewActions: QuickAction[] = [
        {
            id: "comments",
            name: "Comments",
            icon: <MessageSquare className="h-4 w-4" />,
            action: onToggleComments || (() => { }),
        },
        {
            id: "collaborators",
            name: "Collaborators",
            icon: <Users className="h-4 w-4" />,
            action: onToggleCollaborators || (() => { }),
        },
        {
            id: "analytics",
            name: "Analytics",
            icon: <BarChart3 className="h-4 w-4" />,
            action: onToggleAnalytics || (() => { }),
        },
        {
            id: "theme",
            name: "Theme",
            icon: <Palette className="h-4 w-4" />,
            action: onToggleTheme || (() => { }),
        },
        {
            id: "fullscreen",
            name: "Fullscreen",
            icon: <Maximize className="h-4 w-4" />,
            shortcut: "F11",
            action: onToggleFullscreen || (() => { }),
        },
    ];

    const positionClasses = {
        bottom: "fixed bottom-6 left-1/2 -translate-x-1/2",
        top: "fixed top-20 left-1/2 -translate-x-1/2",
        left: "fixed left-6 top-1/2 -translate-y-1/2 flex-col",
        right: "fixed right-6 top-1/2 -translate-y-1/2 flex-col",
    };

    return (
        <div
            className={cn(
                "z-50 flex items-center gap-1 p-2 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700",
                positionClasses[position],
                position === "left" || position === "right" ? "flex-col" : "flex-row"
            )}
        >
            {/* Primary Actions */}
            <div className={cn(
                "flex items-center gap-1",
                (position === "left" || position === "right") && "flex-col"
            )}>
                {primaryActions.map((action) => (
                    <QuickActionButton key={action.id} action={action} compact={compact} />
                ))}
            </div>

            <Divider vertical={position === "left" || position === "right"} />

            {/* Secondary Actions */}
            <div className={cn(
                "flex items-center gap-1",
                (position === "left" || position === "right") && "flex-col"
            )}>
                {secondaryActions.map((action) => (
                    <QuickActionButton key={action.id} action={action} compact={compact} />
                ))}
            </div>

            {!compact && (
                <>
                    <Divider vertical={position === "left" || position === "right"} />

                    {/* Insert Actions - shown in popover on compact */}
                    <Popover>
                        <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
                            <Plus className="h-4 w-4" />
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" side={position === "bottom" ? "top" : "bottom"}>
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-500 px-2 mb-2">Insert</p>
                                {insertActions.map((action) => (
                                    <Button
                                        key={action.id}
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start gap-2"
                                        onClick={action.action}
                                    >
                                        {action.icon}
                                        {action.name}
                                    </Button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* View Actions - shown in popover */}
                    <Popover>
                        <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
                            <Settings className="h-4 w-4" />
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" side={position === "bottom" ? "top" : "bottom"}>
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-500 px-2 mb-2">View</p>
                                {viewActions.map((action) => (
                                    <Button
                                        key={action.id}
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start gap-2"
                                        onClick={action.action}
                                    >
                                        {action.icon}
                                        {action.name}
                                    </Button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </>
            )}

            {/* Collaboration indicator */}
            {isCollaborating && (
                <>
                    <Divider vertical={position === "left" || position === "right"} />
                    <div className="flex items-center gap-1 px-2">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs text-slate-500">Live</span>
                    </div>
                </>
            )}
        </div>
    );
}

function QuickActionButton({
    action,
}: {
    action: QuickAction;
    compact?: boolean;
}) {
    return (
        <button
            className={cn(
                buttonVariants({ variant: action.variant === "primary" ? "default" : "ghost", size: "icon" }),
                "h-8 w-8",
                action.variant === "primary" && "bg-blue-600 hover:bg-blue-700 text-white",
                action.variant === "danger" && "hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
            )}
            onClick={action.action}
            disabled={action.disabled}
            title={action.name}
            type="button"
        >
            {action.icon}
        </button>
    );
}

function Divider({ vertical }: { vertical?: boolean }) {
    return (
        <div
            className={cn(
                "bg-slate-200 dark:bg-slate-700",
                vertical ? "w-full h-px my-1" : "h-6 w-px mx-1"
            )}
        />
    );
}

// Mini floating action button for mobile
export function QuickActionsFAB({
    onPress,
}: {
    onPress: () => void;
}) {
    return (
        <Button
            size="icon"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-linear-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            onClick={onPress}
        >
            <Zap className="h-6 w-6 text-white" />
        </Button>
    );
}
