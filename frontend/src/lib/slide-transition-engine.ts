'use client';

/**
 * Slide Transition Animation Engine
 *
 * Provides CSS keyframe animations for slide transitions and element animations
 * during presentation mode. Supports enter/exit transitions, element-level
 * reveal animations, and various easing functions.
 *
 * Used by PresentationMode to animate between slides.
 */

// ========================================
// TYPES
// ========================================

export type SlideTransitionType =
    | 'none'
    | 'fade'
    | 'slide-left'
    | 'slide-right'
    | 'slide-up'
    | 'slide-down'
    | 'zoom-in'
    | 'zoom-out'
    | 'flip-x'
    | 'flip-y'
    | 'cube'
    | 'cover-left'
    | 'cover-right'
    | 'reveal'
    | 'dissolve'
    | 'morph'
    | 'swipe'
    | 'push';

export type ElementAnimationType =
    | 'none'
    | 'fade-in'
    | 'fade-in-up'
    | 'fade-in-down'
    | 'fade-in-left'
    | 'fade-in-right'
    | 'scale-in'
    | 'scale-bounce'
    | 'slide-in-left'
    | 'slide-in-right'
    | 'slide-in-up'
    | 'slide-in-down'
    | 'rotate-in'
    | 'blur-in'
    | 'typewriter'
    | 'bounce'
    | 'flip'
    | 'swing';

export type EasingFunction =
    | 'linear'
    | 'ease'
    | 'ease-in'
    | 'ease-out'
    | 'ease-in-out'
    | 'spring'
    | 'bounce';

export interface TransitionConfig {
    type: SlideTransitionType;
    duration: number; // milliseconds
    easing: EasingFunction;
}

export interface ElementAnimationConfig {
    type: ElementAnimationType;
    duration: number;
    delay: number;
    easing: EasingFunction;
}

// ========================================
// EASING MAP
// ========================================

