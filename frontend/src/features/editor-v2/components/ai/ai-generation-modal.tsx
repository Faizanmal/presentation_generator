"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  ArrowRight,
  Send,
  Lightbulb,
  Layout,
  MessageSquare,
  Palette,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Wand2,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  staggerContainer,
  staggerChild,
  motionEase,
  aiPulse,
  aiStreamReveal,
  buttonPress,
} from "../../lib/motion";
import { AI_PHASE_LABELS } from "../../constants/editor";
import type { AIGenerationPhase, AIGenerationState, AISuggestion } from "../../types";

interface AIGenerationModalProps {
  state: AIGenerationState;
  onClose: () => void;
  onSubmitPrompt: (prompt: string) => Promise<void>;
  onApplySuggestion: (suggestion: AISuggestion) => void;
}

const QUICK_PROMPTS = [
  { label: "Executive summary", prompt: "Generate an executive summary deck with 5 high-impact slides." },
  { label: "Product launch", prompt: "Create a product launch narrative with features, benefits, and roadmap." },
  { label: "Team update", prompt: "Build a team update with key metrics, wins, and next steps." },
  { label: "Pitch deck", prompt: "Design an investor pitch deck covering problem, solution, market, and traction." },
];

const SUGGESTION_TYPE_ICONS = {
  content: Lightbulb,
  layout: Layout,
  tone: MessageSquare,
  design: Palette,
} as const;

const PHASE_STEPS: AIGenerationPhase[] = ["briefing", "research", "writing", "layouting", "styling", "completed"];

