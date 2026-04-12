"use client";

import { useState } from "react";
import {
  Layout,
  Grid3x3,
  Copy,
  Check,
  Sparkles,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  preview: {
    areas: Array<{ name: string; size: string; color: string }>;
  };
  gridTemplate: string;
  minBlocks: number;
  category: "content" | "data" | "gallery" | "hero" | "comparison";
}

export interface LayoutComposition {
  id: string;
  name: string;
  sections: string[];
  description: string;
}

const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "title-subtitle",
    name: "Title + Subtitle",
    description: "Classic two-line title layout",
    preview: {
      areas: [
        { name: "Title", size: "70%", color: "#3B82F6" },
        { name: "Subtitle", size: "30%", color: "#93C5FD" },
      ],
    },
    gridTemplate: "1fr 0.5fr",
    minBlocks: 2,
    category: "content",
  },
  {
    id: "hero-with-image",
    name: "Hero + Image",
    description: "Title with featured image",
    preview: {
      areas: [
        { name: "Title", size: "40%", color: "#3B82F6" },
        { name: "Image", size: "60%", color: "#BFDBFE" },
      ],
    },
    gridTemplate: "1fr 1fr",
    minBlocks: 2,
    category: "hero",
  },
  {
    id: "three-column",
    name: "Three Column",
    description: "Equal three-column layout",
    preview: {
      areas: [
        { name: "Col 1", size: "33%", color: "#3B82F6" },
        { name: "Col 2", size: "33%", color: "#60A5FA" },
        { name: "Col 3", size: "33%", color: "#93C5FD" },
      ],
    },
    gridTemplate: "1fr 1fr 1fr",
    minBlocks: 3,
    category: "gallery",
  },
  {
    id: "left-sidebar-content",
    name: "Left Sidebar",
    description: "Sidebar navigation + main content",
    preview: {
      areas: [
        { name: "Sidebar", size: "25%", color: "#3B82F6" },
        { name: "Content", size: "75%", color: "#BFDBFE" },
      ],
    },
    gridTemplate: "0.3fr 1fr",
    minBlocks: 2,
    category: "content",
  },
  {
    id: "right-sidebar-content",
    name: "Right Sidebar",
    description: "Main content + right sidebar",
    preview: {
      areas: [
        { name: "Content", size: "75%", color: "#BFDBFE" },
        { name: "Sidebar", size: "25%", color: "#3B82F6" },
      ],
    },
    gridTemplate: "1fr 0.3fr",
    minBlocks: 2,
    category: "content",
  },
  {
    id: "grid-2x2",
    name: "2x2 Grid",
    description: "Four equal quadrants",
    preview: {
      areas: [
        { name: "1", size: "25%", color: "#3B82F6" },
        { name: "2", size: "25%", color: "#60A5FA" },
        { name: "3", size: "25%", color: "#93C5FD" },
        { name: "4", size: "25%", color: "#BFDBFE" },
      ],
    },
    gridTemplate: "1fr 1fr / 1fr 1fr",
    minBlocks: 4,
    category: "gallery",
  },
  {
    id: "masthead",
    name: "Masthead",
    description: "Full width hero + content below",
    preview: {
      areas: [
        { name: "Hero", size: "50%", color: "#3B82F6" },
        { name: "Content", size: "50%", color: "#BFDBFE" },
      ],
    },
    gridTemplate: "auto auto",
    minBlocks: 2,
    category: "hero",
  },
  {
    id: "comparison-table",
    name: "Comparison",
    description: "Side-by-side comparison layout",
    preview: {
      areas: [
        { name: "Option A", size: "45%", color: "#3B82F6" },
        { name: "VS", size: "10%", color: "#FBBF24" },
        { name: "Option B", size: "45%", color: "#8B5CF6" },
      ],
    },
    gridTemplate: "1fr 0.2fr 1fr",
    minBlocks: 3,
    category: "comparison",
  },
  {
    id: "data-showcase",
    name: "Data Showcase",
    description: "Large metric + supporting details",
    preview: {
      areas: [
        { name: "Main Metric", size: "50%", color: "#3B82F6" },
        { name: "Details", size: "50%", color: "#BFDBFE" },
      ],
    },
    gridTemplate: "2fr 1fr",
    minBlocks: 2,
    category: "data",
  },
  {
    id: "card-grid",
    name: "Card Grid (3x3)",
    description: "Nine card grid layout",
    preview: {
      areas: Array(9)
        .fill(null)
        .map((_, i) => ({
          name: `${i + 1}`,
          size: "33%",
          color: `hsl(${210 + i * 5}, 70%, ${50 + i * 5}%)`,
        })),
    },
    gridTemplate: "1fr 1fr 1fr / 1fr 1fr 1fr",
    minBlocks: 9,
    category: "gallery",
  },
];

