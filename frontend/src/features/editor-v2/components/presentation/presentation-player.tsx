"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  ArrowLeft,
  ArrowRight,
  PenLine,
  StickyNote,
  Maximize2,
  Clock,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { slideTransitions, motionTiming, motionEase, springSnappy } from "../../lib/motion";
import type { EditorSlide } from "../../types";

interface PresentationPlayerProps {
  open: boolean;
  slides: EditorSlide[];
  currentSlideIndex: number;
  showNotes: boolean;
  laserEnabled: boolean;
  presenterMode: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleNotes: () => void;
  onToggleLaser: () => void;
}

export function PresentationPlayer({
  open,
  slides,
  currentSlideIndex,
  showNotes,
  laserEnabled,
  presenterMode,
  onClose,
  onNext,
  onPrevious,
  onToggleNotes,
  onToggleLaser,
}: PresentationPlayerProps) {
  const [laserPosition, setLaserPosition] = useState({ x: 0, y: 0 });
  const [controlsVisible, setControlsVisible] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const controlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Auto-hide controls after 3s of inactivity
  const resetControlTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlTimerRef.current) {
      clearTimeout(controlTimerRef.current);
    }
    controlTimerRef.current = setTimeout(() => {
      if (!presenterMode) {
        setControlsVisible(false);
      }
    }, 3000);
  }, [presenterMode]);

  // Timer
  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      startTimeRef.current = Date.now();
      setElapsedTime(0);
    });
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, [open]);

  // Keyboard
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      resetControlTimer();

      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        onNext();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrevious();
      }
      if (event.key.toLowerCase() === "l") {
        onToggleLaser();
      }
      if (event.key.toLowerCase() === "n") {
        onToggleNotes();
      }
      if (event.key.toLowerCase() === "f") {
        void document.documentElement.requestFullscreen?.();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrevious, onToggleLaser, onToggleNotes, open, resetControlTimer]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => resetControlTimer());
    return () => cancelAnimationFrame(frame);
  }, [open, resetControlTimer]);

  if (!open || slides.length === 0) {
    return null;
  }

  const slide = slides[currentSlideIndex] ?? slides[0];
  const transition = slideTransitions[slide.transition] ?? slideTransitions.fade;
  const progress = ((currentSlideIndex + 1) / slides.length) * 100;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] bg-black"
      onMouseMove={(event) => {
        resetControlTimer();
        if (laserEnabled) {
          setLaserPosition({ x: event.clientX, y: event.clientY });
        }
      }}
      style={{ cursor: controlsVisible ? "default" : "none" }}
    >
      {/* ── Progress bar ─────────────────────────────────────────── */}
      <motion.div
        className="absolute left-0 top-0 z-30 h-[3px] bg-gradient-to-r from-[oklch(0.75_0.16_248)] to-[oklch(0.72_0.18_295)]"
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, ease: motionEase.smooth }}
      />

      {/* ── Top controls ─────────────────────────────────────────── */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: motionTiming.normal, ease: motionEase.smooth }}
            className="absolute right-4 top-4 z-30 flex items-center gap-2"
          >
            <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/50 p-1 backdrop-blur-lg">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white",
                  showNotes && "bg-white/15 text-white",
                )}
                onClick={onToggleNotes}
              >
                <StickyNote className="mr-1.5 h-3.5 w-3.5" />
                Notes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white",
                  laserEnabled && "bg-red-500/20 text-red-400",
                )}
                onClick={onToggleLaser}
              >
                <PenLine className="mr-1.5 h-3.5 w-3.5" />
                Laser
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => void document.documentElement.requestFullscreen?.()}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-xs tabular-nums text-white/60 backdrop-blur-lg">
              <Clock className="h-3 w-3" />
              {formatTime(elapsedTime)}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl border border-white/15 bg-black/50 text-white/70 backdrop-blur-lg hover:bg-white/10 hover:text-white"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom navigation ────────────────────────────────────── */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: motionTiming.normal, ease: motionEase.smooth }}
            className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/15 bg-black/50 px-4 py-2 backdrop-blur-lg"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
              onClick={onPrevious}
              disabled={currentSlideIndex === 0}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {/* Slide dots */}
            <div className="flex items-center gap-1.5">
              {slides.length <= 12 ? (
                slides.map((slide, idx) => (
                  <motion.button
                    key={slide.id}
                    type="button"
                    className={cn(
                      "rounded-full transition",
                      idx === currentSlideIndex
                        ? "h-2 w-6 bg-white"
                        : "h-2 w-2 bg-white/30 hover:bg-white/60",
                    )}
                    animate={{
                      width: idx === currentSlideIndex ? 24 : 8,
                    }}
                    transition={springSnappy}
                    onClick={() => {
                      const diff = idx - currentSlideIndex;
                      if (diff > 0) {
                        for (let i = 0; i < diff; i++) {
                          onNext();
                        }
                      } else {
                        for (let i = 0; i < Math.abs(diff); i++) {
                          onPrevious();
                        }
                      }
                    }}
                  />
                ))
              ) : (
                <span className="text-sm tabular-nums text-white">
                  {currentSlideIndex + 1} / {slides.length}
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
              onClick={onNext}
              disabled={currentSlideIndex === slides.length - 1}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Slide content ────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={transition.initial}
          animate={transition.animate}
          exit={transition.exit}
          transition={transition.transition}
          className={cn(
            "absolute inset-0 mx-auto my-auto flex overflow-hidden rounded-[30px]",
            presenterMode
              ? "h-[88vh] w-[94vw] max-w-[1800px]"
              : "h-[86vh] w-[92vw] max-w-[1680px]",
          )}
        >
          {/* Main slide area */}
          <section
            className={cn(
              "flex-1 border border-white/10 bg-white p-12 text-zinc-900 shadow-2xl lg:p-16",
              presenterMode ? "rounded-l-[30px]" : "rounded-[30px]",
            )}
          >
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: motionEase.smooth }}
              className="text-4xl font-semibold leading-tight lg:text-5xl"
            >
              {slide.title}
            </motion.h1>

            <motion.div
              className="mt-8 space-y-5"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
              }}
            >
              {slide.blocks.map((block) => (
                <motion.article
                  key={block.id}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.4, ease: motionEase.smooth }}
                >
                  {block.type === "heading" ? (
                    <h2 className="text-2xl font-semibold lg:text-3xl">{block.content.text}</h2>
                  ) : block.type === "stat" ? (
                    <div className="flex items-baseline gap-4">
                      <span className="text-5xl font-bold text-blue-600 lg:text-6xl">
                        {block.content.statValue || block.content.text}
                      </span>
                      {block.content.statLabel && (
                        <span className="text-lg text-zinc-500">{block.content.statLabel}</span>
                      )}
                    </div>
                  ) : block.type === "quote" ? (
                    <blockquote className="border-l-4 border-blue-500 pl-6">
                      <p className="text-xl italic leading-relaxed text-zinc-700 lg:text-2xl">
                        &ldquo;{block.content.text}&rdquo;
                      </p>
                      {block.content.quoteAuthor && (
                        <cite className="mt-2 block text-sm not-italic text-zinc-500">
                          — {block.content.quoteAuthor}
                        </cite>
                      )}
                    </blockquote>
                  ) : block.type === "image" ? (
                    <div className="flex h-48 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 lg:h-64">
                      <span className="text-sm text-zinc-400">Image</span>
                    </div>
                  ) : (
                    <p className="text-lg leading-relaxed text-zinc-700 lg:text-xl">
                      {block.content.text}
                    </p>
                  )}
                </motion.article>
              ))}
            </motion.div>
          </section>

          {/* Presenter sidebar */}
          {presenterMode && (
            <aside className="flex w-[360px] flex-col border border-white/10 bg-zinc-900 p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                  Presenter Notes
                </p>
                <span className="text-xs tabular-nums text-zinc-500">
                  {currentSlideIndex + 1}/{slides.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-sm leading-relaxed text-zinc-300">
                  {slide.notes || "No notes for this slide."}
                </p>
              </div>

              {/* Next slide preview */}
              {currentSlideIndex < slides.length - 1 && (
                <div className="mt-4">
                  <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                    Next slide
                  </p>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="line-clamp-1 text-sm font-medium text-zinc-400">
                      {slides[currentSlideIndex + 1].title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-600">
                      {slides[currentSlideIndex + 1].blocks
                        .map((b) => b.content.text)
                        .filter(Boolean)
                        .join(" ")
                        .slice(0, 100)}
                    </p>
                  </div>
                </div>
              )}

              {/* Timer */}
              <div className="mt-4 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <span className="text-xs text-zinc-500">Elapsed</span>
                <span className="text-lg font-medium tabular-nums text-zinc-300">
                  {formatTime(elapsedTime)}
                </span>
              </div>
            </aside>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Notes overlay (non-presenter mode) ───────────────────── */}
      <AnimatePresence>
        {showNotes && !presenterMode && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: motionTiming.normal, ease: motionEase.smooth }}
            className="absolute bottom-20 left-1/2 z-30 w-[min(780px,90vw)] -translate-x-1/2 rounded-xl border border-white/15 bg-black/60 p-5 text-sm leading-relaxed text-white/90 backdrop-blur-lg"
          >
            <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
              Speaker Notes
            </p>
            {slide.notes || "No notes for this slide."}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Laser pointer ────────────────────────────────────────── */}
      {laserEnabled && (
        <motion.div
          className="pointer-events-none absolute z-40"
          animate={{ x: laserPosition.x - 8, y: laserPosition.y - 8 }}
          transition={{ type: "spring", damping: 18, stiffness: 280, mass: 0.18 }}
        >
          <div className="h-4 w-4 rounded-full bg-red-500 shadow-[0_0_20px_6px_rgba(255,0,0,0.6)]" />
          <div className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-40" />
        </motion.div>
      )}
    </motion.div>
  );
}
