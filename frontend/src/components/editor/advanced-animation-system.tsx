"use client";

import { useState } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export interface AnimationKeyframe {
  time: number;
  transforms: {
    scale?: number;
    rotateY?: number;
    translateZ?: number;
    opacity?: number;
  };
}

export interface AnimationPreset {
  id: string;
  name: string;
  description: string;
  duration: number;
  easing: string;
  keyframes: AnimationKeyframe[];
  category: "entrance" | "emphasis" | "exit" | "3d";
  isPremium: boolean;
}

const ANIMATION_PRESETS: AnimationPreset[] = [
  // Entrance Animations
  {
    id: "fade-in",
    name: "Fade In",
    description: "Simple opacity fade",
    duration: 600,
    easing: "ease-out",
    keyframes: [
      { time: 0, transforms: { opacity: 0 } },
      { time: 100, transforms: { opacity: 1 } },
    ],
    category: "entrance",
    isPremium: false,
  },
  {
    id: "slide-from-left",
    name: "Slide from Left",
    description: "Slide in from the left edge",
    duration: 700,
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    keyframes: [
      { time: 0, transforms: { translateZ: -100, opacity: 0 } },
      { time: 100, transforms: { translateZ: 0, opacity: 1 } },
    ],
    category: "entrance",
    isPremium: false,
  },
  {
    id: "bounce-in",
    name: "Bounce In",
    description: "Bounce entrance effect",
    duration: 800,
    easing: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    keyframes: [
      { time: 0, transforms: { scale: 0 } },
      { time: 50, transforms: { scale: 1.2 } },
      { time: 100, transforms: { scale: 1 } },
    ],
    category: "entrance",
    isPremium: false,
  },
  {
    id: "zoom-in",
    name: "Zoom In",
    description: "Zoom from small to normal",
    duration: 500,
    easing: "ease-out",
    keyframes: [
      { time: 0, transforms: { scale: 0.5, opacity: 0 } },
      { time: 100, transforms: { scale: 1, opacity: 1 } },
    ],
    category: "entrance",
    isPremium: false,
  },
  {
    id: "flip-in",
    name: "Flip In",
    description: "3D flip entrance",
    duration: 700,
    easing: "ease-out",
    keyframes: [
      { time: 0, transforms: { rotateY: 90, opacity: 0 } },
      { time: 100, transforms: { rotateY: 0, opacity: 1 } },
    ],
    category: "3d",
    isPremium: true,
  },

  // Emphasis Animations
  {
    id: "pulse",
    name: "Pulse",
    description: "Gentle pulsing effect",
    duration: 1000,
    easing: "ease-in-out",
    keyframes: [
      { time: 0, transforms: { scale: 1 } },
      { time: 50, transforms: { scale: 1.1 } },
      { time: 100, transforms: { scale: 1 } },
    ],
    category: "emphasis",
    isPremium: false,
  },
  {
    id: "shake",
    name: "Shake",
    description: "Attention-grabbing shake",
    duration: 500,
    easing: "ease-in-out",
    keyframes: [
      { time: 0, transforms: { rotateY: 0 } },
      { time: 25, transforms: { rotateY: -5 } },
      { time: 50, transforms: { rotateY: 5 } },
      { time: 75, transforms: { rotateY: -5 } },
      { time: 100, transforms: { rotateY: 0 } },
    ],
    category: "emphasis",
    isPremium: false,
  },
  {
    id: "glow",
    name: "Glow",
    description: "Glowing emphasis effect",
    duration: 1200,
    easing: "ease-in-out",
    keyframes: [
      { time: 0, transforms: { opacity: 1 } },
      { time: 50, transforms: { opacity: 0.6 } },
      { time: 100, transforms: { opacity: 1 } },
    ],
    category: "emphasis",
    isPremium: true,
  },

  // Exit Animations
  {
    id: "fade-out",
    name: "Fade Out",
    description: "Simple opacity fade out",
    duration: 600,
    easing: "ease-in",
    keyframes: [
      { time: 0, transforms: { opacity: 1 } },
      { time: 100, transforms: { opacity: 0 } },
    ],
    category: "exit",
    isPremium: false,
  },
  {
    id: "slide-out-right",
    name: "Slide Out Right",
    description: "Slide out to the right",
    duration: 700,
    easing: "ease-in",
    keyframes: [
      { time: 0, transforms: { translateZ: 0, opacity: 1 } },
      { time: 100, transforms: { translateZ: 100, opacity: 0 } },
    ],
    category: "exit",
    isPremium: false,
  },
];

