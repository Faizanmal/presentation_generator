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
import { ChartBlock } from "./chart-block";
import { ImageAIControls } from "./image-ai-controls";
import RichTextEditor from "./RichTextEditor";
import { OEmbedBlock } from "./oembed-block";
import type { EmbedServiceType } from "./oembed-block";

interface BlockRendererProps {
  block: Block;
  theme?: Theme;
  isActive: boolean;
  blockIndex?: number; // For stagger animation
  onFocus: () => void;
  onBlur: () => void;
  onChange: (content: Record<string, unknown>) => void;
  onDelete: () => void;
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
        onChange(content);
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

  const bulletItems = useMemo(() => (content?.items as string[]) || ["Item 1", "Item 2", "Item 3"], [content?.items]);
  const keyedBulletItems = useMemo(() => buildKeyedTextItems(bulletItems, "bullet"), [bulletItems]);

  const numberedItems = useMemo(() => (content?.items as string[]) || ["Item 1", "Item 2", "Item 3"], [content?.items]);
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
  const customFontSize = blockStyle.fontSize;
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
            {/* Decorative accent bar */}
            <div
              className="absolute -left-4 top-1 bottom-1 w-1 rounded-full opacity-80"
              style={{ background: gradientFromColor(primaryColor, '180deg') }}
            />
            <h1
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleTextChange}
              onFocus={onFocus}
              onBlur={onBlur}
              className="text-4xl font-bold outline-none leading-tight tracking-tight transition-all duration-200"
              style={{
                fontFamily: theme?.fonts?.heading || "'Inter', system-ui",
                color: customColor?.startsWith('#') ? customColor : primaryColor,
                textAlign,
                fontSize: customFontSize || undefined,
                textShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              {content?.text || "Heading"}
            </h1>
          </div>
        );

      case "SUBHEADING":
        return (
          <h2
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleTextChange}
            onFocus={onFocus}
            onBlur={onBlur}
            className="text-2xl font-semibold outline-none leading-snug transition-all duration-200"
            style={{
              fontFamily: theme?.fonts?.heading || "'Inter', system-ui",
              color: customColor?.startsWith('#') ? customColor : undefined,
              textAlign,
              fontSize: customFontSize || undefined,
              opacity: 0.9,
            }}
          >
            {content?.text || "Subheading"}
          </h2>
        );

      case "PARAGRAPH": {
        const variant = blockStyle.variant || block.formatting?.variant;
        const isCard = variant === 'card';
        const isIconText = variant === 'icon-text';
        const textContent = content?.text || "Start typing...";

        // Card variant - glassmorphism style
        if (isCard) {
          return (
            <div
              className="relative p-5 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              style={{
                background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.08)}, ${colorWithAlpha(secondaryColor, 0.06)})`,
                backdropFilter: 'blur(8px)',
                border: `1px solid ${colorWithAlpha(primaryColor, 0.15)}`,
              }}
            >
              {/* Decorative corner accent */}
              <div
                className="absolute top-0 right-0 w-16 h-16 opacity-20 rounded-bl-full"
                style={{ background: gradientFromColor(accentColor) }}
              />
              <p
                ref={contentRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleTextChange}
                onFocus={onFocus}
                onBlur={onBlur}
                className="text-lg leading-relaxed outline-none relative z-10 font-medium"
                style={{
                  fontFamily: theme?.fonts?.body || "'Inter', system-ui",
                  color: customColor?.startsWith('#') ? customColor : undefined,
                  textAlign,
                }}
              >
                {textContent}
              </p>
            </div>
          );
        }

        // Icon-text variant
        if (isIconText) {
          return (
            <div className="flex items-start gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl shadow-sm"
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
                suppressContentEditableWarning
                onInput={handleTextChange}
                onFocus={onFocus}
                onBlur={onBlur}
                className="text-lg leading-relaxed outline-none flex-1 pt-1.5"
                style={{
                  fontFamily: theme?.fonts?.body || "'Inter', system-ui",
                  color: customColor?.startsWith('#') ? customColor : undefined,
                }}
              >
                {textContent}
              </p>
            </div>
          );
        }

        // Check if this looks like a big stat number (e.g., "98%", "$1.5M")
        const isBigStat = /^[\d$€£¥%.,MBKmkb+\-\s]+$/.test(textContent.trim()) && textContent.trim().length < 12;

        if (isBigStat) {
          return (
            <div className="py-3" style={{ textAlign }}>
              <p
                ref={contentRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleTextChange}
                onFocus={onFocus}
                onBlur={onBlur}
                className="outline-none font-extrabold tracking-tight bg-clip-text text-transparent"
                style={{
                  fontFamily: theme?.fonts?.heading || "'Inter', system-ui",
                  fontSize: customFontSize || '3.5rem',
                  lineHeight: 1.1,
                  backgroundImage: gradientFromColor(primaryColor),
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {textContent}
              </p>
            </div>
          );
        }

        // Regular paragraph with refined styling
        return (
          <p
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleTextChange}
            onFocus={onFocus}
            onBlur={onBlur}
            className="text-lg leading-relaxed outline-none transition-colors duration-200"
            style={{
              fontFamily: theme?.fonts?.body || "'Inter', system-ui",
              color: customColor?.startsWith('#') ? customColor : undefined,
              textAlign,
              fontSize: customFontSize || undefined,
              opacity: blockStyle.opacity ? Number(blockStyle.opacity) : undefined,
            }}
          >
            {textContent}
          </p>
        );
      }

      case "BULLET_LIST":
        return (
          <ul className="space-y-3 pl-1">
            {keyedBulletItems.map(({ item, key }, i: number) => {
              return (
                <li
                  key={key}
                  className="flex items-start gap-3 group/item transition-all duration-200 hover:translate-x-0.5"
                >
                  {/* Custom gradient bullet */}
                  <span
                    className="mt-2 w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                    style={{
                      background: gradientFromColor(primaryColor),
                      boxShadow: `0 0 8px ${colorWithAlpha(primaryColor, 0.3)}`,
                    }}
                  />
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const items = [...bulletItems] as string[];
                      items[i] = (e.target as HTMLElement).innerText;
                      setContent({ ...content, items });
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className="text-lg outline-none flex-1 leading-relaxed"
                    style={{ fontFamily: theme?.fonts?.body || "'Inter', system-ui" }}
                  >
                    {item}
                  </span>
                </li>
              );
            })}
          </ul>
        );

      case "NUMBERED_LIST":
        return (
          <ol className="space-y-3 pl-1">
            {keyedNumberedItems.map(({ item, key }, i: number) => {
              return (
                <li
                  key={key}
                  className="flex items-start gap-3 group/item transition-all duration-200 hover:translate-x-0.5"
                >
                  {/* Gradient number badge */}
                  <span
                    className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm"
                    style={{
                      background: gradientFromColor(primaryColor),
                      boxShadow: `0 2px 8px ${colorWithAlpha(primaryColor, 0.3)}`,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const items = [...numberedItems] as string[];
                      items[i] = (e.target as HTMLElement).innerText;
                      setContent({ ...content, items });
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className="text-lg outline-none flex-1 leading-relaxed pt-0.5"
                    style={{ fontFamily: theme?.fonts?.body || "'Inter', system-ui" }}
                  >
                    {item}
                  </span>
                </li>
              );
            })}
          </ol>
        );

      case "IMAGE":
        return (
          <div className="relative group/image">
            <ImageAIControls
              imageUrl={content?.url}
              imageAlt={content?.alt || "Image"}
              blockId={block.id}
              slideId={block.slideId || ""}
              projectId={block.projectId}
              onImageUpdate={(newUrl, newAlt) => {
                setContent({ ...content, url: newUrl, alt: newAlt || content?.alt });
              }}
              onDelete={onDelete}
            />
            {!content?.url && (
              <div
                className="aspect-video rounded-xl flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:shadow-lg cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.05)}, ${colorWithAlpha(secondaryColor, 0.08)})`,
                  border: `2px dashed ${colorWithAlpha(primaryColor, 0.25)}`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.1)}, ${colorWithAlpha(accentColor, 0.1)})`,
                  }}
                >
                  🖼️
                </div>
                <span className="text-slate-500 text-sm font-medium">Click to add image</span>
              </div>
            )}
          </div>
        );

      case "CODE":
        return (
          <div className="rounded-xl overflow-hidden shadow-lg">
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
              className="p-5 overflow-x-auto"
              style={{
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                background: '#0f172a',
                color: '#e2e8f0',
              }}
            >
              <code
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  setContent({ ...content, code: (e.target as HTMLElement).innerText });
                }}
                onFocus={onFocus}
                onBlur={onBlur}
                className="outline-none text-sm leading-relaxed"
              >
                {content?.code || "// Your code here"}
              </code>
            </pre>
          </div>
        );

      case "QUOTE":
        return (
          <div
            className="relative pl-6 py-4 pr-4 rounded-r-xl transition-all duration-300"
            style={{
              borderLeft: `4px solid ${accentColor}`,
              background: `linear-gradient(135deg, ${colorWithAlpha(accentColor, 0.06)}, ${colorWithAlpha(primaryColor, 0.03)})`,
            }}
          >
            {/* Large decorative quote mark */}
            <div
              className="absolute -top-2 left-4 text-6xl font-serif leading-none opacity-15 select-none"
              style={{ color: accentColor }}
            >
              &ldquo;
            </div>

            <p
              contentEditable
              suppressContentEditableWarning
              onInput={handleTextChange}
              onFocus={onFocus}
              onBlur={onBlur}
              className="text-xl outline-none italic leading-relaxed relative z-10"
              style={{
                fontFamily: theme?.fonts?.body || "'Georgia', serif",
                textAlign,
              }}
            >
              {content?.text || "Quote text..."}
            </p>
            {content?.author && (
              <footer className="mt-3 text-sm font-medium flex items-center gap-2 relative z-10">
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
          <div className="tiptap-wrapper my-4 relative z-10" onFocus={onFocus} onBlur={onBlur}>
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
          <div className="aspect-video rounded-xl overflow-hidden shadow-lg">
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

      case "TIMELINE": {
        const timelineItems = (content?.items as string[]) || ["Phase 1: Planning", "Phase 2: Development", "Phase 3: Launch"];
        const keyedTimelineItems = buildKeyedTextItems(timelineItems, "timeline");
        return (
          <div className="relative pl-8">
            {/* Vertical line */}
            <div
              className="absolute left-3 top-2 bottom-2 w-0.5 rounded-full"
              style={{ background: `linear-gradient(180deg, ${primaryColor}, ${colorWithAlpha(accentColor, 0.3)})` }}
            />
            <div className="space-y-5">
              {keyedTimelineItems.map(({ item, key }, i: number) => (
                <div key={key} className="relative flex items-start gap-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                  {/* Timeline dot */}
                  <div
                    className="absolute -left-5 mt-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-md flex-shrink-0 z-10"
                    style={{
                      background: gradientFromColor(i === 0 ? primaryColor : accentColor),
                      boxShadow: `0 0 0 3px ${colorWithAlpha(i === 0 ? primaryColor : accentColor, 0.2)}`,
                    }}
                  />
                  {/* Timeline content */}
                  <div
                    className="flex-1 p-4 rounded-xl transition-all duration-200 hover:shadow-md"
                    style={{
                      background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.04)}, ${colorWithAlpha(secondaryColor, 0.02)})`,
                      border: `1px solid ${colorWithAlpha(primaryColor, 0.1)}`,
                    }}
                  >
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => {
                        const items = [...timelineItems] as string[];
                        items[i] = (e.target as HTMLElement).innerText;
                        setContent({ ...content, items });
                      }}
                      onFocus={onFocus}
                      onBlur={onBlur}
                      className="text-base font-medium outline-none"
                      style={{ fontFamily: theme?.fonts?.body || "'Inter', system-ui" }}
                    >
                      {item}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "COMPARISON": {
        const comparisonItems = ((content?.items as string[]) || [
          "Option A: Fast and simple",
          "Option B: Powerful and flexible",
        ]).map((text, idx) => ({ id: text || `cmp-${idx}`, text }));
        return (
          <div className="grid grid-cols-2 gap-4">
            {comparisonItems.map((entry, i) => {
              const colors = [primaryColor, accentColor, secondaryColor];
              const color = colors[i % colors.length];
              return (
                <div
                  key={entry.id}
                  className="p-5 rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${colorWithAlpha(color, 0.08)}, ${colorWithAlpha(color, 0.03)})`,
                    border: `1px solid ${colorWithAlpha(color, 0.15)}`,
                  }}
                >
                  {/* Top accent line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-b"
                    style={{ background: gradientFromColor(color, '90deg') }}
                  />
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold mb-3 shadow-sm"
                    style={{ background: gradientFromColor(color) }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const items = [...comparisonItems];
                      items[i].text = (e.target as HTMLElement).innerText;
                      const stringItems = items.map((o) => o.text);
                      setContent({ ...content, items: stringItems });
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className="text-base leading-relaxed outline-none font-medium"
                    style={{ fontFamily: theme?.fonts?.body || "'Inter', system-ui" }}
                  >
                    {entry.text}
                  </p>
                </div>
              );
            })}
          </div>
        );
      }

      case "STATS_GRID": {
        const statsItems = ((content?.items as string[]) || [
          "📊 98% Accuracy",
          "⚡ 2x Faster",
          "🎯 500+ Users",
          "💰 $1.2M Saved",
        ]).map((text, idx) => ({ id: text || `stat-${idx}`, text }));
        return (
          <div className="grid grid-cols-2 gap-3">
            {statsItems.map((entry, i) => {
              const colors = [primaryColor, accentColor, secondaryColor, '#f59e0b'];
              const color = colors[i % colors.length];
              return (
                <div
                  key={entry.id}
                  className="relative p-5 rounded-xl text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden group/stat"
                  style={{
                    background: `linear-gradient(135deg, ${colorWithAlpha(color, 0.06)}, ${colorWithAlpha(color, 0.02)})`,
                    border: `1px solid ${colorWithAlpha(color, 0.12)}`,
                  }}
                >
                  {/* Decorative ring */}
                  <div
                    className="absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-10 group-hover/stat:opacity-20 transition-opacity"
                    style={{ background: gradientFromColor(color) }}
                  />
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const items = [...statsItems];
                      items[i].text = (e.target as HTMLElement).innerText;
                      const stringItems = items.map((o) => o.text);
                      setContent({ ...content, items: stringItems });
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className="text-lg font-bold outline-none relative z-10"
                    style={{ fontFamily: theme?.fonts?.heading || "'Inter', system-ui" }}
                  >
                    {entry.text}
                  </p>
                </div>
              );
            })}
          </div>
        );
      }

      case "CALL_TO_ACTION": {
        const ctaText = content?.text || "🚀 Get Started Today";
        return (
          <div
            className="relative p-8 rounded-2xl text-center overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            style={{
              background: gradientFromColor(primaryColor),
              boxShadow: `0 8px 32px ${colorWithAlpha(primaryColor, 0.3)}`,
            }}
          >
            {/* Animated shimmer overlay */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`,
                backgroundSize: '200% 100%',
                animation: 'gradient-shimmer 3s linear infinite',
              }}
            />
            {/* Decorative circles */}
            <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full bg-white/10" />
            <p
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleTextChange}
              onFocus={onFocus}
              onBlur={onBlur}
              className="text-2xl font-bold text-white outline-none relative z-10 drop-shadow-sm"
              style={{ fontFamily: theme?.fonts?.heading || "'Inter', system-ui" }}
            >
              {ctaText}
            </p>
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
            className="w-full aspect-square max-w-[120px] mx-auto rounded-lg"
            style={{ backgroundColor: shapeColor, opacity: 0.2 }}
          />
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

  // Stagger animation delay based on block order
  const animDelay = Math.min(blockIndex * 0.06, 0.5);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        animationDelay: `${animDelay}s`,
      }}
      className={`group relative rounded-xl transition-all duration-300 animate-fade-in-up ${isActive
        ? "ring-2 ring-blue-500/70 shadow-lg shadow-blue-500/10"
        : "hover:ring-1 hover:ring-slate-300/80 hover:shadow-md"
        } ${isDragging ? "opacity-50 scale-[0.98]" : ""}`}
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
      <div className="p-3">{renderBlockContent()}</div>
    </div>
  );
});

BlockRenderer.displayName = "BlockRenderer";

export default BlockRenderer;
