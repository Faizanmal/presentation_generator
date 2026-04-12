"use client";

import { useState } from "react";
import {
  Sparkles,
  Zap,
  BarChart3,
  AlertCircle,
  Info,
  TrendingUp,
  Eye,
  Type,
  Layout,
} from "lucide-react";
import { toast } from "sonner";

export interface QualityMetric {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  issues: string[];
  recommendations: string[];
  icon: React.ReactNode;
  category: "design" | "content" | "accessibility" | "performance";
}

export interface PresentationQualityReport {
  overallScore: number;
  metrics: QualityMetric[];
  warnings: string[];
  suggestions: string[];
}

interface PresentationQualityAnalyzerProps {
  slideCount: number;
  hasConsistentTheme: boolean;
  hasAccessibilityCheck: boolean;
  averageBlocKsPerSlide: number;
  onGetRecommendations?: () => void;
}

export function PresentationQualityAnalyzer({
  slideCount,
  hasConsistentTheme,
  hasAccessibilityCheck,
  averageBlocKsPerSlide,
}: PresentationQualityAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<PresentationQualityReport | null>(null);

  const analyzePresentation = () => {
    setIsAnalyzing(true);

    // Simulate analysis
    setTimeout(() => {
      const metrics: QualityMetric[] = [
        {
          id: "content-density",
          name: "Content Density",
          score: Math.min(10, 10 * (Math.min(5, averageBlocKsPerSlide) / 5)),
          maxScore: 10,
          issues: averageBlocKsPerSlide > 7 ? ["Too many blocks per slide"] : [],
          recommendations: ["Aim for 3-5 blocks per slide for optimal readability"],
          icon: <Type className="w-4 h-4" />,
          category: "design",
        },
        {
          id: "theme-consistency",
          name: "Theme Consistency",
          score: hasConsistentTheme ? 10 : 5,
          maxScore: 10,
          issues: !hasConsistentTheme ? ["Inconsistent theme across slides"] : [],
          recommendations: ["Use consistent color palette and typography"],
          icon: <Sparkles className="w-4 h-4" />,
          category: "design",
        },
        {
          id: "accessibility",
          name: "Accessibility",
          score: hasAccessibilityCheck ? 9 : 6,
          maxScore: 10,
          issues: !hasAccessibilityCheck ? ["No accessibility check performed"] : [],
          recommendations: ["Run accessibility checker for WCAG compliance"],
          icon: <Eye className="w-4 h-4" />,
          category: "accessibility",
        },
        {
          id: "slide-count",
          name: "Slide Count",
          score: Math.min(
            10,
            slideCount < 5 ? 3 : slideCount < 15 ? 9 : slideCount < 30 ? 10 : 7
          ),
          maxScore: 10,
          issues:
            slideCount < 5
              ? ["Too few slides"]
              : slideCount > 30
                ? ["Very long presentation"]
                : [],
          recommendations:
            slideCount < 5
              ? ["Add more slides to cover topic thoroughly"]
              : slideCount > 30
                ? ["Consider breaking into multiple presentations"]
                : ["Slide count is appropriate"],
          icon: <Layout className="w-4 h-4" />,
          category: "content",
        },
        {
          id: "visual-hierarchy",
          name: "Visual Hierarchy",
          score: 7,
          maxScore: 10,
          issues: [],
          recommendations: [
            "Ensure clear visual hierarchy with size, color, and contrast",
          ],
          icon: <TrendingUp className="w-4 h-4" />,
          category: "design",
        },
      ];

      const avgScore = metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length;

      const warnings = metrics
        .filter((m) => m.score < 7)
        .flatMap((m) => m.issues);

      const suggestions = metrics
        .flatMap((m) => m.recommendations)
        .slice(0, 5);

      setReport({
        overallScore: Math.round(avgScore),
        metrics,
        warnings,
        suggestions,
      });
      setIsAnalyzing(false);
      toast.success("Presentation analysis complete");
    }, 1000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 9) {return "text-green-600 dark:text-green-400";}
    if (score >= 7) {return "text-blue-600 dark:text-blue-400";}
    if (score >= 5) {return "text-yellow-600 dark:text-yellow-400";}
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 9) {return "bg-green-100 dark:bg-green-900";}
    if (score >= 7) {return "bg-blue-100 dark:bg-blue-900";}
    if (score >= 5) {return "bg-yellow-100 dark:bg-yellow-900";}
    return "bg-red-100 dark:bg-red-900";
  };

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 rounded-lg border border-emerald-200 dark:border-emerald-800">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Presentation Quality Analyzer
          </h3>
        </div>
        <button
          onClick={analyzePresentation}
          disabled={isAnalyzing}
          className="px-4 py-2 rounded text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <span className="animate-spin">⌛</span>
              Analyzing...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Analyze Now
            </>
          )}
        </button>
      </div>

      {/* Overall Score */}
      {report && (
        <div className={`p-4 rounded-lg ${getScoreBgColor(report.overallScore)}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Overall Quality Score
              </p>
              <p className={`text-3xl font-bold mt-1 ${getScoreColor(report.overallScore)}`}>
                {report.overallScore}/10
              </p>
            </div>
            <div className="text-right text-xs text-slate-600 dark:text-slate-400">
              {report.overallScore >= 8
                ? "✨ Excellent presentation!"
                : report.overallScore >= 6
                  ? "👍 Good, but can improve"
                  : "⚠️ Needs attention"}
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      {report && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Detailed Metrics
          </h4>
          {report.metrics.map((metric) => (
            <div
              key={metric.id}
              className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-700 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-slate-600 dark:text-slate-400">
                    {metric.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {metric.name}
                    </p>
                    <p className={`text-xs font-bold ${getScoreColor(metric.score)}`}>
                      {metric.score}/{metric.maxScore}
                    </p>
                  </div>
                </div>
                <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      metric.score >= 8
                        ? "bg-green-500"
                        : metric.score >= 6
                          ? "bg-blue-500"
                          : metric.score >= 4
                            ? "bg-yellow-500"
                            : "bg-red-500"
                    }`}
                    style={{ width: `${(metric.score / metric.maxScore) * 100}%` }}
                  />
                </div>
              </div>

              {/* Issues */}
              {metric.issues.length > 0 && (
                <div className="space-y-1">
                  {metric.issues.map((issue, idx) => (
                    <div key={issue} className="flex gap-2 text-xs">
                      <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-600 dark:text-slate-400">
                        {issue}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {metric.recommendations.length > 0 && (
                <div className="space-y-1">
                  {metric.recommendations.map((rec, idx) => (
                    <div key={rec} className="flex gap-2 text-xs">
                      <Info className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-600 dark:text-slate-400">
                        {rec}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {report && report.suggestions.length > 0 && (
        <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg border border-blue-300 dark:border-blue-700">
          <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Top Suggestions
          </h4>
          <ul className="space-y-1">
            {report.suggestions.map((suggestion, idx) => (
              <li key={suggestion} className="text-xs text-blue-800 dark:text-blue-200">
                • {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-700">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          📊 Analyzes design consistency, content density, accessibility, and more to ensure professional, engaging presentations.
        </p>
      </div>
    </div>
  );
}
