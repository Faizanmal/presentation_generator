import { create } from "zustand";
import type { EditorComment, PresenceUser } from "../types";

interface CollaborationState {
  connected: boolean;
  participants: PresenceUser[];
  comments: EditorComment[];

  setConnected: (connected: boolean) => void;
  setParticipants: (participants: PresenceUser[]) => void;
  updateCursor: (userId: string, x: number, y: number, slideId: string | null) => void;
  setTyping: (userId: string, typing: boolean) => void;
  addComment: (comment: EditorComment) => void;
  resolveComment: (commentId: string) => void;
}

const demoParticipants: PresenceUser[] = [
  {
    id: "u-1",
    name: "Ari",
    avatar: "A",
    color: "oklch(0.74 0.18 252)",
    cursor: { x: 520, y: 260, slideId: null },
    isTyping: false,
    activeTool: "select",
  },
  {
    id: "u-2",
    name: "Nila",
    avatar: "N",
    color: "oklch(0.74 0.15 164)",
    cursor: { x: 740, y: 410, slideId: null },
    isTyping: true,
    activeTool: "comment",
  },
];

export const useCollaborationStore = create<CollaborationState>()((set) => ({
  connected: true,
  participants: demoParticipants,
  comments: [],

  setConnected: (connected) => set(() => ({ connected })),

  setParticipants: (participants) => set(() => ({ participants })),

  updateCursor: (userId, x, y, slideId) =>
    set((state) => ({
      participants: state.participants.map((participant) =>
        participant.id === userId
          ? {
              ...participant,
              cursor: { x, y, slideId },
            }
          : participant,
      ),
    })),

  setTyping: (userId, typing) =>
    set((state) => ({
      participants: state.participants.map((participant) =>
        participant.id === userId
          ? {
              ...participant,
              isTyping: typing,
            }
          : participant,
      ),
    })),

  addComment: (comment) => set((state) => ({ comments: [comment, ...state.comments] })),

  resolveComment: (commentId) =>
    set((state) => ({
      comments: state.comments.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              resolved: true,
            }
          : comment,
      ),
    })),
}));

