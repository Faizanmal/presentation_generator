"use client";

import { useState, useMemo } from "react";
import {
    MessageSquare,
    Send,
    X,
    MoreVertical,
    Trash2,
    Edit2,
    Check,
    Reply,
    AtSign,
    Pin,
    PinOff,
    ChevronDown,
    ChevronUp,
    CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Comment {
    id: string;
    content: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    slideId: string;
    blockId?: string;
    position?: { x: number; y: number };
    createdAt: string;
    updatedAt: string;
    resolved: boolean;
    pinned: boolean;
    replies: Reply[];
    mentions: string[];
}

interface Reply {
    id: string;
    content: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    createdAt: string;
}

interface CommentsProviderProps {
    projectId: string;
    slideId: string;
    currentUserId: string;
    currentUserName: string;
    comments: Comment[];
    collaborators: { id: string; name: string; avatar?: string }[];
    onAddComment: (comment: Omit<Comment, "id" | "createdAt" | "updatedAt" | "replies">) => void;
    onUpdateComment: (commentId: string, content: string) => void;
    onDeleteComment: (commentId: string) => void;
    onResolveComment: (commentId: string, resolved: boolean) => void;
    onPinComment: (commentId: string, pinned: boolean) => void;
    onAddReply: (commentId: string, content: string) => void;
}

// Comments Panel (sidebar)
export function CommentsPanel({
    slideId,
    currentUserId,
    currentUserName,
    comments,
    collaborators,
    onAddComment,
    onUpdateComment,
    onDeleteComment,
    onResolveComment,
    onPinComment,
    onAddReply,
}: CommentsProviderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
    const [showMentions, setShowMentions] = useState(false);

    // Filter comments for current slide
    const slideComments = useMemo(() => {
        let filtered = comments.filter((c) => c.slideId === slideId);

        if (filter === "open") {
            filtered = filtered.filter((c) => !c.resolved);
        } else if (filter === "resolved") {
            filtered = filtered.filter((c) => c.resolved);
        }

        // Sort: pinned first, then by date
        return filtered.sort((a, b) => {
            if (a.pinned && !b.pinned) {return -1;}
            if (!a.pinned && b.pinned) {return 1;}
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [comments, slideId, filter]);

    const unresolvedCount = comments.filter(
        (c) => c.slideId === slideId && !c.resolved
    ).length;

    const handleAddComment = () => {
        if (!newComment.trim()) {return;}

        // Extract mentions
        const mentionRegex = /@(\w+)/g;
        const mentions: string[] = [];
        let match;
        while ((match = mentionRegex.exec(newComment)) !== null) {
            mentions.push(match[1]);
        }

        onAddComment({
            content: newComment,
            authorId: currentUserId,
            authorName: currentUserName,
            slideId,
            resolved: false,
            pinned: false,
            mentions,
        });

        setNewComment("");
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 relative">
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Comments</span>
                    {unresolvedCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                            {unresolvedCount}
                        </Badge>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-96 sm:w-105flex flex-col p-0">
                <SheetHeader className="px-4 py-3 border-b">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Comments
                            {unresolvedCount > 0 && (
                                <Badge variant="secondary">{unresolvedCount} open</Badge>
                            )}
                        </SheetTitle>
                    </div>

                    {/* Filter tabs */}
                    <div className="flex gap-1 mt-2">
                        {(["all", "open", "resolved"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "px-3 py-1 text-sm rounded-full transition-colors",
                                    filter === f
                                        ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </SheetHeader>

                {/* Comments List */}
                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                        {slideComments.length === 0 ? (
                            <div className="text-center py-12">
                                <MessageSquare className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600" />
                                <p className="text-sm text-slate-500 mt-2">No comments yet</p>
                                <p className="text-xs text-slate-400">
                                    Add a comment to start a discussion
                                </p>
                            </div>
                        ) : (
                            slideComments.map((comment) => (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    currentUserId={currentUserId}
                                    collaborators={collaborators}
                                    onUpdate={(content) => onUpdateComment(comment.id, content)}
                                    onDelete={() => onDeleteComment(comment.id)}
                                    onResolve={(resolved) => onResolveComment(comment.id, resolved)}
                                    onPin={(pinned) => onPinComment(comment.id, pinned)}
                                    onReply={(content) => onAddReply(comment.id, content)}
                                />
                            ))
                        )}
                    </div>
                </ScrollArea>

                {/* New Comment Input */}
                <div className="p-4 border-t bg-slate-50 dark:bg-slate-800/50">
                    <div className="relative">
                        <Textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a comment... Use @ to mention"
                            className="min-h-20 resize-none pr-12"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                    handleAddComment();
                                }
                            }}
                        />
                        <div className="absolute bottom-2 right-2 flex items-center gap-1">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => setShowMentions(!showMentions)}
                            >
                                <AtSign className="h-4 w-4" />
                            </Button>
                            <Button
                                size="icon"
                                onClick={handleAddComment}
                                disabled={!newComment.trim()}
                                className="h-8 w-8"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        Press ⌘+Enter to send
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// Individual comment item
function CommentItem({
    comment,
    currentUserId,
    onUpdate,
    onDelete,
    onResolve,
    onPin,
    onReply,
}: {
    comment: Comment;
    currentUserId: string;
    collaborators: { id: string; name: string; avatar?: string }[];
    onUpdate: (content: string) => void;
    onDelete: () => void;
    onResolve: (resolved: boolean) => void;
    onPin: (pinned: boolean) => void;
    onReply: (content: string) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(comment.content);
    const [showReplies, setShowReplies] = useState(comment.replies.length > 0);
    const [replyContent, setReplyContent] = useState("");
    const [isReplying, setIsReplying] = useState(false);

    const isAuthor = comment.authorId === currentUserId;

    const handleSaveEdit = () => {
        onUpdate(editContent);
        setIsEditing(false);
    };

    const handleReply = () => {
        if (replyContent.trim()) {
            onReply(replyContent);
            setReplyContent("");
            setIsReplying(false);
        }
    };

    return (
        <div
            className={cn(
                "rounded-lg border transition-colors",
                comment.resolved
                    ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700",
                comment.pinned && "ring-2 ring-yellow-400"
            )}
        >
            {/* Header */}
            <div className="flex items-start gap-3 p-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.authorAvatar} />
                    <AvatarFallback>
                        {comment.authorName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                            {comment.authorName}
                        </span>
                        {comment.pinned && (
                            <Pin className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        )}
                        {comment.resolved && (
                            <Badge variant="outline" className="text-green-600 border-green-300 text-xs gap-1">
                                <CheckCheck className="h-3 w-3" />
                                Resolved
                            </Badge>
                        )}
                    </div>
                    <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(comment.createdAt))} ago
                    </span>
                </div>

                {/* Actions */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onResolve(!comment.resolved)}>
                            {comment.resolved ? (
                                <>
                                    <X className="mr-2 h-4 w-4" />
                                    Reopen
                                </>
                            ) : (
                                <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Resolve
                                </>
                            )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onPin(!comment.pinned)}>
                            {comment.pinned ? (
                                <>
                                    <PinOff className="mr-2 h-4 w-4" />
                                    Unpin
                                </>
                            ) : (
                                <>
                                    <Pin className="mr-2 h-4 w-4" />
                                    Pin
                                </>
                            )}
                        </DropdownMenuItem>
                        {isAuthor && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                                    <Edit2 className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={onDelete}
                                    className="text-red-600"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Content */}
            <div className="px-3 pb-3">
                {isEditing ? (
                    <div className="space-y-2">
                        <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="min-h-15 resize-none"
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setEditContent(comment.content);
                                    setIsEditing(false);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSaveEdit}>
                                Save
                            </Button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {comment.content}
                    </p>
                )}
            </div>

            {/* Replies */}
            {comment.replies.length > 0 && (
                <div className="border-t">
                    <button
                        onClick={() => setShowReplies(!showReplies)}
                        className="w-full px-3 py-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                        {showReplies ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                        {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
                    </button>

                    {showReplies && (
                        <div className="px-3 pb-3 space-y-3">
                            {comment.replies.map((reply) => (
                                <div key={reply.id} className="flex gap-2 ml-4">
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={reply.authorAvatar} />
                                        <AvatarFallback className="text-xs">
                                            {reply.authorName.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{reply.authorName}</span>
                                            <span className="text-xs text-slate-400">
                                                {formatDistanceToNow(new Date(reply.createdAt))} ago
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {reply.content}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Reply Input */}
            <div className="border-t px-3 py-2">
                {isReplying ? (
                    <div className="space-y-2">
                        <Textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Write a reply..."
                            className="min-h-15 resize-none text-sm"
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setReplyContent("");
                                    setIsReplying(false);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleReply}>
                                Reply
                            </Button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsReplying(true)}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                        <Reply className="h-4 w-4" />
                        Reply
                    </button>
                )}
            </div>
        </div>
    );
}

// Floating comment indicator on slide
export function CommentIndicator({
    commentCount,
    hasUnresolved,
    onClick,
    position,
}: {
    commentCount: number;
    hasUnresolved: boolean;
    onClick: () => void;
    position?: { x: number; y: number };
}) {
    if (commentCount === 0) {return null;}

    return (
        <button
            onClick={onClick}
            className={cn(
                "absolute z-10 p-1.5 rounded-full shadow-lg transition-transform hover:scale-110",
                hasUnresolved
                    ? "bg-blue-500 text-white"
                    : "bg-green-500 text-white"
            )}
            style={position ? { left: position.x, top: position.y } : {}}
        >
            <MessageSquare className="h-4 w-4" />
            {commentCount > 1 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-xs flex items-center justify-center">
                    {commentCount}
                </span>
            )}
        </button>
    );
}
