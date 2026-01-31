/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useEditorStore } from '@/stores/editor-store';
import { toast } from 'sonner';

interface Collaborator {
  userId: string;
  userName: string;
  color: string;
  socketId: string;
  cursorX?: number;
  cursorY?: number;
  cursorSlide?: number;
}

interface CursorPosition {
  x: number;
  y: number;
  slideIndex: number;
}

interface UseCollaborationOptions {
  projectId: string;
  token: string;
  onUserJoined?: (user: Collaborator) => void;
  onUserLeft?: (user: { userId: string; userName: string }) => void;
}

export function useCollaboration({
  projectId,
  token,
  onUserJoined,
  onUserLeft,
}: UseCollaborationOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [cursors, setCursors] = useState<Map<string, CursorPosition & { color: string; userName: string }>>(
    new Map()
  );

  const { updateBlock, addSlide, deleteSlide, reorderSlides } = useEditorStore();

  // Initialize socket connection
  useEffect(() => {
    if (!projectId || !token) return;

    const socket = io(`${process.env.NEXT_PUBLIC_API_URL}/collaboration`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('project:join', { projectId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      toast.error('Failed to connect to collaboration server');
    });

    // Collaborator events
    socket.on('collaborators:list', (list: Collaborator[]) => {
      setCollaborators(list);
    });

    socket.on('user:joined', (user: Collaborator) => {
      setCollaborators((prev) => [...prev, user]);
      onUserJoined?.(user);
      toast.info(`${user.userName} joined the presentation`);
    });

    socket.on('user:left', (user: { userId: string; userName: string; socketId: string }) => {
      setCollaborators((prev) => prev.filter((c) => c.socketId !== user.socketId));
      setCursors((prev) => {
        const next = new Map(prev);
        next.delete(user.userId);
        return next;
      });
      onUserLeft?.(user);
    });

    // Cursor events
    socket.on('cursor:update', (data: CursorPosition & { userId: string; userName: string; color: string }) => {
      setCursors((prev) => {
        const next = new Map(prev);
        next.set(data.userId, {
          x: data.x,
          y: data.y,
          slideIndex: data.slideIndex,
          color: data.color,
          userName: data.userName,
        });
        return next;
      });
    });

    // Content update events
    socket.on('block:updated', (data: any) => {
      updateBlock(data.slideId, data.blockId, data.data);
    });

    socket.on('slide:added', (data: any) => {
      addSlide(data.slide);
    });

    socket.on('slide:deleted', (data: any) => {
      deleteSlide(data.slideId);
    });

    socket.on('slide:reordered', (data: any) => {
      reorderSlides(data.fromIndex, data.toIndex);
    });

    // Comment events
    socket.on('comment:added', (data: any) => {
      toast.info(`${data.userName} added a comment`);
    });

    socket.on('comment:resolved', (data: any) => {
      toast.info('Comment resolved');
    });

    // Version events
    socket.on('version:saved', (data: any) => {
      toast.success(`Version saved by ${data.userName}`);
    });

    // Cleanup
    return () => {
      socket.emit('project:leave', { projectId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId, token, updateBlock, addSlide, deleteSlide, reorderSlides, onUserJoined, onUserLeft]);

  // Send cursor position
  const sendCursorPosition = useCallback((position: CursorPosition) => {
    socketRef.current?.emit('cursor:move', position);
  }, []);

  // Send block update
  const sendBlockUpdate = useCallback(
    (slideId: string, blockId: string, data: any) => {
      socketRef.current?.emit('block:update', {
        projectId,
        slideId,
        blockId,
        data,
      });
    },
    [projectId]
  );

  // Send slide update
  const sendSlideUpdate = useCallback(
    (slideId: string, data: any) => {
      socketRef.current?.emit('slide:update', {
        projectId,
        slideId,
        data,
      });
    },
    [projectId]
  );

  // Send slide add
  const sendSlideAdd = useCallback(
    (slide: any) => {
      socketRef.current?.emit('slide:add', {
        projectId,
        slide,
      });
    },
    [projectId]
  );

  // Send slide delete
  const sendSlideDelete = useCallback(
    (slideId: string) => {
      socketRef.current?.emit('slide:delete', {
        projectId,
        slideId,
      });
    },
    [projectId]
  );

  // Send slide reorder
  const sendSlideReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      socketRef.current?.emit('slide:reorder', {
        projectId,
        fromIndex,
        toIndex,
      });
    },
    [projectId]
  );

  // Add comment
  const addComment = useCallback(
    async (content: string, slideId?: string, blockId?: string) => {
      return new Promise((resolve) => {
        socketRef.current?.emit(
          'comment:add',
          { projectId, slideId, blockId, content },
          (response: any) => resolve(response)
        );
      });
    },
    [projectId]
  );

  // Resolve comment
  const resolveComment = useCallback(
    (commentId: string) => {
      socketRef.current?.emit('comment:resolve', { projectId, commentId });
    },
    [projectId]
  );

  // Save version
  const saveVersion = useCallback(
    async (snapshot: any, message?: string) => {
      return new Promise((resolve) => {
        socketRef.current?.emit(
          'version:save',
          { projectId, snapshot, message },
          (response: any) => resolve(response)
        );
      });
    },
    [projectId]
  );

  return {
    isConnected,
    collaborators,
    cursors,
    sendCursorPosition,
    sendBlockUpdate,
    sendSlideUpdate,
    sendSlideAdd,
    sendSlideDelete,
    sendSlideReorder,
    addComment,
    resolveComment,
    saveVersion,
  };
}
