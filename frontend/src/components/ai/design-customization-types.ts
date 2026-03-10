// ============================================
// DESIGN CUSTOMIZATION TYPES & PRESETS
// ============================================

import type { SlideTransitionType } from '@/lib/slide-transition-engine';

// ----- Design Template Presets -----

export type DesignTemplateName =
    | 'modern-minimalist'
    | 'tech-dark'
    | 'corporate-blue'
    | 'playful-gradient'
    | 'elegant-serif'
    | 'bold-statement'
    | 'nature-organic'
    | 'retro-vintage';

export interface DesignTemplate {
    name: DesignTemplateName;
    label: string;
    description: string;
    icon: string;
    colors: ColorPalette;
    fonts: FontPairing;
    borderRadius: string;
    cardStyle: 'flat' | 'elevated' | 'glassmorphism' | 'outlined';
}

export interface ColorPalette {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
}

export interface FontPairing {
    heading: string;
    body: string;
    label: string;
    description: string;
}

export type ContentDensity = 'minimal' | 'balanced' | 'data-heavy';

export type AspectRatio = '16:9' | '4:3' | '9:16';

// ----- Generation Design Settings -----

export interface DesignSettings {
    template: DesignTemplateName;
    colorPalette: ColorPalette;
    fontPairing: FontPairing;
    transition: SlideTransitionType;
    contentDensity: ContentDensity;
    aspectRatio: AspectRatio;
    customInstructions: string;
}

// ============================================
// PRESET DATA
// ============================================

export const COLOR_PALETTES: Record<DesignTemplateName, ColorPalette> = {
    'modern-minimalist': {
        primary: '#0f172a',
        secondary: '#64748b',
        accent: '#3b82f6',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#0f172a',
        textMuted: '#94a3b8',
    },
    'tech-dark': {
        primary: '#a78bfa',
        secondary: '#06b6d4',
        accent: '#22d3ee',
        background: '#0f0f23',
        surface: '#1a1a3e',
        text: '#e2e8f0',
        textMuted: '#64748b',
    },
    'corporate-blue': {
        primary: '#1e40af',
        secondary: '#1e3a5f',
        accent: '#3b82f6',
        background: '#f0f4ff',
        surface: '#dbeafe',
        text: '#1e293b',
        textMuted: '#64748b',
    },
    'playful-gradient': {
        primary: '#ec4899',
        secondary: '#8b5cf6',
        accent: '#f59e0b',
        background: '#fdf2f8',
        surface: '#fce7f3',
        text: '#1f2937',
        textMuted: '#6b7280',
    },
    'elegant-serif': {
        primary: '#78350f',
        secondary: '#92400e',
        accent: '#d97706',
        background: '#fffbeb',
        surface: '#fef3c7',
        text: '#1c1917',
        textMuted: '#78716c',
    },
    'bold-statement': {
        primary: '#dc2626',
        secondary: '#0f172a',
        accent: '#facc15',
        background: '#18181b',
        surface: '#27272a',
        text: '#fafafa',
        textMuted: '#a1a1aa',
    },
    'nature-organic': {
        primary: '#059669',
        secondary: '#065f46',
        accent: '#10b981',
        background: '#f0fdf4',
        surface: '#dcfce7',
        text: '#14532d',
        textMuted: '#6b7280',
    },
    'retro-vintage': {
        primary: '#b45309',
        secondary: '#9a3412',
        accent: '#ea580c',
        background: '#fef7ed',
        surface: '#fff7ed',
        text: '#431407',
        textMuted: '#78716c',
    },
};

export const FONT_PAIRINGS: Record<DesignTemplateName, FontPairing> = {
    'modern-minimalist': {
        heading: 'Inter',
        body: 'Inter',
        label: 'Clean & Modern',
        description: 'Minimalist geometric sans-serif',
    },
    'tech-dark': {
        heading: 'JetBrains Mono',
        body: 'Inter',
        label: 'Tech Mono',
        description: 'Monospace headings with clean body',
    },
    'corporate-blue': {
        heading: 'Outfit',
        body: 'Source Sans 3',
        label: 'Corporate Pro',
        description: 'Professional and authoritative',
    },
    'playful-gradient': {
        heading: 'Fredoka',
        body: 'Nunito',
        label: 'Playful Rounded',
        description: 'Friendly and approachable',
    },
    'elegant-serif': {
        heading: 'Playfair Display',
        body: 'Lora',
        label: 'Classic Serif',
        description: 'Timeless elegance',
    },
    'bold-statement': {
        heading: 'Bebas Neue',
        body: 'Roboto',
        label: 'Bold Impact',
        description: 'High contrast and attention-grabbing',
    },
    'nature-organic': {
        heading: 'DM Serif Display',
        body: 'DM Sans',
        label: 'Organic Warmth',
        description: 'Natural and grounded',
    },
    'retro-vintage': {
        heading: 'Pacifico',
        body: 'Raleway',
        label: 'Retro Charm',
        description: 'Nostalgic and characterful',
    },
};

