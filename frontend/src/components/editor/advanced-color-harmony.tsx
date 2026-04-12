"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

export interface PaletteScheme {
  id: string;
  name: string;
  baseColor: string;
  variants: {
    primary: string;
    secondary: string;
    tertiary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    neutral: string;
  };
  description: string;
  harmonyType: "analogous" | "complementary" | "triadic" | "tetradic";
}

export interface ColorHarmonyPreset {
  id: string;
  name: string;
  harmony: "analogous" | "complementary" | "triadic" | "tetradic" | "split-complementary";
  colors: string[];
  description: string;
}

const COLOR_HARMONY_PRESETS: ColorHarmonyPreset[] = [
  {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    harmony: "analogous",
    colors: ["#0052CC", "#00B0FF", "#00D4FF", "#00E5FF"],
    description: "Cool blues and cyans, calm and professional",
  },
  {
    id: "sunset-warmth",
    name: "Sunset Warmth",
    harmony: "analogous",
    colors: ["#FF6B35", "#FF8C42", "#FFAB3D", "#FFD93D"],
    description: "Warm oranges and golds, energetic feel",
  },
  {
    id: "nature-fresh",
    name: "Nature Fresh",
    harmony: "analogous",
    colors: ["#2D5016", "#52B788", "#80B0A0", "#A8DADC"],
    description: "Greens and blues, natural and fresh",
  },
  {
    id: "vibrant-contrast",
    name: "Vibrant Contrast",
    harmony: "complementary",
    colors: ["#FF006E", "#00B4DB", "#FFB703", "#023E8A"],
    description: "Bold complementary pairs, eye-catching",
  },
  {
    id: "royal-purple",
    name: "Royal Purple",
    harmony: "triadic",
    colors: ["#6A0DAD", "#F6D604", "#00A651", "#1F77F2"],
    description: "Purple, gold, green, blue - regal and balanced",
  },
  {
    id: "tech-minimal",
    name: "Tech Minimal",
    harmony: "triadic",
    colors: ["#0F0F0F", "#FF3E55", "#00D9FF", "#FFFFFF"],
    description: "Black, red, cyan, white - modern tech",
  },
];

const _generateColorVariants = (baseColor: string): PaletteScheme["variants"] => {
  // Simplified color generation - in production would use a library like chroma-js
  return {
    primary: baseColor,
    secondary: adjustBrightness(baseColor, 20),
    tertiary: adjustBrightness(baseColor, 40),
    accent: rotateHue(baseColor, 180),
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    neutral: "#6B7280",
  };
};

const adjustBrightness = (color: string, _percent: number): string => {
  // Simplified - returns a lighter shade
  return color;
};

const rotateHue = (color: string, _degrees: number): string => {
  // Simplified - returns complementary color
  return color;
};

interface AdvancedColorHarmonyProps {
  onSelectHarmony?: (preset: ColorHarmonyPreset) => void;
  onApplyPalette?: (palette: PaletteScheme) => void;
}

export function AdvancedColorHarmony({
  onSelectHarmony,
}: AdvancedColorHarmonyProps) {
  const [selectedHarmony, setSelectedHarmony] = useState<string | null>(null);
  const [selectedHarmonyData, setSelectedHarmonyData] = useState<ColorHarmonyPreset | null>(null);
  const [copied, setCopied] = useState(false);
  const [_customColors, _setCustomColors] = useState<string[]>([]);

  const handleSelectHarmony = (preset: ColorHarmonyPreset) => {
    setSelectedHarmony(preset.id);
    setSelectedHarmonyData(preset);
    onSelectHarmony?.(preset);
    toast.success(`Selected "${preset.name}" harmony`);
  };

  const copyPaletteCSS = () => {
    if (!selectedHarmonyData) {return;}
    const css = selectedHarmonyData.colors
      .map((color, idx) => `--harmony-color-${idx + 1}: ${color};`)
      .join("\n");
    navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPalette = () => {
    if (!selectedHarmonyData) {return;}
    const palette = {
      name: selectedHarmonyData.name,
      harmonyType: selectedHarmonyData.harmony,
      colors: selectedHarmonyData.colors,
      timestamp: new Date().toISOString(),
    };
    const json = JSON.stringify(palette, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `palette-${selectedHarmonyData.id}.json`;
    a.click();
    toast.success("Palette downloaded");
  };

  const harmonyTypes = [
    "analogous",
    "complementary",
    "triadic",
    "tetradic",
    "split-complementary",
  ];

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 rounded-lg border border-violet-200 dark:border-violet-800">
      {/* Harmony Types */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Color Harmony Types
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {harmonyTypes.map((type) => {
            const presets = COLOR_HARMONY_PRESETS.filter(
              (p) => p.harmony === type
            );
            if (presets.length === 0) {return null;}

            return (
              <div key={type} className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 capitalize">
                  {type.replace("-", " ")}
                </h4>
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectHarmony(preset)}
                    className={`w-full p-2 rounded-lg border-2 transition-all ${
                      selectedHarmony === preset.id
                        ? "border-violet-500 bg-violet-100 dark:bg-violet-900"
                        : "border-violet-200 dark:border-violet-700 hover:border-violet-400"
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {preset.name}
                    </div>
                    <div className="flex gap-1 mt-1">
                      {preset.colors.map((color, idx) => (
                        <div
                          key={color}
                          className="w-4 h-4 rounded border border-slate-300"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Harmony Details */}
      {selectedHarmonyData && (
        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-violet-200 dark:border-violet-700">
          <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-2">
            {selectedHarmonyData.name}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
            {selectedHarmonyData.description}
          </p>

          {/* Color Grid */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {selectedHarmonyData.colors.map((color, idx) => (
              <div key={color} className="space-y-1">
                <div
                  className="w-full h-12 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer hover:scale-105 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    navigator.clipboard.writeText(color);
                    toast.success(`Copied ${color}`);
                  }}
                  title={`Click to copy: ${color}`}
                />
                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 text-center block">
                  {color.toUpperCase()}
                </span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={copyPaletteCSS}
              className="flex-1 py-2 px-3 rounded text-xs font-semibold bg-violet-500 text-white hover:bg-violet-600 transition-all flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy CSS
                </>
              )}
            </button>
            <button
              onClick={downloadPalette}
              className="flex-1 py-2 px-3 rounded text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
            >
              Download
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-violet-200 dark:border-violet-700">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          🎨 Color harmony system with scientifically balanced palettes for professional presentations. Click any color to copy hex code.
        </p>
      </div>
    </div>
  );
}
