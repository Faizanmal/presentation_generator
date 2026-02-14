"use client";

import { useState, useEffect } from "react";
import {
    Users,
    Eye,
    Edit3,
    MessageSquare,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Collaborator {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    color: string;
    status: "online" | "away" | "offline";
    currentSlideId?: string;
    cursor?: { x: number; y: number };
    activity: "viewing" | "editing" | "commenting";
    lastSeen: Date;
}

interface CollaboratorPresenceProps {
    collaborators: Collaborator[];
    currentUserId: string;
    maxVisible?: number;
}

// Color palette for collaborators
const collaboratorColors = [
    "#EF4444", // red
    "#F59E0B", // amber
    "#10B981", // emerald
    "#3B82F6", // blue
    "#8B5CF6", // violet
    "#EC4899", // pink
    "#06B6D4", // cyan
    "#F97316", // orange
];

export function getCollaboratorColor(index: number): string {
    return collaboratorColors[index % collaboratorColors.length];
}

// Main presence indicator component (header bar)
export function CollaboratorPresence({
    collaborators,
    currentUserId,
    maxVisible = 4,
}: CollaboratorPresenceProps) {
    const otherCollaborators = collaborators.filter((c) => c.id !== currentUserId);
    const activeCollaborators = otherCollaborators.filter(
        (c) => c.status !== "offline"
    );

    const visibleCollaborators = activeCollaborators.slice(0, maxVisible);
    const hiddenCount = activeCollaborators.length - maxVisible;

    if (otherCollaborators.length === 0) {
        return null;
    }

    return (
        <TooltipProvider>
            <Popover>
                <PopoverTrigger asChild>
                    <button className="flex items-center -space-x-2 hover:opacity-80 transition-opacity">
                        {visibleCollaborators.map((collaborator) => (
                            <Tooltip key={collaborator.id}>
                                <TooltipTrigger asChild>
                                    <div className="relative">
                                        <Avatar
                                            className="h-8 w-8 border-2 border-white dark:border-slate-950"
                                            style={{ borderColor: collaborator.color }}
                                        >
                                            <AvatarImage src={collaborator.avatar} />
                                            <AvatarFallback
                                                style={{ backgroundColor: collaborator.color }}
                                                className="text-white text-xs"
                                            >
                                                {collaborator.name.slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <StatusDot status={collaborator.status} />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="flex items-center gap-2">
                                        <span>{collaborator.name}</span>
                                        <ActivityBadge activity={collaborator.activity} />
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        ))}

                        {hiddenCount > 0 && (
                            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-950 flex items-center justify-center text-xs font-medium">
                                +{hiddenCount}
                            </div>
                        )}
                    </button>
                </PopoverTrigger>

                <PopoverContent className="w-80" align="end">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Collaborators
                            </h4>
                            <Badge variant="secondary">
                                {activeCollaborators.length} online
                            </Badge>
                        </div>

                        <div className="space-y-2">
                            {otherCollaborators.map((collaborator) => (
                                <CollaboratorListItem
                                    key={collaborator.id}
                                    collaborator={collaborator}
                                />
                            ))}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </TooltipProvider>
    );
}

// Individual collaborator in list
function CollaboratorListItem({
    collaborator,
}: {
    collaborator: Collaborator;
}) {
    return (
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
            <div className="relative">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={collaborator.avatar} />
                    <AvatarFallback
                        style={{ backgroundColor: collaborator.color }}
                        className="text-white"
                    >
                        {collaborator.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <StatusDot status={collaborator.status} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                        {collaborator.name}
                    </span>
                    <ActivityBadge activity={collaborator.activity} />
                </div>
                <p className="text-xs text-slate-500 truncate">
                    {collaborator.email}
                </p>
            </div>

            {collaborator.currentSlideId && (
                <span className="text-xs text-slate-400">
                    Slide {collaborator.currentSlideId}
                </span>
            )}
        </div>
    );
}

// Status dot component
function StatusDot({ status }: { status: Collaborator["status"] }) {
    const statusColors = {
        online: "bg-green-500",
        away: "bg-yellow-500",
        offline: "bg-slate-400",
    };

    return (
        <span
            className={cn(
                "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-950",
                statusColors[status]
            )}
        />
    );
}

// Activity badge
function ActivityBadge({ activity }: { activity: Collaborator["activity"] }) {
    const config = {
        viewing: {
            icon: Eye,
            label: "Viewing",
            className: "text-blue-600 bg-blue-50 dark:bg-blue-950/50",
        },
        editing: {
            icon: Edit3,
            label: "Editing",
            className: "text-green-600 bg-green-50 dark:bg-green-950/50",
        },
        commenting: {
            icon: MessageSquare,
            label: "Commenting",
            className: "text-purple-600 bg-purple-50 dark:bg-purple-950/50",
        },
    };

    const { icon: Icon, label, className } = config[activity];

    return (
        <Badge variant="outline" className={cn("text-xs gap-1 px-1.5", className)}>
            <Icon className="h-3 w-3" />
            {label}
        </Badge>
    );
}

// Live cursor overlay for real-time collaboration
export function CollaboratorCursors({
    collaborators,
    currentUserId,
}: {
    collaborators: Collaborator[];
    currentUserId: string;
    containerRef: React.RefObject<HTMLElement>;
}) {
    const cursorsToShow = collaborators.filter(
        (c) => c.id !== currentUserId && c.cursor && c.status === "online"
    );

    return (
        <>
            {cursorsToShow.map((collaborator) => (
                <CollaboratorCursor
                    key={collaborator.id}
                    collaborator={collaborator}
                />
            ))}
        </>
    );
}

// Individual cursor
function CollaboratorCursor({
    collaborator,
}: {
    collaborator: Collaborator;
}) {
    if (!collaborator.cursor) {return null;}

    return (
        <div
            className="pointer-events-none absolute z-50 transition-all duration-75"
            style={{
                left: collaborator.cursor.x,
                top: collaborator.cursor.y,
            }}
        >
            {/* Cursor pointer */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                style={{ color: collaborator.color }}
            >
                <path
                    d="M5.5 3.5L18.5 12.5L12 13.5L9 20.5L5.5 3.5Z"
                    fill="currentColor"
                    stroke="white"
                    strokeWidth="1.5"
                />
            </svg>

            {/* Name label */}
            <div
                className="absolute left-5 top-4 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap shadow-lg"
                style={{ backgroundColor: collaborator.color }}
            >
                {collaborator.name}
            </div>
        </div>
    );
}

// Selection highlight for collaborative editing
export function CollaboratorSelection({
    collaborator,
}: {
    collaborator: Collaborator;
    selection: { start: number; end: number; blockId: string };
}) {
    return (
        <div
            className="absolute pointer-events-none"
            style={{
                backgroundColor: `${collaborator.color}20`,
                borderLeft: `2px solid ${collaborator.color}`,
            }}
        >
            <div
                className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-xs text-white whitespace-nowrap"
                style={{ backgroundColor: collaborator.color }}
            >
                {collaborator.name}
            </div>
        </div>
    );
}

// Hook to track and broadcast cursor position
export function useCollaboratorCursor(
    userId: string,
    containerRef: React.RefObject<HTMLElement>,
    onCursorMove: (cursor: { x: number; y: number }) => void,
    throttleMs = 50
) {
    const [lastBroadcast, setLastBroadcast] = useState(0);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {return;}

        const handleMouseMove = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastBroadcast < throttleMs) {return;}

            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            onCursorMove({ x, y });
            setLastBroadcast(now);
        };

        container.addEventListener("mousemove", handleMouseMove);
        return () => container.removeEventListener("mousemove", handleMouseMove);
    }, [containerRef, onCursorMove, throttleMs, lastBroadcast]);
}

// Typing indicator
export function TypingIndicator({
    users,
}: {
    users: { id: string; name: string; color: string }[];
}) {
    if (users.length === 0) {return null;}

    const names =
        users.length === 1
            ? users[0].name
            : users.length === 2
                ? `${users[0].name} and ${users[1].name}`
                : `${users[0].name} and ${users.length - 1} others`;

    return (
        <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="flex -space-x-1">
                {users.slice(0, 3).map((user) => (
                    <div
                        key={user.id}
                        className="h-5 w-5 rounded-full border border-white flex items-center justify-center text-xs text-white"
                        style={{ backgroundColor: user.color }}
                    >
                        {user.name[0]}
                    </div>
                ))}
            </div>
            <span>{names} typing...</span>
            <span className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
        </div>
    );
}
