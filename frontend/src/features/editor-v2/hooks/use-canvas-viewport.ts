import { useMemo, useRef, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";

interface UseCanvasViewportOptions {
  onPan: (deltaX: number, deltaY: number) => void;
  onZoomDelta: (delta: number) => void;
}

interface CanvasViewportBind {
  onWheel: (event: ReactWheelEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
}

interface PointerState {
  id: number | null;
  x: number;
  y: number;
  active: boolean;
}

export function useCanvasViewport({ onPan, onZoomDelta }: UseCanvasViewportOptions): CanvasViewportBind {
  const pointer = useRef<PointerState>({ id: null, x: 0, y: 0, active: false });

  return useMemo(
    () => ({
      onWheel: (event) => {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          const delta = event.deltaY < 0 ? 0.06 : -0.06;
          onZoomDelta(delta);
          return;
        }

        if (Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) > 0) {
          onPan(-event.deltaX * 0.4, -event.deltaY * 0.4);
        }
      },

      onPointerDown: (event) => {
        if (event.button !== 1 && !event.altKey) {
          return;
        }

        pointer.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          active: true,
        };

        event.currentTarget.setPointerCapture(event.pointerId);
      },

      onPointerMove: (event) => {
        const state = pointer.current;
        if (!state.active || state.id !== event.pointerId) {
          return;
        }

        const deltaX = event.clientX - state.x;
        const deltaY = event.clientY - state.y;

        pointer.current = {
          ...state,
          x: event.clientX,
          y: event.clientY,
        };

        onPan(deltaX, deltaY);
      },

      onPointerUp: () => {
        pointer.current = { id: null, x: 0, y: 0, active: false };
      },

      onPointerLeave: () => {
        pointer.current = { id: null, x: 0, y: 0, active: false };
      },
    }),
    [onPan, onZoomDelta],
  );
}

