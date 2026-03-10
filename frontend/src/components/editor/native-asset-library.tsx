'use client';

import { useState, useMemo } from 'react';
import {
    Search,
    Shapes,
    ArrowRight,
    Type,
    LayoutGrid,
    Minus,
    Star,
    Heart,
    CircleDot,
    Triangle,
    Square,
    Hexagon,
    Pentagon,
    Diamond,
    Zap,
    CloudLightning,
    Flame,
    Target,
    Award,
    Shield,
    Flag,
    Bookmark,
    Check,
    X,
    AlertTriangle,
    Info,
    HelpCircle,
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ChevronsRight,
    CornerDownRight,
    TrendingUp,
    TrendingDown,
    BarChart3,
    PieChart,
    Activity,
    GitBranch,
    Workflow,
    Network,
    Users,
    User,
    Briefcase,
    Building2,
    Globe,
    Lightbulb,
    Rocket,
    Puzzle,
    Layers,
    Database,
    Server,
    Cloud,
    Lock,
    Key,
    Eye,
    Clock,
    Calendar,
    Mail,
    Phone,
    MessageCircle,
    ThumbsUp,
    Gift,
    Trophy,
    Crown,
    Gem,
    Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ========================================
// TYPES
// ========================================

interface AssetItem {
    id: string;
    name: string;
    category: AssetCategory;
    tags: string[];
    type: 'shape' | 'icon' | 'divider' | 'connector' | 'badge';
    svg: string; // SVG string with customizable fill/stroke
    defaultColor?: string;
}

type AssetCategory =
    | 'basic-shapes'
    | 'arrows'
    | 'flowchart'
    | 'icons-business'
    | 'icons-tech'
    | 'icons-social'
    | 'icons-status'
    | 'dividers'
    | 'connectors'
    | 'badges'
    | 'callouts';

interface NativeAssetLibraryProps {
    onInsertAsset: (asset: {
        type: string;
        svg: string;
        name: string;
        color: string;
        width: number;
        height: number;
    }) => void;
    className?: string;
}

// ========================================
// SHAPE SVG DEFINITIONS
// ========================================

const SHAPES: AssetItem[] = [
    // Basic Shapes
    {
        id: 'rect', name: 'Rectangle', category: 'basic-shapes', type: 'shape', tags: ['box', 'square', 'rectangle'],
        svg: '<rect x="2" y="6" width="60" height="36" rx="4" fill="currentColor"/>'
    },
    {
        id: 'rounded-rect', name: 'Rounded Rectangle', category: 'basic-shapes', type: 'shape', tags: ['pill', 'button', 'rounded'],
        svg: '<rect x="2" y="6" width="60" height="36" rx="18" fill="currentColor"/>'
    },
    {
        id: 'circle', name: 'Circle', category: 'basic-shapes', type: 'shape', tags: ['round', 'dot', 'circle'],
        svg: '<circle cx="32" cy="24" r="20" fill="currentColor"/>'
    },
    {
        id: 'ellipse', name: 'Ellipse', category: 'basic-shapes', type: 'shape', tags: ['oval', 'ellipse'],
        svg: '<ellipse cx="32" cy="24" rx="28" ry="18" fill="currentColor"/>'
    },
    {
        id: 'triangle', name: 'Triangle', category: 'basic-shapes', type: 'shape', tags: ['triangle', 'arrow'],
        svg: '<polygon points="32,4 60,44 4,44" fill="currentColor"/>'
    },
    {
        id: 'diamond', name: 'Diamond', category: 'basic-shapes', type: 'shape', tags: ['rhombus', 'diamond', 'decision'],
        svg: '<polygon points="32,4 60,24 32,44 4,24" fill="currentColor"/>'
    },
    {
        id: 'pentagon', name: 'Pentagon', category: 'basic-shapes', type: 'shape', tags: ['pentagon', '5-sided'],
        svg: '<polygon points="32,4 58,18 50,44 14,44 6,18" fill="currentColor"/>'
    },
    {
        id: 'hexagon', name: 'Hexagon', category: 'basic-shapes', type: 'shape', tags: ['hexagon', 'honeycomb'],
        svg: '<polygon points="16,4 48,4 60,24 48,44 16,44 4,24" fill="currentColor"/>'
    },
    {
        id: 'star-5', name: '5-Point Star', category: 'basic-shapes', type: 'shape', tags: ['star', 'rating', 'favorite'],
        svg: '<polygon points="32,4 38,18 54,18 42,28 46,44 32,34 18,44 22,28 10,18 26,18" fill="currentColor"/>'
    },
    {
        id: 'parallelogram', name: 'Parallelogram', category: 'basic-shapes', type: 'shape', tags: ['parallelogram', 'slant'],
        svg: '<polygon points="14,8 58,8 50,40 6,40" fill="currentColor"/>'
    },
    {
        id: 'trapezoid', name: 'Trapezoid', category: 'basic-shapes', type: 'shape', tags: ['trapezoid', 'funnel'],
        svg: '<polygon points="12,8 52,8 60,40 4,40" fill="currentColor"/>'
    },
    {
        id: 'cross', name: 'Cross', category: 'basic-shapes', type: 'shape', tags: ['plus', 'cross', 'add'],
        svg: '<path d="M22,4 h20 v16 h16 v16 h-16 v16 h-20 v-16 h-16 v-16 h16 z" fill="currentColor"/>'
    },

    // Arrows
    {
        id: 'arrow-right', name: 'Arrow Right', category: 'arrows', type: 'connector', tags: ['arrow', 'right', 'next'],
        svg: '<path d="M4,24 h44 l-12,-12 m12,12 l-12,12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    {
        id: 'arrow-left', name: 'Arrow Left', category: 'arrows', type: 'connector', tags: ['arrow', 'left', 'back'],
        svg: '<path d="M60,24 h-44 l12,-12 m-12,12 l12,12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    {
        id: 'arrow-up', name: 'Arrow Up', category: 'arrows', type: 'connector', tags: ['arrow', 'up', 'increase'],
        svg: '<path d="M32,44 v-32 l-12,12 m12,-12 l12,12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    {
        id: 'arrow-down', name: 'Arrow Down', category: 'arrows', type: 'connector', tags: ['arrow', 'down', 'decrease'],
        svg: '<path d="M32,4 v32 l-12,-12 m12,12 l12,-12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    {
        id: 'double-arrow', name: 'Double Arrow', category: 'arrows', type: 'connector', tags: ['bidirectional', 'both'],
        svg: '<path d="M16,24 h32 M48,24 l-8,-8 m8,8 l-8,8 M16,24 l8,-8 m-8,8 l8,8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    {
        id: 'curved-arrow', name: 'Curved Arrow', category: 'arrows', type: 'connector', tags: ['curve', 'flow', 'process'],
        svg: '<path d="M8,36 Q8,8 32,8 Q56,8 56,36" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M50,30 l6,6 l6,-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    {
        id: 'chevron-right', name: 'Chevron', category: 'arrows', type: 'shape', tags: ['chevron', 'process', 'step'],
        svg: '<polygon points="4,4 48,4 60,24 48,44 4,44 16,24" fill="currentColor"/>'
    },

    // Flowchart
    {
        id: 'fc-process', name: 'Process', category: 'flowchart', type: 'shape', tags: ['process', 'step', 'action'],
        svg: '<rect x="4" y="8" width="56" height="32" rx="2" fill="currentColor"/>'
    },
    {
        id: 'fc-decision', name: 'Decision', category: 'flowchart', type: 'shape', tags: ['decision', 'if', 'branch'],
        svg: '<polygon points="32,4 60,24 32,44 4,24" fill="currentColor"/>'
    },
    {
        id: 'fc-terminal', name: 'Terminal', category: 'flowchart', type: 'shape', tags: ['start', 'end', 'terminal'],
        svg: '<rect x="4" y="8" width="56" height="32" rx="16" fill="currentColor"/>'
    },
    {
        id: 'fc-data', name: 'Data', category: 'flowchart', type: 'shape', tags: ['data', 'io', 'input', 'output'],
        svg: '<polygon points="14,8 60,8 50,40 4,40" fill="currentColor"/>'
    },
    {
        id: 'fc-document', name: 'Document', category: 'flowchart', type: 'shape', tags: ['document', 'file', 'report'],
        svg: '<path d="M8,6 h48 v30 q-12,8 -24,0 t-24,0 z" fill="currentColor"/>'
    },
    {
        id: 'fc-cylinder', name: 'Database', category: 'flowchart', type: 'shape', tags: ['database', 'storage', 'cylinder'],
        svg: '<ellipse cx="32" cy="12" rx="24" ry="8" fill="currentColor"/><rect x="8" y="12" width="48" height="24" fill="currentColor"/><ellipse cx="32" cy="36" rx="24" ry="8" fill="currentColor"/>'
    },

    // Dividers
    {
        id: 'divider-line', name: 'Simple Line', category: 'dividers', type: 'divider', tags: ['line', 'separator', 'divider'],
        svg: '<line x1="4" y1="24" x2="60" y2="24" stroke="currentColor" stroke-width="2"/>'
    },
    {
        id: 'divider-dashed', name: 'Dashed Line', category: 'dividers', type: 'divider', tags: ['dashed', 'separator'],
        svg: '<line x1="4" y1="24" x2="60" y2="24" stroke="currentColor" stroke-width="2" stroke-dasharray="6,4"/>'
    },
    {
        id: 'divider-dotted', name: 'Dotted Line', category: 'dividers', type: 'divider', tags: ['dotted', 'separator'],
        svg: '<line x1="4" y1="24" x2="60" y2="24" stroke="currentColor" stroke-width="2" stroke-dasharray="2,4" stroke-linecap="round"/>'
    },
    {
        id: 'divider-gradient', name: 'Gradient Line', category: 'dividers', type: 'divider', tags: ['gradient', 'fade'],
        svg: '<defs><linearGradient id="dg"><stop offset="0%" stop-color="currentColor" stop-opacity="0"/><stop offset="50%" stop-color="currentColor" stop-opacity="1"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><line x1="4" y1="24" x2="60" y2="24" stroke="url(#dg)" stroke-width="2"/>'
    },
    {
        id: 'divider-wave', name: 'Wave', category: 'dividers', type: 'divider', tags: ['wave', 'curved', 'organic'],
        svg: '<path d="M4,24 Q12,14 20,24 T36,24 T52,24 T60,24" fill="none" stroke="currentColor" stroke-width="2"/>'
    },
    {
        id: 'divider-zigzag', name: 'Zigzag', category: 'dividers', type: 'divider', tags: ['zigzag', 'pattern'],
        svg: '<polyline points="4,24 10,16 16,32 22,16 28,32 34,16 40,32 46,16 52,32 58,16 60,24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    },

    // Badges / Labels
    {
        id: 'badge-circle', name: 'Circle Badge', category: 'badges', type: 'badge', tags: ['badge', 'circle', 'number'],
        svg: '<circle cx="32" cy="24" r="20" fill="currentColor"/><circle cx="32" cy="24" r="17" fill="none" stroke="white" stroke-width="1.5" opacity="0.5"/>'
    },
    {
        id: 'badge-ribbon', name: 'Ribbon Badge', category: 'badges', type: 'badge', tags: ['ribbon', 'award', 'medal'],
        svg: '<circle cx="32" cy="18" r="14" fill="currentColor"/><polygon points="22,28 24,44 32,38 40,44 42,28" fill="currentColor" opacity="0.8"/>'
    },
    {
        id: 'badge-shield', name: 'Shield Badge', category: 'badges', type: 'badge', tags: ['shield', 'security', 'trust'],
        svg: '<path d="M32,4 L56,14 L56,28 Q56,42 32,46 Q8,42 8,28 L8,14 Z" fill="currentColor"/>'
    },
    {
        id: 'badge-banner', name: 'Banner', category: 'badges', type: 'badge', tags: ['banner', 'title', 'label'],
        svg: '<path d="M4,12 h56 v24 h-56 z" fill="currentColor"/><polygon points="4,12 4,8 12,12" fill="currentColor" opacity="0.7"/><polygon points="60,12 60,8 52,12" fill="currentColor" opacity="0.7"/>'
    },

    // Callouts
    {
        id: 'callout-speech', name: 'Speech Bubble', category: 'callouts', type: 'shape', tags: ['speech', 'bubble', 'comment', 'chat'],
        svg: '<rect x="4" y="4" width="56" height="30" rx="8" fill="currentColor"/><polygon points="16,34 24,44 28,34" fill="currentColor"/>'
    },
    {
        id: 'callout-thought', name: 'Thought Bubble', category: 'callouts', type: 'shape', tags: ['thought', 'idea', 'think'],
        svg: '<ellipse cx="34" cy="18" rx="26" ry="16" fill="currentColor"/><circle cx="16" cy="38" r="4" fill="currentColor"/><circle cx="10" cy="44" r="2.5" fill="currentColor"/>'
    },
    {
        id: 'callout-tooltip', name: 'Tooltip', category: 'callouts', type: 'shape', tags: ['tooltip', 'info', 'popup'],
        svg: '<rect x="4" y="4" width="56" height="28" rx="6" fill="currentColor"/><polygon points="28,32 32,40 36,32" fill="currentColor"/>'
    },
];

// ========================================
// CATEGORY METADATA
// ========================================

const CATEGORIES: { id: AssetCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'basic-shapes', label: 'Shapes', icon: <Shapes className="h-4 w-4" /> },
    { id: 'arrows', label: 'Arrows', icon: <ArrowRight className="h-4 w-4" /> },
    { id: 'flowchart', label: 'Flowchart', icon: <Workflow className="h-4 w-4" /> },
    { id: 'dividers', label: 'Dividers', icon: <Minus className="h-4 w-4" /> },
    { id: 'badges', label: 'Badges', icon: <Award className="h-4 w-4" /> },
    { id: 'callouts', label: 'Callouts', icon: <MessageCircle className="h-4 w-4" /> },
    { id: 'icons-business', label: 'Business', icon: <Briefcase className="h-4 w-4" /> },
    { id: 'icons-tech', label: 'Tech', icon: <Database className="h-4 w-4" /> },
    { id: 'icons-status', label: 'Status', icon: <AlertTriangle className="h-4 w-4" /> },
];

// Lucide icon wrappers as asset items (rendered as SVG strings at insert time)
const LUCIDE_ICONS: { name: string; icon: React.ComponentType<{ className?: string }>; category: AssetCategory; tags: string[] }[] = [
    // Business
    { name: 'Users', icon: Users, category: 'icons-business', tags: ['team', 'people', 'group'] },
    { name: 'User', icon: User, category: 'icons-business', tags: ['person', 'profile'] },
    { name: 'Briefcase', icon: Briefcase, category: 'icons-business', tags: ['work', 'business', 'job'] },
    { name: 'Building', icon: Building2, category: 'icons-business', tags: ['company', 'office', 'corporate'] },
    { name: 'Globe', icon: Globe, category: 'icons-business', tags: ['world', 'global', 'international'] },
    { name: 'TrendingUp', icon: TrendingUp, category: 'icons-business', tags: ['growth', 'increase', 'profit'] },
    { name: 'TrendingDown', icon: TrendingDown, category: 'icons-business', tags: ['decline', 'decrease', 'loss'] },
    { name: 'BarChart', icon: BarChart3, category: 'icons-business', tags: ['chart', 'stats', 'analytics'] },
    { name: 'PieChart', icon: PieChart, category: 'icons-business', tags: ['chart', 'breakdown', 'share'] },
    { name: 'Target', icon: Target, category: 'icons-business', tags: ['goal', 'objective', 'aim'] },
    { name: 'Award', icon: Award, category: 'icons-business', tags: ['achievement', 'prize', 'win'] },
    { name: 'Trophy', icon: Trophy, category: 'icons-business', tags: ['winner', 'champion', 'best'] },
    { name: 'Crown', icon: Crown, category: 'icons-business', tags: ['leader', 'king', 'top'] },
    { name: 'Gift', icon: Gift, category: 'icons-business', tags: ['reward', 'bonus', 'present'] },
    { name: 'Calendar', icon: Calendar, category: 'icons-business', tags: ['schedule', 'date', 'event'] },
    { name: 'Mail', icon: Mail, category: 'icons-business', tags: ['email', 'message', 'contact'] },
    { name: 'Phone', icon: Phone, category: 'icons-business', tags: ['call', 'contact', 'mobile'] },
    { name: 'ThumbsUp', icon: ThumbsUp, category: 'icons-business', tags: ['approve', 'like', 'good'] },

    // Tech
    { name: 'Database', icon: Database, category: 'icons-tech', tags: ['data', 'storage', 'sql'] },
    { name: 'Server', icon: Server, category: 'icons-tech', tags: ['hosting', 'backend', 'infrastructure'] },
    { name: 'Cloud', icon: Cloud, category: 'icons-tech', tags: ['cloud', 'saas', 'hosting'] },
    { name: 'Lock', icon: Lock, category: 'icons-tech', tags: ['security', 'password', 'encrypted'] },
    { name: 'Key', icon: Key, category: 'icons-tech', tags: ['access', 'api', 'authentication'] },
    { name: 'Eye', icon: Eye, category: 'icons-tech', tags: ['view', 'visibility', 'monitor'] },
    { name: 'Activity', icon: Activity, category: 'icons-tech', tags: ['monitoring', 'health', 'pulse'] },
    { name: 'GitBranch', icon: GitBranch, category: 'icons-tech', tags: ['version', 'branch', 'git'] },
    { name: 'Network', icon: Network, category: 'icons-tech', tags: ['network', 'connection', 'topology'] },
    { name: 'Layers', icon: Layers, category: 'icons-tech', tags: ['stack', 'layers', 'architecture'] },
    { name: 'Puzzle', icon: Puzzle, category: 'icons-tech', tags: ['integration', 'plugin', 'module'] },

    // Status
    { name: 'Check', icon: Check, category: 'icons-status', tags: ['yes', 'done', 'complete', 'success'] },
    { name: 'X Mark', icon: X, category: 'icons-status', tags: ['no', 'close', 'cancel', 'fail'] },
    { name: 'Warning', icon: AlertTriangle, category: 'icons-status', tags: ['alert', 'caution', 'warning'] },
    { name: 'Info', icon: Info, category: 'icons-status', tags: ['information', 'notice', 'tip'] },
    { name: 'Help', icon: HelpCircle, category: 'icons-status', tags: ['question', 'support', 'help'] },
    { name: 'Star', icon: Star, category: 'icons-status', tags: ['favorite', 'rating', 'star'] },
    { name: 'Heart', icon: Heart, category: 'icons-status', tags: ['love', 'favorite', 'health'] },
    { name: 'Lightning', icon: Zap, category: 'icons-status', tags: ['fast', 'electric', 'power'] },
    { name: 'Flame', icon: Flame, category: 'icons-status', tags: ['hot', 'trending', 'fire'] },
    { name: 'Lightbulb', icon: Lightbulb, category: 'icons-status', tags: ['idea', 'innovation', 'bright'] },
    { name: 'Rocket', icon: Rocket, category: 'icons-status', tags: ['launch', 'growth', 'startup'] },
    { name: 'Sparkles', icon: Sparkles, category: 'icons-status', tags: ['new', 'magic', 'ai'] },
    { name: 'Shield', icon: Shield, category: 'icons-status', tags: ['security', 'protection', 'safe'] },
    { name: 'Flag', icon: Flag, category: 'icons-status', tags: ['milestone', 'mark', 'important'] },
    { name: 'Bookmark', icon: Bookmark, category: 'icons-status', tags: ['save', 'bookmark', 'reference'] },
    { name: 'Clock', icon: Clock, category: 'icons-status', tags: ['time', 'deadline', 'duration'] },
    { name: 'Gem', icon: Gem, category: 'icons-status', tags: ['premium', 'value', 'quality'] },
    { name: 'Storm', icon: CloudLightning, category: 'icons-status', tags: ['problem', 'crisis', 'disruption'] },
];

// ========================================
// COLOR PALETTE
// ========================================

const COLOR_PALETTE = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#1e293b', // Slate
    '#ffffff', // White
    '#64748b', // Gray
];

