import type { Target, Transition, VariantLabels, Variants } from "framer-motion";

/* ═══════════════════════════════════════════════════════════════════════
   Motion System — Premium Presentation Designer
   ───────────────────────────────────────────────────────────────────────
   Principles:
     1. Spring-physics first — duration-based only for sequences.
     2. Named timing tokens — no magic numbers in components.
     3. Accessibility: all variants respect `prefersReducedMotion`.
   ═══════════════════════════════════════════════════════════════════════ */

// ── Duration tokens (seconds) ──────────────────────────────────────
export const motionTiming = {
  instant: 0.09,
  quick: 0.16,
  normal: 0.24,
  smooth: 0.38,
  slow: 0.5,
  cinematic: 0.62,
  epic: 1.0,
} as const;

// ── Easing curves ──────────────────────────────────────────────────
export const motionEase = {
  smooth: [0.22, 1, 0.36, 1] as [number, number, number, number],
  out: [0.2, 0.75, 0.3, 1] as [number, number, number, number],
  springy: [0.16, 1, 0.3, 1] as [number, number, number, number],
  bounce: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  cinematic: [0.65, 0, 0.35, 1] as [number, number, number, number],
  inOut: [0.42, 0, 0.58, 1] as [number, number, number, number],
};

// ── Spring presets ─────────────────────────────────────────────────
export const springTransition: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 24,
  mass: 0.85,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 30,
  mass: 0.6,
};

export const springGentle: Transition = {
  type: "spring",
  stiffness: 160,
  damping: 20,
  mass: 1,
};

export const springBouncy: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 18,
  mass: 0.5,
};

export const springDrag: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 22,
  mass: 0.45,
};

// ── Layout transition (for layoutId / layout animations) ───────────
export const layoutTransition: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 28,
  mass: 0.8,
};

// ── Fade + Slide — the go-to entrance variant ──────────────────────
export const fadeSlideVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: motionTiming.normal, ease: motionEase.smooth },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: "blur(2px)",
    transition: { duration: motionTiming.quick, ease: motionEase.out },
  },
};

// ── Scale-in (modals, popovers) ────────────────────────────────────
export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: motionTiming.smooth, ease: motionEase.smooth },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    filter: "blur(4px)",
    transition: { duration: motionTiming.quick, ease: motionEase.out },
  },
};

// ── Stagger container ──────────────────────────────────────────────
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.025,
      delayChildren: 0.01,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.06,
    },
  },
};

// ── Stagger child (pair with staggerContainer) ─────────────────────
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTiming.normal, ease: motionEase.smooth },
  },
};

// ── Slide transitions (presentation mode) ──────────────────────────
export const slideTransitions = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: motionTiming.smooth, ease: motionEase.cinematic },
  },
  slide: {
    initial: { opacity: 0, x: 100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 },
    transition: { duration: motionTiming.smooth, ease: motionEase.smooth },
  },
  zoom: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.06 },
    transition: { duration: motionTiming.smooth, ease: motionEase.smooth },
  },
  cinematic: {
    initial: { opacity: 0, y: 40, filter: "blur(12px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -30, filter: "blur(8px)" },
    transition: { duration: motionTiming.cinematic, ease: motionEase.cinematic },
  },
} as const;

// ── Hover + Tap micro-interactions ─────────────────────────────────
export const hoverLift = {
  whileHover: {
    y: -2,
    transition: { duration: motionTiming.quick, ease: motionEase.out },
  },
  whileTap: {
    y: 0,
    scale: 0.992,
    transition: { duration: motionTiming.instant, ease: motionEase.out },
  },
};

export const hoverScale = {
  whileHover: {
    scale: 1.02,
    transition: springSnappy,
  },
  whileTap: {
    scale: 0.98,
    transition: { duration: motionTiming.instant },
  },
};

export const hoverGlow = {
  whileHover: {
    boxShadow: "0 0 0 1px rgba(77, 116, 255, 0.3), 0 8px 28px rgba(77, 116, 255, 0.15)",
    transition: { duration: motionTiming.normal, ease: motionEase.smooth },
  },
};

export const buttonPress = {
  whileTap: {
    scale: 0.97,
    transition: { duration: motionTiming.instant, ease: motionEase.out },
  },
};

// ── Panel slide (sidebar, inspector) ───────────────────────────────
export const panelSlide = {
  left: {
    initial: { x: -20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 },
    transition: { duration: motionTiming.normal, ease: motionEase.smooth },
  },
  right: {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 20, opacity: 0 },
    transition: { duration: motionTiming.normal, ease: motionEase.smooth },
  },
  bottom: {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 20, opacity: 0 },
    transition: { duration: motionTiming.normal, ease: motionEase.smooth },
  },
} as const;

// ── Toolbar entrance ───────────────────────────────────────────────
export const toolbarEntrance = {
  initial: { y: 16, opacity: 0, scale: 0.96 },
  animate: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: motionTiming.smooth, ease: motionEase.smooth },
  },
  exit: {
    y: 8,
    opacity: 0,
    scale: 0.98,
    transition: { duration: motionTiming.quick, ease: motionEase.out },
  },
};

// ── AI thinking pulse ──────────────────────────────────────────────
export const aiPulse: Variants = {
  idle: { scale: 1, opacity: 0.5 },
  active: {
    scale: [1, 1.04, 1],
    opacity: [0.5, 1, 0.5],
    transition: { repeat: Infinity, duration: 1.8, ease: motionEase.inOut },
  },
};

export const aiStreamReveal: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTiming.quick, ease: motionEase.out },
  },
};

// ── Drag overlay ───────────────────────────────────────────────────
export const dragOverlayVariants: Variants = {
  idle: { scale: 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" },
  dragging: {
    scale: 1.04,
    boxShadow: "0 24px 48px rgba(0,0,0,0.15)",
    transition: springDrag,
  },
};

// ── Skeleton shimmer ───────────────────────────────────────────────
export const shimmer: Variants = {
  initial: { backgroundPosition: "-200% 0" },
  animate: {
    backgroundPosition: "200% 0",
    transition: { repeat: Infinity, duration: 2, ease: "linear" },
  },
};

// ── Helper: create a transition with defaults ──────────────────────
export function createTransition(
  duration = motionTiming.normal,
  ease = motionEase.smooth,
): Transition {
  return { duration, ease };
}

// ── Presence animation props (shorthand for AnimatePresence) ───────
export function presenceProps(variant: "fadeSlide" | "scaleIn" = "fadeSlide") {
  const variants = variant === "scaleIn" ? scaleInVariants : fadeSlideVariants;
  return {
    initial: "hidden" as VariantLabels,
    animate: "visible" as VariantLabels,
    exit: "exit" as VariantLabels,
    variants,
  };
}

// ── Viewport / canvas transition ───────────────────────────────────
export const viewportTransition: Transition = {
  duration: motionTiming.quick,
  ease: motionEase.out,
};

// ── Shared layout animation config ─────────────────────────────────
export const sharedLayoutConfig = {
  transition: layoutTransition,
} as { transition: Transition; animate?: Target };
