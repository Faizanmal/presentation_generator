'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Reply, Check, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Comment } from '@/types';

interface CommentsPanelProps {
  comments: Comment[];
  currentUserId: string;
  onAddComment: (content: string, slideId?: string, blockId?: string, parentId?: string) => void;
  onResolveComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  selectedSlideId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CommentsPanel({
  comments,
  currentUserId,
  onAddComment,
  onResolveComment,
  onDeleteComment,
  selectedSlideId,
  isOpen,
  onClose,
}: CommentsPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  // Filter comments
  const filteredComments = comments.filter((comment) => {
    if (!comment.parentId) {
      // Top-level comments only
      if (filter === 'open') {return !comment.resolved;}
      if (filter === 'resolved') {return comment.resolved;}
      return true;
    }
    return false;
  });

  // Group by slide if showing all
  const commentsBySlide = filteredComments.reduce(
    (acc, comment) => {
      const slideId = comment.slideId || 'general';
      if (!acc[slideId]) {acc[slideId] = [];}
      acc[slideId].push(comment);
      return acc;
    },
    {} as Record<string, Comment[]>
  );

  const handleSubmitComment = () => {
    if (!newComment.trim()) {return;}
    onAddComment(newComment, selectedSlideId);
    setNewComment('');
  };

  const handleSubmitReply = (parentId: string) => {
    if (!replyContent.trim()) {return;}
    onAddComment(replyContent, undefined, undefined, parentId);
    setReplyContent('');
    setReplyingTo(null);
  };

  if (!isOpen) {return null;}

  return (
    <div className="w-80 border-l bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Comments
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(['all', 'open', 'resolved'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
              {f !== 'all' && (
                <Badge variant="secondary" className="ml-1 px-1.5">
                  {comments.filter((c) => 
                    !c.parentId && (f === 'open' ? !c.resolved : c.resolved)
                  ).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {Object.entries(commentsBySlide).map(([slideId, slideComments]) => (
            <div key={slideId}>
              {slideId !== 'general' && (
                <p className="text-xs text-muted-foreground mb-2">
                  Slide {slideId.slice(-4)}
                </p>
              )}
              {slideComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onResolve={() => onResolveComment(comment.id)}
                  onDelete={() => onDeleteComment(comment.id)}
                  onReply={() => setReplyingTo(comment.id)}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  onReplyContentChange={setReplyContent}
                  onSubmitReply={() => handleSubmitReply(comment.id)}
                  onCancelReply={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                />
              ))}
            </div>
          ))}

          {filteredComments.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No comments yet
            </p>
          )}
        </div>
      </ScrollArea>

      {/* New comment input */}
      <div className="p-4 border-t">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-20 mb-2"
        />
        <div className="flex justify-end">
          <Button onClick={handleSubmitComment} disabled={!newComment.trim()}>
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  onResolve: () => void;
  onDelete: () => void;
  onReply: () => void;
  replyingTo: string | null;
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  onSubmitReply: () => void;
  onCancelReply: () => void;
}

function CommentItem({
  comment,
  currentUserId,
  onResolve,
  onDelete,
  onReply,
  replyingTo,
  replyContent,
  onReplyContentChange,
  onSubmitReply,
  onCancelReply,
}: CommentItemProps) {
  const isOwner = comment.userId === currentUserId;
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  return (
    <div
      className={cn(
        'rounded-lg p-3 mb-2',
        comment.resolved ? 'bg-muted/50' : 'bg-muted'
      )}
    >
      <div className="flex items-start gap-2">
        <Avatar className="w-8 h-8">
          <AvatarImage src={comment.user.image || undefined} />
          <AvatarFallback>
            {comment.user.name?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {comment.user.name || 'User'}
            </span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
            {comment.resolved && (
              <Badge variant="outline" className="text-xs">
                <Check className="w-3 h-3 mr-1" />
                Resolved
              </Badge>
            )}
          </div>

          <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onReply}
            >
              <Reply className="w-3 h-3 mr-1" />
              Reply
            </Button>

            {!comment.resolved && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onResolve}
              >
                <Check className="w-3 h-3 mr-1" />
                Resolve
              </Button>
            )}

            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-10 mt-3 space-y-2">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={reply.user.image || undefined} />
                <AvatarFallback className="text-xs">
                  {reply.user.name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-xs">{reply.user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {replyingTo === comment.id && (
        <div className="ml-10 mt-3">
          <Textarea
            placeholder="Write a reply..."
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            className="min-h-15 text-sm"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={onCancelReply}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSubmitReply} disabled={!replyContent.trim()}>
              Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