export const DESIGN_TEMPLATES: DesignTemplate[] = [
    {
        name: 'modern-minimalist',
        label: 'Modern Minimalist',
        description: 'Clean, spacious, focused',
        icon: '◻️',
        colors: COLOR_PALETTES['modern-minimalist'],
        fonts: FONT_PAIRINGS['modern-minimalist'],
        borderRadius: '12px',
        cardStyle: 'flat',
    },
    {
        name: 'tech-dark',
        label: 'Tech Dark',
        description: 'Neon accents, dark mode',
        icon: '🌃',
        colors: COLOR_PALETTES['tech-dark'],
        fonts: FONT_PAIRINGS['tech-dark'],
        borderRadius: '8px',
        cardStyle: 'glassmorphism',
    },
    {
        name: 'corporate-blue',
        label: 'Corporate Blue',
        description: 'Professional, trustworthy',
        icon: '🏢',
        colors: COLOR_PALETTES['corporate-blue'],
        fonts: FONT_PAIRINGS['corporate-blue'],
        borderRadius: '8px',
        cardStyle: 'elevated',
    },
    {
        name: 'playful-gradient',
        label: 'Playful Gradient',
        description: 'Fun, vibrant, colorful',
        icon: '🎨',
        colors: COLOR_PALETTES['playful-gradient'],
        fonts: FONT_PAIRINGS['playful-gradient'],
        borderRadius: '20px',
        cardStyle: 'elevated',
    },
    {
        name: 'elegant-serif',
        label: 'Elegant Serif',
        description: 'Classic, sophisticated',
        icon: '📜',
        colors: COLOR_PALETTES['elegant-serif'],
        fonts: FONT_PAIRINGS['elegant-serif'],
        borderRadius: '4px',
        cardStyle: 'outlined',
    },
    {
        name: 'bold-statement',
        label: 'Bold Statement',
        description: 'High contrast, impactful',
        icon: '⚡',
        colors: COLOR_PALETTES['bold-statement'],
        fonts: FONT_PAIRINGS['bold-statement'],
        borderRadius: '0px',
        cardStyle: 'flat',
    },
    {
        name: 'nature-organic',
        label: 'Nature Organic',
        description: 'Soft, earthy, calming',
        icon: '🌿',
        colors: COLOR_PALETTES['nature-organic'],
        fonts: FONT_PAIRINGS['nature-organic'],
        borderRadius: '16px',
        cardStyle: 'elevated',
    },
    {
        name: 'retro-vintage',
        label: 'Retro Vintage',
        description: 'Warm tones, character',
        icon: '📻',
        colors: COLOR_PALETTES['retro-vintage'],
        fonts: FONT_PAIRINGS['retro-vintage'],
        borderRadius: '8px',
        cardStyle: 'outlined',
    },
];

export const CONTENT_DENSITY_OPTIONS: { value: ContentDensity; label: string; icon: string; description: string }[] = [
    {
        value: 'minimal',
        label: 'Minimal',
        icon: '🧘',
        description: 'Max 3 points per slide, lots of whitespace',
    },
    {
        value: 'balanced',
        label: 'Balanced',
        icon: '⚖️',
        description: 'Good mix of text and visuals',
    },
    {
        value: 'data-heavy',
        label: 'Data Heavy',
        icon: '📊',
        description: 'More charts, tables, detailed content',
    },
];

export const ASPECT_RATIO_OPTIONS: { value: AspectRatio; label: string; icon: string; dimensions: string }[] = [
    { value: '16:9', label: 'Widescreen', icon: '🖥️', dimensions: '1920×1080' },
    { value: '4:3', label: 'Standard', icon: '📺', dimensions: '1024×768' },
    { value: '9:16', label: 'Mobile / Story', icon: '📱', dimensions: '1080×1920' },
];

export const TRANSITION_OPTIONS: { value: SlideTransitionType; label: string; icon: string }[] = [
    { value: 'none', label: 'None', icon: '⏹️' },
    { value: 'fade', label: 'Fade', icon: '🌅' },
    { value: 'slide-left', label: 'Slide', icon: '➡️' },
    { value: 'zoom-in', label: 'Zoom', icon: '🔍' },
    { value: 'flip-y', label: 'Flip 3D', icon: '🔄' },
    { value: 'cube', label: 'Cube 3D', icon: '🧊' },
    { value: 'dissolve', label: 'Dissolve', icon: '✨' },
    { value: 'morph', label: 'Morph', icon: '🪄' },
    { value: 'swipe', label: 'Swipe', icon: '👆' },
    { value: 'push', label: 'Push', icon: '📤' },
];

// Helper to get default settings for a template
export function getDefaultDesignSettings(template: DesignTemplateName = 'modern-minimalist'): DesignSettings {
    return {
        template,
        colorPalette: COLOR_PALETTES[template],
        fontPairing: FONT_PAIRINGS[template],
        transition: 'fade',
        contentDensity: 'balanced',
        aspectRatio: '16:9',
        customInstructions: '',
    };
}