export function AIGenerationModal({
  state,
  onClose,
  onSubmitPrompt,
  onApplySuggestion,
}: AIGenerationModalProps) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const streamContainerRef = useRef<HTMLDivElement>(null);

  const phaseLabel = useMemo(() => AI_PHASE_LABELS[state.phase], [state.phase]);
  const isGenerating = state.phase !== "idle" && state.phase !== "completed" && state.phase !== "error";
  const currentPhaseIndex = PHASE_STEPS.indexOf(state.phase);

  // Auto-scroll stream
  useEffect(() => {
    if (streamContainerRef.current && state.streamText) {
      streamContainerRef.current.scrollTop = streamContainerRef.current.scrollHeight;
    }
  }, [state.streamText]);

  const handleSubmit = async (text: string) => {
    if (!text.trim()) {
      return;
    }
    setSubmitting(true);
    await onSubmitPrompt(text.trim());
    setSubmitting(false);
    setPrompt("");
  };

  return (
    <Dialog open={state.isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-w-4xl overflow-hidden rounded-2xl border-pd-border bg-pd-panel p-0 text-pd-text shadow-modal">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr]">
          {/* ── Left Panel — Prompt & Stream ────────────────────── */}
          <div className="flex flex-col border-r border-pd-border">
            <DialogHeader className="border-b border-pd-border px-6 py-5">
              <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold">
                <motion.div
                  variants={aiPulse}
                  animate={isGenerating ? "active" : "idle"}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-pd-accent to-[oklch(0.72_0.18_295)] shadow-glow-subtle"
                >
                  <Brain className="h-4.5 w-4.5 text-white" />
                </motion.div>
                AI Presentation Composer
              </DialogTitle>
              <DialogDescription className="text-pd-text-secondary">
                Describe your presentation and watch it come to life in real-time.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 flex-col p-6">
              {/* Quick prompt chips */}
              {state.phase === "idle" && !state.streamText && (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="mb-4 flex flex-wrap gap-2"
                >
                  {QUICK_PROMPTS.map((qp) => (
                    <motion.button
                      key={qp.label}
                      variants={staggerChild}
                      type="button"
                      onClick={() => {
                        setPrompt(qp.prompt);
                        void handleSubmit(qp.prompt);
                      }}
                      {...buttonPress}
                      className="rounded-full border border-pd-border bg-pd-elevated px-3 py-1.5 text-xs text-pd-text-secondary transition hover:border-pd-accent hover:bg-pd-accent-ultra-soft hover:text-pd-text"
                    >
                      <Wand2 className="mr-1.5 inline h-3 w-3" />
                      {qp.label}
                    </motion.button>
                  ))}
                </motion.div>
              )}

              {/* Prompt input */}
              <form
                className="flex gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await handleSubmit(prompt);
                }}
              >
                <div className="relative flex-1">
                  <input
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    disabled={submitting}
                    className="h-11 w-full rounded-xl border border-pd-border bg-pd-elevated pl-4 pr-12 text-sm text-pd-text outline-none transition focus:border-pd-border-focus focus:shadow-glow-subtle"
                    placeholder="Generate a board-level narrative for Q4 growth strategy…"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={submitting || !prompt.trim()}
                    className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg bg-pd-accent text-white disabled:opacity-40"
                  >
                    {submitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </form>

              {/* Phase progress */}
              <div className="mt-4 rounded-xl border border-pd-border bg-pd-elevated p-3">
                <div className="mb-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {isGenerating && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      >
                        <RefreshCw className="h-3 w-3 text-pd-accent" />
                      </motion.div>
                    )}
                    {state.phase === "completed" && (
                      <CheckCircle2 className="h-3 w-3 text-pd-success" />
                    )}
                    {state.phase === "error" && (
                      <AlertTriangle className="h-3 w-3 text-pd-danger" />
                    )}
                    <span className={cn(
                      state.phase === "completed" && "text-pd-success",
                      state.phase === "error" && "text-pd-danger",
                    )}>
                      {phaseLabel}
                    </span>
                  </div>
                  <span className="tabular-nums text-pd-muted">{state.progress}%</span>
                </div>

                {/* Multi-step progress */}
                <div className="flex gap-1">
                  {PHASE_STEPS.map((step, index) => (
                    <motion.div
                      key={step}
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-pd-sunken"
                    >
                      <motion.div
                        animate={{
                          width: index < currentPhaseIndex
                            ? "100%"
                            : index === currentPhaseIndex
                              ? `${state.progress}%`
                              : "0%",
                        }}
                        transition={{ duration: 0.3, ease: motionEase.smooth }}
                        className={cn(
                          "h-full rounded-full",
                          index < currentPhaseIndex
                            ? "bg-pd-success"
                            : "bg-pd-accent",
                        )}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Phase labels */}
                <div className="mt-2 flex justify-between">
                  {PHASE_STEPS.slice(0, -1).map((step, index) => (
                    <span
                      key={step}
                      className={cn(
                        "text-[9px]",
                        index <= currentPhaseIndex ? "text-pd-text-secondary" : "text-pd-muted",
                      )}
                    >
                      {AI_PHASE_LABELS[step]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stream output */}
              <div
                ref={streamContainerRef}
                className="mt-4 flex-1 overflow-y-auto rounded-xl border border-pd-border bg-pd-sunken p-4 pd-scrollbar-thin"
                style={{ minHeight: 200, maxHeight: 320 }}
              >
                <AnimatePresence mode="popLayout">
                  {state.streamText ? (
                    <motion.div
                      key="stream"
                      variants={aiStreamReveal}
                      initial="hidden"
                      animate="visible"
                    >
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-pd-text">
                        {state.streamText}
                        {isGenerating && (
                          <motion.span
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                            className="inline-block h-4 w-0.5 bg-pd-accent"
                          />
                        )}
                      </pre>
                    </motion.div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <Sparkles className="mb-3 h-8 w-8 text-pd-muted opacity-40" />
                      <p className="text-sm text-pd-muted">
                        Generated output appears here as the model streams.
                      </p>
                      <p className="mt-1 text-xs text-pd-muted opacity-60">
                        Try one of the quick prompts above to get started.
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ── Right Panel — Suggestions ───────────────────────── */}
          <div className="flex flex-col bg-pd-elevated/50 p-6">
            <p className="text-[10px] uppercase tracking-[0.12em] text-pd-muted">
              AI Suggestions
            </p>

            <div className="mt-3 flex-1 space-y-2 overflow-y-auto pd-scrollbar-thin">
              {state.suggestions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-pd-border p-4 text-center">
                  <Lightbulb className="mx-auto mb-2 h-6 w-6 text-pd-muted opacity-40" />
                  <p className="text-sm text-pd-text-secondary">
                    Suggestions will appear once draft generation completes.
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  {state.suggestions.map((suggestion) => {
                    const TypeIcon = SUGGESTION_TYPE_ICONS[suggestion.type] ?? Lightbulb;
                    return (
                      <motion.button
                        key={suggestion.id}
                        variants={staggerChild}
                        type="button"
                        className="group w-full rounded-xl border border-pd-border bg-pd-elevated p-3 text-left transition hover:border-pd-accent hover:shadow-glow-subtle"
                        onClick={() => onApplySuggestion(suggestion)}
                        {...buttonPress}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <div className="grid h-5 w-5 place-items-center rounded-md bg-pd-accent-ultra-soft">
                            <TypeIcon className="h-3 w-3 text-pd-accent" />
                          </div>
                          <p className="text-sm font-semibold text-pd-text">{suggestion.title}</p>
                        </div>
                        <p className="text-xs leading-relaxed text-pd-text-secondary">
                          {suggestion.rationale}
                        </p>
                        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-pd-accent transition group-hover:gap-2">
                          {suggestion.actionLabel}
                          <ArrowRight className="h-3 w-3" />
                        </p>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </div>

            {/* History / conversation */}
            {state.messages.length > 0 && (
              <div className="mt-4 border-t border-pd-border pt-4">
                <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-pd-muted">
                  Conversation
                </p>
                <div className="max-h-[120px] space-y-2 overflow-y-auto pd-scrollbar-thin">
                  {state.messages.slice(-4).map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs",
                        message.role === "user"
                          ? "bg-pd-accent-soft text-pd-text"
                          : "bg-pd-sunken text-pd-text-secondary",
                      )}
                    >
                      {message.content.slice(0, 120)}
                      {message.content.length > 120 && "…"}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
