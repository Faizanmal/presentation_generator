import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TransitionType =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'flip'
  | 'rotate'
  | 'cube'
  | 'dissolve'
  | 'wipe'
  | 'push'
  | 'cover'
  | 'uncover'
  | 'morph';

export type AnimationType =
  | 'none'
  | 'fade-in'
  | 'fade-in-up'
  | 'fade-in-down'
  | 'fade-in-left'
  | 'fade-in-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'bounce'
  | 'slide-in'
  | 'flip-in'
  | 'rotate-in'
  | 'typewriter'
  | 'blur-in'
  | 'scale-in'
  | 'swing'
  | 'wobble'
  | 'pulse';

export type EasingType =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'cubic-bezier'
  | 'spring'
  | 'bounce';

export interface TransitionConfig {
  type: TransitionType;
  duration: number; // milliseconds
  easing: EasingType;
  delay?: number;
}

export interface AnimationConfig {
  type: AnimationType;
  duration: number;
  easing: EasingType;
  delay: number;
  stagger?: number; // for sequential animations
  trigger: 'on-enter' | 'on-click' | 'with-previous' | 'after-previous';
}

export interface SlideAnimations {
  slideId: string;
  transition: TransitionConfig;
  elementAnimations: Array<{
    blockId: string;
    animation: AnimationConfig;
  }>;
}

@Injectable()
export class TransitionsService {
  constructor(private prisma: PrismaService) {}

  getAvailableTransitions(): Array<{
    type: TransitionType;
    name: string;
    description: string;
    preview: string;
    category: string;
  }> {
    return [
      { type: 'none', name: 'None', description: 'No transition', preview: '/transitions/none.gif', category: 'basic' },
      { type: 'fade', name: 'Fade', description: 'Smooth fade between slides', preview: '/transitions/fade.gif', category: 'basic' },
      { type: 'slide-left', name: 'Slide Left', description: 'Slide from right to left', preview: '/transitions/slide-left.gif', category: 'slide' },
      { type: 'slide-right', name: 'Slide Right', description: 'Slide from left to right', preview: '/transitions/slide-right.gif', category: 'slide' },
      { type: 'slide-up', name: 'Slide Up', description: 'Slide from bottom to top', preview: '/transitions/slide-up.gif', category: 'slide' },
      { type: 'slide-down', name: 'Slide Down', description: 'Slide from top to bottom', preview: '/transitions/slide-down.gif', category: 'slide' },
      { type: 'zoom-in', name: 'Zoom In', description: 'Zoom into the next slide', preview: '/transitions/zoom-in.gif', category: 'zoom' },
      { type: 'zoom-out', name: 'Zoom Out', description: 'Zoom out to the next slide', preview: '/transitions/zoom-out.gif', category: 'zoom' },
      { type: 'flip', name: 'Flip', description: '3D flip transition', preview: '/transitions/flip.gif', category: '3d' },
      { type: 'rotate', name: 'Rotate', description: '3D rotation transition', preview: '/transitions/rotate.gif', category: '3d' },
      { type: 'cube', name: 'Cube', description: '3D cube rotation', preview: '/transitions/cube.gif', category: '3d' },
      { type: 'dissolve', name: 'Dissolve', description: 'Pixel dissolve effect', preview: '/transitions/dissolve.gif', category: 'creative' },
      { type: 'wipe', name: 'Wipe', description: 'Wipe across screen', preview: '/transitions/wipe.gif', category: 'creative' },
      { type: 'push', name: 'Push', description: 'Push previous slide off', preview: '/transitions/push.gif', category: 'slide' },
      { type: 'cover', name: 'Cover', description: 'Cover previous slide', preview: '/transitions/cover.gif', category: 'slide' },
      { type: 'uncover', name: 'Uncover', description: 'Uncover next slide', preview: '/transitions/uncover.gif', category: 'slide' },
      { type: 'morph', name: 'Morph', description: 'Morph matching elements', preview: '/transitions/morph.gif', category: 'creative' },
    ];
  }

