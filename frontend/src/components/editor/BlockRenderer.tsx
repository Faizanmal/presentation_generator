"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useRef, useEffect } from "react";
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

interface BlockRendererProps {
  block: Block;
  theme?: Theme;
  isActive: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (content: Record<string, unknown>) => void;
  onDelete: () => void;
}

export default function BlockRenderer({
  block,
  theme,
  isActive,
  onFocus,
  onBlur,
  onChange,
  onDelete,
}: BlockRendererProps) {
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

  // Render based on block type
  const renderBlockContent = () => {
    // Support both 'type' and 'blockType' properties for compatibility
    const blockType = (block.type || block.blockType)?.toUpperCase();

    switch (blockType) {
      case "HEADING":
        return (
          <h1
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleTextChange}
            onFocus={onFocus}
            onBlur={onBlur}
            className="text-4xl font-bold outline-none"
            style={{
              fontFamily: theme?.fonts?.heading || "system-ui",
              color: primaryColor,
            }}
          >
            {content?.text || "Heading"}
          </h1>
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
            className="text-2xl font-semibold outline-none"
            style={{ fontFamily: theme?.fonts?.heading || "system-ui" }}
          >
            {content?.text || "Subheading"}
          </h2>
        );

      case "PARAGRAPH":
        const isCard = block.formatting?.variant === 'card';
        return (
          <div className={isCard ? "bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700" : ""}>
            <p
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleTextChange}
              onFocus={onFocus}
              onBlur={onBlur}
              className={`text-lg leading-relaxed outline-none ${block.formatting?.color ? `text-${block.formatting.color}` : ""}`}
              style={{
                fontFamily: theme?.fonts?.body || "system-ui",
                color: block.formatting?.color && block.formatting.color.startsWith('#') ? block.formatting.color : undefined
              }}
            >
              {content?.text || "Start typing..."}
            </p>
          </div>
        );

      case "BULLET_LIST":
        const bulletItems = content?.items || ["Item 1", "Item 2", "Item 3"];
        const keyedBulletItems = buildKeyedTextItems(bulletItems, "bullet");
        return (
          <ul className="list-disc list-inside space-y-2">
            {keyedBulletItems.map(({ item, key }, i: number) => {
                return (
                  <li
                    key={key}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const items = [...bulletItems] as string[];
                      items[i] = (e.target as HTMLElement).innerText;
                      setContent({ ...content, items });
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className="text-lg outline-none"
                    style={{ fontFamily: theme?.fonts?.body || "system-ui" }}
                  >
                    {item}
                  </li>
                );
              })}
          </ul>
        );

      case "NUMBERED_LIST":
        const numberedItems = content?.items || ["Item 1", "Item 2", "Item 3"];
        const keyedNumberedItems = buildKeyedTextItems(numberedItems, "numbered");
        return (
          <ol className="list-decimal list-inside space-y-2">
            {keyedNumberedItems.map(({ item, key }, i: number) => {
                return (
                  <li
                    key={key}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const items = [...numberedItems] as string[];
                      items[i] = (e.target as HTMLElement).innerText;
                      setContent({ ...content, items });
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className="text-lg outline-none"
                    style={{ fontFamily: theme?.fonts?.body || "system-ui" }}
                  >
                    {item}
                  </li>
                );
              })}
          </ol>
        );

      case "IMAGE":
        return (
          <div className="relative">
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
              <div className="aspect-video bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                <span className="text-slate-500">Click to add image</span>
              </div>
            )}
          </div>
        );

      case "CODE":
        return (
          <pre
            className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto"
            style={{ fontFamily: "monospace" }}
          >
            <code
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                setContent({ ...content, code: (e.target as HTMLElement).innerText });
              }}
              onFocus={onFocus}
              onBlur={onBlur}
              className="outline-none"
            >
              {content?.code || "// Your code here"}
            </code>
          </pre>
        );

      case "QUOTE":
        return (
          <blockquote
            className="border-l-4 pl-4 italic"
            style={{ borderColor: accentColor }}
          >
            <p
              contentEditable
              suppressContentEditableWarning
              onInput={handleTextChange}
              onFocus={onFocus}
              onBlur={onBlur}
              className="text-xl outline-none"
              style={{ fontFamily: theme?.fonts?.body || "system-ui" }}
            >
              {content?.text || "Quote text..."}
            </p>
            {content?.author && (
              <footer className="mt-2 text-sm text-slate-500">
                — {content.author}
              </footer>
            )}
          </blockquote>
        );

      case "DIVIDER":
        return (
          <hr
            className="my-4"
            style={{ borderColor: theme?.colors?.secondary || "#e2e8f0" }}
          />
        );

      case "TABLE":
        const rows = content?.rows || [
          ["Header 1", "Header 2", "Header 3"],
          ["Cell 1", "Cell 2", "Cell 3"],
          ["Cell 4", "Cell 5", "Cell 6"],
        ];
        const seenRows = new Map<string, number>();
        const keyedRows = rows.map((row) => {
          const rowSignature = normalizeKeyPart(row.join("|"));
          const rowCount = (seenRows.get(rowSignature) || 0) + 1;
          seenRows.set(rowSignature, rowCount);

          const seenCells = new Map<string, number>();
          const cells = row.map((cell) => {
            const cellSignature = normalizeKeyPart(cell);
            const cellCount = (seenCells.get(cellSignature) || 0) + 1;
            seenCells.set(cellSignature, cellCount);
            return { value: cell, key: `cell-${cellSignature}-${cellCount}` };
          });

          return { row, cells, key: `row-${rowSignature}-${rowCount}` };
        });
        return (
          <table className="w-full border-collapse">
            <tbody>
              {keyedRows.map(({ cells, key: rowKey }, rowIndex: number) => {
                return (
                  <tr key={rowKey}>
                    {cells.map(({ value, key: cellKey }, cellIndex: number) => {
                      return (
                        <td
                          key={`${rowKey}-${cellKey}`}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={(e) => {
                            const newRows = [...rows] as string[][];
                            newRows[rowIndex][cellIndex] = (e.target as HTMLElement).innerText;
                            setContent({ ...content, rows: newRows });
                          }}
                          onFocus={onFocus}
                          onBlur={onBlur}
                          className={`border p-2 outline-none ${rowIndex === 0 ? "font-semibold bg-slate-100 dark:bg-slate-800" : ""
                            }`}
                          style={{
                            borderColor: theme?.colors?.secondary || "#e2e8f0",
                            fontFamily: theme?.fonts?.body || "system-ui",
                          }}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table >
        );

      case "EMBED":
        return (
          <div className="aspect-video bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
            {content?.url ? (
              <iframe
                src={content.url}
                className="w-full h-full rounded-lg"
                allowFullScreen
              />
            ) : (
              <span className="text-slate-500">Click to add embed URL</span>
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
          <ChartBlock
            data={chartData ? {
              type: (chartData.type || 'bar') as 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea',
              data: chartData.datasets?.[0]?.data.map((val, i) => ({
                label: chartData.labels?.[i] || `Item ${i}`,
                value: val,
                color: Array.isArray(chartData.datasets?.[0]?.backgroundColor)
                  ? chartData.datasets[0].backgroundColor[0]
                  : (chartData.datasets?.[0]?.backgroundColor as string) || '#3b82f6'
              })) || [],
              title: typeof block.content.text === 'string' ? block.content.text : 'Chart',
            } : undefined}
            isEditable={isActive}
          />
        );
      }

      default:
        return (
          <p className="text-slate-500">Unknown block type: {blockType}</p>
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg transition-all ${isActive
        ? "ring-2 ring-blue-500"
        : "hover:ring-1 hover:ring-slate-300"
        } ${isDragging ? "opacity-50" : ""}`}
    >
      {/* Controls */}
      <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div
          {...attributes}
          {...listeners}
          className="h-6 w-6 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center cursor-grab hover:bg-slate-300 dark:hover:bg-slate-600"
        >
          <GripVertical className="h-4 w-4 text-slate-500" />
        </div>
      </div>

      <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-4 w-4" />
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
      <div className="p-2">{renderBlockContent()}</div>
    </div>
  );
}
