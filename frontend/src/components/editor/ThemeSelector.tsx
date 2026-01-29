"use client";

import { Theme } from "@/types";
import { Check, Lock } from "lucide-react";

interface ThemeSelectorProps {
  themes: Theme[];
  currentTheme?: Theme;
  onSelect: (theme: Theme) => void;
}

export default function ThemeSelector({
  themes,
  currentTheme,
  onSelect,
}: ThemeSelectorProps) {
  // Separate free and premium themes
  const freeThemes = themes.filter((t) => !t.isPremium);
  const premiumThemes = themes.filter((t) => t.isPremium);

  return (
    <div className="mt-6 space-y-6">
      {/* Free themes */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          Free Themes
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {freeThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isSelected={currentTheme?.id === theme.id}
              onSelect={() => onSelect(theme)}
            />
          ))}
        </div>
      </div>

      {/* Premium themes */}
      {premiumThemes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Premium Themes
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {premiumThemes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isSelected={currentTheme?.id === theme.id}
                onSelect={() => onSelect(theme)}
                isPremium
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeCard({
  theme,
  isSelected,
  onSelect,
  isPremium = false,
}: {
  theme: Theme;
  isSelected: boolean;
  onSelect: () => void;
  isPremium?: boolean;
}) {
  const colors = theme.colors as any;
  const bgColor = colors?.background || "#ffffff";
  const primaryColor = colors?.primary || "#3b82f6";
  const secondaryColor = colors?.secondary || "#8b5cf6";
  const textColor = colors?.text || "#1f2937";

  return (
    <button
      onClick={onSelect}
      className={`relative rounded-lg border-2 overflow-hidden transition-all text-left ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-200"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
      }`}
    >
      {/* Theme preview */}
      <div
        className="aspect-[4/3] p-3"
        style={{ backgroundColor: bgColor }}
      >
        <div
          className="h-2 w-2/3 rounded mb-2"
          style={{ backgroundColor: primaryColor }}
        />
        <div
          className="h-1.5 w-1/2 rounded mb-2"
          style={{ backgroundColor: textColor, opacity: 0.7 }}
        />
        <div
          className="h-1 w-full rounded mb-1"
          style={{ backgroundColor: textColor, opacity: 0.3 }}
        />
        <div
          className="h-1 w-4/5 rounded"
          style={{ backgroundColor: textColor, opacity: 0.3 }}
        />
      </div>

      {/* Theme name */}
      <div className="p-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
        <p className="text-xs font-medium truncate">{theme.name}</p>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Premium indicator */}
      {isPremium && (
        <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center">
          <Lock className="h-3 w-3 text-white" />
        </div>
      )}
    </button>
  );
}