// ========================================
// COMPONENT
// ========================================

export function NativeAssetLibrary({
    onInsertAsset,
    className,
}: NativeAssetLibraryProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'all'>('all');
    const [selectedColor, setSelectedColor] = useState('#6366f1');
    const [activeTab, setActiveTab] = useState('shapes');

    // Filter shapes by search and category
    const filteredShapes = useMemo(() => {
        return SHAPES.filter((shape) => {
            const matchesSearch =
                !searchQuery ||
                shape.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                shape.tags.some((tag) =>
                    tag.toLowerCase().includes(searchQuery.toLowerCase()),
                );
            const matchesCategory =
                selectedCategory === 'all' || shape.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [searchQuery, selectedCategory]);

    // Filter Lucide icons
    const filteredIcons = useMemo(() => {
        return LUCIDE_ICONS.filter((icon) => {
            const matchesSearch =
                !searchQuery ||
                icon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                icon.tags.some((tag) =>
                    tag.toLowerCase().includes(searchQuery.toLowerCase()),
                );
            const matchesCategory =
                selectedCategory === 'all' || icon.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [searchQuery, selectedCategory]);

    const handleInsertShape = (shape: AssetItem) => {
        const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48" width="200" height="150" style="color: ${selectedColor}">${shape.svg}</svg>`;
        onInsertAsset({
            type: shape.type,
            svg: fullSvg,
            name: shape.name,
            color: selectedColor,
            width: 200,
            height: 150,
        });
    };

    const handleInsertIcon = (icon: { name: string }) => {
        // For Lucide icons, we generate a simple SVG wrapper
        const size = 64;
        const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${selectedColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="${icon.name.toLowerCase()}"></svg>`;
        onInsertAsset({
            type: 'icon',
            svg: fullSvg,
            name: icon.name,
            color: selectedColor,
            width: size,
            height: size,
        });
    };

    return (
        <div className={cn('flex flex-col h-full', className)}>
            {/* Header */}
            <div className="p-4 border-b space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Shapes className="h-4 w-4" />
                        Asset Library
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                        {SHAPES.length + LUCIDE_ICONS.length} assets
                    </Badge>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search shapes, icons..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-sm"
                    />
                </div>

                {/* Color Picker */}
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">Color:</span>
                    {COLOR_PALETTE.map((color) => (
                        <button
                            key={color}
                            className={cn(
                                'w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
                                selectedColor === color
                                    ? 'border-foreground scale-110'
                                    : 'border-transparent',
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => setSelectedColor(color)}
                            title={color}
                        />
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="mx-4 mt-2 grid grid-cols-3">
                    <TabsTrigger value="shapes" className="text-xs">
                        <Shapes className="h-3.5 w-3.5 mr-1" />
                        Shapes
                    </TabsTrigger>
                    <TabsTrigger value="icons" className="text-xs">
                        <Star className="h-3.5 w-3.5 mr-1" />
                        Icons
                    </TabsTrigger>
                    <TabsTrigger value="all" className="text-xs">
                        <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                        All
                    </TabsTrigger>
                </TabsList>

                {/* Category filter chips */}
                <div className="px-4 py-2">
                    <ScrollArea className="w-full" style={{ maxHeight: 38 }}>
                        <div className="flex gap-1.5 flex-wrap">
                            <button
                                className={cn(
                                    'px-2.5 py-1 rounded-full text-xs transition-colors',
                                    selectedCategory === 'all'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                                )}
                                onClick={() => setSelectedCategory('all')}
                            >
                                All
                            </button>
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    className={cn(
                                        'px-2.5 py-1 rounded-full text-xs transition-colors flex items-center gap-1',
                                        selectedCategory === cat.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80',
                                    )}
                                    onClick={() => setSelectedCategory(cat.id)}
                                >
                                    {cat.icon}
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Shapes Grid */}
                <TabsContent value="shapes" className="flex-1 m-0">
                    <ScrollArea className="h-full px-4 pb-4">
                        <div className="grid grid-cols-4 gap-2">
                            {filteredShapes.map((shape) => (
                                <button
                                    key={shape.id}
                                    className="aspect-square rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/50 transition-all flex items-center justify-center p-2 group"
                                    onClick={() => handleInsertShape(shape)}
                                    title={shape.name}
                                >
                                    <svg
                                        viewBox="0 0 64 48"
                                        className="w-full h-full transition-transform group-hover:scale-110"
                                        style={{ color: selectedColor }}
                                        dangerouslySetInnerHTML={{ __html: shape.svg }}
                                    />
                                </button>
                            ))}
                        </div>
                        {filteredShapes.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No shapes match your search.
                            </p>
                        )}
                    </ScrollArea>
                </TabsContent>

                {/* Icons Grid */}
                <TabsContent value="icons" className="flex-1 m-0">
                    <ScrollArea className="h-full px-4 pb-4">
                        <div className="grid grid-cols-5 gap-2">
                            {filteredIcons.map(({ name, icon: Icon }) => (
                                <button
                                    key={name}
                                    className="aspect-square rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/50 transition-all flex flex-col items-center justify-center p-1.5 group gap-0.5"
                                    onClick={() => handleInsertIcon({ name })}
                                    title={name}
                                >
                                    <Icon
                                        className="h-5 w-5 transition-transform group-hover:scale-110"
                                    />
                                    <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-none">
                                        {name}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {filteredIcons.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No icons match your search.
                            </p>
                        )}
                    </ScrollArea>
                </TabsContent>

                {/* All Grid */}
                <TabsContent value="all" className="flex-1 m-0">
                    <ScrollArea className="h-full px-4 pb-4">
                        {/* Shapes section */}
                        {filteredShapes.length > 0 && (
                            <>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                    <Shapes className="h-3 w-3" /> Shapes & Connectors
                                </h4>
                                <div className="grid grid-cols-4 gap-2 mb-4">
                                    {filteredShapes.map((shape) => (
                                        <button
                                            key={shape.id}
                                            className="aspect-square rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/50 transition-all flex items-center justify-center p-2 group"
                                            onClick={() => handleInsertShape(shape)}
                                            title={shape.name}
                                        >
                                            <svg
                                                viewBox="0 0 64 48"
                                                className="w-full h-full transition-transform group-hover:scale-110"
                                                style={{ color: selectedColor }}
                                                dangerouslySetInnerHTML={{ __html: shape.svg }}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Icons section */}
                        {filteredIcons.length > 0 && (
                            <>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                    <Star className="h-3 w-3" /> Icons
                                </h4>
                                <div className="grid grid-cols-5 gap-2">
                                    {filteredIcons.map(({ name, icon: Icon }) => (
                                        <button
                                            key={name}
                                            className="aspect-square rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/50 transition-all flex flex-col items-center justify-center p-1.5 group gap-0.5"
                                            onClick={() => handleInsertIcon({ name })}
                                            title={name}
                                        >
                                            <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                                            <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-none">
                                                {name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {filteredShapes.length === 0 && filteredIcons.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No assets match your search.
                            </p>
                        )}
                    </ScrollArea>
                </TabsContent>
            </Tabs>
        </div>
    );
}
