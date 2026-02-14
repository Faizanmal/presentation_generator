'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    MessageCircle,
    Send,
    Sparkles,
    X,
    Bot,
    User,
    Loader2,
    ChevronDown,
    Lightbulb,
    PenTool,
    Zap,
    FileText,
    Layout,
    RefreshCw,
    Check,
    Copy,
    MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    suggestedActions?: Array<{
        type: string;
        description: string;
        payload: Record<string, unknown>;
    }>;
    updatedContent?: {
        heading?: string;
        blocks?: Array<{ type: string; content: string }>;
    };
}

interface SlideContext {
    slideId: string;
    heading?: string;
    blocks?: Array<{ type: string; content: string }>;
    speakerNotes?: string;
}

interface AIChatAssistantProps {
    projectId: string;
    slideContext: SlideContext;
    onApplyChanges?: (changes: {
        heading?: string;
        blocks?: Array<{ type: string; content: string }>;
    }) => void;
    onClose?: () => void;
    isOpen?: boolean;
}

const QUICK_ACTIONS = [
    { id: 'improve', label: 'Improve', icon: Sparkles, description: 'Make it better' },
    { id: 'shorten', label: 'Shorten', icon: FileText, description: 'Make it concise' },
    { id: 'expand', label: 'Expand', icon: PenTool, description: 'Add more detail' },
    { id: 'simplify', label: 'Simplify', icon: Zap, description: 'Easier to understand' },
    { id: 'make_professional', label: 'Professional', icon: FileText, description: 'Business tone' },
    { id: 'add_examples', label: 'Add Examples', icon: Lightbulb, description: 'Illustrate points' },
] as const;

const SUGGESTED_PROMPTS = [
    "Make this slide more engaging",
    "Add a call to action",
    "Suggest visuals for this content",
    "Rewrite in a more conversational tone",
    "Create bullet points from this text",
    "What should the next slide be about?",
];

