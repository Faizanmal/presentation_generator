// ============================================
// DESIGN CUSTOMIZATION TYPES & PRESETS
// ============================================

import type { SlideTransitionType } from '@/lib/slide-transition-engine';

// ----- Design Template Presets -----

export const DEFAULT_DESIGN_TEMPLATE: DesignTemplateName = 'corporate-blue';

export type DesignTemplateName =
    | 'modern-minimalist'
    | 'tech-dark'
    | 'corporate-blue'
    | 'playful-gradient'
    | 'elegant-serif'
    | 'bold-statement'
    | 'nature-organic'
    | 'retro-vintage'
    | 'neon-cyber'
    | 'soft-pastel';

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
        primary: '#111827',
        secondary: '#475569',
        accent: '#0ea5e9',
        background: '#f8fafc',
        surface: '#ffffff',
        text: '#111827',
        textMuted: '#64748b',
    },
    'tech-dark': {
        primary: '#8b5cf6',
        secondary: '#06b6d4',
        accent: '#38bdf8',
        background: '#0b1120',
        surface: '#111827',
        text: '#e5eefb',
        textMuted: '#8aa0bf',
    },
    'corporate-blue': {
        primary: '#163b66',
        secondary: '#2c5282',
        accent: '#14b8a6',
        background: '#f5f9ff',
        surface: '#e9f1fb',
        text: '#10253f',
        textMuted: '#5b7088',
    },
    'playful-gradient': {
        primary: '#db2777',
        secondary: '#7c3aed',
        accent: '#fb923c',
        background: '#fff7fb',
        surface: '#fde7f3',
        text: '#1f2937',
        textMuted: '#6b7280',
    },
    'elegant-serif': {
        primary: '#6b3f1d',
        secondary: '#8b5e34',
        accent: '#c08457',
        background: '#fffaf3',
        surface: '#f7ead9',
        text: '#2a211b',
        textMuted: '#7c6b5c',
    },
    'bold-statement': {
        primary: '#ef4444',
        secondary: '#111827',
        accent: '#f59e0b',
        background: '#111111',
        surface: '#1f2937',
        text: '#fafafa',
        textMuted: '#cbd5e1',
    },
    'nature-organic': {
        primary: '#0f766e',
        secondary: '#166534',
        accent: '#84cc16',
        background: '#f5fbf7',
        surface: '#e3f5eb',
        text: '#163124',
        textMuted: '#5f7a69',
    },
    'retro-vintage': {
        primary: '#9a3412',
        secondary: '#7c2d12',
        accent: '#d97706',
        background: '#fff7ed',
        surface: '#ffedd5',
        text: '#4a1d0a',
        textMuted: '#7c6b5c',
    },
    'neon-cyber': {
        primary: '#00f5d4',
        secondary: '#9b5de5',
        accent: '#f15bb5',
        background: '#0a0a1a',
        surface: '#141428',
        text: '#e8e8ff',
        textMuted: '#8888aa',
    },
    'soft-pastel': {
        primary: '#7c3aed',
        secondary: '#f472b6',
        accent: '#fb923c',
        background: '#faf5ff',
        surface: '#f3e8ff',
        text: '#1e1b4b',
        textMuted: '#6b6b99',
    },
};

export const FONT_PAIRINGS: Record<DesignTemplateName, FontPairing> = {
    'modern-minimalist': {
        heading: 'Sora',
        body: 'Manrope',
        label: 'Editorial Minimal',
        description: 'Sharp sans-serif hierarchy with clean body copy',
    },
    'tech-dark': {
        heading: 'JetBrains Mono',
        body: 'Space Grotesk',
        label: 'Futurist Console',
        description: 'Technical edge with stronger display contrast',
    },
    'corporate-blue': {
        heading: 'Outfit',
        body: 'Source Sans 3',
        label: 'Boardroom Modern',
        description: 'Executive clarity with polished authority',
    },
    'playful-gradient': {
        heading: 'Fredoka',
        body: 'Nunito',
        label: 'Playful Energy',
        description: 'Rounded, expressive, and upbeat',
    },
    'elegant-serif': {
        heading: 'Playfair Display',
        body: 'Lora',
        label: 'Magazine Serif',
        description: 'Sophisticated editorial contrast',
    },
    'bold-statement': {
        heading: 'Bebas Neue',
        body: 'Barlow',
        label: 'Poster Impact',
        description: 'Punchy headlines with sturdy supporting text',
    },
    'nature-organic': {
        heading: 'DM Serif Display',
        body: 'DM Sans',
        label: 'Organic Calm',
        description: 'Warm contrast with grounded readability',
    },
    'retro-vintage': {
        heading: 'Abril Fatface',
        body: 'Raleway',
        label: 'Vintage Editorial',
        description: 'Nostalgic display typography with cleaner body text',
    },
    'neon-cyber': {
        heading: 'Space Grotesk',
        body: 'Inter',
        label: 'Cyber Terminal',
        description: 'Electric futurist with geometric precision',
    },
    'soft-pastel': {
        heading: 'DM Serif Display',
        body: 'DM Sans',
        label: 'Lavender Dream',
        description: 'Gentle serif contrast with airy sans-serif body',
    },
};

