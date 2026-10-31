"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React, { useState, useRef, useEffect, useMemo } from "react";
import type { Block, Theme } from "@/types";
import { GripVertical, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { ImageAIControls } from "./image-ai-controls";
import { OEmbedBlock } from "./oembed-block";
import { BentoGridBlock } from "./bento-grid-block";
import { TimelineBlock } from "./timeline-block";
import type { EmbedServiceType } from "./oembed-block";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { isValidMediaUrl, mediaUrlFromBlockContent } from "@/lib/slide-media";
import { BrandedMediaPlaceholder } from "./BrandedMediaPlaceholder";

const ChartBlock = dynamic(() => import("./chart-block").then((m) => m.ChartBlock), { ssr: false });
const ThreeDBlock = dynamic(() => import("./three-d-block").then((m) => m.ThreeDBlock), { ssr: false });
const RichTextEditor = dynamic(() => import("./RichTextEditor"), { ssr: false });

interface BlockRendererProps {
  block: Block;
  theme?: Theme;
  isActive: boolean;
  blockIndex?: number; // For stagger animation
  presentationDensity?: number;
  presentationTone?: number;
  /** IMAGE blocks: fill parent height (bleed media columns) */
  fillMedia?: boolean;
  /** Tighter typography/padding for constrained layout cells */
  compact?: boolean;
  /** Enforce identical font size across all cards in a multi-card row */
  uniformFontSize?: string;
  /** Avoid double card borders when parent layout cell is already a card */
  suppressCardChrome?: boolean;
  /** Topic context from deck/slide for topic-matched image resolution */
  topicContext?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onChange?: (content: Record<string, unknown>) => void;
  onDelete?: () => void;
}

const normalizeKeyPart = (value: string) =>
  value.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase().slice(0, 24) || "empty";

const buildKeyedTextItems = (items: string[], prefix: string) => {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const normalized = normalizeKeyPart(item);
    const count = (seen.get(normalized) || 0) + 1;
    seen.set(normalized, count);
    return { item, key: `${prefix}-${normalized}-${count}` };
  });
};

/** Generate a lighter/transparent variant for backgrounds */
const colorWithAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Generate a complementary gradient from a color */
const gradientFromColor = (hex: string, direction = '135deg'): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const r2 = Math.min(255, r + 40);
  const g2 = Math.min(255, g + 20);
  const b2 = Math.max(0, b - 20);
  return `linear-gradient(${direction}, rgb(${r}, ${g}, ${b}), rgb(${r2}, ${g2}, ${b2}))`;
};

