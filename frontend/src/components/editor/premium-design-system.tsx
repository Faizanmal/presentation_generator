"use client";

import { useState } from "react";
import {
  Palette,
  Sparkles,
  Copy,
  Check,
  Layers,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface GradientPreset {
  id: string;
  name: string;
  colors: string[];
  angle: number;
  category: string;
}

interface EffectPreset {
  id: string;
  name: string;
  blur: number;
  shadow: string;
  opacity: number;
  scale: number;
}

interface ShadowPreset {
  id: string;
  name: string;
  value: string;
  intensity: "soft" | "medium" | "hard";
}

const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: "sunset",
    name: "Sunset",
    colors: ["#FF6B6B", "#FFA500", "#FFD93D"],
    angle: 135,
    category: "warm",
  },
  {
    id: "ocean",
    name: "Ocean",
    colors: ["#1E90FF", "#00BFFF", "#87CEEB"],
    angle: 45,
    category: "cool",
  },
  {
    id: "forest",
    name: "Forest",
    colors: ["#2D5016", "#6CA752", "#95D5B2"],
    angle: 180,
    category: "natural",
  },
  {
    id: "purple-haze",
    name: "Purple Haze",
    colors: ["#667EEA", "#764BA2", "#F093FB"],
    angle: 225,
    category: "vibrant",
  },
  {
    id: "peach",
    name: "Peach",
    colors: ["#FFB347", "#FFA07A", "#FFB6C1"],
    angle: 90,
    category: "warm",
  },
  {
    id: "mint",
    name: "Mint",
    colors: ["#00D4FF", "#0093FF", "#00B8A9"],
    angle: 315,
    category: "cool",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    colors: ["#0F0C29", "#302B63", "#24243E"],
    angle: 45,
    category: "dark",
  },
  {
    id: "aurora",
    name: "Aurora",
    colors: ["#00C9FF", "#92FE9D", "#FFD700"],
    angle: 60,
    category: "vibrant",
  },
];

const SHADOW_PRESETS: ShadowPreset[] = [
  {
    id: "subtle",
    name: "Subtle",
    value: "0 1px 2px rgba(0,0,0,0.05)",
    intensity: "soft",
  },
  {
    id: "soft",
    name: "Soft",
    value: "0 4px 6px rgba(0,0,0,0.1)",
    intensity: "soft",
  },
  {
    id: "medium",
    name: "Medium",
    value: "0 10px 15px rgba(0,0,0,0.15)",
    intensity: "medium",
  },
  {
    id: "elevated",
    name: "Elevated",
    value: "0 20px 25px rgba(0,0,0,0.2)",
    intensity: "medium",
  },
  {
    id: "dramatic",
    name: "Dramatic",
    value: "0 25px 50px rgba(0,0,0,0.3)",
    intensity: "hard",
  },
];

const EFFECT_PRESETS: EffectPreset[] = [
  {
    id: "glass",
    name: "Glassmorphism",
    blur: 10,
    shadow: "0 8px 32px rgba(0,0,0,0.1)",
    opacity: 0.8,
    scale: 1,
  },
  {
    id: "neon",
    name: "Neon Glow",
    blur: 20,
    shadow: "0 0 20px rgba(0,255,255,0.5)",
    opacity: 1,
    scale: 1.02,
  },
  {
    id: "neumorphic",
    name: "Neumorphic",
    blur: 5,
    shadow: "5px 5px 10px rgba(0,0,0,0.1), -5px -5px 10px rgba(255,255,255,0.7)",
    opacity: 1,
    scale: 1,
  },
  {
    id: "material",
    name: "Material Design",
    blur: 0,
    shadow: "0 2px 4px rgba(0,0,0,0.12)",
    opacity: 1,
    scale: 1,
  },
];

const TYPOGRAPHY_EFFECTS = [
  { id: "bold-outline", name: "Bold Outline", css: "text-stroke: 1px" },
  { id: "soft-shadow", name: "Soft Shadow", css: "text-shadow: 2px 2px 4px" },
  { id: "deep-shadow", name: "Deep Shadow", css: "text-shadow: 3px 3px 0px" },
  { id: "neon", name: "Neon Glow", css: "text-shadow: 0 0 10px" },
];

interface PremiumDesignSystemProps {
  onApplyGradient?: (gradient: string) => void;
  onApplyShadow?: (shadow: ShadowPreset) => void;
  onApplyEffect?: (effect: EffectPreset) => void;
}

