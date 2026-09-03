"use client";

import { useState } from "react";
import {
  Download,
  Copy,
  Check,
  Star,
} from "lucide-react";
import { toast } from "sonner";

export interface DesignPreset {
  id: string;
  name: string;
  description: string;
  category: "corporate" | "creative" | "minimal" | "vibrant" | "premium";
  preview: {
    colors: string[];
    fonts: string[];
    style: string;
  };
  cssVariables: Record<string, string>;
  isPremium: boolean;
}

const PRESENTATION_DESIGN_PRESETS: DesignPreset[] = [
  {
    id: "corporate",
    name: "Corporate Professional",
    description: "Clean, business-focused design system",
    category: "corporate",
    preview: {
      colors: ["#003366", "#0052CC", "#F5F5F5"],
      fonts: ["Inter", "Roboto"],
      style: "Minimalist with focus on clarity",
    },
    cssVariables: {
      "--primary-color": "#003366",
      "--secondary-color": "#0052CC",
      "--accent-color": "#FF6B35",
      "--neutral-color": "#F5F5F5",
      "--text-primary": "#1F2937",
      "--text-secondary": "#6B7280",
      "--background": "#FFFFFF",
      "--border-radius": "8px",
      "--font-family": "Inter, sans-serif",
      "--shadow": "0 4px 6px rgba(0, 0, 0, 0.1)",
    },
    isPremium: false,
  },
  {
    id: "creative-burst",
    name: "Creative Burst",
    description: "Bold, artistic, eye-catching design",
    category: "creative",
    preview: {
      colors: ["#FF006E", "#8338EC", "#3A86FF"],
      fonts: ["Poppins", "Playfair Display"],
      style: "Vibrant with artistic flair",
    },
    cssVariables: {
      "--primary-color": "#FF006E",
      "--secondary-color": "#8338EC",
      "--accent-color": "#3A86FF",
      "--neutral-color": "#F8F9FA",
      "--text-primary": "#FFFFFF",
      "--text-secondary": "#E0E0E0",
      "--background": "#1A1A2E",
      "--border-radius": "16px",
      "--font-family": "Poppins, sans-serif",
      "--shadow": "0 8px 16px rgba(255, 0, 110, 0.3)",
    },
    isPremium: true,
  },
  {
    id: "minimal-zen",
    name: "Minimal Zen",
    description: "Simplistic, calm, and focused design",
    category: "minimal",
    preview: {
      colors: ["#2D3436", "#FFFFFF", "#DFE6E9"],
      fonts: ["Inter", "Lora"],
      style: "Zen minimalism with breathing room",
    },
    cssVariables: {
      "--primary-color": "#2D3436",
      "--secondary-color": "#DFE6E9",
      "--accent-color": "#00B894",
      "--neutral-color": "#FFFFFF",
      "--text-primary": "#2D3436",
      "--text-secondary": "#636E72",
      "--background": "#FAFAFA",
      "--border-radius": "4px",
      "--font-family": "Inter, sans-serif",
      "--shadow": "0 2px 4px rgba(0, 0, 0, 0.05)",
    },
    isPremium: false,
  },
  {
    id: "vibrant-tech",
    name: "Vibrant Tech",
    description: "Modern, tech-forward, future-ready",
    category: "vibrant",
    preview: {
      colors: ["#00D4FF", "#0093FF", "#00B8A9"],
      fonts: ["Montserrat", "Space Mono"],
      style: "Cyberpunk meets modern", 
    },
    cssVariables: {
      "--primary-color": "#00D4FF",
      "--secondary-color": "#0093FF",
      "--accent-color": "#00B8A9",
      "--neutral-color": "#0F172A",
      "--text-primary": "#00D4FF",
      "--text-secondary": "#64748B",
      "--background": "#020617",
      "--border-radius": "12px",
      "--font-family": "Montserrat, sans-serif",
      "--shadow": "0 0 20px rgba(0, 212, 255, 0.3)",
    },
    isPremium: true,
  },
  {
    id: "luxury-gold",
    name: "Luxury Gold",
    description: "Premium, elegant, sophisticated",
    category: "premium",
    preview: {
      colors: ["#1A0000", "#D4AF37", "#F5E6D3"],
      fonts: ["Playfair Display", "Lora"],
      style: "Elegant luxury branding",
    },
    cssVariables: {
      "--primary-color": "#1A0000",
      "--secondary-color": "#D4AF37",
      "--accent-color": "#F5E6D3",
      "--neutral-color": "#FFFFFF",
      "--text-primary": "#1A0000",
      "--text-secondary": "#8B7355",
      "--background": "#FEFEF0",
      "--border-radius": "0px",
      "--font-family": "Playfair Display, serif",
      "--shadow": "0 4px 12px rgba(0, 0, 0, 0.15)",
    },
    isPremium: true,
  },
  {
    id: "startup-energy",
    name: "Startup Energy",
    description: "Fast-paced, growth-focused design",
    category: "vibrant",
    preview: {
      colors: ["#FF6B35", "#004E89", "#F7B801"],
      fonts: ["Montserrat", "Poppins"],
      style: "Dynamic and energetic",
    },
    cssVariables: {
      "--primary-color": "#FF6B35",
      "--secondary-color": "#004E89",
      "--accent-color": "#F7B801",
      "--neutral-color": "#F3F0FF",
      "--text-primary": "#004E89",
      "--text-secondary": "#8E7B8E",
      "--background": "#FFFFFF",
      "--border-radius": "20px",
      "--font-family": "Montserrat, sans-serif",
      "--shadow": "0 8px 24px rgba(255, 107, 53, 0.2)",
    },
    isPremium: true,
  },
];