const BlockRenderer = React.memo(({
  block,
  theme,
  isActive,
  blockIndex = 0,
  presentationDensity = 60,
  presentationTone = 70,
  fillMedia = false,
  compact = false,
  uniformFontSize,
  suppressCardChrome = false,
  topicContext = '',
  onFocus,
  onBlur,
  onChange,
  onDelete,
}: BlockRendererProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Theme colors
  const primaryColor = theme?.colors?.primary || "#3b82f6";
  const accentColor = theme?.colors?.accent || "#10b981";
  const secondaryColor = theme?.colors?.secondary || "#8b5cf6";
  // surface color was used in earlier designs but is currently unused
  // const surfaceColor = theme?.colors?.surface || "#f8fafc";
  const isDense = presentationDensity >= 66 || compact;
  const isSpacious = !compact && presentationDensity < 34;
  const bodyLineHeight = isDense ? 1.45 : 1.72;
  const readableWidth = isDense ? '36rem' : '42rem';
  const headingScale = compact
    ? 'clamp(1.35rem, 2.4vw, 1.85rem)'
    : isSpacious
      ? 'clamp(2.2rem, 4.2vw, 3.5rem)'
      : isDense
        ? 'clamp(1.7rem, 3vw, 2.4rem)'
        : 'clamp(1.9rem, 3.6vw, 3rem)';
  const subheadingScale = compact
    ? 'clamp(0.95rem, 1.5vw, 1.2rem)'
    : isSpacious
      ? 'clamp(1.25rem, 2.2vw, 1.65rem)'
      : isDense
        ? 'clamp(1.05rem, 1.6vw, 1.3rem)'
        : 'clamp(1.15rem, 1.9vw, 1.45rem)';
  const bodyOpacity = presentationTone > 66 ? 0.92 : presentationTone < 34 ? 0.82 : 0.88;

  // Content state
  const [content, setContent] = useState(block.content);
  const contentRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync content changes with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      if (JSON.stringify(content) !== JSON.stringify(block.content)) {
        onChange?.(content);
      }
    }, 500);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [content, block.content, onChange]);

  // Handle text change for editable blocks
  const handleTextChange = (e: React.FormEvent<HTMLElement>) => {
    const text = (e.target as HTMLElement).innerText;
    setContent({ ...content, text });
  };

  // Cap list length so dense AI decks don't clip off the 16:9 canvas
  const MAX_LIST_ITEMS = compact ? 4 : isDense ? 5 : 6;
  const bulletItems = useMemo(() => {
    const raw = (content?.items as string[]) || ["Item 1", "Item 2", "Item 3"];
    return raw.slice(0, MAX_LIST_ITEMS);
  }, [content?.items, MAX_LIST_ITEMS]);
  const keyedBulletItems = useMemo(() => buildKeyedTextItems(bulletItems, "bullet"), [bulletItems]);

  const numberedItems = useMemo(() => {
    const raw = (content?.items as string[]) || ["Item 1", "Item 2", "Item 3"];
    return raw.slice(0, MAX_LIST_ITEMS);
  }, [content?.items, MAX_LIST_ITEMS]);
  const keyedNumberedItems = useMemo(() => buildKeyedTextItems(numberedItems, "numbered"), [numberedItems]);

  const rows = useMemo(() => (content?.rows as string[][]) || [
    ["Header 1", "Header 2", "Header 3"],
    ["Cell 1", "Cell 2", "Cell 3"],
    ["Cell 4", "Cell 5", "Cell 6"],
  ], [content?.rows]);
  const _keyedRows = useMemo(() => {
    const seenRows = new Map<string, number>();
    return rows.map((row: string[]) => {
      const rowSignature = normalizeKeyPart(row.join("|"));
      const count = (seenRows.get(rowSignature) || 0) + 1;
      seenRows.set(rowSignature, count);
      const rowKey = `row-${rowSignature}-${count}`;

      const seenCells = new Map<string, number>();
      const keyedCells = row.map((cell: string) => {
        const cellSig = normalizeKeyPart(cell);
        const cellCount = (seenCells.get(cellSig) || 0) + 1;
        seenCells.set(cellSig, cellCount);
        return { cell, key: `${rowKey}-cell-${cellSig}-${cellCount}` };
      });

      return { row, key: rowKey, cells: keyedCells };
    });
  }, [rows]);

  // Block styling from the block's style property
  const blockStyle = block.style || {};
  const textAlign = (blockStyle.textAlign || block.formatting?.alignment || 'left') as React.CSSProperties['textAlign'];
  // Cap AI-provided px sizes so generated decks don't clip titles off the 16:9 canvas.
  // In compact/card layouts, ignore legacy default backend fontSizes (21/22/24px) so all cards match.
  const customFontSize = (() => {
    if (uniformFontSize) {
      return uniformFontSize;
    }
    if (compact || suppressCardChrome) {
      return undefined;
    }
    const raw = blockStyle.fontSize;
    if (raw == null || raw === '') {
      return undefined;
    }
    if (typeof raw === 'number') {
      if (raw >= 20 && raw <= 24) {
        return undefined;
      }
      return `${Math.min(raw, isDense ? 36 : 44)}px`;
    }
    const match = String(raw).match(/^([\d.]+)px$/i);
    if (match) {
      const px = parseFloat(match[1]);
      if (!Number.isNaN(px)) {
        if (px >= 20 && px <= 24) {
          return undefined;
        }
        return `${Math.min(px, isDense ? 36 : 44)}px`;
      }
    }
    return String(raw);
  })();
  const customColor = blockStyle.color || block.formatting?.color;

  // Render based on block type
  const renderBlockContent = () => {
    // Support both 'type' and 'blockType' properties for compatibility
    // and normalize spacing and hyphens just in case
    const blockType = ((block.type || block.blockType) as string)
      ?.toUpperCase()
      .trim()
      .replace(/-/g, '_');

    switch (blockType) {
      case "HEADING":
        return (
          <div className="relative">
            {!isDense && textAlign !== 'center' && (
              <div
                className="absolute -left-3 top-1.5 bottom-1.5 w-0.5 rounded-full opacity-70"
                style={{ background: primaryColor }}
              />
            )}
            <h1
              ref={contentRef}
              contentEditable
              onInput={handleTextChange}
              onFocus={onFocus}
              onBlur={onBlur}
              className="outline-none font-extrabold leading-[1.12] tracking-[-0.02em] transition-all duration-200 w-full max-w-full [word-break:normal] [overflow-wrap:normal] [hyphens:none]"
              style={{
                fontFamily: theme?.fonts?.heading || 'var(--font-dm-sans), system-ui, sans-serif',
                color: customColor?.startsWith('#') ? customColor : (theme?.colors?.text || primaryColor),
                textAlign,
                fontSize: customFontSize || headingScale,
                maxWidth: textAlign === 'center' ? readableWidth : '100%',
              }}
              dangerouslySetInnerHTML={{ __html: content?.text || "Heading" }}
            />
          </div>
        );

      case "SUBHEADING": {
        const variant = blockStyle.variant || block.formatting?.variant;
        if (variant === 'kicker') {
          const kickerText = String(content?.text || '').trim();
          if (/^(editorial|executive|bold|manifesto|comparison|quote|timeline|history|basics|evidence|use cases|look ahead|call to action|cta)$/i.test(kickerText)) {
            return null;
          }
          return (
            <div
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase"
              style={{
                color: primaryColor,
                background: colorWithAlpha(primaryColor, 0.08),
                border: `1px solid ${colorWithAlpha(primaryColor, 0.2)}`,
                fontFamily: theme?.fonts?.body || 'var(--font-dm-sans), system-ui, sans-serif',
              }}
            >
              {content?.text || "Kicker"}
            </div>
          );
        }
        return (
          <h2
            ref={contentRef}
            contentEditable
            onInput={handleTextChange}
            onFocus={onFocus}
            onBlur={onBlur}
            className="outline-none font-semibold leading-snug transition-all duration-200 text-[clamp(1.25rem,2vw,1.9rem)] w-full max-w-full [word-break:normal] [overflow-wrap:normal] [hyphens:none]"
            style={{
              fontFamily: theme?.fonts?.heading || 'var(--font-dm-sans), system-ui, sans-serif',
              color: customColor?.startsWith('#') ? customColor : undefined,
              textAlign,
              fontSize: customFontSize || subheadingScale,
              opacity: 0.9,
              maxWidth: '100%',
            }}
            dangerouslySetInnerHTML={{ __html: content?.text || "Subheading" }}
          />
        );
      }

      case "PARAGRAPH": {
        const variant = blockStyle.variant || block.formatting?.variant;
        const isCard = variant === 'card';
        const isIconText = variant === 'icon-text';
        const textContent = content?.text || "Start typing...";

        // Card variant - glassmorphism style (skip nested border when parent is already a column card)
        if (isCard && !suppressCardChrome) {
          return (
            <div
              className={cn(
                'relative rounded-2xl overflow-hidden min-h-0 flex-1 flex flex-col justify-between h-full',
                compact ? 'p-3.5' : 'p-4',
              )}
              style={{
                background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.08)}, ${colorWithAlpha(secondaryColor, 0.06)})`,
                backdropFilter: 'blur(8px)',
                border: `1px solid ${colorWithAlpha(primaryColor, 0.15)}`,
              }}
            >
              <p
                ref={contentRef}
                contentEditable
                onInput={handleTextChange}
                onFocus={onFocus}
                onBlur={onBlur}
                className={cn(
                  'outline-none relative z-10 font-medium min-h-0 [word-break:normal] [overflow-wrap:normal] [hyphens:none] whitespace-normal',
                  compact ? 'text-sm leading-relaxed' : 'text-[1.02rem] leading-relaxed',
                )}
                style={{
                  fontFamily: theme?.fonts?.body || 'var(--font-dm-sans), system-ui, sans-serif',
                  color: customColor?.startsWith('#') ? customColor : undefined,
                  textAlign,
                  fontSize: uniformFontSize || undefined,
                  lineHeight: bodyLineHeight,
                  opacity: bodyOpacity,
                  maxWidth: '100%',
                }}
                dangerouslySetInnerHTML={{ __html: textContent }}
              />
            </div>
          );
        }

        // Icon-text variant
        if (isIconText) {
          return (
            <div className="flex items-start gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.15)}, ${colorWithAlpha(accentColor, 0.1)})`,
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.2)}`,
                }}
              >
                {textContent.charAt(0)}
              </div>
              <p
                ref={contentRef}
                contentEditable
                onInput={handleTextChange}
                onFocus={onFocus}
                onBlur={onBlur}
                className="outline-none flex-1 pt-1.5 text-sm sm:text-base leading-relaxed [word-break:normal] [overflow-wrap:normal] [hyphens:none] whitespace-normal"
                style={{
                  fontFamily: theme?.fonts?.body || 'var(--font-dm-sans), system-ui, sans-serif',
                  color: customColor?.startsWith('#') ? customColor : undefined,
                  fontSize: uniformFontSize || undefined,
                  lineHeight: bodyLineHeight,
                  opacity: bodyOpacity,
                }}
                dangerouslySetInnerHTML={{ __html: textContent }}
              />
            </div>
          );
        }

        // Check if this looks like a big stat number (e.g., "95%", "3×", "3x", "$1.5M", or "95% Customer Retention")
        const trimmed = textContent.trim();
        const statOnlyMatch = /^[\d$€£¥%.,MBKmkb+\-×x\s]+$/i.test(trimmed) && trimmed.length < 14;
        const statWithLabelMatch = trimmed.match(/^([$€£¥]?\d+(?:[.,]\d+)?(?:%|[x×]|(?:[kKmMbBtT]))?)\s*[:–—\-]?\s+(.+)$/i);
        const isBigStat = !suppressCardChrome && (statOnlyMatch || Boolean(statWithLabelMatch && statWithLabelMatch[1] && statWithLabelMatch[1].length < 10));

        if (isBigStat) {
          const statValue = statWithLabelMatch ? statWithLabelMatch[1] : trimmed;
          const statLabel = statWithLabelMatch ? statWithLabelMatch[2] : '';

          return (
            <div className="py-2.5 flex flex-col justify-center" style={{ textAlign }}>
              <p
                ref={contentRef}
                contentEditable
                onInput={handleTextChange}
                onFocus={onFocus}
                onBlur={onBlur}
                className="outline-none font-extrabold tracking-tight bg-clip-text text-transparent text-4xl sm:text-5xl"
                style={{
                  fontFamily: theme?.fonts?.heading || 'var(--font-dm-sans), system-ui, sans-serif',
                  lineHeight: 1.1,
                  backgroundImage: gradientFromColor(primaryColor),
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
                dangerouslySetInnerHTML={{ __html: statValue }}
              />
              {statLabel && (
                <p
                  className="mt-1.5 text-sm font-medium tracking-wide opacity-80"
                  style={{
                    fontFamily: theme?.fonts?.body || 'var(--font-dm-sans), system-ui, sans-serif',
                    color: customColor?.startsWith('#') ? customColor : undefined,
                  }}
                >
                  {statLabel}
                </p>
              )}
            </div>
          );
        }

        // Regular paragraph with refined styling and consistent compact size
        return (
          <p
            ref={contentRef}
            contentEditable
            onInput={handleTextChange}
            onFocus={onFocus}
            onBlur={onBlur}
            className={cn(
              "outline-none transition-colors duration-200 [word-break:normal] [overflow-wrap:normal] [hyphens:none] whitespace-normal",
              compact ? "text-sm leading-relaxed" : "text-[1.02rem] leading-relaxed"
            )}
            style={{
              fontFamily: theme?.fonts?.body || 'var(--font-dm-sans), system-ui, sans-serif',
              color: customColor?.startsWith('#') ? customColor : undefined,
              textAlign,
              fontSize: uniformFontSize || customFontSize || undefined,
              opacity: blockStyle.opacity ? Number(blockStyle.opacity) : bodyOpacity,
              lineHeight: bodyLineHeight,
              maxWidth: compact || suppressCardChrome ? '100%' : readableWidth,
            }}
            dangerouslySetInnerHTML={{ __html: textContent }}
          />
        );
      }

      case "BULLET_LIST":
        return (
          <ul className={cn(compact ? 'space-y-2' : 'space-y-3', 'pl-1 max-w-full min-h-0')}>
            {keyedBulletItems.map(({ item, key }, i: number) => {
              return (
                <li
                  key={key}
                  className="flex items-start gap-2.5 group/item"
                >
                  <span
                    className="mt-2 w-2 h-2 rounded-full shrink-0"
                    style={{
                      background: gradientFromColor(primaryColor),
                    }}
                  />
                  <span
                    contentEditable
                    onInput={(e) => {
                      const items = [...bulletItems] as string[];
                      items[i] = (e.target as HTMLElement).innerText;
                      setContent({ ...content, items });
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className={cn(
                      'outline-none flex-1 min-w-0 [word-break:normal] [overflow-wrap:normal] [hyphens:none]',
                      compact ? 'text-sm leading-relaxed' : 'text-[0.98rem] leading-7',
                    )}
                    style={{
                      fontFamily: theme?.fonts?.body || 'var(--font-dm-sans), system-ui, sans-serif',
                      fontSize: uniformFontSize || undefined,
                      lineHeight: bodyLineHeight,
                      opacity: bodyOpacity,
                    }}
                    dangerouslySetInnerHTML={{ __html: item }}
                  />
                </li>
              );
            })}
          </ul>
        );

      case "NUMBERED_LIST":
        return (
          <ol className="space-y-4 pl-1 max-w-[42rem]">
            {keyedNumberedItems.map(({ item, key }, i: number) => {
              return (
                <li
                  key={key}
                  className="flex items-start gap-3 group/item transition-all duration-200 hover:translate-x-1"
                >
                  {/* Gradient number badge */}
                  <span
                    className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm"
                    style={{
                      background: gradientFromColor(primaryColor),
                      boxShadow: `0 2px 8px ${colorWithAlpha(primaryColor, 0.3)}`,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    contentEditable
                    onInput={(e) => {
                      const items = [...numberedItems] as string[];
                      items[i] = (e.target as HTMLElement).innerText;
                      setContent({ ...content, items });
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className="outline-none flex-1 pt-0.5 text-[1.02rem] leading-8"
                    style={{
                      fontFamily: theme?.fonts?.body || 'var(--font-dm-sans), system-ui, sans-serif',
                      lineHeight: bodyLineHeight,
                      opacity: bodyOpacity,
                    }}
                    dangerouslySetInnerHTML={{ __html: item }}
                  />
                </li>
              );
            })}
          </ol>
        );

      case "IMAGE": {
        const imageUrl =
          mediaUrlFromBlockContent(content, topicContext, blockIndex) ||
          (isValidMediaUrl(content?.url) ? String(content.url) : undefined);
        if (!imageUrl) {
          return (
            <div
              className={cn(
                'relative group/image w-full overflow-hidden',
                fillMedia ? 'h-full min-h-0 rounded-none' : 'min-h-[8rem] rounded-xl',
              )}
            >
              <BrandedMediaPlaceholder
                primary={primaryColor}
                secondary={secondaryColor}
              />
              {onChange && (
                <div className="absolute inset-x-0 bottom-0 p-2 opacity-0 group-hover/image:opacity-100 transition-opacity">
                  <ImageAIControls
                    imageUrl={undefined}
                    imageAlt={content?.alt || "Image"}
                    blockId={block.id}
                    slideId={block.slideId || ""}
                    projectId={block.projectId}
                    fillContainer={fillMedia}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    onImageUpdate={(newUrl, newAlt) => {
                      setContent({ ...content, url: newUrl, alt: newAlt || content?.alt });
                    }}
                    onDelete={onDelete}
                  />
                </div>
              )}
            </div>
          );
        }
        return (
          <div className={cn('relative group/image w-full min-h-0', fillMedia && 'h-full')}>
            <ImageAIControls
              imageUrl={imageUrl}
              imageAlt={content?.alt || "Image"}
              blockId={block.id}
              slideId={block.slideId || ""}
              projectId={block.projectId}
              fillContainer={fillMedia}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              onImageUpdate={(newUrl, newAlt) => {
                setContent({ ...content, url: newUrl, alt: newAlt || content?.alt });
              }}
              onDelete={onDelete}
            />
          </div>
        );
      }

      case "CODE":
        return (
          <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200/70 dark:border-slate-700/70">
            {/* Code header bar */}
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}
            >
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-slate-500 ml-2 font-mono">
                {content?.language || "code"}
              </span>
            </div>
            <pre
              className="p-5 overflow-x-auto bg-slate-950"
              style={{
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                background: '#0f172a',
                color: '#e2e8f0',
              }}
            >
              <code
                contentEditable
                onInput={(e) => {
                  setContent({ ...content, code: (e.target as HTMLElement).innerText });
                }}
                onFocus={onFocus}
                onBlur={onBlur}
                className="outline-none text-sm leading-7"
                dangerouslySetInnerHTML={{ __html: content?.code || "// Your code here" }}
              />
            </pre>
          </div>
        );

      case "QUOTE":
        return (
          <div
            className={cn(
              'relative rounded-2xl transition-all duration-300 max-w-[42rem] min-h-0 overflow-hidden',
              compact ? 'pl-4 py-3 pr-3' : 'pl-7 py-4 pr-5',
            )}
            style={{
              borderLeft: `4px solid ${accentColor}`,
              background: `linear-gradient(135deg, ${colorWithAlpha(accentColor, 0.06)}, ${colorWithAlpha(primaryColor, 0.03)})`,
            }}
          >
            <p
              contentEditable
              onInput={handleTextChange}
              onFocus={onFocus}
              onBlur={onBlur}
              className={cn(
                'outline-none italic relative z-10 min-h-0',
                compact
                  ? 'text-base leading-snug line-clamp-5'
                  : 'leading-[1.6] text-[clamp(1.05rem,1.8vw,1.35rem)]',
              )}
              style={{
                fontFamily: theme?.fonts?.body || "'Georgia', serif",
                textAlign,
                opacity: bodyOpacity,
              }}
              dangerouslySetInnerHTML={{ __html: content?.text || "Quote text..." }}
            />
            {content?.author && (
              <footer className="mt-2 text-sm font-medium flex items-center gap-2 relative z-10">
                <div
                  className="w-8 h-0.5 rounded-full"
                  style={{ background: accentColor }}
                />
                <span style={{ color: accentColor }}>{content.author}</span>
              </footer>
            )}
          </div>
        );

      case "DIVIDER":
        return (
          <div className="py-4 flex items-center gap-4">
            <div className="flex-1 h-px" style={{
              background: `linear-gradient(90deg, transparent, ${colorWithAlpha(primaryColor, 0.3)}, ${colorWithAlpha(accentColor, 0.3)}, transparent)`,
            }} />
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: gradientFromColor(primaryColor) }}
            />
            <div className="flex-1 h-px" style={{
              background: `linear-gradient(90deg, transparent, ${colorWithAlpha(accentColor, 0.3)}, ${colorWithAlpha(primaryColor, 0.3)}, transparent)`,
            }} />
          </div>
        );

      case "TABLE":
        return (
          <div className="tiptap-wrapper my-4 relative z-10 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 shadow-lg overflow-hidden bg-white/80 dark:bg-slate-900/70" onFocus={onFocus} onBlur={onBlur}>
            <RichTextEditor
              initialContent={content?.html as string}
              initialRows={content?.rows as string[][]}
              isEditable={isActive}
              onChange={(html) => {
                setContent({ ...content, html });
              }}
            />
          </div>
        );

      case "EMBED":
        return (
          <div className="aspect-video rounded-2xl overflow-hidden shadow-xl border border-slate-200/70 dark:border-slate-700/70">
            {content?.url ? (
              <iframe
                src={content.url}
                className="w-full h-full"
                allowFullScreen
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center gap-3"
                style={{
                  background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.05)}, ${colorWithAlpha(secondaryColor, 0.08)})`,
                  border: `2px dashed ${colorWithAlpha(primaryColor, 0.2)}`,
                }}
              >
                <div className="text-3xl">🔗</div>
                <span className="text-slate-500 text-sm">Click to add embed URL</span>
              </div>
            )}
          </div>
        );

      case "CHART": {
        const chartData = (block.chartData || block.content.chartData) as {
          type?: string;
          datasets?: Array<{
            data: number[];
            backgroundColor?: string | string[];
          }>;
          labels?: string[];
        } | undefined;

        return (
          <div className="p-2 rounded-xl" style={{
            background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.03)}, ${colorWithAlpha(secondaryColor, 0.02)})`,
          }}>
            <ChartBlock
              data={chartData ? {
                type: (chartData.type || 'bar') as 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea',
                data: chartData.datasets?.[0]?.data.map((val, i) => ({
                  label: chartData.labels?.[i] || `Item ${i}`,
                  value: val,
                  color: Array.isArray(chartData.datasets?.[0]?.backgroundColor)
                    ? (chartData.datasets[0].backgroundColor[i] || chartData.datasets[0].backgroundColor[0] || primaryColor)
                    : (chartData.datasets?.[0]?.backgroundColor as string) || primaryColor
                })) || [],
                title: typeof block.content.text === 'string' ? block.content.text : 'Chart',
              } : undefined}
              isEditable={isActive}
            />
          </div>
        );
      }

      case "STATISTIC": {
        const value = String(content?.value || content?.text || '95%');
        const label = String(content?.label || '');
        return (
          <div className="py-2 flex flex-col justify-center" style={{ textAlign }}>
            <p
              ref={contentRef}
              contentEditable
              onInput={handleTextChange}
              onFocus={onFocus}
              onBlur={onBlur}
              className="outline-none font-extrabold tracking-tight bg-clip-text text-transparent text-4xl sm:text-5xl"
              style={{
                fontFamily: theme?.fonts?.heading || 'var(--font-dm-sans), system-ui, sans-serif',
                lineHeight: 1.1,
                backgroundImage: gradientFromColor(primaryColor),
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
              dangerouslySetInnerHTML={{ __html: value }}
            />
            {label && (
              <p
                className="mt-1.5 text-sm font-medium tracking-wide opacity-80"
                style={{
                  fontFamily: theme?.fonts?.body || 'var(--font-dm-sans), system-ui, sans-serif',
                  color: customColor?.startsWith('#') ? customColor : undefined,
                }}
              >
                {label}
              </p>
            )}
          </div>
        );
      }

      case "BENTO_GRID":
        return <BentoGridBlock content={content} theme={theme} onChange={setContent} isEditing={isActive} />;
      case "TIMELINE":
        return <TimelineBlock content={content} theme={theme} onChange={setContent} isEditing={isActive} />;
      case "COMPARISON": {
        const comparisonItems = ((content?.items as string[]) || [
          "Option A: Fast and simple",
          "Option B: Powerful and flexible",
        ])
          .slice(0, 4)
          .map((text, idx) => ({ id: `cmp-${idx}`, text }));
        const maxItemLen = Math.max(...comparisonItems.map((c) => c.text.length), 0);
        const stackVertically = comparisonItems.length === 3 || maxItemLen > 45;
        const isFourCards = comparisonItems.length === 4 && !stackVertically;
        return (
          <div
            className={cn(
              "grid gap-3 min-h-0 items-stretch w-full",
              stackVertically
                ? "grid-cols-1"
                : isFourCards
                  ? "grid-cols-2"
                  : comparisonItems.length >= 3
                    ? "grid-cols-3"
                    : "grid-cols-2"
            )}
          >
            {comparisonItems.map((entry, i) => {
              const colors = [primaryColor, accentColor, secondaryColor, '#f59e0b'];
              const color = colors[i % colors.length];
              return (
                <div
                  key={entry.id}
                  className={cn(
                    'rounded-2xl relative overflow-hidden min-h-0',
                    stackVertically
                      ? 'flex flex-row items-start gap-3.5 p-3.5 sm:p-4'
                      : 'flex flex-col justify-start p-4',
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${colorWithAlpha(color, 0.08)}, ${colorWithAlpha(color, 0.03)})`,
                    border: `1px solid ${colorWithAlpha(color, 0.15)}`,
                  }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-b"
                    style={{ background: gradientFromColor(color, '90deg') }}
                  />
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0',
                      stackVertically ? 'mt-0.5' : 'mb-2',
                    )}
                    style={{ background: gradientFromColor(color) }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                  <p
                    contentEditable
                    onInput={(e) => {
                      const items = [...comparisonItems];
                      items[i].text = (e.target as HTMLElement).innerText;
                      const stringItems = items.map((o) => o.text);
                      setContent({ ...content, items: stringItems });
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className="outline-none font-medium min-h-0 flex-1 min-w-0 text-sm sm:text-[0.95rem] leading-relaxed [word-break:normal] [overflow-wrap:normal] [hyphens:none] whitespace-normal"
                    style={{
                      fontFamily: theme?.fonts?.body || 'var(--font-dm-sans), system-ui, sans-serif',
                      fontSize: uniformFontSize || undefined,
                      lineHeight: bodyLineHeight,
                      opacity: bodyOpacity,
                    }}
                    dangerouslySetInnerHTML={{ __html: entry.text }}
                  />
                </div>
              );
            })}
          </div>
        );
      }

      case "STATS_GRID": {
        type StatItem = { value?: string; label?: string; text?: string };
        const rawItems = (content?.stats as Array<StatItem> | undefined) ||
          (content?.items as Array<string | StatItem> | undefined) ||
          [];
        const statsItems = (rawItems.length
          ? rawItems
          : ["Named proof point", "Specific outcome", "Measurable change"]
        ).map((item, idx) => {
          if (typeof item === 'string') {
            return { id: `stat-${idx}`, value: item, label: '' };
          }
          return {
            id: `stat-${idx}`,
            value: item.value || item.text || '',
            label: item.label || '',
          };
        });
        return (
          <div className="grid grid-cols-3 gap-4">
            {statsItems.map((entry, i) => {
              const colors = [primaryColor, accentColor, secondaryColor, '#f59e0b'];
              const color = colors[i % colors.length];
              return (
                <div
                  key={entry.id}
                  className="relative p-6 rounded-2xl text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden group/stat"
                  style={{
                    background: `linear-gradient(135deg, ${colorWithAlpha(color, 0.06)}, ${colorWithAlpha(color, 0.02)})`,
                    border: `1px solid ${colorWithAlpha(color, 0.12)}`,
                  }}
                >
                  <div
                    className="absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-10 group-hover/stat:opacity-20 transition-opacity"
                    style={{ background: gradientFromColor(color) }}
                  />
                  <p
                    className="text-3xl font-extrabold outline-none relative z-10 tracking-tight"
                    style={{
                      fontFamily: theme?.fonts?.heading || 'var(--font-dm-sans), system-ui, sans-serif',
                      color,
                      lineHeight: 1.1,
                    }}
                  >
                    {entry.value}
                  </p>
                  {entry.label ? (
                    <p className="mt-2 text-sm relative z-10" style={{ opacity: 0.72 }}>
                      {entry.label}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      }

      case "CALL_TO_ACTION": {
        const ctaText = content?.text || "Get Started Today";
        if (suppressCardChrome) {
          return (
            <p
              ref={contentRef}
              contentEditable
              onInput={handleTextChange}
              onFocus={onFocus}
              onBlur={onBlur}
              className="outline-none font-medium [word-break:normal] [overflow-wrap:normal] [hyphens:none] whitespace-normal text-sm leading-relaxed"
              style={{
                fontFamily: theme?.fonts?.body || 'var(--font-dm-sans), system-ui, sans-serif',
                fontSize: uniformFontSize || undefined,
                lineHeight: bodyLineHeight,
                opacity: bodyOpacity,
              }}
              dangerouslySetInnerHTML={{ __html: ctaText }}
            />
          );
        }
        return (
          <div
            className={cn(
              'relative text-center overflow-hidden w-full h-full flex items-center justify-center mx-auto min-h-0',
              compact ? 'p-4 rounded-2xl' : 'p-5 rounded-2xl',
            )}
            style={{
              background: gradientFromColor(primaryColor),
              boxShadow: `0 8px 24px ${colorWithAlpha(primaryColor, 0.25)}`,
            }}
          >
            <p
              ref={contentRef}
              contentEditable
              onInput={handleTextChange}
              onFocus={onFocus}
              onBlur={onBlur}
              className={cn(
                'font-bold text-white outline-none relative z-10 drop-shadow-sm leading-snug w-full max-w-full [word-break:normal] [overflow-wrap:normal] [hyphens:none] px-1',
                compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg',
              )}
              style={{
                fontFamily: theme?.fonts?.heading || 'var(--font-dm-sans), system-ui, sans-serif',
                fontSize: uniformFontSize || undefined,
              }}
              dangerouslySetInnerHTML={{ __html: ctaText }}
            />
          </div>
        );
      }

      case "OEMBED": {
        return (
          <OEmbedBlock
            embedUrl={content?.embedUrl as string}
            embedHtml={content?.embedHtml as string}
            embedType={content?.embedType as EmbedServiceType}
            embedAspectRatio={content?.embedAspectRatio as string}
            isEditing={isActive}
            onUpdate={(data) => {
              setContent({ ...content, ...data });
            }}
          />
        );
      }

      case "SHAPE": {
        const svgContent = content?.svg as string;
        const shapeColor = content?.shapeColor as string || primaryColor;
        if (svgContent) {
          // Inject color into the SVG by replacing 'currentColor'
          const colorizedSvg = svgContent.replace(/currentColor/g, shapeColor);
          return (
            <div
              className="flex items-center justify-center p-2"
              dangerouslySetInnerHTML={{ __html: colorizedSvg }}
            />
          );
        }
        return (
          <div
            className="w-full aspect-square max-w-30 mx-auto rounded-lg"
            style={{ backgroundColor: shapeColor, opacity: 0.2 }}
          />
        );
      }

      case "3D_MODEL": {
        return (
          <div className="h-64 sm:h-80 md:h-96 w-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl bg-black/5 dark:bg-white/5 backdrop-blur-md border border-black/10 dark:border-white/10 group-hover:shadow-blue-500/20 transition-all duration-300">
            <ThreeDBlock
              modelUrl={content?.url as string}
              autoRotate
              environment="sunset"
            />
          </div>
        );
      }

      default:
        return (
          <p className="text-slate-500 italic p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-600">
            Unknown block type: {blockType}
          </p>
        );
    }
  };



  return (
    <motion.div
      ref={setNodeRef}
      style={{
        ...style,
      }}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className={cn(
        "group relative transition-shadow duration-300",
        fillMedia ? "h-full min-h-0 rounded-none w-full" : "rounded-xl",
        isActive
          ? "ring-2 ring-blue-500/70 shadow-lg shadow-blue-500/10"
          : "hover:ring-1 hover:ring-slate-300/80 hover:shadow-md",
        isDragging ? "opacity-50 scale-[0.98] z-50" : ""
      )}
    >
      {/* Controls */}
      <div className="absolute -left-9 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
        <div
          {...attributes}
          {...listeners}
          className="h-7 w-7 rounded-lg bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-grab hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <GripVertical className="h-4 w-4 text-slate-400" />
        </div>
      </div>

      <div className="absolute -right-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
              <MoreHorizontal className="h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Block content */}
      <div className={cn("w-full min-w-0", fillMedia ? "h-full min-h-0 p-0" : suppressCardChrome ? "p-0.5" : "p-1.5")}>
        {renderBlockContent()}
      </div>
    </motion.div>
  );
});

BlockRenderer.displayName = "BlockRenderer";

export default BlockRenderer;
