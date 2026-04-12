"use client";

import { useState } from "react";
import {
  Zap,
  FileText,
  BarChart3,
  Users,
  MessageCircle,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export interface InteractiveContentBlock {
  id: string;
  type:
    | "poll"
    | "quiz"
    | "survey"
    | "discussion"
    | "countdown"
    | "breakout"
    | "voting";
  name: string;
  description: string;
  difficulty: "easy" | "medium" | "advanced";
  icon: React.ReactNode;
  engagementScore: number;
  isPremium: boolean;
}

const INTERACTIVE_BLOCKS: InteractiveContentBlock[] = [
  {
    id: "poll",
    type: "poll",
    name: "Audience Poll",
    description: "Real-time polling with instant visualization",
    difficulty: "easy",
    icon: <BarChart3 className="w-4 h-4" />,
    engagementScore: 95,
    isPremium: false,
  },
  {
    id: "quiz",
    type: "quiz",
    name: "Knowledge Quiz",
    description: "Interactive quiz with scoring and feedback",
    difficulty: "medium",
    icon: <FileText className="w-4 h-4" />,
    engagementScore: 98,
    isPremium: false,
  },
  {
    id: "survey",
    type: "survey",
    name: "Survey Form",
    description: "Collect audience feedback and data",
    difficulty: "medium",
    icon: <Users className="w-4 h-4" />,
    engagementScore: 87,
    isPremium: false,
  },
  {
    id: "discussion",
    type: "discussion",
    name: "Discussion Thread",
    description: "Live discussion with Q&A moderation",
    difficulty: "advanced",
    icon: <MessageCircle className="w-4 h-4" />,
    engagementScore: 92,
    isPremium: true,
  },
  {
    id: "countdown",
    type: "countdown",
    name: "Countdown Timer",
    description: "Timed activity or break timer",
    difficulty: "easy",
    icon: <Zap className="w-4 h-4" />,
    engagementScore: 85,
    isPremium: false,
  },
  {
    id: "breakout",
    type: "breakout",
    name: "Breakout Groups",
    description: "Divide audience into discussion groups",
    difficulty: "advanced",
    icon: <Users className="w-4 h-4" />,
    engagementScore: 96,
    isPremium: true,
  },
  {
    id: "voting",
    type: "voting",
    name: "Voting Board",
    description: "Real-time voting/ranking on topics",
    difficulty: "medium",
    icon: <BarChart3 className="w-4 h-4" />,
    engagementScore: 94,
    isPremium: false,
  },
];

interface AdvancedInteractiveContentProps {
  onInsertBlock?: (block: InteractiveContentBlock) => void;
  onConfigureBlock?: (block: InteractiveContentBlock, config: Record<string, unknown>) => void;
}

export function AdvancedInteractiveContent({
  onInsertBlock,
}: AdvancedInteractiveContentProps) {
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [_config, _setConfig] = useState<Record<string, unknown>>({});
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [minEngagement, setMinEngagement] = useState(80);

  const filteredBlocks = INTERACTIVE_BLOCKS.filter((block) => {
    if (filterDifficulty !== "all" && block.difficulty !== filterDifficulty)
      {return false;}
    if (block.engagementScore < minEngagement) {return false;}
    return true;
  });

  const handleSelectBlock = (block: InteractiveContentBlock) => {
    if (block.isPremium) {
      toast.info("Premium feature - Upgrade to unlock");
      return;
    }
    setSelectedBlock(block.id);
    onInsertBlock?.(block);
    toast.success(`Selected "${block.name}" interactive block`);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
      case "medium":
        return "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200";
      case "advanced":
        return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
      default:
        return "bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200";
    }
  };

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 rounded-lg border border-indigo-200 dark:border-indigo-800">
      {/* Filters */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
            Difficulty Level
          </label>
          <div className="flex gap-2 flex-wrap">
            {["all", "easy", "medium", "advanced"].map((difficulty) => (
              <button
                key={difficulty}
                onClick={() => setFilterDifficulty(difficulty)}
                className={`px-3 py-1 rounded text-xs font-semibold capitalize transition-all ${
                  filterDifficulty === difficulty
                    ? "bg-indigo-500 text-white"
                    : "bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 hover:border-indigo-400"
                }`}
              >
                {difficulty}
              </button>
            ))}
          </div>
        </div>

        {/* Minimum Engagement Filter */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Minimum Engagement Score
            </label>
            <span className="text-xs font-mono bg-indigo-200 dark:bg-indigo-800 px-2 py-1 rounded">
              {minEngagement}
            </span>
          </div>
          <Slider
            value={[minEngagement]}
            onValueChange={(v) => setMinEngagement(v[0])}
            min={50}
            max={100}
            step={5}
            className="w-full"
          />
        </div>
      </div>

      {/* Interactive Blocks Grid */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Available Interactive Blocks
        </h3>
        <div className="space-y-2">
          {filteredBlocks.map((block) => (
            <button
              key={block.id}
              onClick={() => handleSelectBlock(block)}
              className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                selectedBlock === block.id
                  ? "border-indigo-500 bg-indigo-100 dark:bg-indigo-900"
                  : "border-indigo-200 dark:border-indigo-700 hover:border-indigo-400"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-2 flex-1">
                  <div className="text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                    {block.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {block.name}
                      </h4>
                      {block.isPremium && (
                        <span className="text-[10px] bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded font-bold">
                          PREMIUM
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {block.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span
                    className={`text-[10px] px-2 py-1 rounded font-semibold capitalize ${getDifficultyColor(
                      block.difficulty
                    )}`}
                  >
                    {block.difficulty}
                  </span>
                  <div className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    {block.engagementScore}% engagement
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Configuration Panel */}
      {selectedBlock && (
        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-indigo-200 dark:border-indigo-700 space-y-2">
          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Configuration
          </h4>
          <div className="space-y-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Display Duration (seconds)
              </label>
              <input
                type="number"
                defaultValue={30}
                min={5}
                max={300}
                className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Display Options
              </label>
              <div className="space-y-1">
                {["Show results", "Allow retake", "Require response"].map(
                  (option) => (
                    <label
                      key={option}
                      className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300"
                    >
                      <input type="checkbox" defaultChecked className="rounded" />
                      {option}
                    </label>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-indigo-200 dark:border-indigo-700">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          🎮 Boost audience engagement with interactive polls, quizzes, surveys, and live discussions. Engagement scores indicate audience participation rates.
        </p>
      </div>
    </div>
  );
}
