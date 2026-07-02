import { useCallback } from "react";
import { AI_PHASE_LABELS } from "../constants/editor";
import { useAIGenerationStore } from "../stores/use-ai-generation-store";
import type { AISuggestion } from "../types";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const buildSuggestions = (prompt: string): AISuggestion[] => [
  {
    id: "s-1",
    title: "Trim opening to one sentence",
    rationale: "Sharper opening improves executive attention within the first 7 seconds.",
    actionLabel: "Apply concise opening",
    type: "tone",
  },
  {
    id: "s-2",
    title: "Add visual contrast panel",
    rationale: "Current slide density is high. Visual anchor will increase scan speed.",
    actionLabel: "Insert contrast panel",
    type: "layout",
  },
  {
    id: "s-3",
    title: `AI follow-up on \"${prompt}\"`,
    rationale: "Narrative continuity can be improved with a transition sentence and metric callout.",
    actionLabel: "Generate transition line",
    type: "content",
  },
];

export function useAIComposer(): {
  startGeneration: (prompt: string) => Promise<void>;
  applySuggestion: (suggestion: AISuggestion) => string;
} {
  const setPhase = useAIGenerationStore((state) => state.setPhase);
  const appendStream = useAIGenerationStore((state) => state.appendStream);
  const resetStream = useAIGenerationStore((state) => state.resetStream);
  const addMessage = useAIGenerationStore((state) => state.addMessage);
  const setSuggestions = useAIGenerationStore((state) => state.setSuggestions);

  const startGeneration = useCallback(
    async (prompt: string) => {
      resetStream();

      addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        createdAt: new Date().toISOString(),
      });

      const phases = ["briefing", "research", "writing", "layouting", "styling"] as const;
      const draftLines = [
        "Opening with a framing statement tied to business impact.",
        "Reordering points into challenge, shift, and quantified outcome.",
        "Introducing a contrast card for before and after positioning.",
        "Refining language for presenter cadence and visual rhythm.",
      ];

      for (const [index, phase] of phases.entries()) {
        const progress = Math.round(((index + 1) / phases.length) * 78);
        setPhase(phase, progress);
        appendStream(`${AI_PHASE_LABELS[phase]}...\n`);
        await wait(420);
      }

      for (const line of draftLines) {
        appendStream(`${line}\n`);
        await wait(260);
      }

      setPhase("completed", 100);
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: draftLines.join(" "),
        createdAt: new Date().toISOString(),
      });
      setSuggestions(buildSuggestions(prompt));
    },
    [addMessage, appendStream, resetStream, setPhase, setSuggestions],
  );

  const applySuggestion = useCallback((suggestion: AISuggestion): string => {
    return `${suggestion.title}: ${suggestion.rationale}`;
  }, []);

  return {
    startGeneration,
    applySuggestion,
  };
}