const EASING_CSS: Record<EasingFunction, string> = {
    linear: 'linear',
    ease: 'ease',
    'ease-in': 'ease-in',
    'ease-out': 'ease-out',
    'ease-in-out': 'ease-in-out',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// ========================================
// SLIDE TRANSITION CSS GENERATORS
// ========================================

/**
 * Generate CSS classes for the current slide entering and the previous slide exiting
 */
export function getSlideTransitionStyles(
    config: TransitionConfig,
    direction: 'forward' | 'backward' = 'forward',
): {
    enterStyles: React.CSSProperties;
    exitStyles: React.CSSProperties;
    enterAnimation: string;
    exitAnimation: string;
} {
    const dur = `${config.duration}ms`;
    const easing = EASING_CSS[config.easing] || 'ease';

    switch (config.type) {
        case 'fade':
            return {
                enterStyles: {},
                exitStyles: {},
                enterAnimation: `slideEnterFade ${dur} ${easing} forwards`,
                exitAnimation: `slideExitFade ${dur} ${easing} forwards`,
            };

        case 'slide-left':
        case 'slide-right': {
            const isLeft =
                (config.type === 'slide-left' && direction === 'forward') ||
                (config.type === 'slide-right' && direction === 'backward');
            return {
                enterStyles: {},
                exitStyles: {},
                enterAnimation: `slideEnter${isLeft ? 'FromRight' : 'FromLeft'} ${dur} ${easing} forwards`,
                exitAnimation: `slideExit${isLeft ? 'ToLeft' : 'ToRight'} ${dur} ${easing} forwards`,
            };
        }

        case 'slide-up':
        case 'slide-down': {
            const isUp =
                (config.type === 'slide-up' && direction === 'forward') ||
                (config.type === 'slide-down' && direction === 'backward');
            return {
                enterStyles: {},
                exitStyles: {},
                enterAnimation: `slideEnter${isUp ? 'FromBottom' : 'FromTop'} ${dur} ${easing} forwards`,
                exitAnimation: `slideExit${isUp ? 'ToTop' : 'ToBottom'} ${dur} ${easing} forwards`,
            };
        }

        case 'zoom-in':
            return {
                enterStyles: {},
                exitStyles: {},
                enterAnimation: `slideZoomIn ${dur} ${easing} forwards`,
                exitAnimation: `slideZoomOutFade ${dur} ${easing} forwards`,
            };

        case 'zoom-out':
            return {
                enterStyles: {},
                exitStyles: {},
                enterAnimation: `slideZoomOut ${dur} ${easing} forwards`,
                exitAnimation: `slideZoomInFade ${dur} ${easing} forwards`,
            };

        case 'flip-x':
            return {
                enterStyles: { perspective: '1200px' },
                exitStyles: { perspective: '1200px' },
                enterAnimation: `slideFlipInX ${dur} ${easing} forwards`,
                exitAnimation: `slideFlipOutX ${dur} ${easing} forwards`,
            };

        case 'flip-y':
            return {
                enterStyles: { perspective: '1200px' },
                exitStyles: { perspective: '1200px' },
                enterAnimation: `slideFlipInY ${dur} ${easing} forwards`,
                exitAnimation: `slideFlipOutY ${dur} ${easing} forwards`,
            };

        case 'cube':
            return {
                enterStyles: { perspective: '1200px', transformStyle: 'preserve-3d' as const },
                exitStyles: { perspective: '1200px', transformStyle: 'preserve-3d' as const },
                enterAnimation: `slideCubeIn ${dur} ${easing} forwards`,
                exitAnimation: `slideCubeOut ${dur} ${easing} forwards`,
            };

        case 'cover-left':
        case 'cover-right': {
            const coverFromRight = config.type === 'cover-left';
            return {
                enterStyles: { zIndex: 10 },
                exitStyles: { zIndex: 5 },
                enterAnimation: `slideEnter${coverFromRight ? 'FromRight' : 'FromLeft'} ${dur} ${easing} forwards`,
                exitAnimation: `slideStay ${dur} ${easing} forwards`,
            };
        }

        case 'reveal':
            return {
                enterStyles: { zIndex: 5 },
                exitStyles: { zIndex: 10 },
                enterAnimation: `slideStay ${dur} ${easing} forwards`,
                exitAnimation: `slideExitToLeft ${dur} ${easing} forwards`,
            };

        case 'dissolve':
            return {
                enterStyles: {},
                exitStyles: {},
                enterAnimation: `slideDissolveIn ${dur} ${easing} forwards`,
                exitAnimation: `slideDissolveOut ${dur} ${easing} forwards`,
            };

        case 'swipe':
            return {
                enterStyles: {},
                exitStyles: {},
                enterAnimation: `slideSwipeIn ${dur} ${easing} forwards`,
                exitAnimation: `slideSwipeOut ${dur} ${easing} forwards`,
            };

        case 'push':
            return {
                enterStyles: {},
                exitStyles: {},
                enterAnimation: `slideEnterFromRight ${dur} ${easing} forwards`,
                exitAnimation: `slideExitToLeft ${dur} ${easing} forwards`,
            };

        case 'morph':
            return {
                enterStyles: {},
                exitStyles: {},
                enterAnimation: `slideMorphIn ${dur} ${easing} forwards`,
                exitAnimation: `slideMorphOut ${dur} ${easing} forwards`,
            };

        case 'none':
        default:
            return {
                enterStyles: {},
                exitStyles: {},
                enterAnimation: '',
                exitAnimation: '',
            };
    }
}

// ========================================
// ELEMENT ANIMATION CSS GENERATORS
// ========================================

/**
 * Get CSS animation string for an individual block/element animation
 */
export function getElementAnimationCSS(
    config: ElementAnimationConfig,
): string {
    const dur = `${config.duration}ms`;
    const delay = `${config.delay}ms`;
    const easing = EASING_CSS[config.easing] || 'ease';

    if (config.type === 'none') return '';

    const animationName = `elem${config.type
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('')}`;

    return `${animationName} ${dur} ${easing} ${delay} both`;
}

// ========================================
// CSS KEYFRAMES STYLESHEET
// ========================================

/**
 * Inject all animation keyframes into the document head.
 * Call this once during application initialization.
 */
export function injectTransitionKeyframes(): void {
    if (typeof document === 'undefined') return;

    const id = 'presentation-transition-keyframes';
    if (document.getElementById(id)) return;

    const style = document.createElement('style');
    style.id = id;
    style.textContent = KEYFRAMES_CSS;
    document.head.appendChild(style);
}

const KEYFRAMES_CSS = `
/* ===== SLIDE TRANSITION KEYFRAMES ===== */

@keyframes slideEnterFade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideExitFade {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slideEnterFromRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
@keyframes slideExitToLeft {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}
@keyframes slideEnterFromLeft {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
@keyframes slideExitToRight {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}

@keyframes slideEnterFromBottom {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes slideExitToTop {
  from { transform: translateY(0); }
  to { transform: translateY(-100%); }
}
@keyframes slideEnterFromTop {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}
@keyframes slideExitToBottom {
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
}

@keyframes slideZoomIn {
  from { transform: scale(0.3); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes slideZoomOutFade {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(1.3); opacity: 0; }
}
@keyframes slideZoomOut {
  from { transform: scale(1.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes slideZoomInFade {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.5); opacity: 0; }
}

@keyframes slideFlipInX {
  from { transform: rotateX(90deg); opacity: 0; }
  to { transform: rotateX(0deg); opacity: 1; }
}
@keyframes slideFlipOutX {
  from { transform: rotateX(0deg); opacity: 1; }
  to { transform: rotateX(-90deg); opacity: 0; }
}
@keyframes slideFlipInY {
  from { transform: rotateY(90deg); opacity: 0; }
  to { transform: rotateY(0deg); opacity: 1; }
}
@keyframes slideFlipOutY {
  from { transform: rotateY(0deg); opacity: 1; }
  to { transform: rotateY(-90deg); opacity: 0; }
}

@keyframes slideCubeIn {
  from { transform: rotateY(-90deg) translateZ(50%); opacity: 0; }
  to { transform: rotateY(0deg) translateZ(0); opacity: 1; }
}
@keyframes slideCubeOut {
  from { transform: rotateY(0deg) translateZ(0); opacity: 1; }
  to { transform: rotateY(90deg) translateZ(50%); opacity: 0; }
}

@keyframes slideStay {
  from { transform: none; opacity: 1; }
  to { transform: none; opacity: 1; }
}

@keyframes slideDissolveIn {
  0% { opacity: 0; filter: blur(8px); }
  100% { opacity: 1; filter: blur(0px); }
}
@keyframes slideDissolveOut {
  0% { opacity: 1; filter: blur(0px); }
  100% { opacity: 0; filter: blur(8px); }
}

@keyframes slideSwipeIn {
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
}
@keyframes slideSwipeOut {
  from { clip-path: inset(0 0 0 0); }
  to { clip-path: inset(0 0 0 100%); }
}

@keyframes slideMorphIn {
  0% { transform: scale(0.8) rotate(-2deg); opacity: 0; filter: blur(4px); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0px); }
}
@keyframes slideMorphOut {
  0% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0px); }
  100% { transform: scale(0.8) rotate(2deg); opacity: 0; filter: blur(4px); }
}

/* ===== ELEMENT ANIMATION KEYFRAMES ===== */

@keyframes elemFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes elemFadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes elemFadeInDown {
  from { opacity: 0; transform: translateY(-30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes elemFadeInLeft {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes elemFadeInRight {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes elemScaleIn {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes elemScaleBounce {
  0% { opacity: 0; transform: scale(0.3); }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes elemSlideInLeft {
  from { transform: translateX(-100px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes elemSlideInRight {
  from { transform: translateX(100px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes elemSlideInUp {
  from { transform: translateY(100px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes elemSlideInDown {
  from { transform: translateY(-100px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes elemRotateIn {
  from { transform: rotate(-180deg) scale(0.5); opacity: 0; }
  to { transform: rotate(0deg) scale(1); opacity: 1; }
}

@keyframes elemBlurIn {
  from { filter: blur(12px); opacity: 0; }
  to { filter: blur(0px); opacity: 1; }
}

@keyframes elemTypewriter {
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
}

@keyframes elemBounce {
  0%, 20%, 53%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-30px); }
  60% { transform: translateY(-15px); }
}

@keyframes elemFlip {
  0% { transform: perspective(400px) rotateY(90deg); opacity: 0; }
  40% { transform: perspective(400px) rotateY(-10deg); }
  70% { transform: perspective(400px) rotateY(10deg); }
  100% { transform: perspective(400px) rotateY(0deg); opacity: 1; }
}

@keyframes elemSwing {
  20% { transform: rotate(15deg); }
  40% { transform: rotate(-10deg); }
  60% { transform: rotate(5deg); }
  80% { transform: rotate(-5deg); }
  100% { transform: rotate(0deg); }
}
`;

// ========================================
// TRANSITION PRESETS
// ========================================

export const TRANSITION_PRESETS: Record<string, TransitionConfig> = {
    none: { type: 'none', duration: 0, easing: 'ease' },
    'fade-smooth': { type: 'fade', duration: 600, easing: 'ease-in-out' },
    'fade-quick': { type: 'fade', duration: 300, easing: 'ease' },
    'slide-modern': { type: 'slide-left', duration: 500, easing: 'spring' },
    'slide-gentle': { type: 'slide-left', duration: 800, easing: 'ease-out' },
    'zoom-dramatic': { type: 'zoom-in', duration: 700, easing: 'spring' },
    'flip-3d': { type: 'flip-y', duration: 800, easing: 'ease-in-out' },
    'cube-3d': { type: 'cube', duration: 900, easing: 'ease-in-out' },
    'cover-reveal': { type: 'cover-left', duration: 600, easing: 'ease-out' },
    dissolve: { type: 'dissolve', duration: 700, easing: 'ease-in-out' },
    morph: { type: 'morph', duration: 800, easing: 'spring' },
    'swipe-clean': { type: 'swipe', duration: 600, easing: 'ease-in-out' },
    push: { type: 'push', duration: 500, easing: 'ease-out' },
};

/**
 * Default element animation stagger for sequential reveals
 */
export function getStaggeredElementAnimations(
    elementCount: number,
    baseAnimation: ElementAnimationConfig,
    staggerInterval: number = 100,
): ElementAnimationConfig[] {
    return Array.from({ length: elementCount }, (_, i) => ({
        ...baseAnimation,
        delay: baseAnimation.delay + i * staggerInterval,
    }));
}
