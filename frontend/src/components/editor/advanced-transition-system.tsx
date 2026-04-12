"use client";

import { useState } from "react";
import { Radio, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface TransitionEffect {
  id: string;
  name: string;
  description: string;
  duration: number;
  easing: string;
  category: "fade" | "slide" | "wipe" | "zoom" | "spin" | "3d";
  isPremium: boolean;
  css: string;
}

const TRANSITION_PRESETS: TransitionEffect[] = [
  // Fade Transitions
  {
    id: "fade-simple",
    name: "Simple Fade",
    description: "Basic opacity transition",
    duration: 500,
    easing: "ease-out",
    category: "fade",
    isPremium: false,
    css: "@keyframes transition-fade { from { opacity: 0; } to { opacity: 1; } }",
  },
  {
    id: "fade-cross",
    name: "Cross Fade",
    description: "Fade out previous slide while fading in next",
    duration: 600,
    easing: "ease-in-out",
    category: "fade",
    isPremium: false,
    css: "@keyframes transition-cross { 0% { opacity: 0; } 50% { opacity: 0; } 100% { opacity: 1; } }",
  },

  // Slide Transitions
  {
    id: "slide-left",
    name: "Slide Left",
    description: "Slide in from right, slide out to left",
    duration: 700,
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    category: "slide",
    isPremium: false,
    css: "@keyframes transition-slide-left { from { transform: translateX(100%); } to { transform: translateX(0); } }",
  },
  {
    id: "slide-right",
    name: "Slide Right",
    description: "Slide in from left, slide out to right",
    duration: 700,
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    category: "slide",
    isPremium: false,
    css: "@keyframes transition-slide-right { from { transform: translateX(-100%); } to { transform: translateX(0); } }",
  },
  {
    id: "slide-up",
    name: "Slide Up",
    description: "Slide in from bottom, slide out to top",
    duration: 600,
    easing: "ease-out",
    category: "slide",
    isPremium: false,
    css: "@keyframes transition-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }",
  },
  {
    id: "slide-down",
    name: "Slide Down",
    description: "Slide in from top, slide out to bottom",
    duration: 600,
    easing: "ease-out",
    category: "slide",
    isPremium: false,
    css: "@keyframes transition-slide-down { from { transform: translateY(-100%); } to { transform: translateY(0); } }",
  },

  // Wipe Transitions
  {
    id: "wipe-top",
    name: "Wipe Top",
    description: "Wipe effect from bottom to top",
    duration: 800,
    easing: "ease-in-out",
    category: "wipe",
    isPremium: true,
    css: "@keyframes transition-wipe { from { clip-path: inset(100% 0 0 0); } to { clip-path: inset(0); } }",
  },
  {
    id: "wipe-left",
    name: "Wipe Left",
    description: "Wipe effect from right to left",
    duration: 800,
    easing: "ease-in-out",
    category: "wipe",
    isPremium: true,
    css: "@keyframes transition-wipe-left { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0); } }",
  },

  // Zoom Transitions
  {
    id: "zoom-in",
    name: "Zoom In",
    description: "Zoom in from small to full",
    duration: 500,
    easing: "ease-out",
    category: "zoom",
    isPremium: false,
    css: "@keyframes transition-zoom-in { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }",
  },
  {
    id: "zoom-out",
    name: "Zoom Out",
    description: "Zoom out from full to small",
    duration: 500,
    easing: "ease-in",
    category: "zoom",
    isPremium: false,
    css: "@keyframes transition-zoom-out { from { transform: scale(1); opacity: 1; } to { transform: scale(0.8); opacity: 0; } }",
  },

  // Spin Transitions
  {
    id: "spin-cw",
    name: "Spin Clockwise",
    description: "Spin rotation clockwise",
    duration: 700,
    easing: "ease-out",
    category: "spin",
    isPremium: true,
    css: "@keyframes transition-spin-cw { from { transform: rotate(-180deg); opacity: 0; } to { transform: rotate(0); opacity: 1; } }",
  },
  {
    id: "spin-ccw",
    name: "Spin Counterclockwise",
    description: "Spin rotation counterclockwise",
    duration: 700,
    easing: "ease-out",
    category: "spin",
    isPremium: true,
    css: "@keyframes transition-spin-ccw { from { transform: rotate(180deg); opacity: 0; } to { transform: rotate(0); opacity: 1; } }",
  },

  // 3D Transitions
  {
    id: "flip-h",
    name: "Flip Horizontal",
    description: "3D flip along horizontal axis",
    duration: 800,
    easing: "ease-out",
    category: "3d",
    isPremium: true,
    css: "@keyframes transition-flip-h { from { transform: perspective(1000px) rotateY(90deg); opacity: 0; } to { transform: perspective(1000px) rotateY(0); opacity: 1; } }",
  },
  {
    id: "flip-v",
    name: "Flip Vertical",
    description: "3D flip along vertical axis",
    duration: 800,
    easing: "ease-out",
    category: "3d",
    isPremium: true,
    css: "@keyframes transition-flip-v { from { transform: perspective(1000px) rotateX(90deg); opacity: 0; } to { transform: perspective(1000px) rotateX(0); opacity: 1; } }",
  },
];

const DISSOLVE_EFFECTS = [
  { name: "Soft Dissolve", strength: 0.3 },
  { name: "Medium Dissolve", strength: 0.5 },
  { name: "Hard Dissolve", strength: 0.8 },
];

interface AdvancedTransitionsProps {
  onSelectTransition?: (effect: TransitionEffect) => void;
  onApplyGlobalTransition?: (config: Record<string, unknown>) => void;
}

export function AdvancedTransitionSystem({
  onSelectTransition,
  onApplyGlobalTransition,
}: AdvancedTransitionsProps) {
  const [selectedTransition, setSelectedTransition] = useState<string | null>(null);
  const [globalDuration, setGlobalDuration] = useState(500);
  const [globalDelay, setGlobalDelay] = useState(0);
  const [ , setIsPreviewPlaying] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedDissolution, setSelectedDissolution] = useState("Medium Dissolve");

  const filteredTransitions =
    filterCategory === "all"
      ? TRANSITION_PRESETS
      : TRANSITION_PRESETS.filter((t) => t.category === filterCategory);

  const handleSelectTransition = (effect: TransitionEffect) => {
    if (effect.isPremium) {
      toast.info("Premium transition - Upgrade to unlock");
      return;
    }
    setSelectedTransition(effect.id);
    onSelectTransition?.(effect);
    toast.success(`Selected "${effect.name}" transition`);
  };

  const playPreview = () => {
    setIsPreviewPlaying(true);
    setTimeout(() => setIsPreviewPlaying(false), globalDuration + 300);
  };

  const categories = [
    "all",
    ...Array.from(new Set(TRANSITION_PRESETS.map((t) => t.category))),
  ];

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-lime-50 to-green-50 dark:from-lime-950 dark:to-green-950 rounded-lg border border-lime-200 dark:border-lime-800">
      {/* Category Filter */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Transition Categories
        </h3>
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setFilterCategory(category)}
              className={`px-3 py-1 rounded text-xs font-semibold capitalize transition-all ${
                filterCategory === category
                  ? "bg-lime-500 text-white"
                  : "bg-white dark:bg-slate-900 border border-lime-300 dark:border-lime-700 hover:border-lime-400"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Transitions List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredTransitions.map((transition) => (
          <button
            key={transition.id}
            onClick={() => handleSelectTransition(transition)}
            className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
              selectedTransition === transition.id
                ? "border-lime-500 bg-lime-100 dark:bg-lime-900"
                : "border-lime-200 dark:border-lime-700 hover:border-lime-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {transition.name}
                  {transition.isPremium && (
                    <span className="text-[10px] bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded font-bold">
                      PRO
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {transition.description}
                </p>
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  {transition.duration}ms • {transition.easing}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!transition.isPremium) {
                    playPreview();
                  }
                }}
                className="p-2 rounded-lg hover:bg-lime-200 dark:hover:bg-lime-800 transition-all"
              >
                <Play className="w-4 h-4" />
              </button>
            </div>
          </button>
        ))}
      </div>

      {/* Global Settings */}
      {selectedTransition && (
        <div className="space-y-3 pt-3 border-t border-lime-200 dark:border-lime-700">
          {/* Duration */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Global Duration
              </label>
              <span className="text-sm font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded">
                {globalDuration}ms
              </span>
            </div>
            <Slider
              value={[globalDuration]}
              onValueChange={(v) => setGlobalDuration(v[0])}
              min={200}
              max={2000}
              step={50}
              className="w-full"
            />
          </div>

          {/* Delay */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Delay Between Slides
              </label>
              <span className="text-sm font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded">
                {globalDelay}ms
              </span>
            </div>
            <Slider
              value={[globalDelay]}
              onValueChange={(v) => setGlobalDelay(v[0])}
              min={0}
              max={1000}
              step={100}
              className="w-full"
            />
          </div>

          {/* Dissolution */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
              Dissolution Style
            </label>
            <div className="space-y-1">
              {DISSOLVE_EFFECTS.map((effect) => (
                <button
                  key={effect.name}
                  onClick={() => setSelectedDissolution(effect.name)}
                  className={`w-full px-3 py-2 rounded text-xs text-left font-semibold transition-all ${
                    selectedDissolution === effect.name
                      ? "bg-lime-500 text-white"
                      : "bg-white dark:bg-slate-900 border border-lime-300 dark:border-lime-700 hover:border-lime-400"
                  }`}
                >
                  {effect.name}
                </button>
              ))}
            </div>
          </div>

          {/* Apply Button */}
          <Button
            onClick={() => {
              onApplyGlobalTransition?.({
                transition: selectedTransition,
                duration: globalDuration,
                delay: globalDelay,
                dissolution: selectedDissolution,
              });
              toast.success("Applied transition to all slides");
            }}
            className="w-full"
          >
            <Radio className="w-4 h-4 mr-2" />
            Apply to All Slides
          </Button>
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-lime-200 dark:border-lime-700">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          🎬 Advanced transitions with smooth animations, 3D effects, and customizable timing for professional slide shows.
        </p>
      </div>
    </div>
  );
}