export const DESIGN_TEMPLATES: DesignTemplate[] = [
    {
        name: 'modern-minimalist',
        label: 'Modern Minimalist',
        description: 'Editorial whitespace and crisp hierarchy',
        icon: '◻️',
        colors: COLOR_PALETTES['modern-minimalist'],
        fonts: FONT_PAIRINGS['modern-minimalist'],
        borderRadius: '12px',
        cardStyle: 'flat',
    },
    {
        name: 'tech-dark',
        label: 'Tech Dark',
        description: 'High-contrast, futuristic, data-ready',
        icon: '🌃',
        colors: COLOR_PALETTES['tech-dark'],
        fonts: FONT_PAIRINGS['tech-dark'],
        borderRadius: '8px',
        cardStyle: 'glassmorphism',
    },
    {
        name: 'corporate-blue',
        label: 'Corporate Blue',
        description: 'Executive polish with teal accents',
        icon: '🏢',
        colors: COLOR_PALETTES['corporate-blue'],
        fonts: FONT_PAIRINGS['corporate-blue'],
        borderRadius: '8px',
        cardStyle: 'elevated',
    },
    {
        name: 'playful-gradient',
        label: 'Playful Gradient',
        description: 'Lively color with controlled energy',
        icon: '🎨',
        colors: COLOR_PALETTES['playful-gradient'],
        fonts: FONT_PAIRINGS['playful-gradient'],
        borderRadius: '20px',
        cardStyle: 'elevated',
    },
    {
        name: 'elegant-serif',
        label: 'Elegant Serif',
        description: 'Magazine-style storytelling',
        icon: '📜',
        colors: COLOR_PALETTES['elegant-serif'],
        fonts: FONT_PAIRINGS['elegant-serif'],
        borderRadius: '4px',
        cardStyle: 'outlined',
    },
    {
        name: 'bold-statement',
        label: 'Bold Statement',
        description: 'Poster-like impact for decisive messaging',
        icon: '⚡',
        colors: COLOR_PALETTES['bold-statement'],
        fonts: FONT_PAIRINGS['bold-statement'],
        borderRadius: '0px',
        cardStyle: 'flat',
    },
    {
        name: 'nature-organic',
        label: 'Nature Organic',
        description: 'Soft depth with grounded contrast',
        icon: '🌿',
        colors: COLOR_PALETTES['nature-organic'],
        fonts: FONT_PAIRINGS['nature-organic'],
        borderRadius: '16px',
        cardStyle: 'elevated',
    },
    {
        name: 'retro-vintage',
        label: 'Retro Vintage',
        description: 'Warm editorial nostalgia without clutter',
        icon: '📻',
        colors: COLOR_PALETTES['retro-vintage'],
        fonts: FONT_PAIRINGS['retro-vintage'],
        borderRadius: '8px',
        cardStyle: 'outlined',
    },
    {
        name: 'neon-cyber',
        label: 'Neon Cyber',
        description: 'Electric dark mode with vivid neon accents',
        icon: '🌐',
        colors: COLOR_PALETTES['neon-cyber'],
        fonts: FONT_PAIRINGS['neon-cyber'],
        borderRadius: '12px',
        cardStyle: 'glassmorphism',
    },
    {
        name: 'soft-pastel',
        label: 'Soft Pastel',
        description: 'Airy lavender elegance with warm rose touches',
        icon: '🦋',
        colors: COLOR_PALETTES['soft-pastel'],
        fonts: FONT_PAIRINGS['soft-pastel'],
        borderRadius: '16px',
        cardStyle: 'elevated',
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
export function getDefaultDesignSettings(template: DesignTemplateName = DEFAULT_DESIGN_TEMPLATE): DesignSettings {
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