  getAvailableAnimations(): Array<{
    type: AnimationType;
    name: string;
    description: string;
    preview: string;
    category: string;
  }> {
    return [
      { type: 'none', name: 'None', description: 'No animation', preview: '/animations/none.gif', category: 'basic' },
      { type: 'fade-in', name: 'Fade In', description: 'Simple fade in', preview: '/animations/fade-in.gif', category: 'fade' },
      { type: 'fade-in-up', name: 'Fade In Up', description: 'Fade in from below', preview: '/animations/fade-in-up.gif', category: 'fade' },
      { type: 'fade-in-down', name: 'Fade In Down', description: 'Fade in from above', preview: '/animations/fade-in-down.gif', category: 'fade' },
      { type: 'fade-in-left', name: 'Fade In Left', description: 'Fade in from right', preview: '/animations/fade-in-left.gif', category: 'fade' },
      { type: 'fade-in-right', name: 'Fade In Right', description: 'Fade in from left', preview: '/animations/fade-in-right.gif', category: 'fade' },
      { type: 'zoom-in', name: 'Zoom In', description: 'Scale up into view', preview: '/animations/zoom-in.gif', category: 'zoom' },
      { type: 'zoom-out', name: 'Zoom Out', description: 'Scale down into view', preview: '/animations/zoom-out.gif', category: 'zoom' },
      { type: 'bounce', name: 'Bounce', description: 'Bouncy entrance', preview: '/animations/bounce.gif', category: 'attention' },
      { type: 'slide-in', name: 'Slide In', description: 'Slide into position', preview: '/animations/slide-in.gif', category: 'slide' },
      { type: 'flip-in', name: 'Flip In', description: '3D flip entrance', preview: '/animations/flip-in.gif', category: '3d' },
      { type: 'rotate-in', name: 'Rotate In', description: 'Rotate into view', preview: '/animations/rotate-in.gif', category: '3d' },
      { type: 'typewriter', name: 'Typewriter', description: 'Type text character by character', preview: '/animations/typewriter.gif', category: 'text' },
      { type: 'blur-in', name: 'Blur In', description: 'Blur to focus', preview: '/animations/blur-in.gif', category: 'creative' },
      { type: 'scale-in', name: 'Scale In', description: 'Scale into view', preview: '/animations/scale-in.gif', category: 'zoom' },
      { type: 'swing', name: 'Swing', description: 'Swinging entrance', preview: '/animations/swing.gif', category: 'attention' },
      { type: 'wobble', name: 'Wobble', description: 'Wobble effect', preview: '/animations/wobble.gif', category: 'attention' },
      { type: 'pulse', name: 'Pulse', description: 'Pulsing attention', preview: '/animations/pulse.gif', category: 'attention' },
    ];
  }

