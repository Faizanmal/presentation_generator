'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AutoFitTextProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Starting font size in px (or CSS length used as max). */
  maxFontPx?: number;
  /** Floor font size in px. */
  minFontPx?: number;
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * Shrinks font-size until content fits the parent (or hits minFontPx).
 * Parent must have bounded height/width (e.g. flex min-h-0 overflow-hidden).
 */
export function AutoFitText({
  children,
  className,
  style,
  maxFontPx = 48,
  minFontPx = 14,
  as: Tag = 'div',
}: AutoFitTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [fontSize, setFontSize] = useState(maxFontPx);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    let size = maxFontPx;
    el.style.fontSize = `${size}px`;

    // Binary-ish shrink: reduce until fits or min
    let guard = 0;
    while (
      guard < 24 &&
      size > minFontPx &&
      (el.scrollHeight > el.clientHeight + 1 ||
        el.scrollWidth > el.clientWidth + 1)
    ) {
      size = Math.max(minFontPx, size - 2);
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
    setFontSize(size);
  }, [children, maxFontPx, minFontPx]);

  return React.createElement(
    Tag,
    {
      ref,
      className: cn('min-h-0 min-w-0 overflow-hidden', className),
      style: { ...style, fontSize: `${fontSize}px` },
    },
    children,
  );
}

export default AutoFitText;
