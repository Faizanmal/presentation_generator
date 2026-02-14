'use client';

import { useEffect, useRef } from 'react';
import type { ActiveUser } from '@/types';

interface CursorOverlayProps {
  users: ActiveUser[];
  currentUserId: string;
  containerRef: React.RefObject<HTMLElement>;
}

export function CursorOverlay({
  users,
  currentUserId,
}: CursorOverlayProps) {
  const otherUsers = users.filter((user) => user.id !== currentUserId && user.cursor);

  if (otherUsers.length === 0) {return null;}

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {otherUsers.map((user) => (
        <UserCursor key={user.id} user={user} />
      ))}
    </div>
  );
}

interface UserCursorProps {
  user: ActiveUser;
}

function UserCursor({ user }: UserCursorProps) {
  if (!user.cursor) {return null;}

  const { x, y } = user.cursor;
  const name = user.name || user.email.split('@')[0];

  return (
    <div
      className="absolute transition-all duration-75 ease-out"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-2px, -2px)',
      }}
    >
      {/* Cursor pointer */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
      >
        <path
          d="M5.65376 3.19995L20.1538 10.6999L11.8538 12.7999L8.35376 20.1999L5.65376 3.19995Z"
          fill={user.color}
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Name label */}
      <div
        className="absolute left-4 top-4 px-2 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap shadow-lg"
        style={{ backgroundColor: user.color }}
      >
        {name}
      </div>
    </div>
  );
}

// Hook to track and broadcast cursor position
export function useCursorTracking(
  containerRef: React.RefObject<HTMLElement>,
  onCursorMove: (position: { x: number; y: number }) => void,
  throttleMs = 50
) {
  const lastBroadcast = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {return;}

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastBroadcast.current < throttleMs) {return;}

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      onCursorMove({ x, y });
      lastBroadcast.current = now;
    };

    const handleMouseLeave = () => {
      onCursorMove({ x: -100, y: -100 }); // Move cursor off-screen
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, onCursorMove, throttleMs]);
}
