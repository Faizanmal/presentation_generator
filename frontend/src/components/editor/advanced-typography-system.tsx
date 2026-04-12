"use client";

import { useState, useCallback } from "react";
import {
  Type,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface TypographyPreset {
  id: string;
  name: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  fontFamily: string;
  description: string;
}

export interface TextStyle {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecoration: boolean;
  fontStyle: "normal" | "italic";
}

const TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  {
    id: "hero-title",
    name: "Hero Title",
    fontSize: 72,
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: -2,
    textTransform: "none",
    fontFamily: "Inter",
    description: "Large dramatic headlines",
  },
  {
    id: "section-title",
    name: "Section Title",
    fontSize: 48,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: -0.5,
    textTransform: "none",
    fontFamily: "Inter",
    description: "Bold section headings",
  },
  {
    id: "subtitle",
    name: "Subtitle",
    fontSize: 28,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: 0,
    textTransform: "none",
    fontFamily: "Inter",
    description: "Supporting headlines",
  },
  {
    id: "body-large",
    name: "Body Large",
    fontSize: 20,
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: 0.3,
    textTransform: "none",
    fontFamily: "Inter",
    description: "Primary body text",
  },
  {
    id: "body-regular",
    name: "Body Regular",
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
    textTransform: "none",
    fontFamily: "Inter",
    description: "Standard body text",
  },
  {
    id: "caption",
    name: "Caption",
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily: "Inter",
    description: "Small labels and captions",
  },
  {
    id: "quote",
    name: "Quote",
    fontSize: 32,
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: 0.5,
    textTransform: "none",
    fontFamily: "Georgia",
    description: "Italic quotes and testimonials",
  },
];

const FONT_FAMILIES = [
  "Inter",
  "Playfair Display",
  "Montserrat",
  "Poppins",
  "Roboto",
  "Lora",
  "Merriweather",
  "Georgia",
  "Courier New",
];

const FONT_WEIGHTS = [
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Extra Bold" },
];

interface AdvancedTypographyProps {
  onApplyStyle: (style: TextStyle) => void;
  currentStyle?: Partial<TextStyle>;
}

