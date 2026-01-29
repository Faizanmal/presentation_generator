"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Sparkles,
    Wand2,
    ArrowLeftRight,
    ArrowDown,
    ArrowUp,
    Languages,
    Mic,
    MessageSquare,
    Loader2,
    RefreshCw,
    Check,
    Copy,
    Lightbulb,
    Smile,
    Briefcase,
    GraduationCap,
    Pen,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AITextToolsProps {
    selectedText: string;
    onApply: (newText: string) => void;
    triggerRef?: React.RefObject<HTMLElement>;
    showSpeakerNotes?: boolean;
}

type AIAction =
    | "shorten"
    | "expand"
    | "simplify"
    | "professional"
    | "casual"
    | "academic"
    | "persuasive"
    | "speaker-notes"
    | "translate"
    | "fix-grammar"
    | "custom";

interface AIActionConfig {
    id: AIAction;
    name: string;
    description: string;
    icon: React.ReactNode;
    instruction: string;
}

const aiActions: AIActionConfig[] = [
    {
        id: "shorten",
        name: "Shorten",
        description: "Make it more concise",
        icon: <ArrowDown className="h-4 w-4" />,
        instruction: "Make this text shorter and more concise while keeping the key message",
    },
    {
        id: "expand",
        name: "Expand",
        description: "Add more detail",
        icon: <ArrowUp className="h-4 w-4" />,
        instruction: "Expand this text with more details and examples",
    },
    {
        id: "simplify",
        name: "Simplify",
        description: "Make it easier to understand",
        icon: <Lightbulb className="h-4 w-4" />,
        instruction: "Simplify this text to make it easier to understand for a general audience",
    },
    {
        id: "professional",
        name: "Professional",
        description: "Business-appropriate tone",
        icon: <Briefcase className="h-4 w-4" />,
        instruction: "Rewrite this text in a professional, business-appropriate tone",
    },
    {
        id: "casual",
        name: "Casual",
        description: "Friendly and relaxed",
        icon: <Smile className="h-4 w-4" />,
        instruction: "Rewrite this text in a casual, friendly tone",
    },
    {
        id: "academic",
        name: "Academic",
        description: "Scholarly and formal",
        icon: <GraduationCap className="h-4 w-4" />,
        instruction: "Rewrite this text in an academic, scholarly tone",
    },
    {
        id: "persuasive",
        name: "Persuasive",
        description: "Convincing and impactful",
        icon: <MessageSquare className="h-4 w-4" />,
        instruction: "Rewrite this text to be more persuasive and compelling",
    },
    {
        id: "fix-grammar",
        name: "Fix Grammar",
        description: "Correct errors",
        icon: <Pen className="h-4 w-4" />,
        instruction: "Fix any grammar, spelling, and punctuation errors in this text",
    },
];

