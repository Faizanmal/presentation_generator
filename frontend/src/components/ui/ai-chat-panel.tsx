"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {

    X,
    Send,
    Sparkles,
    Loader2,
    Copy,
    Check,
    ThumbsUp,
    ThumbsDown,
    Maximize2,
    Minimize2,

} from "lucide-react";
import { Button } from "./button";
import { Textarea } from "./textarea";
import { ScrollArea } from "./scroll-area";
import { api } from "@/lib/api";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    suggestions?: string[];
}

interface AIChatPanelProps {
    projectId?: string;
    onInsertContent?: (content: string) => void;
    suggestions?: string[];
}

export function AIChatPanel({
    projectId,
    onInsertContent,
    suggestions = [
        "Help me improve this slide",
        "Suggest a better title",
        "Add more content to this section",
        "Make this more engaging",
    ],
}: AIChatPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: "Hi! I'm your AI presentation assistant. I can help you create content, improve slides, and answer questions. How can I help you today?",
            timestamp: new Date(),
            suggestions,
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Create chat session on mount when projectId is available
    const createSessionMutation = useMutation({
        mutationFn: (pId: string) => api.copilot.createSession(pId),
        onSuccess: (session) => {
            setSessionId(session.id);
        },
    });

    useEffect(() => {
        if (projectId && !sessionId && !createSessionMutation.isPending) {
            createSessionMutation.mutate(projectId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    // Send message mutation
    const sendMessageMutation = useMutation({
        mutationFn: ({ sid, message }: { sid: string; message: string }) =>
            api.copilot.sendMessage(sid, message),
    });

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) { return; }

        const userMessage: Message = {
            id: `user-${crypto.randomUUID()}`,
            role: "user",
            content: content.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            if (!sessionId) {
                throw new Error("No active chat session");
            }

            const response = await sendMessageMutation.mutateAsync({
                sid: sessionId,
                message: content.trim(),
            });

            const aiResponse: Message = {
                id: `assistant-${crypto.randomUUID()}`,
                role: "assistant",
                content: response.content || response.message || "I couldn't generate a response. Please try again.",
                timestamp: new Date(),
                suggestions: response.suggestions || [
                    "Tell me more",
                    "Can you be more specific?",
                    "Apply this to my slide",
                ],
            };
            setMessages((prev) => [...prev, aiResponse]);
        } catch {
            const errorMessage: Message = {
                id: `assistant-${crypto.randomUUID()}`,
                role: "assistant",
                content: "Sorry, I encountered an error processing your request. Please try again.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, sessionId, sendMessageMutation]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleSuggestionClick = (suggestion: string) => {
        sendMessage(suggestion);
    };



    return (
        <>
            {/* Floating button */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-linear-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-500/25 flex items-center justify-center text-white hover:shadow-xl transition-shadow"
                    >
                        <Sparkles className="h-6 w-6" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className={`fixed z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col ${isExpanded
                            ? "inset-4 md:inset-8"
                            : "bottom-6 right-6 w-96 h-150 max-h-[80vh]"
                            }`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white shrink-0">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5" />
                                <span className="font-semibold">AI Assistant</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-white hover:bg-white/20"
                                    onClick={() => setIsExpanded(!isExpanded)}
                                >
                                    {isExpanded ? (
                                        <Minimize2 className="h-4 w-4" />
                                    ) : (
                                        <Maximize2 className="h-4 w-4" />
                                    )}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-white hover:bg-white/20"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Messages */}
                        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                            <div className="space-y-4">
                                {messages.map((message) => (
                                    <motion.div
                                        key={message.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"
                                            }`}
                                    >
                                        <div
                                            className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === "user"
                                                ? "bg-blue-600 text-white"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                                                }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                                            {/* Actions for assistant messages */}
                                            {message.role === "assistant" && (
                                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                                    <button
                                                        onClick={() => copyToClipboard(message.content, message.id)}
                                                        className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                                        title="Copy"
                                                    >
                                                        {copiedId === message.id ? (
                                                            <Check className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    {onInsertContent && (
                                                        <button
                                                            onClick={() => onInsertContent(message.content)}
                                                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                                        >
                                                            Insert
                                                        </button>
                                                    )}
                                                    <div className="flex-1" />
                                                    <button className="p-1 text-slate-500 hover:text-green-500 transition-colors">
                                                        <ThumbsUp className="h-4 w-4" />
                                                    </button>
                                                    <button className="p-1 text-slate-500 hover:text-red-500 transition-colors">
                                                        <ThumbsDown className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Suggestions */}
                                            {message.suggestions && message.suggestions.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {message.suggestions.map((suggestion) => (
                                                        <button
                                                            key={suggestion}
                                                            onClick={() => handleSuggestionClick(suggestion)}
                                                            className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors"
                                                        >
                                                            {suggestion}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}

                                {/* Loading indicator */}
                                {isLoading && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex items-center gap-2 text-slate-500"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-linear-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                                            <Sparkles className="h-4 w-4 text-white" />
                                        </div>
                                        <div className="flex gap-1">
                                            {[0, 1, 2].map((i) => (
                                                <motion.div
                                                    key={i}
                                                    className="w-2 h-2 bg-slate-400 rounded-full"
                                                    animate={{ y: [0, -5, 0] }}
                                                    transition={{
                                                        duration: 0.5,
                                                        repeat: Infinity,
                                                        delay: i * 0.1,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Input */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
                            <div className="flex items-end gap-2">
                                <Textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask me anything..."
                                    className="min-h-11 max-h-32 resize-none"
                                    rows={1}
                                />
                                <Button
                                    onClick={() => sendMessage(input)}
                                    disabled={!input.trim() || isLoading}
                                    size="icon"
                                    className="h-11 w-11 shrink-0 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Send className="h-5 w-5" />
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2 text-center">
                                AI may produce inaccurate information
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// Compact AI button for toolbars
export function AIAssistButton({
    onClick,
    variant = "default",
}: {
    onClick: () => void;
    variant?: "default" | "compact";
}) {
    return (
        <Button
            onClick={onClick}
            variant="ghost"
            size={variant === "compact" ? "sm" : "default"}
            className="bg-linear-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 text-blue-600 dark:text-blue-400"
        >
            <Sparkles className="h-4 w-4 mr-2" />
            {variant === "compact" ? "AI" : "Ask AI"}
        </Button>
    );
}