const LAYOUT_COMPOSITIONS: LayoutComposition[] = [
  {
    id: "story-telling",
    name: "Story Telling",
    sections: [
      "Title Slide",
      "Problem Statement",
      "Solution Overview",
      "Implementation",
      "Results & Metrics",
      "Call to Action",
    ],
    description: "Narrative-driven presentation flow",
  },
  {
    id: "data-driven",
    name: "Data-Driven",
    sections: [
      "Title",
      "Key Metrics",
      "Trend Analysis",
      "Comparisons",
      "Insights",
      "Recommendations",
    ],
    description: "Data visualization and insights",
  },
  {
    id: "product-pitch",
    name: "Product Pitch",
    sections: [
      "Product Hero",
      "Problem",
      "Solution",
      "Features",
      "Benefits",
      "Pricing",
      "CTA",
    ],
    description: "Perfect for product launches",
  },
  {
    id: "training",
    name: "Training Module",
    sections: [
      "Learning Objectives",
      "Concept 1",
      "Concept 2",
      "Practice",
      "Q&A",
      "Summary",
    ],
    description: "Educational content structure",
  },
];

interface AdvancedLayoutComposerProps {
  onSelectLayout?: (template: LayoutTemplate) => void;
  onSelectComposition?: (composition: LayoutComposition) => void;
  onCreateCustom?: (config: Record<string, unknown>) => void;
}

export function AdvancedLayoutComposer({
  onSelectLayout,
  onSelectComposition,
}: AdvancedLayoutComposerProps) {
  const [selectedLayout, setSelectedLayout] = useState<string | null>(null);
  const [selectedComposition, setSelectedComposition] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"templates" | "compositions">(
    "templates"
  );

  const handleLayoutSelect = (template: LayoutTemplate) => {
    setSelectedLayout(template.id);
    onSelectLayout?.(template);
    toast.success(`Selected "${template.name}" layout`);
  };

  const handleCompositionSelect = (composition: LayoutComposition) => {
    setSelectedComposition(composition.id);
    onSelectComposition?.(composition);
    toast.success(`Selected "${composition.name}" structure`);
  };

  const copyLayoutCode = () => {
    if (!selectedLayout) {return;}
    const template = LAYOUT_TEMPLATES.find((t) => t.id === selectedLayout);
    if (!template) {return;}
    const css = `display: grid;\ngrid-template-columns: ${template.gridTemplate};\ngap: 2rem;`;
    navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "data":
        return <BarChart3 className="w-3 h-3" />;
      case "gallery":
        return <Grid3x3 className="w-3 h-3" />;
      case "hero":
        return <Sparkles className="w-3 h-3" />;
      case "comparison":
        return <TrendingUp className="w-3 h-3" />;
      default:
        return <Layout className="w-3 h-3" />;
    }
  };

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950 rounded-lg border border-teal-200 dark:border-teal-800">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-teal-200 dark:border-teal-800">
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "templates"
              ? "border-teal-500 text-teal-600 dark:text-teal-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Layout Templates
        </button>
        <button
          onClick={() => setActiveTab("compositions")}
          className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "compositions"
              ? "border-teal-500 text-teal-600 dark:text-teal-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Compositions
        </button>
      </div>

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="space-y-3">
          {["hero", "content", "gallery", "data", "comparison"].map(
            (category) => {
              const templates = LAYOUT_TEMPLATES.filter(
                (t) => t.category === category
              );
              if (templates.length === 0) {return null;}

              return (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 capitalize flex items-center gap-1">
                    {getCategoryIcon(category)} {category}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleLayoutSelect(template)}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          selectedLayout === template.id
                            ? "border-teal-500 bg-teal-100 dark:bg-teal-900"
                            : "border-teal-200 dark:border-teal-700 hover:border-teal-400"
                        }`}
                      >
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {template.name}
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                          {template.description}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-2">
                          min {template.minBlocks} blocks
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            }
          )}

          {/* Copy Layout Code */}
          {selectedLayout && (
            <button
              onClick={copyLayoutCode}
              className="w-full py-2 px-3 rounded text-xs font-semibold bg-teal-500 text-white hover:bg-teal-600 transition-all flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Layout CSS
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Compositions Tab */}
      {activeTab === "compositions" && (
        <div className="space-y-2">
          {LAYOUT_COMPOSITIONS.map((composition) => (
            <button
              key={composition.id}
              onClick={() => handleCompositionSelect(composition)}
              className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                selectedComposition === composition.id
                  ? "border-teal-500 bg-teal-100 dark:bg-teal-900"
                  : "border-teal-200 dark:border-teal-700 hover:border-teal-400"
              }`}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {composition.name}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {composition.description}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {composition.sections.map((section) => (
                  <span
                    key={section}
                    className="text-[10px] px-2 py-1 rounded bg-teal-200 dark:bg-teal-800 text-teal-900 dark:text-teal-100"
                  >
                    {section}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-teal-200 dark:border-teal-700">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          🎨 Advanced layout system with pre-built templates and narrative structures for professional presentations.
        </p>
      </div>
    </div>
  );
}
