"use client";

import { useState, createContext, useContext, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bell,
    X,
    Check,
    AlertCircle,
    Info,
    Sparkles,
    Users,
    MessageSquare,
    Share2,
    CheckCircle2,
    Clock,
    Trash2,
} from "lucide-react";
import { Button } from "./button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "./dropdown-menu";
import { ScrollArea } from "./scroll-area";

// Notification types
export type NotificationType = "success" | "error" | "warning" | "info" | "ai" | "collaboration" | "comment" | "share";

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    action?: {
        label: string;
        onClick: () => void;
    };
    avatar?: string;
    link?: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    removeNotification: (id: string) => void;
    clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
}

// Provider component
export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = useCallback(
        (notification: Omit<Notification, "id" | "timestamp" | "read">) => {
            const newNotification: Notification = {
                ...notification,
                id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date(),
                read: false,
            };
            setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // Keep max 50 notifications
        },
        []
    );

    const markAsRead = useCallback((id: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                addNotification,
                markAsRead,
                markAllAsRead,
                removeNotification,
                clearAll,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

// Notification bell component
export function NotificationBell() {
    const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } =
        useNotifications();
    const [isOpen, setIsOpen] = useState(false);

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case "success":
                return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case "error":
                return <AlertCircle className="h-5 w-5 text-red-500" />;
            case "warning":
                return <AlertCircle className="h-5 w-5 text-yellow-500" />;
            case "info":
                return <Info className="h-5 w-5 text-blue-500" />;
            case "ai":
                return <Sparkles className="h-5 w-5 text-purple-500" />;
            case "collaboration":
                return <Users className="h-5 w-5 text-cyan-500" />;
            case "comment":
                return <MessageSquare className="h-5 w-5 text-orange-500" />;
            case "share":
                return <Share2 className="h-5 w-5 text-pink-500" />;
            default:
                return <Bell className="h-5 w-5 text-slate-500" />;
        }
    };

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) { return "Just now"; }
        if (minutes < 60) { return `${minutes}m ago`; }
        if (hours < 24) { return `${hours}h ago`; }
        if (days < 7) { return `${days}d ago`; }
        return date.toLocaleDateString();
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <AnimatePresence>
                        {unreadCount > 0 && (
                            <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-medium"
                            >
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96 p-0">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="font-semibold">Notifications</h3>
                    {notifications.length > 0 && (
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={markAllAsRead}
                                    className="text-xs h-7"
                                >
                                    <Check className="h-3 w-3 mr-1" />
                                    Mark all read
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearAll}
                                className="text-xs h-7 text-red-600 hover:text-red-700"
                            >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Clear
                            </Button>
                        </div>
                    )}
                </div>

                {/* Notifications list */}
                <ScrollArea className="max-h-100">
                    {notifications.length === 0 ? (
                        <div className="py-12 text-center">
                            <Bell className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            <AnimatePresence>
                                {notifications.map((notification) => (
                                    <motion.div
                                        key={notification.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative group ${!notification.read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                                            }`}
                                        onClick={() => {
                                            markAsRead(notification.id);
                                            if (notification.link) {
                                                window.location.href = notification.link;
                                            }
                                        }}
                                    >
                                        <div className="flex gap-3">
                                            <div className="shrink-0 mt-0.5">
                                                {notification.avatar ? (
                                                    <img
                                                        src={notification.avatar}
                                                        alt=""
                                                        className="h-10 w-10 rounded-full"
                                                    />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                        {getIcon(notification.type)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-slate-900 dark:text-white">
                                                    {notification.title}
                                                </p>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <Clock className="h-3 w-3 text-slate-400" />
                                                    <span className="text-xs text-slate-400">
                                                        {formatTime(notification.timestamp)}
                                                    </span>
                                                </div>
                                                {notification.action && (
                                                    <Button
                                                        variant="link"
                                                        size="sm"
                                                        className="h-auto p-0 mt-2"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            notification.action?.onClick();
                                                        }}
                                                    >
                                                        {notification.action.label}
                                                    </Button>
                                                )}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeNotification(notification.id);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                                            >
                                                <X className="h-4 w-4 text-slate-400" />
                                            </button>
                                        </div>
                                        {!notification.read && (
                                            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full" />
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// Toast notification component (for immediate feedback)
interface ToastNotification {
    id: string;
    type: NotificationType;
    title: string;
    message?: string;
}

interface ToastContextType {
    showToast: (notification: Omit<ToastNotification, "id">) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastNotification[]>([]);

    const showToast = useCallback((notification: Omit<ToastNotification, "id">) => {
        const id = `toast-${Date.now()}`;
        setToasts((prev) => [...prev, { ...notification, id }]);

        // Auto remove after 5 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case "success":
                return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case "error":
                return <AlertCircle className="h-5 w-5 text-red-500" />;
            case "warning":
                return <AlertCircle className="h-5 w-5 text-yellow-500" />;
            case "info":
                return <Info className="h-5 w-5 text-blue-500" />;
            case "ai":
                return <Sparkles className="h-5 w-5 text-purple-500" />;
            default:
                return <Bell className="h-5 w-5 text-slate-500" />;
        }
    };

    const getBgColor = (type: NotificationType) => {
        switch (type) {
            case "success":
                return "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800";
            case "error":
                return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
            case "warning":
                return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800";
            case "info":
                return "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800";
            case "ai":
                return "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800";
            default:
                return "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700";
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Toast container */}
            <div className="fixed bottom-4 right-4 z-100 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 100, scale: 0.95 }}
                            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm max-w-sm ${getBgColor(
                                toast.type
                            )}`}
                        >
                            {getIcon(toast.type)}
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-slate-900 dark:text-white">
                                    {toast.title}
                                </p>
                                {toast.message && (
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                        {toast.message}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}
