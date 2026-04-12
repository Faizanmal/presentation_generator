"use client";

import { useState } from "react";
import { Sparkles, Layout, Focus } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface VisualHierarchyRule {
  element: string;
  sizeMultiplier: number;
  opacityLevel: number;
  blurOffset: number;
  description: string;
}

export interface SpatialComposition {
  id: string;
  name: string;
  description: string;
  ratio: string;
  focusArea: string;
}

export interface ContentCompositionConfig {
  title: {
    priority: number;
    size: number;
    opacity: number;
  };
  subtitle: {
    priority: number;
    size: number;
    opacity: number;
  };
  body: {
    priority: number;
    size: number;
    opacity: number;
  };
  accent: {
    priority: number;
    size: number;
    opacity: number;
  };
}

const _VISUAL_HIERARCHY_RULES: VisualHierarchyRule[] = [
  {
    element: "Primary Title",
    sizeMultiplier: 1,
    opacityLevel: 1,
    blurOffset: 0,
    description: "Main focal point - Maximum size and opacity",
  },
  {
    element: "Secondary Title",
    sizeMultiplier: 0.65,
    opacityLevel: 0.9,
    blurOffset: 0,
    description: "Supporting element",
  },
  {
    element: "Body Text",
    sizeMultiplier: 0.4,
    opacityLevel: 0.7,
    blurOffset: 0,
    description: "Supporting information",
  },
  {
    element: "Background",
    sizeMultiplier: 1,
    opacityLevel: 0.3,
    blurOffset: 5,
    description: "Non-focal elements",
  },
];

const SPATIAL_COMPOSITIONS: SpatialComposition[] = [
  {
    id: "rule-of-thirds",
    name: "Rule of Thirds",
    description: "Classic compositional rule - divide into 9 equal parts",
    ratio: "1:3:1",
    focusArea: "Center power points",
  },
  {
    id: "golden-ratio",
    name: "Golden Ratio",
    description: "Natural fibonacci sequence - aesthetically pleasing",
    ratio: "1.618:1",
    focusArea: "Spiral focal points",
  },
  {
    id: "symmetrical",
    name: "Symmetrical",
    description: "Mirror composition - balanced and formal",
    ratio: "1:1",
    focusArea: "Center axis",
  },
  {
    id: "asymmetrical",
    name: "Asymmetrical",
    description: "Dynamic composition - interesting and engaging",
    ratio: "2:1",
    focusArea: "Offset focal point",
  },
  {
    id: "diagonal",
    name: "Diagonal Flow",
    description: "Leading lines create movement",
    ratio: "Dynamic",
    focusArea: "Corner to corner",
  },
];

interface AdvancedContentCompositionProps {
  onApplyHierarchy?: (config: ContentCompositionConfig) => void;
  onSelectComposition?: (composition: SpatialComposition) => void;
}

export function AdvancedContentComposition({
  onApplyHierarchy,
  onSelectComposition,
}: AdvancedContentCompositionProps) {
  const [config, setConfig] = useState<ContentCompositionConfig>({
    title: { priority: 1, size: 72, opacity: 100 },
    subtitle: { priority: 2, size: 40, opacity: 90 },
    body: { priority: 3, size: 16, opacity: 70 },
    accent: { priority: 4, size: 24, opacity: 80 },
  });

  const [selectedComposition, setSelectedComposition] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<string | null>(null);

  const handleUpdateConfig = (
    element: keyof ContentCompositionConfig,
    property: string,
    value: unknown
  ) => {
    const newConfig = {
      ...config,
      [element]: {
        ...config[element],
        [property]: value,
      },
    };
    setConfig(newConfig);
    onApplyHierarchy?.(newConfig);
  };

  const handleSelectComposition = (composition: SpatialComposition) => {
    setSelectedComposition(composition.id);
    onSelectComposition?.(composition);
    toast.success(`Applied "${composition.name}" composition`);
  };

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950 dark:to-blue-950 rounded-lg border border-sky-200 dark:border-sky-800">
      {/* Visual Hierarchy Configuration */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Visual Hierarchy
        </h3>

        {/* Title Configuration */}
        <div className="space-y-3">
          {(
            ["title", "subtitle", "body", "accent"] as const
          ).map((elementKey) => {
            const element = config[elementKey];
            const elementName =
              elementKey.charAt(0).toUpperCase() + elementKey.slice(1);

            return (
              <div
                key={elementKey}
                className="p-3 rounded-lg border border-sky-200 dark:border-sky-700 bg-white dark:bg-slate-900 space-y-2"
              >
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {elementName}
                </h4>

                {/* Priority */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      Priority
                    </label>
                    <span className="text-xs font-mono">{element.priority}</span>
                  </div>
                  <Slider
                    value={[element.priority]}
                    onValueChange={(v) =>
                      handleUpdateConfig(elementKey, "priority", v[0])
                    }
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Size */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      Size
                    </label>
                    <span className="text-xs font-mono">{element.size}px</span>
                  </div>
                  <Slider
                    value={[element.size]}
                    onValueChange={(v) =>
                      handleUpdateConfig(elementKey, "size", v[0])
                    }
                    min={8}
                    max={96}
                    step={2}
                    className="w-full"
                  />
                </div>

                {/* Opacity */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      Opacity
                    </label>
                    <span className="text-xs font-mono">{element.opacity}%</span>
                  </div>
                  <Slider
                    value={[element.opacity]}
                    onValueChange={(v) =>
                      handleUpdateConfig(elementKey, "opacity", v[0])
                    }
                    min={10}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spatial Composition */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
          <Layout className="w-4 h-4" />
          Spatial Composition Rules
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {SPATIAL_COMPOSITIONS.map((composition) => (
            <button
              key={composition.id}
              onClick={() => handleSelectComposition(composition)}
              className={`p-3 rounded-lg border-2 transition-all text-left text-xs ${
                selectedComposition === composition.id
                  ? "border-sky-500 bg-sky-100 dark:bg-sky-900"
                  : "border-sky-200 dark:border-sky-700 hover:border-sky-400"
              }`}
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {composition.name}
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                {composition.description}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1 font-mono">
                {composition.ratio}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Focus Modes */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
          <Focus className="w-4 h-4" />
          Focus Modes
        </h3>
        <div className="flex gap-2 flex-wrap">
          {["content-focus", "title-focus", "image-focus", "balanced"].map(
            (mode) => (
              <button
                key={mode}
                onClick={() => setFocusMode(mode)}
                className={`px-3 py-2 rounded text-xs font-semibold transition-all ${
                  focusMode === mode
                    ? "bg-sky-500 text-white"
                    : "bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-700 hover:border-sky-400"
                }`}
              >
                {mode.replace("-", " ").toUpperCase()}
              </button>
            )
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-sky-200 dark:border-sky-700">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          🎯 Professional composition system using rule of thirds, golden ratio, and visual hierarchy principles for eye-catching presentations.
        </p>
      </div>
    </div>
  );
}
