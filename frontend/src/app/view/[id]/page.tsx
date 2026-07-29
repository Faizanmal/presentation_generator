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
import type { Variants } from "framer-motion";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { LayoutCompiler } from "@/components/editor/LayoutCompiler";

// Lazy-load 3D background for title slides in presentation view
const Ambient3DBackground = dynamic(
  () => import("@/components/editor/ambient-3d-background").then(m => m.Ambient3DBackground),
  { ssr: false }
);

export default function PresentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
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
      setDirection(-1);
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  }, [currentSlideIndex]);

  const nextSlide = useCallback(() => {
    if (project?.slides && currentSlideIndex < project.slides.length - 1) {
      setDirection(1);
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
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
          <p className="text-white/60 text-sm font-medium tracking-wide">Loading presentation...</p>
        </div>
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
  const totalSlides = project.slides?.length || 0;

  // Slide transition variants
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '60%' : '-60%',
      opacity: 0,
      scale: 0.92,
      filter: 'blur(6px)',
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-40%' : '40%',
      opacity: 0,
      scale: 0.95,
      filter: 'blur(4px)',
    }),
  };

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
      {/* Cinematic vignette overlay */}
      <div className="absolute inset-0 pointer-events-none z-30"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      {/* Animated slide content with transitions */}
      <AnimatePresence mode="wait" custom={direction}>
        {currentSlide && (
          <motion.div
            key={currentSlide.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 200, damping: 28 },
              opacity: { duration: 0.35 },
              scale: { duration: 0.4 },
              filter: { duration: 0.3 },
            }}
            className="w-full h-full flex items-center justify-center"
          >
            <SlideView slide={currentSlide} theme={theme || undefined} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 z-40 ${showControls ? "opacity-100" : "opacity-0"
          }`}
      >
        {/* Top bar with frosted glass */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/60 to-transparent backdrop-blur-sm flex items-center justify-between px-6 pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            className="text-white/80 hover:text-white hover:bg-white/10 transition-all"
            onClick={() => router.back()}
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="text-white/90 text-sm font-medium tracking-wide">
            {project.title}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-white/80 hover:text-white hover:bg-white/10 transition-all"
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
        <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
          {/* Progress bar */}
          <div className="h-1 bg-white/10 mx-6 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)' }}
              animate={{ width: `${((currentSlideIndex + 1) / totalSlides) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          <div className="h-20 bg-gradient-to-t from-black/60 to-transparent backdrop-blur-sm flex items-center justify-center gap-6 px-6">
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/10 transition-all h-10 w-10"
              onClick={prevSlide}
              disabled={currentSlideIndex === 0}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>

            {/* Slide dots with active indicator */}
            <div className="flex items-center gap-1.5">
              {project.slides?.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => {
                    setDirection(idx > currentSlideIndex ? 1 : -1);
                    setCurrentSlideIndex(idx);
                  }}
                  className="relative"
                >
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentSlideIndex
                      ? "w-6 bg-white"
                      : idx < currentSlideIndex
                      ? "w-1.5 bg-white/50"
                      : "w-1.5 bg-white/25"
                  }`} />
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/10 transition-all h-10 w-10"
              onClick={nextSlide}
              disabled={currentSlideIndex === totalSlides - 1}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Slide number */}
        <div className="absolute bottom-6 right-8 text-white/40 text-xs font-mono pointer-events-none tracking-wider">
          {String(currentSlideIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
        </div>
      </div>

      {/* Click to navigate */}
      <div className="absolute inset-0 flex z-20">
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

// ====================================================
// HELPER: Color utilities
// ====================================================
const colorWithAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const gradientFromColor = (hex: string, direction = '135deg'): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const r2 = Math.min(255, r + 40);
  const g2 = Math.min(255, g + 20);
  const b2 = Math.max(0, b - 20);
  return `linear-gradient(${direction}, rgb(${r}, ${g}, ${b}), rgb(${r2}, ${g2}, ${b2}))`;
};

// ====================================================
// Slide View Component — Premium
// ====================================================
function SlideView({ slide, theme }: { slide: Slide; theme?: Theme }) {
  const bgColor = (theme?.colors as Theme['colors'] | undefined)?.background || "#ffffff";
  const textColor = (theme?.colors as Theme['colors'] | undefined)?.text || "#1f2937";
  const primaryColor = (theme?.colors as Theme['colors'] | undefined)?.primary || "#3b82f6";
  const accentColor = (theme?.colors as Theme['colors'] | undefined)?.accent || "#10b981";

  // Sort blocks by order
  const sortedBlocks = [...(slide.blocks || [])].sort((a, b) => a.order - b.order);

  // Determine title slide
  const isTitleSlide = slide.layout === 'title' || sortedBlocks.some(
    b => (b.type || b.blockType) === 'HEADING' && b.order === 0 && sortedBlocks.length <= 3
  );

  // Stagger animation for blocks entering
  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  };

  const blockVariants: Variants = {
    hidden: { opacity: 0, y: 30, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 260,
        damping: 20,
      },
    },
  };

  return (
    <div
      className="w-full h-full max-w-[90vw] max-h-[90vh] aspect-[16/10] rounded-2xl shadow-2xl overflow-hidden relative"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        fontFamily: (theme?.fonts as Theme['fonts'] | undefined)?.body || 'var(--font-dm-sans), system-ui, sans-serif',
        boxShadow: `0 30px 60px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255,255,255,0.06)`,
      }}
    >
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full blur-[100px] opacity-40"
          style={{ background: `radial-gradient(circle, ${colorWithAlpha(primaryColor, 0.25)} 0%, transparent 70%)` }}
        />
        <div
          className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full blur-[80px] opacity-30"
          style={{ background: `radial-gradient(circle, ${colorWithAlpha(accentColor, 0.2)} 0%, transparent 70%)` }}
        />
        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }} />
      </div>

      {/* 3D ambient background for title slides */}
      {isTitleSlide && (
        <Ambient3DBackground
          primaryColor={primaryColor}
          accentColor={accentColor}
          variant="floating-spheres"
          intensity={0.35}
        />
      )}

      <div className="w-full h-full">
        <motion.div
          className="w-full h-full"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <LayoutCompiler
            layoutType={slide.layout || 'content'}
            blocks={sortedBlocks}
            theme={theme}
            renderBlock={(block) => (
              <motion.div key={block.id} variants={blockVariants} layoutId={`present-block-${block.id}`}>
                <BlockView block={block} theme={theme} />
              </motion.div>
            )}
          />
        </motion.div>
      </div>
    </div>
  );
}

// ====================================================
// Block View Component (read-only, PREMIUM styled)
// ====================================================
function BlockView({ block, theme }: { block: Block; theme?: Theme }) {
  const primaryColor = (theme?.colors as Theme['colors'] | undefined)?.primary || "#0F172A";
  const accentColor = (theme?.colors as Theme['colors'] | undefined)?.accent || "#0D9488";
  const secondaryColor = (theme?.colors as Theme['colors'] | undefined)?.secondary || "#334155";
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
        <div className="relative">
          {/* Decorative accent bar */}
          <div
            className="absolute -left-6 top-1 bottom-1 w-1.5 rounded-full opacity-80"
            style={{ background: gradientFromColor(primaryColor, '180deg') }}
          />
          <h1
            className="text-7xl font-bold leading-[1.1] tracking-tight"
            style={{
              fontFamily: (theme?.fonts as Theme['fonts'] | undefined)?.heading || 'var(--font-dm-sans), system-ui, sans-serif',
              color: primaryColor,
              textShadow: '0 2px 4px rgba(0,0,0,0.06)',
            }}
          >
            {content?.text || ""}
          </h1>
        </div>
      );

    case "SUBHEADING":
      return (
        <h2
          className="text-4xl font-semibold leading-snug"
          style={{
            fontFamily: (theme?.fonts as Theme['fonts'] | undefined)?.heading || 'var(--font-dm-sans), system-ui, sans-serif',
            opacity: 0.85,
          }}
        >
          {content?.text || ""}
        </h2>
      );

    case "PARAGRAPH": {
      const text = content?.text || "";
      // Detect big stat numbers
      const isBigStat = /^[\d$€£¥%.,MBKmkb+\-\s]+$/.test(text.trim()) && text.trim().length < 12;

      if (isBigStat) {
        return (
          <div className="py-4">
            <p
              className="font-extrabold tracking-tight bg-clip-text text-transparent"
              style={{
                fontFamily: (theme?.fonts as Theme['fonts'] | undefined)?.heading || 'var(--font-dm-sans), system-ui, sans-serif',
                fontSize: 'clamp(3rem, 6vw, 5rem)',
                lineHeight: 1.1,
                backgroundImage: gradientFromColor(primaryColor),
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {text}
            </p>
          </div>
        );
      }

      return (
        <p
          className="text-2xl leading-relaxed"
          style={{
            fontFamily: (theme?.fonts as Theme['fonts'] | undefined)?.body || 'var(--font-dm-sans), system-ui, sans-serif',
            opacity: 0.9,
          }}
        >
          {text}
        </p>
      );
    }

    case "BULLET_LIST":
      return (
        <ul className="space-y-4 pl-1">
          {(content?.items || []).map((item: string) => {
            const slug = item?.slice(0, 20).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9\-]/g, "") || "bullet";
            return (
              <li key={`bullet-${slug}`} className="flex items-start gap-4 text-2xl">
                <span
                  className="mt-2.5 w-3 h-3 rounded-full shrink-0 shadow-sm"
                  style={{
                    background: gradientFromColor(primaryColor),
                    boxShadow: `0 0 12px ${colorWithAlpha(primaryColor, 0.3)}`,
                  }}
                />
                <span className="leading-relaxed">{item}</span>
              </li>
            );
          })}
        </ul>
      );

    case "NUMBERED_LIST":
      return (
        <ol className="space-y-4 pl-1">
          {(content?.items || []).map((item: string, index: number) => {
            const slug = item?.slice(0, 20).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9\-]/g, "") || `num-${index}`;
            return (
              <li key={`num-${slug}`} className="flex items-start gap-4 text-2xl">
                <span
                  className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-md"
                  style={{
                    background: gradientFromColor(primaryColor),
                    boxShadow: `0 2px 10px ${colorWithAlpha(primaryColor, 0.35)}`,
                  }}
                >
                  {index + 1}
                </span>
                <span className="leading-relaxed pt-0.5">{item}</span>
              </li>
            );
          })}
        </ol>
      );

    case "IMAGE":
      return content?.url ? (
        <div className="rounded-2xl overflow-hidden shadow-2xl">
          <Image
            src={content.url}
            alt={content.alt || ""}
            className="max-w-full max-h-[60vh] object-contain mx-auto"
            width={1200}
            height={800}
          />
        </div>
      ) : null;

    case "CODE":
      return (
        <div className="rounded-2xl overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2 px-5 py-3" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs text-slate-500 ml-2 font-mono">
              {(content as Record<string, unknown>)?.language as string || "code"}
            </span>
          </div>
          <pre
            className="p-6 overflow-x-auto text-lg"
            style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              background: '#0f172a',
              color: '#e2e8f0',
            }}
          >
            <code>{content?.code || ""}</code>
          </pre>
        </div>
      );

    case "QUOTE":
      return (
        <div
          className="relative pl-8 py-6 pr-6 rounded-r-2xl"
          style={{
            borderLeft: `5px solid ${accentColor}`,
            background: `linear-gradient(135deg, ${colorWithAlpha(accentColor, 0.06)}, ${colorWithAlpha(primaryColor, 0.03)})`,
          }}
        >
          <div
            className="absolute -top-4 left-6 text-8xl font-serif leading-none opacity-10 select-none"
            style={{ color: accentColor }}
          >
            &ldquo;
          </div>
          <p className="text-3xl italic leading-relaxed relative z-10"
            style={{ fontFamily: (theme?.fonts as Theme['fonts'] | undefined)?.body || "'Georgia', serif" }}
          >
            {content?.text || ""}
          </p>
          {content?.author && (
            <footer className="mt-4 text-lg font-medium flex items-center gap-3 relative z-10">
              <div className="w-10 h-0.5 rounded-full" style={{ background: accentColor }} />
              <span style={{ color: accentColor }}>{content.author}</span>
            </footer>
          )}
        </div>
      );

    case "DIVIDER":
      return (
        <div className="py-6 flex items-center gap-4">
          <div className="flex-1 h-px" style={{
            background: `linear-gradient(90deg, transparent, ${colorWithAlpha(primaryColor, 0.3)}, transparent)`,
          }} />
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: gradientFromColor(primaryColor) }}
          />
          <div className="flex-1 h-px" style={{
            background: `linear-gradient(90deg, transparent, ${colorWithAlpha(accentColor, 0.3)}, transparent)`,
          }} />
        </div>
      );

    case "TABLE":
      if (content?.html) {
        return (
          <div
            className="tiptap-content prose dark:prose-invert max-w-none prose-table:w-full prose-table:border-collapse prose-td:border prose-td:p-4 prose-th:border prose-th:p-4 prose-th:bg-slate-100 dark:prose-th:bg-slate-800 text-xl prose-table:my-0 pb-6 [&>table]:w-full [&>table]:border-collapse [&_td]:border [&_th]:border [&_td]:p-4 [&_th]:p-4 [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800 rounded-xl overflow-hidden"
            dangerouslySetInnerHTML={{ __html: content.html }}
            style={{
              fontFamily: (theme?.fonts as Theme['fonts'] | undefined)?.body || 'var(--font-dm-sans), system-ui, sans-serif',
            }}
          />
        );
      }
      const rows = content?.rows || [];
      return (
        <div className="rounded-2xl overflow-hidden shadow-lg">
          <table className="w-full border-collapse text-xl">
            <tbody>
              {rows.map((row: string[], rowIndex: number) => {
                const rowKey = row.map((cell) => cell.replace(/\s+/g, "-").slice(0, 20)).join("|") || `row-${rowIndex}`;
                const isHeaderRow = rowIndex === 0;
                return (
                  <tr key={rowKey}>
                    {row.map((cell: string) => {
                      const cellKey = `${rowKey}-${cell?.slice(0, 15).replace(/\s+/g, "-") || "cell"}`;
                      return (
                        <td
                          key={cellKey}
                          className={`border p-4 ${isHeaderRow ? "font-semibold" : ""}`}
                          style={{
                            borderColor: colorWithAlpha(primaryColor, 0.15),
                            backgroundColor: isHeaderRow
                              ? colorWithAlpha(primaryColor, 0.06)
                              : undefined,
                          }}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );

    case "EMBED":
      return content?.url ? (
        <div className="aspect-video max-w-full rounded-2xl overflow-hidden shadow-2xl">
          <iframe
            src={content.url}
            className="w-full h-full"
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
        <div
          className="p-6 rounded-2xl shadow-lg my-6"
          style={{
            background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.04)}, ${colorWithAlpha(secondaryColor, 0.03)})`,
            border: `1px solid ${colorWithAlpha(primaryColor, 0.1)}`,
          }}
        >
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
      const timelineItems = ((content?.items as string[]) || [
        "Phase 1: Planning",
        "Phase 2: Development",
        "Phase 3: Launch",
      ]).map((text, idx) => ({ id: text || `item-${idx}`, text }));

      return (
        <div className="relative pl-10 my-6">
          <div
            className="absolute left-4 top-4 bottom-4 w-0.5 rounded-full"
            style={{ background: `linear-gradient(to bottom, ${primaryColor}, ${colorWithAlpha(primaryColor, 0.2)})` }}
          />
          <div className="space-y-6">
            {timelineItems.map((entry) => (
              <div key={entry.id} className="relative flex items-center gap-6">
                <div
                  className="absolute -left-[1.35rem] w-5 h-5 rounded-full border-4 shadow-lg z-10"
                  style={{
                    backgroundColor: accentColor,
                    borderColor: 'white',
                    boxShadow: `0 0 12px ${colorWithAlpha(accentColor, 0.4)}`,
                  }}
                />
                <div
                  className="flex-1 p-6 rounded-xl shadow-md text-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.05)}, ${colorWithAlpha(accentColor, 0.03)})`,
                    border: `1px solid ${colorWithAlpha(primaryColor, 0.1)}`,
                  }}
                >
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
        <div className="grid grid-cols-2 gap-6 my-6">
          {comparisonItems.map((entry, i) => {
            const colors = [primaryColor, accentColor, secondaryColor];
            const color = colors[i % colors.length];
            return (
              <div
                key={entry.id}
                className="p-8 rounded-2xl shadow-lg relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${colorWithAlpha(color, 0.08)}, ${colorWithAlpha(color, 0.03)})`,
                  border: `1px solid ${colorWithAlpha(color, 0.15)}`,
                }}
              >
                {/* Top accent */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5 rounded-b"
                  style={{ background: gradientFromColor(color, '90deg') }}
                />
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold mb-4 shadow-md"
                  style={{ background: gradientFromColor(color) }}
                >
                  {String.fromCharCode(65 + i)}
                </div>
                <p className="text-2xl leading-relaxed font-medium">{entry.text}</p>
              </div>
            );
          })}
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
        <div className="grid grid-cols-2 gap-5 my-6">
          {statsItems.map((entry, i) => {
            const colors = [primaryColor, accentColor, secondaryColor, '#f59e0b'];
            const color = colors[i % colors.length];
            return (
              <div
                key={entry.id}
                className="relative p-8 rounded-2xl text-center shadow-lg overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${colorWithAlpha(color, 0.07)}, ${colorWithAlpha(color, 0.02)})`,
                  border: `1px solid ${colorWithAlpha(color, 0.12)}`,
                }}
              >
                <div
                  className="absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-15"
                  style={{ background: gradientFromColor(color) }}
                />
                <p className="text-4xl font-bold relative z-10" style={{ color }}>
                  {entry.text}
                </p>
              </div>
            );
          })}
        </div>
      );
    }

    case "CALL_TO_ACTION": {
      return (
        <div
          className="py-14 px-8 rounded-3xl text-center shadow-2xl my-8 text-white relative overflow-hidden"
          style={{
            background: gradientFromColor(primaryColor),
            boxShadow: `0 12px 40px ${colorWithAlpha(primaryColor, 0.35)}`,
          }}
        >
          {/* Animated shimmer */}
          <div className="absolute inset-0 opacity-20" style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            backgroundSize: '200% 100%',
            animation: 'gradient-shimmer 3s linear infinite',
          }} />
          {/* Decorative shapes */}
          <div className="absolute -top-8 -left-8 w-28 h-28 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-white/10" />
          <p className="text-5xl font-bold drop-shadow-lg relative z-10">{content?.text || "Get Started Today"}</p>
        </div>
      );
    }

    default:
      return null;
  }
}