interface PresentationDesignPresetsProps {
  onApplyPreset?: (preset: DesignPreset) => void;
  onDownloadPreset?: (preset: DesignPreset) => void;
}

export function PresentationDesignPresets({
  onApplyPreset,
}: PresentationDesignPresetsProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredPresets =
    activeCategory === "all"
      ? PRESENTATION_DESIGN_PRESETS
      : PRESENTATION_DESIGN_PRESETS.filter(
        (p) => p.category === activeCategory
      );

  const handleApplyPreset = (preset: DesignPreset) => {
    if (preset.isPremium) {
      toast.info("This is a premium preset. Upgrade to unlock.");
      return;
    }
    setSelectedPreset(preset.id);
    onApplyPreset?.(preset);
    toast.success(`Applied "${preset.name}" design preset`);
  };

  const copyPresetCode = () => {
    if (!selectedPreset) {return;}
    const preset = PRESENTATION_DESIGN_PRESETS.find(
      (p) => p.id === selectedPreset
    );
    if (!preset) {return;}
    const code = Object.entries(preset.cssVariables)
      .map(([key, value]) => `${key}: ${value};`)
      .join("\n");
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPreset = () => {
    if (!selectedPreset) {return;}
    const preset = PRESENTATION_DESIGN_PRESETS.find(
      (p) => p.id === selectedPreset
    );
    if (!preset) {return;}
    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${preset.id}-preset.json`;
    a.click();
    toast.success("Preset downloaded");
  };

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950 rounded-lg border border-rose-200 dark:border-rose-800">
      {/* Category Filter */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Categories
        </h3>
        <div className="flex flex-wrap gap-2">
          {["all", ...Array.from(new Set(PRESENTATION_DESIGN_PRESETS.map((p) => p.category)))].map(
            (category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-3 py-1 rounded text-xs font-semibold capitalize transition-all ${
                  activeCategory === category
                    ? "bg-rose-500 text-white"
                    : "bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 hover:border-rose-400"
                }`}
              >
                {category}
              </button>
            )
          )}
        </div>
      </div>

      {/* Presets Grid */}
      <div className="space-y-3">
        {filteredPresets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handleApplyPreset(preset)}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selectedPreset === preset.id
                ? "border-rose-500 bg-rose-100 dark:bg-rose-900"
                : "border-rose-200 dark:border-rose-700 hover:border-rose-400"
            } ${preset.isPremium ? "opacity-75" : ""}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {preset.name}
                  </h4>
                  {preset.isPremium && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-yellow-400 text-yellow-900">
                      <Star className="w-3 h-3" />
                      PREMIUM
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {preset.description}
                </p>
              </div>
            </div>

            {/* Color Palette */}
            <div className="flex gap-2 mb-3">
              {preset.preview.colors.map((color) => (
                <div
                  key={color}
                  className="w-8 h-8 rounded border border-slate-300 dark:border-slate-600"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>

            {/* Font & Style */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Fonts:
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  {preset.preview.fonts.join(", ")}
                </p>
              </div>
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Style:
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  {preset.preview.style}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      {selectedPreset && (
        <div className="flex gap-2">
          <button
            onClick={copyPresetCode}
            className="flex-1 py-2 px-3 rounded text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-all flex items-center justify-center gap-2"
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
            onClick={downloadPreset}
            className="flex-1 py-2 px-3 rounded text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-700">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          🎯 Complete presentation design systems with pre-configured colors, typography, and visual hierarchy.
        </p>
      </div>
    </div>
  );
}
