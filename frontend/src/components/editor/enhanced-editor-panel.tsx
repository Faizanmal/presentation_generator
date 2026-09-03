"use client";

import { useState } from "react";
import {
  Sparkles,
  Zap,
  Layout,
  Type,
  Palette,
  Download,
  CheckCircle2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdvancedTypographySystem } from "./advanced-typography-system";
import { SmartBlockAlignment } from "./smart-block-alignment";
import { PremiumDesignSystem } from "./premium-design-system";
import { AdvancedLayoutComposer } from "./advanced-layout-composer";
import { PresentationDesignPresets } from "./presentation-design-presets";
import { AdvancedAnimationSystem } from "./advanced-animation-system";
import { AdvancedColorHarmony } from "./advanced-color-harmony";
import { AdvancedContentComposition } from "./advanced-content-composition";
import { PresentationQualityAnalyzer } from "./presentation-quality-analyzer";
import { AdvancedInteractiveContent } from "./advanced-interactive-content";
import { AdvancedExportSystem } from "./advanced-export-system";

interface EnhancedEditorPanelProps {
  projectName?: string;
  slideCount?: number;
  onClose?: () => void;
}

export function EnhancedEditorPanel({
  projectName = "My Presentation",
  slideCount = 1,
}: EnhancedEditorPanelProps) {
  const [selectedTab, setSelectedTab] = useState("design-presets");

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
        >
          <Sparkles className="w-4 h-4" />
          Advanced Design Studio
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[600px] overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-50 bg-white dark:bg-slate-950 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Advanced Design Studio
          </SheetTitle>
          <SheetDescription>
            Professional design tools for premium presentations
          </SheetDescription>
        </SheetHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="w-full px-6 pt-4 bg-transparent border-b border-slate-200 dark:border-slate-800 gap-1 rounded-none justify-start h-auto p-0">
            <TabsTrigger
              value="design-presets"
              className="gap-1 text-xs border-b-2 border-transparent data-[state=active]:border-purple-500 rounded-none"
            >
              <Palette className="w-4 h-4" />
              Design
            </TabsTrigger>
            <TabsTrigger
              value="typography"
              className="gap-1 text-xs border-b-2 border-transparent data-[state=active]:border-purple-500 rounded-none"
            >
              <Type className="w-4 h-4" />
              Typography
            </TabsTrigger>
            <TabsTrigger
              value="layout"
              className="gap-1 text-xs border-b-2 border-transparent data-[state=active]:border-purple-500 rounded-none"
            >
              <Layout className="w-4 h-4" />
              Layout
            </TabsTrigger>
            <TabsTrigger
              value="alignment"
              className="gap-1 text-xs border-b-2 border-transparent data-[state=active]:border-purple-500 rounded-none"
            >
              <Zap className="w-4 h-4" />
              Align
            </TabsTrigger>
            <TabsTrigger
              value="quality"
              className="gap-1 text-xs border-b-2 border-transparent data-[state=active]:border-purple-500 rounded-none"
            >
              <CheckCircle2 className="w-4 h-4" />
              Quality
            </TabsTrigger>
            <TabsTrigger
              value="export"
              className="gap-1 text-xs border-b-2 border-transparent data-[state=active]:border-purple-500 rounded-none"
            >
              <Download className="w-4 h-4" />
              Export
            </TabsTrigger>
          </TabsList>

          {/* Design Presets Tab */}
          <TabsContent value="design-presets" className="p-6 space-y-4">
            <div className="space-y-2 mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Presentation Design Systems
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Choose from professionally designed presentation styles with complete color, typography, and layout systems.
              </p>
            </div>
            <PresentationDesignPresets />
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <PremiumDesignSystem />
            </div>
          </TabsContent>

          {/* Typography Tab */}
          <TabsContent value="typography" className="p-6 space-y-4">
            <div className="space-y-2 mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Advanced Typography System
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Professional font management with presets, sizing controls, and text effects.
              </p>
            </div>
            <AdvancedTypographySystem
              onApplyStyle={(style) => console.warn("Apply style:", style)}
            />
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value="layout" className="p-6 space-y-4">
            <div className="space-y-2 mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Advanced Layout Composer
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Pre-built layout templates and narrative structures for professional presentations.
              </p>
            </div>
            <AdvancedLayoutComposer />
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="space-y-2 mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  Content Composition
                </h3>
              </div>
              <AdvancedContentComposition />
            </div>
          </TabsContent>

          {/* Alignment Tab */}
          <TabsContent value="alignment" className="p-6 space-y-4">
            <div className="space-y-2 mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Smart Block Alignment
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Intelligent positioning, distribution, and alignment tools for perfect layouts.
              </p>
            </div>
            <SmartBlockAlignment
              blocks={[]}
              onUpdateBlocks={() => {}}
            />
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  Color Harmony
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Scientifically balanced color palettes
                </p>
              </div>
              <AdvancedColorHarmony />
            </div>
          </TabsContent>

          {/* Quality Tab */}
          <TabsContent value="quality" className="p-6 space-y-4">
            <div className="space-y-2 mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Presentation Analysis
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Comprehensive quality metrics and recommendations.
              </p>
            </div>
            <PresentationQualityAnalyzer
              slideCount={slideCount}
              hasConsistentTheme
              hasAccessibilityCheck={false}
              averageBlocKsPerSlide={4}
            />
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  Animations & Effects
                </h3>
              </div>
              <AdvancedAnimationSystem />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  Interactive Content
                </h3>
              </div>
              <AdvancedInteractiveContent />
            </div>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="p-6 space-y-4">
            <div className="space-y-2 mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Advanced Export Options
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Export with quality control, compression, and multiple format support.
              </p>
            </div>
            <AdvancedExportSystem
              projectName={projectName}
              slideCount={slideCount}
              onExport={(format, options) => {
                console.warn("Export:", { format, options });
              }}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
