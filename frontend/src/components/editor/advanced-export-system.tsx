"use client";

import { useState } from "react";
import {
  Download,
  FileJson,
  Image,
  Film,
  Code,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export interface ExportFormat {
  id: string;
  name: string;
  description: string;
  fileExtension: string;
  icon: React.ReactNode;
  category: "interactive" | "static" | "data" | "analytics";
  isPremium: boolean;
  quality: number;
}

const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: "pdf-standard",
    name: "PDF (Standard)",
    description: "High-quality PDF export with all slides",
    fileExtension: ".pdf",
    icon: <Image className="w-4 h-4" />,
    category: "static",
    isPremium: false,
    quality: 85,
  },
  {
    id: "pdf-interactive",
    name: "PDF (Interactive)",
    description: "Interactive PDF with clickable elements",
    fileExtension: ".pdf",
    icon: <Sparkles className="w-4 h-4" />,
    category: "interactive",
    isPremium: true,
    quality: 95,
  },
  {
    id: "pptx",
    name: "PowerPoint (PPTX)",
    description: "Compatible with Microsoft PowerPoint",
    fileExtension: ".pptx",
    icon: <FileJson className="w-4 h-4" />,
    category: "interactive",
    isPremium: false,
    quality: 90,
  },
  {
    id: "html5",
    name: "HTML5 Web",
    description: "Self-contained HTML5 presentation",
    fileExtension: ".html",
    icon: <Code className="w-4 h-4" />,
    category: "interactive",
    isPremium: false,
    quality: 98,
  },
  {
    id: "video-mp4",
    name: "Video (MP4)",
    description: "Recorded video with narration",
    fileExtension: ".mp4",
    icon: <Film className="w-4 h-4" />,
    category: "static",
    isPremium: true,
    quality: 92,
  },
  {
    id: "json-data",
    name: "JSON Data",
    description: "Complete presentation data export",
    fileExtension: ".json",
    icon: <FileJson className="w-4 h-4" />,
    category: "data",
    isPremium: false,
    quality: 100,
  },
  {
    id: "analytics",
    name: "Analytics Report",
    description: "Detailed analytics and audience metrics",
    fileExtension: ".xlsx",
    icon: <BarChart3 className="w-4 h-4" />,
    category: "analytics",
    isPremium: false,
    quality: 88,
  },
  {
    id: "animated-webp",
    name: "Animated WebP",
    description: "Lightweight animated slides",
    fileExtension: ".webp",
    icon: <Image className="w-4 h-4" />,
    category: "static",
    isPremium: true,
    quality: 87,
  },
];

export interface AdvancedExportOptions {
  quality: number;
  compression: number;
  includeNotes: boolean;
  includeAnimations: boolean;
  includeAudio: boolean;
  resolution: "sd" | "hd" | "fullhd" | "4k";
  watermark: boolean;
  password: string;
}

interface AdvancedExportSystemProps {
  projectName?: string;
  slideCount?: number;
  onExport?: (format: ExportFormat, options: AdvancedExportOptions) => void;
}