export function AITextTools({
    selectedText,
    onApply,
    showSpeakerNotes = true,
}: AITextToolsProps) {
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = useState("");
    const [activeAction, setActiveAction] = useState<AIAction | null>(null);

    const enhanceMutation = useMutation({
        mutationFn: async ({ text, instruction }: { text: string; instruction: string }) => {
            const response = await api.enhanceContent(text, instruction);
            return response.content;
        },
        onSuccess: (data) => {
            setResult(data);
        },
        onError: () => {
            toast.error("Failed to enhance text. Please try again.");
        },
    });

    const handleAction = (action: AIActionConfig) => {
        setActiveAction(action.id);
        setResult(null);
        enhanceMutation.mutate({
            text: selectedText,
            instruction: action.instruction,
        });
    };

    const handleCustomEnhance = () => {
        if (!customPrompt.trim()) {
            toast.error("Please enter a custom prompt");
            return;
        }
        setActiveAction("custom");
        setResult(null);
        enhanceMutation.mutate({
            text: selectedText,
            instruction: customPrompt,
        });
    };

    const handleGenerateSpeakerNotes = () => {
        setActiveAction("speaker-notes");
        setResult(null);
        enhanceMutation.mutate({
            text: selectedText,
            instruction: "Generate speaker notes for this slide content. The notes should help the presenter explain the key points, include talking points, and suggest what to emphasize. Keep it conversational but informative.",
        });
    };

    const handleApply = () => {
        if (result) {
            onApply(result);
            setOpen(false);
            setResult(null);
            setActiveAction(null);
            toast.success("Text updated!");
        }
    };

    const handleCopy = async () => {
        if (result) {
            await navigator.clipboard.writeText(result);
            toast.success("Copied to clipboard!");
        }
    };

    const handleRetry = () => {
        if (activeAction) {
            const action = aiActions.find((a) => a.id === activeAction);
            if (action) {
                handleAction(action);
            } else if (activeAction === "custom") {
                handleCustomEnhance();
            } else if (activeAction === "speaker-notes") {
                handleGenerateSpeakerNotes();
            }
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/50"
                >
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">AI Tools</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="start" side="bottom">
                <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                    <h4 className="font-medium text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <Wand2 className="h-4 w-4" />
                        AI Text Enhancement
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Transform your selected text with AI
                    </p>
                </div>

                <div className="p-3 space-y-3">
                    {/* Quick Actions */}
                    <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">Quick Actions</p>
                        <div className="grid grid-cols-4 gap-1.5">
                            {aiActions.slice(0, 4).map((action) => (
                                <button
                                    key={action.id}
                                    onClick={() => handleAction(action)}
                                    disabled={enhanceMutation.isPending}
                                    className={cn(
                                        "flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-all",
                                        "border border-transparent hover:border-purple-200 dark:hover:border-purple-800",
                                        "hover:bg-purple-50 dark:hover:bg-purple-950/50",
                                        activeAction === action.id && "bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800"
                                    )}
                                >
                                    <div className={cn(
                                        "p-1.5 rounded-md bg-slate-100 dark:bg-slate-800",
                                        activeAction === action.id && "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400"
                                    )}>
                                        {action.icon}
                                    </div>
                                    <span className="text-slate-700 dark:text-slate-300">{action.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tone Options */}
                    <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">Change Tone</p>
                        <div className="grid grid-cols-4 gap-1.5">
                            {aiActions.slice(3, 8).map((action) => (
                                <button
                                    key={action.id}
                                    onClick={() => handleAction(action)}
                                    disabled={enhanceMutation.isPending}
                                    className={cn(
                                        "flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-all",
                                        "border border-transparent hover:border-purple-200 dark:hover:border-purple-800",
                                        "hover:bg-purple-50 dark:hover:bg-purple-950/50",
                                        activeAction === action.id && "bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800"
                                    )}
                                >
                                    <div className={cn(
                                        "p-1.5 rounded-md bg-slate-100 dark:bg-slate-800",
                                        activeAction === action.id && "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400"
                                    )}>
                                        {action.icon}
                                    </div>
                                    <span className="text-slate-700 dark:text-slate-300">{action.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Speaker Notes */}
                    {showSpeakerNotes && (
                        <div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start gap-2"
                                onClick={handleGenerateSpeakerNotes}
                                disabled={enhanceMutation.isPending}
                            >
                                <Mic className="h-4 w-4 text-purple-600" />
                                Generate Speaker Notes
                            </Button>
                        </div>
                    )}

                    {/* Custom Prompt */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-medium text-slate-500 mb-2">Custom Enhancement</p>
                        <div className="flex gap-2">
                            <Textarea
                                placeholder="Describe how you want to change the text..."
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                className="min-h-[60px] text-sm"
                            />
                        </div>
                        <Button
                            size="sm"
                            className="w-full mt-2"
                            onClick={handleCustomEnhance}
                            disabled={enhanceMutation.isPending || !customPrompt.trim()}
                        >
                            {enhanceMutation.isPending && activeAction === "custom" ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Enhancing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Apply Custom Enhancement
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Loading State */}
                    {enhanceMutation.isPending && (
                        <div className="flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                            <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">
                                Enhancing your text...
                            </span>
                        </div>
                    )}

                    {/* Result Preview */}
                    {result && !enhanceMutation.isPending && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-slate-500">Result</p>
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={handleRetry}
                                        title="Try again"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={handleCopy}
                                        title="Copy"
                                    >
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm text-slate-700 dark:text-slate-300 max-h-32 overflow-y-auto">
                                {result}
                            </div>
                            <Button
                                size="sm"
                                className="w-full bg-purple-600 hover:bg-purple-700"
                                onClick={handleApply}
                            >
                                <Check className="mr-2 h-4 w-4" />
                                Apply Changes
                            </Button>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// Floating AI toolbar that appears when text is selected
export function AIFloatingToolbar({
    selectedText,
    position,
    onApply,
    onClose,
}: {
    selectedText: string;
    position: { x: number; y: number };
    onApply: (newText: string) => void;
    onClose: () => void;
}) {
    const [isLoading, setIsLoading] = useState(false);

    const quickEnhance = async (instruction: string) => {
        setIsLoading(true);
        try {
            const response = await api.enhanceContent(selectedText, instruction);
            onApply(response.content);
            toast.success("Text enhanced!");
            onClose();
        } catch {
            toast.error("Failed to enhance text");
        } finally {
            setIsLoading(false);
        }
    };

    if (!selectedText) return null;

    return (
        <div
            className="fixed z-50 flex items-center gap-1 p-1 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700"
            style={{
                left: position.x,
                top: position.y,
                transform: "translateX(-50%)",
            }}
        >
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => quickEnhance("Make this shorter and more concise")}
                disabled={isLoading}
            >
                <ArrowDown className="h-3 w-3 mr-1" />
                Shorten
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => quickEnhance("Expand this with more detail")}
                disabled={isLoading}
            >
                <ArrowUp className="h-3 w-3 mr-1" />
                Expand
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => quickEnhance("Rewrite this in a professional tone")}
                disabled={isLoading}
            >
                <Briefcase className="h-3 w-3 mr-1" />
                Professional
            </Button>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <AITextTools selectedText={selectedText} onApply={onApply} showSpeakerNotes={false} />
        </div>
    );
}
