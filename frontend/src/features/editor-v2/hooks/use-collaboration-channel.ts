import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { useCollaborationStore } from "../stores/use-collaboration-store";

interface CursorPayload {
  userId: string;
  x: number;
  y: number;
  slideId: string | null;
}

interface TypingPayload {
  userId: string;
  isTyping: boolean;
}

export function useCollaborationChannel(projectId: string, slideId: string | null): void {
  const setConnected = useCollaborationStore((state) => state.setConnected);
  const updateCursor = useCollaborationStore((state) => state.updateCursor);
  const setTyping = useCollaborationStore((state) => state.setTyping);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_COLLAB_SOCKET_URL;
    let socket: Socket | null = null;

    if (socketUrl) {
      socket = io(socketUrl, {
        transports: ["websocket"],
        autoConnect: true,
        withCredentials: true,
      });

      socket.on("connect", () => {
        setConnected(true);
        socket?.emit("join:project", { projectId });
      });

      socket.on("disconnect", () => setConnected(false));
      socket.on("presence:cursor", (payload: CursorPayload) => {
        updateCursor(payload.userId, payload.x, payload.y, payload.slideId);
      });

      socket.on("presence:typing", (payload: TypingPayload) => {
        setTyping(payload.userId, payload.isTyping);
      });
    }

    const ghostCursorInterval = window.setInterval(() => {
      updateCursor(
        "u-2",
        620 + Math.sin(Date.now() / 1100) * 120,
        330 + Math.cos(Date.now() / 1250) * 90,
        slideId,
      );
    }, 120);

    return () => {
      window.clearInterval(ghostCursorInterval);
      socket?.disconnect();
    };
  }, [projectId, setConnected, setTyping, slideId, updateCursor]);
}