interface AdvancedAnimationSystemProps {
  onSelectAnimation?: (preset: AnimationPreset) => void;
  onPreviewAnimation?: (preset: AnimationPreset) => void;
}

export function AdvancedAnimationSystem({
  onSelectAnimation,
  onPreviewAnimation,
}: AdvancedAnimationSystemProps) {
  const [selectedAnimation, setSelectedAnimation] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<string>("entrance");
  const [duration, setDuration] = useState(600);
  const [delay, setDelay] = useState(0);
  const [_customKeyframes, _setCustomKeyframes] = useState<AnimationKeyframe[]>([]);

  const filteredAnimations = ANIMATION_PRESETS.filter(
    (a) => a.category === currentCategory
  );

  const handleSelectAnimation = (animation: AnimationPreset) => {
    if (animation.isPremium) {
      toast.info("Premium animation. Upgrade to unlock.");
      return;
    }
    setSelectedAnimation(animation.id);
    onSelectAnimation?.(animation);
    toast.success(`Selected "${animation.name}" animation`);
  };

  const handlePreview = (animation: AnimationPreset) => {
    setIsPlaying(true);
    onPreviewAnimation?.(animation);
    setTimeout(() => setIsPlaying(false), animation.duration + 300);
  };

  const categories = ["entrance", "emphasis", "exit", "3d"] as const;

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-lg border border-amber-200 dark:border-amber-800">
      {/* Category Tabs */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Animation Categories
        </h3>
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setCurrentCategory(category)}
              className={`px-3 py-2 rounded text-xs font-semibold capitalize transition-all ${
                currentCategory === category
                  ? "bg-amber-500 text-white"
                  : "bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 hover:border-amber-400"
              }`}
            >
              {category === "3d" ? "3D" : category}
            </button>
          ))}
        </div>
      </div>

      {/* Animation Presets */}
      <div className="space-y-2">
        {filteredAnimations.map((animation) => (
          <button
            key={animation.id}
            onClick={() => handleSelectAnimation(animation)}
            className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
              selectedAnimation === animation.id
                ? "border-amber-500 bg-amber-100 dark:bg-amber-900"
                : "border-amber-200 dark:border-amber-700 hover:border-amber-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {animation.name}
                  {animation.isPremium && (
                    <span className="text-[10px] bg-yellow-400 text-yellow-900 px-2 py-1 rounded font-bold">
                      PREMIUM
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {animation.description}
                </p>
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  Duration: {animation.duration}ms • Easing: {animation.easing}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(animation);
                }}
                className="p-2 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800 transition-all"
                title="Preview animation"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
            </div>
          </button>
        ))}
      </div>

      {/* Configuration */}
      {selectedAnimation && (
        <div className="space-y-3 pt-3 border-t border-amber-200 dark:border-amber-700">
          {/* Duration Control */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Duration
              </label>
              <span className="text-sm font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded">
                {duration}ms
              </span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={(v) => setDuration(v[0])}
              min={100}
              max={2000}
              step={50}
              className="w-full"
            />
          </div>

          {/* Delay Control */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Delay
              </label>
              <span className="text-sm font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded">
                {delay}ms
              </span>
            </div>
            <Slider
              value={[delay]}
              onValueChange={(v) => setDelay(v[0])}
              min={0}
              max={1000}
              step={50}
              className="w-full"
            />
          </div>

          {/* Preview Button */}
          <Button
            onClick={() => {
              const animation = ANIMATION_PRESETS.find(
                (a) => a.id === selectedAnimation
              );
              if (animation) {handlePreview(animation);}
            }}
            className="w-full"
            variant="default"
          >
            <Play className="w-4 h-4 mr-2" />
            Preview Animation
          </Button>
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-700">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          ✨ Advanced animation system with entrance, emphasis, exit, and 3D effects for dynamic presentations.
        </p>
      </div>
    </div>
  );
}