  getEasingFunctions(): Array<{
    type: EasingType;
    name: string;
    cssValue: string;
    preview: string;
  }> {
    return [
      { type: 'linear', name: 'Linear', cssValue: 'linear', preview: '/easing/linear.svg' },
      { type: 'ease', name: 'Ease', cssValue: 'ease', preview: '/easing/ease.svg' },
      { type: 'ease-in', name: 'Ease In', cssValue: 'ease-in', preview: '/easing/ease-in.svg' },
      { type: 'ease-out', name: 'Ease Out', cssValue: 'ease-out', preview: '/easing/ease-out.svg' },
      { type: 'ease-in-out', name: 'Ease In Out', cssValue: 'ease-in-out', preview: '/easing/ease-in-out.svg' },
      { type: 'cubic-bezier', name: 'Custom', cssValue: 'cubic-bezier(0.4, 0, 0.2, 1)', preview: '/easing/custom.svg' },
      { type: 'spring', name: 'Spring', cssValue: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', preview: '/easing/spring.svg' },
      { type: 'bounce', name: 'Bounce', cssValue: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', preview: '/easing/bounce.svg' },
    ];
  }

  async setSlideTransition(
    slideId: string,
    config: TransitionConfig,
  ): Promise<void> {
    await this.prisma.slide.update({
      where: { id: slideId },
      data: {
        // Store in JSON field (would need to add to schema)
        // transition: config,
      },
    });
  }

  async setElementAnimation(
    blockId: string,
    config: AnimationConfig,
  ): Promise<void> {
    await this.prisma.block.update({
      where: { id: blockId },
      data: {
        // Store in JSON field
        // animation: config,
      },
    });
  }

  async applyTransitionToAll(
    projectId: string,
    config: TransitionConfig,
  ): Promise<void> {
    await this.prisma.slide.updateMany({
      where: { projectId },
      data: {
        // transition: config,
      },
    });
  }

  async getSlideAnimations(slideId: string): Promise<SlideAnimations> {
    const slide = await this.prisma.slide.findUnique({
      where: { id: slideId },
      include: { blocks: true },
    });

    if (!slide) {
      throw new Error('Slide not found');
    }

    // Default config
    return {
      slideId,
      transition: {
        type: 'fade',
        duration: 500,
        easing: 'ease-out',
      },
      elementAnimations: slide.blocks.map((block) => ({
        blockId: block.id,
        animation: {
          type: 'fade-in-up',
          duration: 400,
          easing: 'ease-out',
          delay: 0,
          trigger: 'on-enter',
        },
      })),
    };
  }

  generateCSSKeyframes(animation: AnimationType): string {
    const keyframes: Record<AnimationType, string> = {
      none: '',
      'fade-in': `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `,
      'fade-in-up': `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `,
      'fade-in-down': `
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `,
      'fade-in-left': `
        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `,
      'fade-in-right': `
        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `,
      'zoom-in': `
        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `,
      'zoom-out': `
        @keyframes zoomOut {
          from {
            opacity: 0;
            transform: scale(1.2);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `,
      bounce: `
        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% {
            transform: translate3d(0, 0, 0);
          }
          40%, 43% {
            transform: translate3d(0, -30px, 0);
          }
          70% {
            transform: translate3d(0, -15px, 0);
          }
          90% {
            transform: translate3d(0, -4px, 0);
          }
        }
      `,
      'slide-in': `
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `,
      'flip-in': `
        @keyframes flipIn {
          from {
            transform: perspective(400px) rotateY(90deg);
            opacity: 0;
          }
          to {
            transform: perspective(400px) rotateY(0);
            opacity: 1;
          }
        }
      `,
      'rotate-in': `
        @keyframes rotateIn {
          from {
            transform: rotate(-200deg);
            opacity: 0;
          }
          to {
            transform: rotate(0);
            opacity: 1;
          }
        }
      `,
      typewriter: `
        @keyframes typewriter {
          from { width: 0; }
          to { width: 100%; }
        }
      `,
      'blur-in': `
        @keyframes blurIn {
          from {
            filter: blur(10px);
            opacity: 0;
          }
          to {
            filter: blur(0);
            opacity: 1;
          }
        }
      `,
      'scale-in': `
        @keyframes scaleIn {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }
      `,
      swing: `
        @keyframes swing {
          20% { transform: rotate(15deg); }
          40% { transform: rotate(-10deg); }
          60% { transform: rotate(5deg); }
          80% { transform: rotate(-5deg); }
          100% { transform: rotate(0deg); }
        }
      `,
      wobble: `
        @keyframes wobble {
          0% { transform: translateX(0%); }
          15% { transform: translateX(-25%) rotate(-5deg); }
          30% { transform: translateX(20%) rotate(3deg); }
          45% { transform: translateX(-15%) rotate(-3deg); }
          60% { transform: translateX(10%) rotate(2deg); }
          75% { transform: translateX(-5%) rotate(-1deg); }
          100% { transform: translateX(0%); }
        }
      `,
      pulse: `
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `,
    };

    return keyframes[animation] || '';
  }
}
