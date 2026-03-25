"use client";

import type { Theme } from "@/types";
import { Check, Lock, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

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
    <div className="mt-6 space-y-8">
      {/* Free themes */}
      <div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-500" />
          Free Themes
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {freeThemes.map((theme, idx) => (
            <motion.div
              key={theme.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, type: "spring", stiffness: 300, damping: 25 }}
            >
              <ThemeCard
                theme={theme}
                isSelected={currentTheme?.id === theme.id}
                onSelect={() => onSelect(theme)}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Premium themes */}
      {premiumThemes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-500" />
            Premium Themes
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {premiumThemes.map((theme, idx) => (
              <motion.div
                key={theme.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 + 0.2, type: "spring", stiffness: 300, damping: 25 }}
              >
                <ThemeCard
                  theme={theme}
                  isSelected={currentTheme?.id === theme.id}
                  onSelect={() => onSelect(theme)}
                  isPremium
                />
              </motion.div>
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
  const colors = theme.colors as unknown as Record<string, string>;
  const bgColor = colors?.background || "#ffffff";
  const primaryColor = colors?.primary || "#3b82f6";
  const accentColor = colors?.accent || "#10b981";
  const textColor = colors?.text || "#1f2937";
  const secondaryColor = colors?.secondary || "#8b5cf6";

  // Is this a dark theme?
  const isDark = isDarkColor(bgColor);

  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`relative w-full rounded-xl overflow-hidden transition-all duration-300 text-left group ${
        isSelected
          ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 shadow-lg shadow-blue-500/20"
          : "ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-slate-300 dark:hover:ring-slate-600 hover:shadow-lg"
      }`}
    >
      {/* Mini slide preview — realistic representation */}
      <div
        className="aspect-[16/10] p-3 relative overflow-hidden"
        style={{ backgroundColor: bgColor }}
      >
        {/* Ambient decoration blob (like real slides) */}
        <div
          className="absolute -top-6 -right-6 w-16 h-16 rounded-full blur-lg opacity-25"
          style={{ backgroundColor: primaryColor }}
        />
        <div
          className="absolute -bottom-4 -left-4 w-12 h-12 rounded-full blur-md opacity-15"
          style={{ backgroundColor: accentColor }}
        />

        {/* Simulated slide content */}
        <div className="relative z-10 h-full flex flex-col justify-center gap-1.5">
          {/* Heading bar */}
          <div
            className="h-2 w-3/4 rounded-sm"
            style={{ background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}aa)` }}
          />
          {/* Subheading */}
          <div
            className="h-1.5 w-1/2 rounded-sm opacity-60"
            style={{ backgroundColor: textColor }}
          />
          {/* Spacer */}
          <div className="h-1" />
          {/* Body text lines */}
          <div className="flex items-center gap-1">
            <div
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <div
              className="h-1 flex-1 rounded-sm opacity-30"
              style={{ backgroundColor: textColor }}
            />
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <div
              className="h-1 w-3/4 rounded-sm opacity-25"
              style={{ backgroundColor: textColor }}
            />
          </div>
          {/* Color palette strip */}
          <div className="flex gap-0.5 mt-auto">
            <div className="w-3 h-1 rounded-full" style={{ backgroundColor: primaryColor }} />
            <div className="w-3 h-1 rounded-full" style={{ backgroundColor: secondaryColor }} />
            <div className="w-3 h-1 rounded-full" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      </div>

      {/* Theme info bar */}
      <div className={`px-3 py-2 border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200/80 dark:bg-slate-900 dark:border-slate-700'}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">
            {theme.name}
          </p>
          {/* Color dots */}
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full border border-white/30 shadow-sm" style={{ backgroundColor: primaryColor }} />
            <div className="w-2.5 h-2.5 rounded-full border border-white/30 shadow-sm" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center shadow-lg z-20"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
          }}
        >
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        </motion.div>
      )}

      {/* Premium indicator */}
      {isPremium && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-amber-900 z-20"
          style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}
        >
          PRO
        </div>
      )}
    </motion.button>
  );
}

function isDarkColor(hex: string): boolean {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  } catch {
    return false;
  }
}