export function AdvancedExportSystem({
  onExport,
}: AdvancedExportSystemProps) {
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [options, setOptions] = useState<AdvancedExportOptions>({
    quality: 85,
    compression: 50,
    includeNotes: true,
    includeAnimations: true,
    includeAudio: true,
    resolution: "hd",
    watermark: false,
    password: "",
  });
  const [isExporting, setIsExporting] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filteredFormats =
    filterCategory === "all"
      ? EXPORT_FORMATS
      : EXPORT_FORMATS.filter((f) => f.category === filterCategory);

  const selectedFormatData = EXPORT_FORMATS.find((f) => f.id === selectedFormat);

  const handleExport = async () => {
    if (!selectedFormat) {
      toast.error("Please select an export format");
      return;
    }
    const selectedFormatData = EXPORT_FORMATS.find((f) => f.id === selectedFormat);
    if (!selectedFormatData) {
      toast.error("Selected format not found");
      return;
    }
    if (selectedFormatData.isPremium) {
      toast.info("This format requires a premium plan");
      return;
    }

    setIsExporting(true);
    try {
      // Simulate export
      await new Promise((resolve) => setTimeout(resolve, 2000));
      onExport?.(selectedFormatData, options);
      toast.success(`Exporting as ${selectedFormatData.name}...`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const updateOption = (key: keyof AdvancedExportOptions, value: unknown) => {
    setOptions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950 dark:to-blue-950 rounded-lg border border-cyan-200 dark:border-cyan-800">
      {/* Category Filter */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Export Categories
        </h3>
        <div className="flex gap-2 flex-wrap">
          {[
            "all",
            "interactive",
            "static",
            "data",
            "analytics",
          ].map(
            (category) => (
              <button
                key={category}
                onClick={() => setFilterCategory(category)}
                className={`px-3 py-1 rounded text-xs font-semibold capitalize transition-all ${
                  filterCategory === category
                    ? "bg-cyan-500 text-white"
                    : "bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 hover:border-cyan-400"
                }`}
              >
                {category}
              </button>
            )
          )}
        </div>
      </div>

      {/* Export Formats Grid */}
      <div className="grid grid-cols-2 gap-2">
        {filteredFormats.map((format) => (
          <button
            key={format.id}
            onClick={() => setSelectedFormat(format.id)}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              selectedFormat === format.id
                ? "border-cyan-500 bg-cyan-100 dark:bg-cyan-900"
                : "border-cyan-200 dark:border-cyan-700 hover:border-cyan-400"
            }`}
          >
            <div className="flex items-start justify-between mb-1">
              <div className="text-cyan-600 dark:text-cyan-400">
                {format.icon}
              </div>
              {format.isPremium && (
                <span className="text-[10px] bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded font-bold">
                  PRO
                </span>
              )}
            </div>
            <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100">
              {format.name}
            </h4>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
              {format.description}
            </p>
            <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-2 font-mono">
              {format.fileExtension}
            </div>
          </button>
        ))}
      </div>

      {/* Export Options */}
      {selectedFormat && (
        <div className="space-y-3 pt-3 border-t border-cyan-200 dark:border-cyan-700">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Export Options
          </h4>

          {/* Quality */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Quality
              </label>
              <span className="text-sm font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded">
                {options.quality}%
              </span>
            </div>
            <Slider
              value={[options.quality]}
              onValueChange={(v) => updateOption("quality", v[0])}
              min={50}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          {/* Compression */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Compression
              </label>
              <span className="text-sm font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded">
                {options.compression}%
              </span>
            </div>
            <Slider
              value={[options.compression]}
              onValueChange={(v) => updateOption("compression", v[0])}
              min={0}
              max={100}
              step={10}
              className="w-full"
            />
          </div>

          {/* Resolution */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
              Resolution
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["sd", "hd", "fullhd", "4k"].map((res) => (
                <button
                  key={res}
                  onClick={() => updateOption("resolution", res)}
                  className={`py-2 px-3 rounded text-xs font-semibold transition-all ${
                    options.resolution === res
                      ? "bg-cyan-500 text-white"
                      : "bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 hover:border-cyan-400"
                  }`}
                >
                  {res.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            {[
              {
                key: "includeNotes",
                label: "Include Speaker Notes",
              },
              {
                key: "includeAnimations",
                label: "Include Animations",
              },
              {
                key: "includeAudio",
                label: "Include Audio/Narration",
              },
              {
                key: "watermark",
                label: "Add Watermark",
              },
            ].map((toggle) => (
              <label
                key={toggle.key}
                className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={options[toggle.key as keyof AdvancedExportOptions] as boolean}
                  onChange={(e) =>
                    updateOption(
                      toggle.key as keyof AdvancedExportOptions,
                      e.target.checked
                    )
                  }
                  className="rounded"
                />
                {toggle.label}
              </label>
            ))}
          </div>

          {/* Password Protection */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Password (Optional)
            </label>
            <input
              type="password"
              placeholder="Leave empty for no password"
              value={options.password}
              onChange={(e) => updateOption("password", e.target.value)}
              className="w-full px-3 py-2 rounded border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>

          {/* Export Button */}
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? (
              <>
                <span className="animate-spin mr-2">⌛</span>
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export as{" "}
                {selectedFormatData?.name.split("(")[0].trim()}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-cyan-200 dark:border-cyan-700">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          💾 Advanced export system with quality controls, compression, and multiple format support for any use case.
        </p>
      </div>
    </div>
  );
}