export function AIChatAssistant({
    projectId,
    slideContext,
    onApplyChanges,
    onClose,
    isOpen = true,
}: AIChatAssistantProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isMinimized, setIsMinimized] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Chat mutation
    const chatMutation = useMutation<{
        message: string;
        suggestedActions?: ChatMessage['suggestedActions'];
        updatedContent?: ChatMessage['updatedContent'];
    }, Error, string>({
        mutationFn: async (message: string) => {
            const response = await api.post<{
                message: string;
                suggestedActions?: ChatMessage['suggestedActions'];
                updatedContent?: ChatMessage['updatedContent'];
            }>('/ai/chat', {
                projectId,
                slideContext,
                message,
                conversationHistory: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
            });
            return response.data;
        },
        onSuccess: (data) => {
            const assistantMessage: ChatMessage = {
                id: `assistant-${crypto.randomUUID()}`,
                role: 'assistant',
                content: data.message,
                timestamp: new Date(),
                suggestedActions: data.suggestedActions,
                updatedContent: data.updatedContent,
            };
            setMessages(prev => [...prev, assistantMessage]);
            setShowSuggestions(false);
        },
    });

    // Quick action mutation
    const quickActionMutation = useMutation<{ result: string; explanation: string }, Error, { action: string; content: string }>({
        mutationFn: async ({ action, content }: { action: string; content: string }) => {
            const response = await api.post<{ result: string; explanation: string }>('/ai/chat/quick-action', {
                action,
                content,
                context: slideContext,
            });
            return response.data;
        },
        onSuccess: (data, variables) => {
            const actionLabel = QUICK_ACTIONS.find(a => a.id === variables.action)?.label || variables.action;
            const assistantMessage: ChatMessage = {
                id: `assistant-${crypto.randomUUID()}`,
                role: 'assistant',
                content: `**${actionLabel}:** ${data.explanation}\n\n${data.result}`,
                timestamp: new Date(),
                updatedContent: {
                    blocks: [{ type: 'paragraph', content: data.result }],
                },
            };
            setMessages(prev => [...prev, assistantMessage]);
        },
    });

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = useCallback(() => {
        if (!inputValue.trim() || chatMutation.isPending) { return; }

        const userMessage: ChatMessage = {
            id: `user-${crypto.randomUUID()}`,
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        chatMutation.mutate(inputValue.trim());
    }, [inputValue, chatMutation]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleQuickAction = (action: string) => {
        const content = slideContext.blocks?.map(b => b.content).join('\n') || '';
        if (!content) { return; }

        const userMessage: ChatMessage = {
            id: `user-${crypto.randomUUID()}`,
            role: 'user',
            content: `Quick action: ${action}`,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        quickActionMutation.mutate({ action, content });
    };

    const handleApplyChanges = (changes: ChatMessage['updatedContent']) => {
        if (changes && onApplyChanges) {
            onApplyChanges(changes);
        }
    };

    const handleSuggestedPrompt = (prompt: string) => {
        setInputValue(prompt);
        inputRef.current?.focus();
    };

    if (!isOpen) { return null; }

    return (
        <Card
            className={cn(
                'fixed bottom-4 right-4 z-50 w-96 shadow-2xl transition-all duration-300',
                isMinimized ? 'h-14' : 'h-[600px]'
            )}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between border-b bg-gradient-to-r from-violet-500 to-purple-600 p-3 text-white cursor-pointer rounded-t-lg"
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                        <Bot className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold">AI Assistant</h3>
                        {!isMinimized && (
                            <p className="text-xs text-white/80">Ask me anything about your slide</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white hover:bg-white/20"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMinimized(!isMinimized);
                        }}
                    >
                        <ChevronDown className={cn('h-4 w-4 transition-transform', isMinimized && 'rotate-180')} />
                    </Button>
                    {onClose && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-white hover:bg-white/20"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {!isMinimized && (
                <CardContent className="flex h-[calc(100%-56px)] flex-col p-0">
                    {/* Quick Actions Bar */}
                    <div className="border-b p-2">
                        <div className="flex gap-1 overflow-x-auto pb-1">
                            {QUICK_ACTIONS.map((action) => (
                                <TooltipProvider key={action.id}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 shrink-0 gap-1 text-xs"
                                                onClick={() => handleQuickAction(action.id)}
                                                disabled={quickActionMutation.isPending}
                                            >
                                                <action.icon className="h-3 w-3" />
                                                {action.label}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{action.description}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))}
                        </div>
                    </div>

                    {/* Messages Area */}
                    <ScrollArea className="flex-1 p-3" ref={scrollRef}>
                        {messages.length === 0 && showSuggestions ? (
                            <div className="space-y-4">
                                <div className="text-center py-6">
                                    <Sparkles className="mx-auto h-12 w-12 text-violet-500 opacity-50" />
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        How can I help with your presentation?
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">Try asking:</p>
                                    {SUGGESTED_PROMPTS.map((prompt) => (
                                        <button
                                            key={prompt}
                                            onClick={() => handleSuggestedPrompt(prompt)}
                                            className="block w-full rounded-lg border p-2 text-left text-sm transition-colors hover:bg-muted"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={cn(
                                            'flex gap-2',
                                            message.role === 'user' ? 'justify-end' : 'justify-start'
                                        )}
                                    >
                                        {message.role === 'assistant' && (
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100">
                                                <Bot className="h-4 w-4 text-violet-600" />
                                            </div>
                                        )}

                                        <div
                                            className={cn(
                                                'max-w-[85%] rounded-lg p-3 text-sm',
                                                message.role === 'user'
                                                    ? 'bg-violet-600 text-white'
                                                    : 'bg-muted'
                                            )}
                                        >
                                            <p className="whitespace-pre-wrap">{message.content}</p>

                                            {/* Suggested Actions */}
                                            {message.suggestedActions && message.suggestedActions.length > 0 && (
                                                <div className="mt-3 space-y-1">
                                                    <p className="text-xs font-medium opacity-70">Suggested actions:</p>
                                                    {message.suggestedActions.map((action) => (
                                                        <Badge
                                                            key={action.description}
                                                            variant="secondary"
                                                            className="mr-1 cursor-pointer text-xs"
                                                        >
                                                            {action.description}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Apply Changes Button */}
                                            {message.updatedContent && (
                                                <div className="mt-3 flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="h-7 gap-1 text-xs"
                                                        onClick={() => handleApplyChanges(message.updatedContent)}
                                                    >
                                                        <Check className="h-3 w-3" />
                                                        Apply Changes
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 gap-1 text-xs"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(
                                                                message.updatedContent?.blocks?.map(b => b.content).join('\n') || ''
                                                            );
                                                        }}
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                        Copy
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {message.role === 'user' && (
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600">
                                                <User className="h-4 w-4 text-white" />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Loading indicator */}
                                {(chatMutation.isPending || quickActionMutation.isPending) && (
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100">
                                            <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                                        </div>
                                        <div className="rounded-lg bg-muted p-3">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <span>Thinking</span>
                                                <span className="animate-pulse">...</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="border-t p-3">
                        <div className="flex gap-2">
                            <Input
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask AI to help with your slide..."
                                className="flex-1"
                                disabled={chatMutation.isPending || quickActionMutation.isPending}
                            />
                            <Button
                                size="icon"
                                onClick={handleSendMessage}
                                disabled={!inputValue.trim() || chatMutation.isPending || quickActionMutation.isPending}
                                className="bg-violet-600 hover:bg-violet-700"
                            >
                                {chatMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>

                        {/* Context Indicator */}
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Layout className="h-3 w-3" />
                            <span>
                                Editing: {slideContext.heading || 'Current slide'}
                            </span>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-5 w-5">
                                        <MoreHorizontal className="h-3 w-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setMessages([])}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Clear conversation
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setShowSuggestions(true)}>
                                        <Lightbulb className="mr-2 h-4 w-4" />
                                        Show suggestions
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

// Floating trigger button for opening the chat
export function AIChatTrigger({ onClick }: { onClick: () => void }) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        onClick={onClick}
                        size="icon"
                        className="fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 shadow-lg hover:from-violet-600 hover:to-purple-700"
                    >
                        <MessageCircle className="h-6 w-6" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                    <p>AI Assistant</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