export function AdvancedTypographySystem({
  onApplyStyle,
  currentStyle = {},
}: AdvancedTypographyProps) {
  const [textStyle, setTextStyle] = useState<TextStyle>({
    fontSize: currentStyle.fontSize || 16,
    fontWeight: currentStyle.fontWeight || 400,
    lineHeight: currentStyle.lineHeight || 1.5,
    letterSpacing: currentStyle.letterSpacing || 0,
    textTransform: currentStyle.textTransform || "none",
    textDecoration: currentStyle.textDecoration || false,
    fontStyle: currentStyle.fontStyle || "normal",
  });

  const [selectedFamily, setSelectedFamily] = useState<string>("Inter");
  const [copied, setCopied] = useState(false);

  const applyPreset = useCallback((preset: TypographyPreset) => {
    const newStyle: TextStyle = {
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight,
      lineHeight: preset.lineHeight,
      letterSpacing: preset.letterSpacing,
      textTransform: preset.textTransform,
      textDecoration: false,
      fontStyle: preset.textTransform === "none" ? "normal" : "normal",
    };
    setTextStyle(newStyle);
    setSelectedFamily(preset.fontFamily);
    onApplyStyle(newStyle);
    toast.success(`Applied "${preset.name}" preset`);
  }, [onApplyStyle]);

  const handleStyleChange = useCallback((updates: Partial<TextStyle>) => {
    const newStyle = { ...textStyle, ...updates };
    setTextStyle(newStyle);
    onApplyStyle(newStyle);
  }, [textStyle, onApplyStyle]);

  const copyStyleConfig = () => {
    const config = JSON.stringify(
      { fontFamily: selectedFamily, ...textStyle },
      null,
      2
    );
    navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Typography Presets */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <h3 className="font-semibold text-sm">Typography Presets</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TYPOGRAPHY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="p-3 rounded-lg border border-slate-300 dark:border-slate-600 hover:border-blue-500 bg-white dark:bg-slate-950 transition-all group cursor-pointer text-left"
              title={preset.description}
            >
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600">
                {preset.name}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {preset.fontSize}px • {preset.fontWeight}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Font Family Selection */}
      <div>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
          Font Family
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
              size="sm"
            >
              {selectedFamily}
              <Type className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {FONT_FAMILIES.map((family) => (
              <DropdownMenuItem
                key={family}
                onClick={() => setSelectedFamily(family)}
                style={{ fontFamily: family }}
              >
                {family}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Font Size Control */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Font Size
          </label>
          <span className="text-sm font-mono bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
            {textStyle.fontSize}px
          </span>
        </div>
        <Slider
          value={[textStyle.fontSize]}
          onValueChange={(v) =>
            handleStyleChange({ fontSize: v[0] })
          }
          min={8}
          max={96}
          step={1}
          className="w-full"
        />
      </div>

      {/* Font Weight Control */}
      <div>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
          Font Weight
        </label>
        <div className="grid grid-cols-3 gap-2">
          {FONT_WEIGHTS.map((weight) => (
            <button
              key={weight.value}
              onClick={() => handleStyleChange({ fontWeight: weight.value })}
              className={`py-2 px-3 rounded text-xs font-semibold transition-all ${
                textStyle.fontWeight === weight.value
                  ? "bg-blue-500 text-white"
                  : "bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 hover:border-blue-400"
              }`}
              style={{ fontWeight: weight.value }}
            >
              {weight.label}
            </button>
          ))}
        </div>
      </div>

      {/* Line Height Control */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Line Height
          </label>
          <span className="text-sm font-mono bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
            {textStyle.lineHeight.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[textStyle.lineHeight * 10]}
          onValueChange={(v) =>
            handleStyleChange({ lineHeight: v[0] / 10 })
          }
          min={8}
          max={30}
          step={1}
          className="w-full"
        />
      </div>

      {/* Letter Spacing Control */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Letter Spacing
          </label>
          <span className="text-sm font-mono bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
            {textStyle.letterSpacing}px
          </span>
        </div>
        <Slider
          value={[textStyle.letterSpacing]}
          onValueChange={(v) =>
            handleStyleChange({ letterSpacing: v[0] })
          }
          min={-4}
          max={8}
          step={0.5}
          className="w-full"
        />
      </div>

      {/* Text Transform */}
      <div>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
          Text Transform
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["none", "uppercase", "lowercase", "capitalize"] as const).map(
            (transform) => (
              <button
                key={transform}
                onClick={() =>
                  handleStyleChange({ textTransform: transform })
                }
                className={`py-2 px-3 rounded text-xs font-semibold transition-all capitalize ${
                  textStyle.textTransform === transform
                    ? "bg-blue-500 text-white"
                    : "bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 hover:border-blue-400"
                }`}
              >
                {transform}
              </button>
            )
          )}
        </div>
      </div>

      {/* Additional Styles */}
      <div className="flex gap-2">
        <button
          onClick={() =>
            handleStyleChange({
              fontStyle: textStyle.fontStyle === "italic" ? "normal" : "italic",
            })
          }
          className={`flex-1 py-2 px-3 rounded text-xs font-semibold transition-all italic ${
            textStyle.fontStyle === "italic"
              ? "bg-blue-500 text-white"
              : "bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 hover:border-blue-400"
          }`}
        >
          Italic
        </button>
        <button
          onClick={() =>
            handleStyleChange({
              textDecoration: !textStyle.textDecoration,
            })
          }
          className={`flex-1 py-2 px-3 rounded text-xs font-semibold transition-all underline ${
            textStyle.textDecoration
              ? "bg-blue-500 text-white"
              : "bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 hover:border-blue-400"
          }`}
        >
          Underline
        </button>
      </div>

      {/* Copy Style Button */}
      <button
        onClick={copyStyleConfig}
        className="w-full py-2 px-3 rounded text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy Style Config
          </>
        )}
      </button>

      {/* Preview */}
      <div className="p-4 bg-white dark:bg-slate-950 rounded-lg border border-slate-300 dark:border-slate-600">
        <div
          style={{
            fontSize: `${textStyle.fontSize}px`,
            fontWeight: textStyle.fontWeight,
            lineHeight: textStyle.lineHeight,
            letterSpacing: `${textStyle.letterSpacing}px`,
            textTransform: textStyle.textTransform,
            fontStyle: textStyle.fontStyle,
            textDecoration: textStyle.textDecoration ? "underline" : "none",
            fontFamily: selectedFamily,
          }}
          className="text-slate-900 dark:text-slate-100"
        >
          The quick brown fox jumps over the lazy dog
        </div>
      </div>
    </div>
  );
}
