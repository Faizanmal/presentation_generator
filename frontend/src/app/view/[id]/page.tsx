"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Maximize,
  Minimize,
  Loader2,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Slide, Theme, Block } from "@/types";
import Image from "next/image";
import ChartBlock from "@/components/editor/chart-block";

export default function PresentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Fetch project (try with token first, then by share token)
  const { data: project, isLoading } = useQuery({
    queryKey: ["present", projectId],
    queryFn: async () => {
      try {
        return await api.projects.getById(projectId);
      } catch {
        // Try as share token
        return await api.projects.getByShareToken(projectId);
      }
    },
  });

  // Hide controls after inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const prevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  }, [currentSlideIndex]);

  const nextSlide = useCallback(() => {
    if (project?.slides && currentSlideIndex < project.slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  }, [currentSlideIndex, project]);

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "Escape") {
        if (isFullscreen) {
          exitFullscreen();
        } else {
          router.back();
        }
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "Home") {
        setCurrentSlideIndex(0);
      } else if (e.key === "End") {
        setCurrentSlideIndex((project?.slides?.length || 1) - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [project, isFullscreen, router, nextSlide, prevSlide]);



  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-xl mb-4">Presentation not found</p>
          <Button variant="outline" onClick={() => router.push("/")}>
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const currentSlide = project.slides?.[currentSlideIndex];
  const theme = project.theme;

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
      {/* Slide content */}
      {currentSlide && (
        <SlideView slide={currentSlide} theme={theme || undefined} />
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"
          }`}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-linear-to-b from-black/50 to-transparent flex items-center justify-between px-4 pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => router.back()}
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="text-white text-sm">
            {project.title}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize className="h-5 w-5" />
            ) : (
              <Maximize className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-linear-to-t from-black/50 to-transparent flex items-center justify-center gap-4 pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={prevSlide}
            disabled={currentSlideIndex === 0}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>

          <div className="flex items-center gap-2">
            {project.slides?.map((slide) => (
              <button

                key={slide.id}
                onClick={() => setCurrentSlideIndex(project.slides?.indexOf(slide) || 0)}
                className={`h-2 w-2 rounded-full transition-all ${project.slides?.indexOf(slide) === currentSlideIndex
                  ? "bg-white w-4"
                  : "bg-white/50 hover:bg-white/80"
                  }`}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={nextSlide}
            disabled={currentSlideIndex === (project.slides?.length || 1) - 1}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </div>

        {/* Slide number */}
        <div className="absolute bottom-4 right-4 text-white/60 text-sm pointer-events-none">
          {currentSlideIndex + 1} / {project.slides?.length || 0}
        </div>
      </div>

      {/* Click to navigate */}
      <div className="absolute inset-0 flex">
        <div
          className="w-1/3 cursor-pointer"
          onClick={prevSlide}
        />
        <div className="w-1/3" />
        <div
          className="w-1/3 cursor-pointer"
          onClick={nextSlide}
        />
      </div>
    </div>
  );
}

// Slide View Component
function SlideView({ slide, theme }: { slide: Slide; theme?: Theme }) {
  const bgColor = (theme?.colors as Theme['colors'] | undefined)?.background || "#ffffff";
  const textColor = (theme?.colors as Theme['colors'] | undefined)?.text || "#1f2937";


  // Sort blocks by order
  const sortedBlocks = [...(slide.blocks || [])].sort((a, b) => a.order - b.order);

  return (
    <div
      className="w-full h-full max-w-[90vw] max-h-[90vh] aspect-16/10 rounded-lg shadow-2xl overflow-hidden"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        fontFamily: (theme?.fonts as Theme['fonts'] | undefined)?.body || "system-ui",
      }}
    >
      <div className="h-full p-12 overflow-y-auto flex flex-col justify-center">
        <div className="space-y-6">
          {sortedBlocks.map((block) => (
            <BlockView
              key={block.id}
              block={block}
              theme={theme}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Block View Component (read-only)
function BlockView({ block, theme }: { block: Block; theme?: Theme }) {
  const primaryColor = (theme?.colors as Theme['colors'] | undefined)?.primary || "#3b82f6";
  const accentColor = (theme?.colors as Theme['colors'] | undefined)?.accent || "#10b981";
  const content = block.content as Record<string, unknown> & {
    text?: string;
    items?: string[];
    url?: string;
    alt?: string;
    code?: string;
    author?: string;
    rows?: string[][];
    html?: string;
  };

  switch (block.type) {
    case "HEADING":
      return (
        <h1
          className="text-6xl font-bold"
          style={{
            fontFamily: (theme?.fonts as Theme['fonts'] | undefined)?.heading || "system-ui",
            color: primaryColor,
          }}
        >
          {content?.text || ""}
        </h1>
      );

    case "SUBHEADING":
      return (
        <h2
          className="text-3xl font-semibold"
          style={{ fontFamily: (theme?.fonts as Theme['fonts'] | undefined)?.heading || "system-ui" }}
        >
          {content?.text || ""}
        </h2>
      );

    case "PARAGRAPH":
      return (
        <p
          className="text-2xl leading-relaxed"
          style={{ fontFamily: (theme?.fonts as Theme['fonts'] | undefined)?.body || "system-ui" }}
        >
          {content?.text || ""}
        </p>
      );

    case "BULLET_LIST":
      return (
        <ul className="list-disc list-inside space-y-3 text-2xl">
          {(content?.items || []).map((item: string) => (

            <li key={item}>{item}</li>
          ))}
        </ul>
      );

    case "NUMBERED_LIST":
      return (
        <ol className="list-decimal list-inside space-y-3 text-2xl">
          {(content?.items || []).map((item: string) => (

            <li key={item}>{item}</li>
          ))}
        </ol>
      );

    case "IMAGE":
      return content?.url ? (
        <Image
          src={content.url}
          alt={content.alt || ""}
          className="max-w-full max-h-[60vh] object-contain mx-auto rounded-lg"
        />
      ) : null;

    case "CODE":
      return (
        <pre className="bg-slate-900 text-slate-100 p-6 rounded-lg overflow-x-auto text-lg">
          <code>{content?.code || ""}</code>
        </pre>
      );

    case "QUOTE":
      return (
        <blockquote
          className="border-l-4 pl-6 italic text-2xl"
          style={{ borderColor: accentColor }}
        >
          <p>{content?.text || ""}</p>
          {content?.author && (
            <footer className="mt-3 text-lg opacity-70">— {content.author}</footer>
          )}
        </blockquote>
      );

    case "DIVIDER":
      return (
        <hr
          className="my-8"
          style={{ borderColor: (theme?.colors as Theme['colors'] | undefined)?.secondary || "#e2e8f0" }}
        />
      );

    case "TABLE":
      if (content?.html) {
        return (
          <div
            className="tiptap-content prose dark:prose-invert max-w-none prose-table:w-full prose-table:border-collapse prose-td:border prose-td:p-3 prose-th:border prose-th:p-3 prose-th:bg-slate-100 dark:prose-th:bg-slate-800 text-xl prose-table:my-0 pb-6 [&>table]:w-full [&>table]:border-collapse [&_td]:border [&_th]:border [&_td]:p-3 [&_th]:p-3 [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800"
            dangerouslySetInnerHTML={{ __html: content.html }}
            style={{
              fontFamily: (theme?.fonts as Theme['fonts'] | undefined)?.body || "system-ui",
              '--tw-prose-border': (theme?.colors as Theme['colors'] | undefined)?.secondary || "#e2e8f0"
            } as React.CSSProperties}
          />
        );
      }
      const rows = content?.rows || [];
      return (
        <table className="w-full border-collapse text-xl">
          <tbody>
            {rows.map((row: string[], rowIndex: number) => (

              <tr key={`row-${row.join('-')}`}>
                {row.map((cell: string, _cellIndex: number) => (
                  <td

                    key={cell}
                    className={`border p-3 ${rowIndex === 0 ? "font-semibold bg-slate-100 dark:bg-slate-800" : ""
                      }`}
                    style={{
                      borderColor: (theme?.colors as Theme['colors'] | undefined)?.secondary || "#e2e8f0",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "EMBED":
      return content?.url ? (
        <div className="aspect-video max-w-full">
          <iframe
            src={content.url}
            className="w-full h-full rounded-lg"
            allowFullScreen
          />
        </div>
      ) : null;

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
        <div className="p-4 rounded-xl shadow-sm bg-slate-50/50 my-6">
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
              title: typeof content?.text === 'string' ? content.text : 'Data Visualization',
            } : undefined}
            isEditable={false}
          />
        </div>
      );
    }

    case "TIMELINE": {
      // convert to objects with stable ids so we can use a proper key
      const timelineItems = ((content?.items as string[]) || [
        "Phase 1: Planning",
        "Phase 2: Development",
        "Phase 3: Launch",
      ]).map((text, idx) => ({ id: text || `item-${idx}`, text }));

      return (
        <div className="relative pl-8 my-6">
          <div
            className="absolute left-3 top-4 bottom-4 w-1 rounded-full opacity-60"
            style={{ backgroundColor: primaryColor }}
          />
          <div className="space-y-6">
            {timelineItems.map((entry) => (
              <div key={entry.id} className="relative flex items-center gap-6">
                <div
                  className="absolute -left-[1.6rem] w-5 h-5 rounded-full border-4 border-white dark:border-slate-900 shadow-md z-10"
                  style={{ backgroundColor: accentColor }}
                />
                <div className="flex-1 p-5 rounded-xl shadow-sm text-2xl bg-slate-50 dark:bg-slate-800">
                  {entry.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "COMPARISON": {
      const comparisonItems = ((content?.items as string[]) || ["Option A", "Option B"]).map(
        (text, idx) => ({ id: text || `cmp-${idx}`, text }),
      );
      return (
        <div className="grid grid-cols-2 gap-8 my-6">
          {comparisonItems.map((entry, i) => (
            <div
              key={entry.id}
              className="p-8 rounded-xl shadow-md border-t-4 bg-slate-50 dark:bg-slate-800"
              style={{ borderColor: i % 2 === 0 ? primaryColor : accentColor }}
            >
              <p className="text-2xl">{entry.text}</p>
            </div>
          ))}
        </div>
      );
    }

    case "STATS_GRID": {
      const statsItems = ((content?.items as string[]) || [
        "98% Accuracy",
        "2x Faster",
        "500+ Users",
        "$1.2M Saved",
      ]).map((text, idx) => ({ id: text || `stat-${idx}`, text }));
      return (
        <div className="grid grid-cols-2 gap-6 my-6">
          {statsItems.map((entry) => (
            <div
              key={entry.id}
              className="p-8 rounded-2xl text-center shadow-sm bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
            >
              <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                {entry.text}
              </p>
            </div>
          ))}
        </div>
      );
    }

    case "CALL_TO_ACTION": {
      return (
        <div className="py-12 px-6 rounded-3xl text-center shadow-xl my-8 text-white relative overflow-hidden" style={{ backgroundColor: primaryColor }}>
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
          <p className="text-4xl font-bold relative z-10">{content?.text || "Get Started Today"}</p>
        </div>
      );
    }

    default:
      return null;
  }
}
