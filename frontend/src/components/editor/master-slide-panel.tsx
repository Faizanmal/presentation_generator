'use client';

import { useState } from 'react';
import {
    Lock,
    Unlock,
    Layout,
    Plus,
    Trash2,
    Check,
    Copy,
    Shield,
    Layers,
    GripVertical,
    Type,
    Image as ImageIcon,
    BarChart3,
    List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { BlockType } from '@/types';

// =========================================================================
// Master Slide Template System
// Allows Enterprise teams to create locked template layouts with
// placeholder regions (Title, Subtitle, Body, Image, Chart).
// Employees can only edit content within the defined regions.
// =========================================================================

export interface MasterSlideRegion {
    id: string;
    name: string;
    allowedBlockTypes: BlockType[];
    placeholder: string;
    locked: boolean; // Prevents repositioning/resizing
    // Position bounds (in % of slide canvas)
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface MasterSlideTemplate {
    id: string;
    name: string;
    description: string;
    category: 'title' | 'content' | 'two-column' | 'image-focus' | 'chart' | 'section-break' | 'blank';
    regions: MasterSlideRegion[];
    isLocked: boolean; // Entire template locked for non-admins
    thumbnail?: string;
    createdBy?: string;
    createdAt?: string;
}

// =========================================================================
// Prebuilt Enterprise Master Templates
// =========================================================================

const MASTER_TEMPLATES: MasterSlideTemplate[] = [
    {
        id: 'master-title',
        name: 'Title Slide',
        description: 'Main title with subtitle. Locked branding layout.',
        category: 'title',
        isLocked: true,
        regions: [
            {
                id: 'r-title',
                name: 'Title',
                allowedBlockTypes: ['HEADING'],
                placeholder: 'Presentation Title',
                locked: true,
                x: 10,
                y: 30,
                width: 80,
                height: 20,
            },
            {
                id: 'r-subtitle',
                name: 'Subtitle',
                allowedBlockTypes: ['SUBHEADING', 'PARAGRAPH'],
                placeholder: 'Subtitle or tagline',
                locked: true,
                x: 20,
                y: 55,
                width: 60,
                height: 10,
            },
        ],
    },
    {
        id: 'master-two-col',
        name: 'Two Column',
        description: 'Left column for text, right column for image or chart.',
        category: 'two-column',
        isLocked: true,
        regions: [
            {
                id: 'r-heading',
                name: 'Heading',
                allowedBlockTypes: ['HEADING', 'SUBHEADING'],
                placeholder: 'Section Heading',
                locked: true,
                x: 5,
                y: 5,
                width: 90,
                height: 12,
            },
            {
                id: 'r-left',
                name: 'Text Content',
                allowedBlockTypes: ['PARAGRAPH', 'BULLET_LIST', 'NUMBERED_LIST'],
                placeholder: 'Key points and supporting text',
                locked: true,
                x: 5,
                y: 20,
                width: 43,
                height: 70,
            },
            {
                id: 'r-right',
                name: 'Visual Content',
                allowedBlockTypes: ['IMAGE', 'CHART', 'EMBED', 'OEMBED'],
                placeholder: 'Image, chart, or embed',
                locked: true,
                x: 52,
                y: 20,
                width: 43,
                height: 70,
            },
        ],
    },
    {
        id: 'master-content',
        name: 'Content Slide',
        description: 'Standard content layout with heading and body area.',
        category: 'content',
        isLocked: true,
        regions: [
            {
                id: 'r-heading',
                name: 'Heading',
                allowedBlockTypes: ['HEADING'],
                placeholder: 'Slide Title',
                locked: true,
                x: 5,
                y: 5,
                width: 90,
                height: 12,
            },
            {
                id: 'r-body',
                name: 'Body',
                allowedBlockTypes: ['PARAGRAPH', 'BULLET_LIST', 'NUMBERED_LIST', 'IMAGE', 'CODE', 'QUOTE'],
                placeholder: 'Slide content goes here',
                locked: false,
                x: 5,
                y: 20,
                width: 90,
                height: 72,
            },
        ],
    },
    {
        id: 'master-image-focus',
        name: 'Image Focus',
        description: 'Large hero image with caption overlay.',
        category: 'image-focus',
        isLocked: true,
        regions: [
            {
                id: 'r-image',
                name: 'Hero Image',
                allowedBlockTypes: ['IMAGE'],
                placeholder: 'Full-size image',
                locked: true,
                x: 0,
                y: 0,
                width: 100,
                height: 75,
            },
            {
                id: 'r-caption',
                name: 'Caption',
                allowedBlockTypes: ['HEADING', 'SUBHEADING', 'PARAGRAPH'],
                placeholder: 'Image caption or description',
                locked: true,
                x: 5,
                y: 78,
                width: 90,
                height: 18,
            },
        ],
    },
    {
        id: 'master-chart',
        name: 'Data & Analytics',
        description: 'Chart-focused layout with data callouts.',
        category: 'chart',
        isLocked: true,
        regions: [
            {
                id: 'r-title',
                name: 'Title',
                allowedBlockTypes: ['HEADING'],
                placeholder: 'Data Insight Title',
                locked: true,
                x: 5,
                y: 3,
                width: 90,
                height: 10,
            },
            {
                id: 'r-chart',
                name: 'Chart Area',
                allowedBlockTypes: ['CHART', 'EMBED', 'OEMBED'],
                placeholder: 'Insert chart or visualization',
                locked: true,
                x: 5,
                y: 15,
                width: 60,
                height: 75,
            },
            {
                id: 'r-callouts',
                name: 'Key Stats',
                allowedBlockTypes: ['STATS_GRID', 'BULLET_LIST', 'PARAGRAPH'],
                placeholder: 'Key data callouts',
                locked: true,
                x: 68,
                y: 15,
                width: 27,
                height: 75,
            },
        ],
    },
    {
        id: 'master-section-break',
        name: 'Section Break',
        description: 'Full-width section divider with title.',
        category: 'section-break',
        isLocked: true,
        regions: [
            {
                id: 'r-section-title',
                name: 'Section Title',
                allowedBlockTypes: ['HEADING'],
                placeholder: 'Section Title',
                locked: true,
                x: 10,
                y: 35,
                width: 80,
                height: 20,
            },
            {
                id: 'r-section-number',
                name: 'Section Number',
                allowedBlockTypes: ['SUBHEADING'],
                placeholder: '01',
                locked: true,
                x: 10,
                y: 60,
                width: 80,
                height: 10,
            },
        ],
    },
];

// =========================================================================
// Preview for region block type icons
// =========================================================================

function blockTypeIcon(type: BlockType) {
    switch (type) {
        case 'HEADING':
        case 'SUBHEADING':
        case 'PARAGRAPH':
            return <Type className="h-3.5 w-3.5" />;
        case 'IMAGE':
            return <ImageIcon className="h-3.5 w-3.5" />;
        case 'CHART':
            return <BarChart3 className="h-3.5 w-3.5" />;
        case 'BULLET_LIST':
        case 'NUMBERED_LIST':
            return <List className="h-3.5 w-3.5" />;
        default:
            return <Layers className="h-3.5 w-3.5" />;
    }
}

// =========================================================================
// MasterSlidePanel — panel UI for browsing/applying master templates
// =========================================================================

interface MasterSlidePanelProps {
    onApplyTemplate: (template: MasterSlideTemplate) => void;
    isEnterprise?: boolean;
}

export function MasterSlidePanel({
    onApplyTemplate,
    isEnterprise = false,
}: MasterSlidePanelProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [customTemplates, setCustomTemplates] = useState<MasterSlideTemplate[]>([]);
    const [showCreator, setShowCreator] = useState(false);

    const allTemplates = [...MASTER_TEMPLATES, ...customTemplates];
    const filtered =
        selectedCategory === 'all'
            ? allTemplates
            : allTemplates.filter((t) => t.category === selectedCategory);

    const categories = [
        { value: 'all', label: 'All' },
        { value: 'title', label: 'Title' },
        { value: 'content', label: 'Content' },
        { value: 'two-column', label: 'Two Column' },
        { value: 'image-focus', label: 'Image Focus' },
        { value: 'chart', label: 'Data' },
        { value: 'section-break', label: 'Section' },
    ];

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-indigo-500" />
                    Master Slides
                </h2>
                <p className="text-sm text-slate-500">
                    Apply predefined layouts with locked regions
                </p>

                {/* Category filter */}
                <div className="flex gap-1 flex-wrap">
                    {categories.map((cat) => (
                        <button
                            key={cat.value}
                            onClick={() => setSelectedCategory(cat.value)}
                            className={cn(
                                'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                                selectedCategory === cat.value
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400',
                            )}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                    {filtered.map((template) => (
                        <Card
                            key={template.id}
                            className="group cursor-pointer hover:ring-2 hover:ring-indigo-500/30 transition-all"
                            onClick={() => {
                                onApplyTemplate(template);
                                toast.success(`Applied "${template.name}" master layout`);
                            }}
                        >
                            <CardHeader className="p-3 pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm flex items-center gap-1.5">
                                        <Layout className="h-4 w-4 text-indigo-500" />
                                        {template.name}
                                    </CardTitle>
                                    <div className="flex items-center gap-1">
                                        {template.isLocked && (
                                            <Badge variant="outline" className="text-[10px] gap-1">
                                                <Lock className="h-2.5 w-2.5" />
                                                Locked
                                            </Badge>
                                        )}
                                        <Badge variant="secondary" className="text-[10px]">
                                            {template.category}
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-3 pt-0">
                                {/* Mini preview of regions */}
                                <div className="relative w-full aspect-video bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 overflow-hidden mb-2">
                                    {template.regions.map((region) => (
                                        <div
                                            key={region.id}
                                            className="absolute border border-dashed flex items-center justify-center transition-all"
                                            style={{
                                                left: `${region.x}%`,
                                                top: `${region.y}%`,
                                                width: `${region.width}%`,
                                                height: `${region.height}%`,
                                                borderColor: region.locked
                                                    ? 'rgb(99 102 241 / 0.5)'
                                                    : 'rgb(156 163 175 / 0.5)',
                                                backgroundColor: region.locked
                                                    ? 'rgb(99 102 241 / 0.05)'
                                                    : 'rgb(156 163 175 / 0.05)',
                                            }}
                                        >
                                            <span className="text-[8px] text-slate-400 text-center px-1 truncate">
                                                {region.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <p className="text-xs text-slate-500 line-clamp-2">
                                    {template.description}
                                </p>

                                {/* Region list */}
                                <div className="mt-2 space-y-1">
                                    {template.regions.map((region) => (
                                        <div
                                            key={region.id}
                                            className="flex items-center gap-1.5 text-[10px] text-slate-500"
                                        >
                                            {region.locked ? (
                                                <Lock className="h-2.5 w-2.5 text-indigo-400" />
                                            ) : (
                                                <Unlock className="h-2.5 w-2.5 text-slate-400" />
                                            )}
                                            <span className="font-medium">{region.name}</span>
                                            <span className="text-slate-400">—</span>
                                            <div className="flex gap-0.5">
                                                {region.allowedBlockTypes.slice(0, 3).map((bt) => (
                                                    <span key={bt} className="opacity-60">
                                                        {blockTypeIcon(bt)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Create custom template */}
                {isEnterprise && (
                    <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={() => setShowCreator(true)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Custom Template
                    </Button>
                )}
            </ScrollArea>

            {/* Template Creator Dialog */}
            <MasterTemplateCreator
                open={showCreator}
                onOpenChange={setShowCreator}
                onSave={(template) => {
                    setCustomTemplates((prev) => [...prev, template]);
                    toast.success(`Created "${template.name}" template`);
                }}
            />
        </div>
    );
}

// =========================================================================
// Template Creator Dialog — for Enterprise admins to create custom masters
// =========================================================================

interface MasterTemplateCreatorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (template: MasterSlideTemplate) => void;
}

function MasterTemplateCreator({
    open,
    onOpenChange,
    onSave,
}: MasterTemplateCreatorProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<MasterSlideTemplate['category']>('content');
    const [regions, setRegions] = useState<MasterSlideRegion[]>([]);

    const addRegion = () => {
        const id = `r-custom-${Date.now()}`;
        setRegions((prev) => [
            ...prev,
            {
                id,
                name: `Region ${prev.length + 1}`,
                allowedBlockTypes: ['PARAGRAPH', 'HEADING'],
                placeholder: 'Edit content here',
                locked: true,
                x: 10,
                y: 10 + prev.length * 25,
                width: 80,
                height: 20,
            },
        ]);
    };

    const updateRegion = (id: string, updates: Partial<MasterSlideRegion>) => {
        setRegions((prev) =>
            prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        );
    };

    const removeRegion = (id: string) => {
        setRegions((prev) => prev.filter((r) => r.id !== id));
    };

    const handleSave = () => {
        if (!name.trim() || regions.length === 0) {
            toast.error('Name and at least one region required');
            return;
        }
        const template: MasterSlideTemplate = {
            id: `custom-${Date.now()}`,
            name: name.trim(),
            description: description.trim(),
            category,
            regions,
            isLocked: true,
            createdAt: new Date().toISOString(),
        };
        onSave(template);
        setName('');
        setDescription('');
        setCategory('content');
        setRegions([]);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-indigo-500" />
                        Create Master Template
                    </DialogTitle>
                    <DialogDescription>
                        Define locked placeholder regions to enforce brand-consistent layouts
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Template Name</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Quarterly Results"
                            />
                        </div>
                        <div>
                            <Label>Category</Label>
                            <Select value={category} onValueChange={(v) => setCategory(v as MasterSlideTemplate['category'])}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="title">Title</SelectItem>
                                    <SelectItem value="content">Content</SelectItem>
                                    <SelectItem value="two-column">Two Column</SelectItem>
                                    <SelectItem value="image-focus">Image Focus</SelectItem>
                                    <SelectItem value="chart">Chart/Data</SelectItem>
                                    <SelectItem value="section-break">Section Break</SelectItem>
                                    <SelectItem value="blank">Blank</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Description</Label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this layout"
                        />
                    </div>

                    {/* Template preview */}
                    <div>
                        <Label>Layout Preview</Label>
                        <div className="relative w-full aspect-video bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                            {regions.map((region) => (
                                <div
                                    key={region.id}
                                    className="absolute border-2 border-dashed border-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/20 rounded flex items-center justify-center"
                                    style={{
                                        left: `${region.x}%`,
                                        top: `${region.y}%`,
                                        width: `${region.width}%`,
                                        height: `${region.height}%`,
                                    }}
                                >
                                    <span className="text-xs text-indigo-600 dark:text-indigo-300 font-medium text-center px-1">
                                        {region.name}
                                    </span>
                                </div>
                            ))}
                            {regions.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                                    Add regions to define your layout
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Region editor */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label>Placeholder Regions</Label>
                            <Button variant="outline" size="sm" onClick={addRegion}>
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Add Region
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {regions.map((region) => (
                                <Card key={region.id} className="p-3">
                                    <div className="flex items-start gap-2">
                                        <GripVertical className="h-4 w-4 text-slate-300 mt-2 shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <div className="flex gap-2">
                                                <Input
                                                    value={region.name}
                                                    onChange={(e) =>
                                                        updateRegion(region.id, { name: e.target.value })
                                                    }
                                                    placeholder="Region name"
                                                    className="text-sm h-8"
                                                />
                                                <Select
                                                    value={region.allowedBlockTypes[0]}
                                                    onValueChange={(v) =>
                                                        updateRegion(region.id, { allowedBlockTypes: [v as BlockType] })
                                                    }
                                                >
                                                    <SelectTrigger className="w-40 h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="HEADING">Heading</SelectItem>
                                                        <SelectItem value="SUBHEADING">Subheading</SelectItem>
                                                        <SelectItem value="PARAGRAPH">Paragraph</SelectItem>
                                                        <SelectItem value="BULLET_LIST">Bullet List</SelectItem>
                                                        <SelectItem value="IMAGE">Image</SelectItem>
                                                        <SelectItem value="CHART">Chart</SelectItem>
                                                        <SelectItem value="EMBED">Embed</SelectItem>
                                                        <SelectItem value="OEMBED">OEmbed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                <div>
                                                    <Label className="text-[10px]">X %</Label>
                                                    <Input
                                                        type="number"
                                                        value={region.x}
                                                        onChange={(e) =>
                                                            updateRegion(region.id, { x: Number(e.target.value) })
                                                        }
                                                        className="h-7 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[10px]">Y %</Label>
                                                    <Input
                                                        type="number"
                                                        value={region.y}
                                                        onChange={(e) =>
                                                            updateRegion(region.id, { y: Number(e.target.value) })
                                                        }
                                                        className="h-7 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[10px]">W %</Label>
                                                    <Input
                                                        type="number"
                                                        value={region.width}
                                                        onChange={(e) =>
                                                            updateRegion(region.id, { width: Number(e.target.value) })
                                                        }
                                                        className="h-7 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[10px]">H %</Label>
                                                    <Input
                                                        type="number"
                                                        value={region.height}
                                                        onChange={(e) =>
                                                            updateRegion(region.id, { height: Number(e.target.value) })
                                                        }
                                                        className="h-7 text-xs"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <button
                                                    onClick={() =>
                                                        updateRegion(region.id, { locked: !region.locked })
                                                    }
                                                    className={cn(
                                                        'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all',
                                                        region.locked
                                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                                                            : 'bg-slate-50 border-slate-200 text-slate-500',
                                                    )}
                                                >
                                                    {region.locked ? (
                                                        <>
                                                            <Lock className="h-2.5 w-2.5" /> Position Locked
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Unlock className="h-2.5 w-2.5" /> Unlocked
                                                        </>
                                                    )}
                                                </button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeRegion(region.id)}
                                                    className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave}>
                            <Check className="h-4 w-4 mr-2" />
                            Create Template
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Export the templates list for use elsewhere
export { MASTER_TEMPLATES };

// Suppress unused import warnings
void Copy;