export function PremiumDesignSystem({
  onApplyGradient,
  onApplyShadow,
  onApplyEffect,
}: PremiumDesignSystemProps) {
  const [selectedGradient, setSelectedGradient] = useState<string | null>(null);
  const [selectedShadow, setSelectedShadow] = useState<string | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [blurAmount, setBlurAmount] = useState(10);
  const [opacity, setOpacity] = useState(100);
  const [copied, setCopied] = useState(false);

  const applyGradient = (preset: GradientPreset) => {
    const angle = preset.angle;
    const gradient =
      `linear-gradient(${angle}deg, ${preset.colors.join(", ")})`;
    setSelectedGradient(preset.id);
    onApplyGradient?.(gradient);
    toast.success(`Applied "${preset.name}" gradient`);
  };

  const applyShadow = (preset: ShadowPreset) => {
    setSelectedShadow(preset.id);
    onApplyShadow?.(preset);
    toast.success(`Applied "${preset.name}" shadow`);
  };

  const applyEffect = (preset: EffectPreset) => {
    setSelectedEffect(preset.id);
    onApplyEffect?.(preset);
    toast.success(`Applied "${preset.name}" effect`);
  };

  const copyGradientCode = () => {
    if (!selectedGradient) {return;}
    const gradient = GRADIENT_PRESETS.find((g) => g.id === selectedGradient);
    if (!gradient) {return;}
    const css = `background: linear-gradient(${gradient.angle}deg, ${gradient.colors.join(", ")});`;
    navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Gradient Presets */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4 text-purple-500" />
          <h3 className="font-semibold text-sm">Gradient Presets</h3>
        </div>

        {/* Group by category */}
        {["warm", "cool", "natural", "vibrant", "dark"].map((category) => {
          const gradients = GRADIENT_PRESETS.filter((g) => g.category === category);
          if (gradients.length === 0) {return null;}

          return (
            <div key={category} className="mb-4">
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 capitalize">
                {category}
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {gradients.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyGradient(preset)}
                    className={`h-20 rounded-lg border-2 transition-all cursor-pointer hover:scale-105 ${
                      selectedGradient === preset.id
                        ? "border-yellow-400 shadow-lg"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                    style={{
                      background: `linear-gradient(${preset.angle}deg, ${preset.colors.join(
                        ", "
                      )})`,
                    }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Copy Gradient Code */}
        {selectedGradient && (
          <button
            onClick={copyGradientCode}
            className="w-full mt-3 py-2 px-3 rounded text-xs font-semibold bg-purple-500 text-white hover:bg-purple-600 transition-all flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Gradient CSS
              </>
            )}
          </button>
        )}
      </div>

      {/* Shadow Presets */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-indigo-500" />
          <h3 className="font-semibold text-sm">Shadow Presets</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SHADOW_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyShadow(preset)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedShadow === preset.id
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                  : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 hover:border-indigo-400"
              }`}
              style={{ boxShadow: preset.value }}
            >
              <div className="text-xs font-semibold text-left">{preset.name}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 text-left mt-1">
                {preset.intensity}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Effect Presets */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-pink-500" />
          <h3 className="font-semibold text-sm">Visual Effects</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {EFFECT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyEffect(preset)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                selectedEffect === preset.id
                  ? "border-pink-500 bg-pink-50 dark:bg-pink-950"
                  : "border-slate-300 dark:border-slate-600 hover:border-pink-400"
              }`}
            >
              <div className="text-xs font-semibold">{preset.name}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Blur: {preset.blur}px
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Blur Control */}
      <div className="space-y-2 pt-4 border-t border-slate-300 dark:border-slate-600">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Blur Effect
          </label>
          <span className="text-sm font-mono bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
            {blurAmount}px
          </span>
        </div>
        <Slider
          value={[blurAmount]}
          onValueChange={(v) => setBlurAmount(v[0])}
          min={0}
          max={50}
          step={1}
          className="w-full"
        />
      </div>

      {/* Opacity Control */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Opacity
          </label>
          <span className="text-sm font-mono bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
            {opacity}%
          </span>
        </div>
        <Slider
          value={[opacity]}
          onValueChange={(v) => setOpacity(v[0])}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      {/* Info */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-600">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          ✨ Premium design system with handcrafted gradients, shadows, and effects for stunning presentations.
        </p>
      </div>
    </div>
  );
}
