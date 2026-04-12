"use client";

/**
 * Advanced Block Styling System
 * 
 * Provides comprehensive styling options for slide blocks including:
 * - Shadows and depths
 * - Gradients and overlays
 * - Border and corner effects
 * - Transform and motion effects
 * - Hover and interactive states
 */

export const BLOCK_SHADOW_PRESETS = {
  none: "box-shadow: none;",
  subtle: "box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);",
  small: "box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);",
  medium: "box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);",
  large: "box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);",
  xlarge: "box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);",
  double:
    "box-shadow: 0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1);",
  neon: "box-shadow: 0 0 10px rgba(66, 153, 225, 0.5), inset 0 0 10px rgba(66, 153, 225, 0.2);",
};

export const BLOCK_GRADIENT_PRESETS = {
  "linear-blue": "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
  "linear-purple": "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
  "linear-pink": "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
  "linear-green": "linear-gradient(135deg, #10b981 0%, #047857 100%)",
  "linear-orange": "linear-gradient(135deg, #f97316 0%, #c2410c 100%)",
  "radial-glow": "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.1) 100%)",
  "mesh-gradient": "linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.05) 50%, transparent 70%)",
};

export const BLOCK_BORDER_PRESETS = {
  none: "border: none;",
  light: "border: 1px solid rgba(0, 0, 0, 0.1);",
  medium: "border: 2px solid rgba(0, 0, 0, 0.15);",
  heavy: "border: 3px solid rgba(0, 0, 0, 0.2);",
  dashed: "border: 2px dashed rgba(0, 0, 0, 0.2);",
  dotted: "border: 2px dotted rgba(0, 0, 0, 0.2);",
  double: "border: 4px double rgba(0, 0, 0, 0.15);",
  glow: "border: 2px solid rgba(66, 153, 225, 0.3);",
};

export const BLOCK_RADIUS_PRESETS = {
  none: "0px",
  small: "4px",
  medium: "8px",
  large: "12px",
  "extra-large": "16px",
  xl: "20px",
  "pill": "999px",
  "smooth": "12px",
};

export const BLOCK_OPACITY_PRESETS = [
  { label: "Full", value: 1 },
  { label: "90%", value: 0.9 },
  { label: "80%", value: 0.8 },
  { label: "70%", value: 0.7 },
  { label: "60%", value: 0.6 },
  { label: "50%", value: 0.5 },
  { label: "40%", value: 0.4 },
  { label: "30%", value: 0.3 },
];

export const BLOCK_TRANSFORM_PRESETS = {
  none: "transform: none;",
  "scale-up-sm": "transform: scale(1.05);",
  "scale-up-md": "transform: scale(1.1);",
  "scale-up-lg": "transform: scale(1.15);",
  "rotate-cw": "transform: rotate(2deg);",
  "rotate-ccw": "transform: rotate(-2deg);",
  "skew-x": "transform: skewX(5deg);",
  "skew-y": "transform: skewY(5deg);",
  "perspective": "perspective(1000px) rotateX(5deg);",
};

export const BLOCK_HOVER_EFFECTS = [
  {
    name: "Lift",
    css: "transition: all 0.3s ease; cursor: pointer; &:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.15); }",
  },
  {
    name: "Glow",
    css: "transition: all 0.3s ease; &:hover { box-shadow: 0 0 20px rgba(66, 153, 225, 0.4); }",
  },
  {
    name: "Slide",
    css: "transition: all 0.3s ease; &:hover { transform: translateX(4px); }",
  },
  {
    name: "Pulse",
    css: "@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } } &:hover { animation: pulse 1s infinite; }",
  },
  {
    name: "Brightness",
    css: "transition: all 0.3s ease; &:hover { filter: brightness(1.1); }",
  },
];

export const BLOCK_ANIMATION_PRESETS = [
  { name: "Fade In", duration: 600, easing: "ease-out" },
  { name: "Slide Up", duration: 700, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
  { name: "Bounce", duration: 800, easing: "cubic-bezier(0.68, -0.55, 0.265, 1.55)" },
  { name: "Zoom", duration: 500, easing: "ease-out" },
  { name: "Flip", duration: 700, easing: "ease-out" },
  { name: "Pulse", duration: 1000, easing: "ease-in-out" },
  { name: "Shake", duration: 500, easing: "ease-in-out" },
  { name: "Swing", duration: 800, easing: "ease-in-out" },
];

/**
 * Generate advanced CSS for block styling
 */
export function generateBlockCSS(config: {
  shadow?: string;
  gradient?: string;
  border?: string;
  radius?: string;
  opacity?: number;
  transform?: string;
  blur?: number;
  brightness?: number;
  saturate?: number;
}): string {
  const parts: string[] = [];

  if (config.shadow && config.shadow !== "none") {
    parts.push(`box-shadow: ${BLOCK_SHADOW_PRESETS[config.shadow as keyof typeof BLOCK_SHADOW_PRESETS] || config.shadow};`);
  }

  if (config.gradient) {
    parts.push(`background-image: ${config.gradient};`);
  }

  if (config.border) {
    parts.push(BLOCK_BORDER_PRESETS[config.border as keyof typeof BLOCK_BORDER_PRESETS] || config.border);
  }

  if (config.radius) {
    parts.push(`border-radius: ${config.radius};`);
  }

  if (config.opacity !== undefined) {
    parts.push(`opacity: ${config.opacity};`);
  }

  if (config.transform) {
    parts.push(`${config.transform};`);
  }

  if (config.blur || config.brightness || config.saturate) {
    const filters = [];
    if (config.blur) {filters.push(`blur(${config.blur}px)`);}
    if (config.brightness) {filters.push(`brightness(${config.brightness})`);}
    if (config.saturate) {filters.push(`saturate(${config.saturate})`);}
    if (filters.length > 0) {
      parts.push(`filter: ${filters.join(" ")};`);
    }
  }

  return parts.join("\n");
}

/**
 * Preset block style configurations
 */
export const BLOCK_STYLE_PRESETS = {
  "card-minimal": {
    shadow: "small",
    radius: "medium",
    border: "light",
    opacity: 1,
  },
  "card-elevated": {
    shadow: "large",
    radius: "large",
    border: "none",
    opacity: 1,
  },
  "card-glass": {
    shadow: "medium",
    radius: "large",
    border: "none",
    opacity: 0.9,
    blur: 10,
    gradient: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)",
  },
  "card-neon": {
    shadow: "neon",
    radius: "medium",
    border: "glow",
    opacity: 1,
  },
  "card-flat": {
    shadow: "none",
    radius: "small",
    border: "none",
    opacity: 1,
  },
  "card-bordered": {
    shadow: "none",
    radius: "medium",
    border: "heavy",
    opacity: 1,
  },
};

export const ADVANCED_TYPOGRAPHY_EFFECTS = [
  {
    name: "Text Shadow Soft",
    css: "text-shadow: 2px 2px 4px rgba(0,0,0,0.1);",
  },
  {
    name: "Text Shadow Deep",
    css: "text-shadow: 3px 3px 0px rgba(0,0,0,0.2);",
  },
  {
    name: "Text Glow",
    css: "text-shadow: 0 0 10px rgba(66, 153, 225, 0.6);",
  },
  {
    name: "Text Outline",
    css: "-webkit-text-stroke: 0.5px rgba(0,0,0,0.2);",
  },
  {
    name: "Text Gradient",
    css: "background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;",
  },
];
