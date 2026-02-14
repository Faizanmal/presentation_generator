'use client';

import React, { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
    Palette,
    Type,
    Image as ImageIcon,
    Paintbrush,
    Save,
    Trash2,
    Plus,
    Upload,
    Eye,
    Copy,
    MoreHorizontal,
    Settings,
    Zap,
    Globe,
    Star,
    Sparkles,
    RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface BrandColor {
    name: string;
    hex: string;
    usage: 'primary' | 'secondary' | 'accent' | 'background' | 'text';
}

interface BrandFont {
    name: string;
    usage: 'heading' | 'body' | 'accent';
    url?: string;
    weights: number[];
}

interface BrandKit {
    id: string;
    name: string;
    isDefault: boolean;
    logo?: {
        light: string;
        dark: string;
    };
    colors: BrandColor[];
    fonts: BrandFont[];
    voice?: {
        tone: 'professional' | 'casual' | 'friendly' | 'formal' | 'creative';
        keywords: string[];
        avoidWords: string[];
    };
    createdAt: string;
    updatedAt: string;
}

interface BrandKitManagerProps {
    onApplyBrandKit?: (kit: BrandKit) => void;
}

const DEFAULT_COLORS: BrandColor[] = [
    { name: 'Primary', hex: '#6366f1', usage: 'primary' },
    { name: 'Secondary', hex: '#8b5cf6', usage: 'secondary' },
    { name: 'Accent', hex: '#f59e0b', usage: 'accent' },
    { name: 'Background', hex: '#ffffff', usage: 'background' },
    { name: 'Text', hex: '#1f2937', usage: 'text' },
];

const FONT_OPTIONS = [
    { name: 'Inter', category: 'Sans-serif' },
    { name: 'Roboto', category: 'Sans-serif' },
    { name: 'Open Sans', category: 'Sans-serif' },
    { name: 'Poppins', category: 'Sans-serif' },
    { name: 'Montserrat', category: 'Sans-serif' },
    { name: 'Playfair Display', category: 'Serif' },
    { name: 'Merriweather', category: 'Serif' },
    { name: 'Lora', category: 'Serif' },
    { name: 'Source Code Pro', category: 'Monospace' },
    { name: 'JetBrains Mono', category: 'Monospace' },
];

const TONE_OPTIONS = [
    { value: 'professional', label: 'Professional', description: 'Business-appropriate and polished' },
    { value: 'casual', label: 'Casual', description: 'Relaxed and approachable' },
    { value: 'friendly', label: 'Friendly', description: 'Warm and personable' },
    { value: 'formal', label: 'Formal', description: 'Traditional and structured' },
    { value: 'creative', label: 'Creative', description: 'Innovative and expressive' },
] as const;

export function BrandKitManager({ onApplyBrandKit }: BrandKitManagerProps) {
    const [activeTab, setActiveTab] = useState<'kits' | 'create' | 'extract'>('kits');
    const [selectedKit, setSelectedKit] = useState<BrandKit | null>(null);
    const [editingKit, setEditingKit] = useState<Partial<BrandKit>>({
        name: 'My Brand Kit',
        colors: [...DEFAULT_COLORS],
        fonts: [
            { name: 'Inter', usage: 'heading', weights: [600, 700] },
            { name: 'Inter', usage: 'body', weights: [400, 500] },
        ],
        voice: {
            tone: 'professional',
            keywords: [],
            avoidWords: [],
        },
    });
    const [showPreview, setShowPreview] = useState(false);

    // Fetch brand kits
    const { data: brandKits = [], refetch } = useQuery<BrandKit[]>({
        queryKey: ['brand-kits'],
        queryFn: async () => {
            const response = await api.get<BrandKit[]>('/brand-kits');
            return response.data;
        },
    });

    // Save brand kit mutation
    const saveMutation = useMutation<BrandKit, Error, Partial<BrandKit>>({
        mutationFn: async (kit: Partial<BrandKit>) => {
            if (kit.id) {
                const response = await api.patch<BrandKit>(`/brand-kits/${kit.id}`, kit);
                return response.data;
            }
            const response = await api.post<BrandKit>('/brand-kits', kit);
            return response.data;
        },
        onSuccess: () => {
            refetch();
            setActiveTab('kits');
        },
    });

    // Delete brand kit mutation
    const deleteMutation = useMutation({
        mutationFn: async (kitId: string) => {
            await api.delete(`/brand-kits/${kitId}`);
        },
        onSuccess: () => refetch(),
    });

    // Extract brand from URL mutation
    const extractMutation = useMutation({
        mutationFn: async (url: string) => {
            const response = await api.post<Partial<BrandKit>>('/brand-kits/extract-from-url', { url });
            return response.data;
        },
        onSuccess: (data) => {
            setEditingKit({ ...editingKit, ...data });
            setActiveTab('create');
        },
    });

    const updateColor = (index: number, updates: Partial<BrandColor>) => {
        const newColors = [...(editingKit.colors || [])];
        newColors[index] = { ...newColors[index], ...updates };
        setEditingKit({ ...editingKit, colors: newColors });
    };

    const addColor = () => {
        const newColors = [...(editingKit.colors || [])];
        newColors.push({ name: 'New Color', hex: '#cccccc', usage: 'accent' });
        setEditingKit({ ...editingKit, colors: newColors });
    };

    const removeColor = (index: number) => {
        const newColors = (editingKit.colors || []).filter((_, i) => i !== index);
        setEditingKit({ ...editingKit, colors: newColors });
    };

    const handleLogoUpload = useCallback((type: 'light' | 'dark') => {
        // In production, this would open a file picker and upload to cloud storage
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                // Placeholder: In production, upload to cloud and get URL
                const url = URL.createObjectURL(file);
                setEditingKit({
                    ...editingKit,
                    logo: {
                        ...(editingKit.logo || { light: '', dark: '' }),
                        [type]: url,
                    },
                });
            }
        };
        input.click();
    }, [editingKit]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Paintbrush className="h-6 w-6 text-violet-500" />
                        Brand Kit
                    </h2>
                    <p className="text-muted-foreground">
                        Manage your brand assets for consistent presentations
                    </p>
                </div>
                <Button onClick={() => setActiveTab('create')} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Brand Kit
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList>
                    <TabsTrigger value="kits">My Brand Kits</TabsTrigger>
                    <TabsTrigger value="create">Create/Edit</TabsTrigger>
                    <TabsTrigger value="extract">Extract from URL</TabsTrigger>
                </TabsList>

                {/* Brand Kits List */}
                <TabsContent value="kits" className="space-y-4">
                    {brandKits.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Palette className="h-12 w-12 text-muted-foreground opacity-50" />
                                <h3 className="mt-4 font-semibold">No Brand Kits Yet</h3>
                                <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
                                    Create a brand kit to maintain consistent colors, fonts, and logos across your presentations.
                                </p>
                                <Button onClick={() => setActiveTab('create')} className="mt-4 gap-2">
                                    <Plus className="h-4 w-4" />
                                    Create Your First Kit
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {brandKits.map((kit) => (
                                <Card
                                    key={kit.id}
                                    className={cn(
                                        'cursor-pointer transition-all hover:shadow-md',
                                        selectedKit?.id === kit.id && 'ring-2 ring-primary'
                                    )}
                                    onClick={() => setSelectedKit(kit)}
                                >
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-lg">{kit.name}</CardTitle>
                                                {kit.isDefault && (
                                                    <Badge variant="secondary" className="gap-1">
                                                        <Star className="h-3 w-3" />
                                                        Default
                                                    </Badge>
                                                )}
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => {
                                                        setEditingKit(kit);
                                                        setActiveTab('create');
                                                    }}>
                                                        <Settings className="mr-2 h-4 w-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <Copy className="mr-2 h-4 w-4" />
                                                        Duplicate
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => deleteMutation.mutate(kit.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {/* Color Preview */}
                                        <div className="flex gap-1 mb-4">
                                            {kit.colors.slice(0, 5).map((color) => (
                                                <TooltipProvider key={`${kit.id}-${color.hex}`}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className="h-8 w-8 rounded-full border"
                                                                style={{ backgroundColor: color.hex }}
                                                            />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{color.name}: {color.hex}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ))}
                                        </div>

                                        {/* Fonts */}
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Type className="h-4 w-4" />
                                            {kit.fonts.map(f => f.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                                        </div>

                                        {/* Actions */}
                                        <div className="mt-4 flex gap-2">
                                            <Button
                                                size="sm"
                                                className="flex-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onApplyBrandKit?.(kit);
                                                }}
                                            >
                                                <Zap className="mr-2 h-4 w-4" />
                                                Apply to Presentation
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Create/Edit Brand Kit */}
                <TabsContent value="create" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {editingKit.id ? 'Edit Brand Kit' : 'Create Brand Kit'}
                            </CardTitle>
                            <CardDescription>
                                Define your brand identity for consistent presentations
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Brand Name */}
                            <div className="space-y-2">
                                <Label htmlFor="kit-name">Brand Kit Name</Label>
                                <Input
                                    id="kit-name"
                                    value={editingKit.name}
                                    onChange={(e) => setEditingKit({ ...editingKit, name: e.target.value })}
                                    placeholder="My Company Brand"
                                />
                            </div>

                            <Separator />

                            {/* Logo Upload */}
                            <div className="space-y-4">
                                <Label className="flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4" />
                                    Logos
                                </Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Light Background</Label>
                                        <div
                                            className="flex h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed bg-white transition-colors hover:border-primary"
                                            onClick={() => handleLogoUpload('light')}
                                        >
                                            {editingKit.logo?.light ? (
                                                <img src={editingKit.logo.light} alt={`${editingKit.name || "Brand"} Light Logo`} className="max-h-20 max-w-full" />
                                            ) : (
                                                <div className="text-center">
                                                    <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                                                    <p className="mt-1 text-xs text-muted-foreground">Upload</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Dark Background</Label>
                                        <div
                                            className="flex h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed bg-gray-900 transition-colors hover:border-primary"
                                            onClick={() => handleLogoUpload('dark')}
                                        >
                                            {editingKit.logo?.dark ? (
                                                <img src={editingKit.logo.dark} alt={`${editingKit.name || "Brand"} Dark Logo`} className="max-h-20 max-w-full" />
                                            ) : (
                                                <div className="text-center">
                                                    <Upload className="mx-auto h-6 w-6 text-gray-500" />
                                                    <p className="mt-1 text-xs text-gray-500">Upload</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Colors */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="flex items-center gap-2">
                                        <Palette className="h-4 w-4" />
                                        Brand Colors
                                    </Label>
                                    <Button variant="outline" size="sm" onClick={addColor}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Color
                                    </Button>
                                </div>
                                <div className="grid gap-3">
                                    {editingKit.colors?.map((color, index) => (
                                        <div key={color.usage === 'accent' ? `accent-${color.hex}-${index}` : color.usage} className="flex items-center gap-3">
                                            <input
                                                type="color"
                                                value={color.hex}
                                                onChange={(e) => updateColor(index, { hex: e.target.value })}
                                                className="h-10 w-12 cursor-pointer rounded border p-1"
                                            />
                                            <Input
                                                value={color.name}
                                                onChange={(e) => updateColor(index, { name: e.target.value })}
                                                placeholder="Color name"
                                                className="flex-1"
                                            />
                                            <Select
                                                value={color.usage}
                                                onValueChange={(v) => updateColor(index, { usage: v as BrandColor['usage'] })}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="primary">Primary</SelectItem>
                                                    <SelectItem value="secondary">Secondary</SelectItem>
                                                    <SelectItem value="accent">Accent</SelectItem>
                                                    <SelectItem value="background">Background</SelectItem>
                                                    <SelectItem value="text">Text</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                value={color.hex}
                                                onChange={(e) => updateColor(index, { hex: e.target.value })}
                                                className="w-24 font-mono text-sm"
                                            />
                                            {editingKit.colors && editingKit.colors.length > 3 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeColor(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            {/* Fonts */}
                            <div className="space-y-4">
                                <Label className="flex items-center gap-2">
                                    <Type className="h-4 w-4" />
                                    Typography
                                </Label>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-sm text-muted-foreground">Heading Font</Label>
                                        <Select
                                            value={editingKit.fonts?.find(f => f.usage === 'heading')?.name}
                                            onValueChange={(v) => {
                                                const fonts = editingKit.fonts?.map(f =>
                                                    f.usage === 'heading' ? { ...f, name: v } : f
                                                );
                                                setEditingKit({ ...editingKit, fonts });
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select font" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {FONT_OPTIONS.map((font) => (
                                                    <SelectItem key={font.name} value={font.name}>
                                                        <span style={{ fontFamily: font.name }}>{font.name}</span>
                                                        <span className="ml-2 text-xs text-muted-foreground">
                                                            {font.category}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm text-muted-foreground">Body Font</Label>
                                        <Select
                                            value={editingKit.fonts?.find(f => f.usage === 'body')?.name}
                                            onValueChange={(v) => {
                                                const fonts = editingKit.fonts?.map(f =>
                                                    f.usage === 'body' ? { ...f, name: v } : f
                                                );
                                                setEditingKit({ ...editingKit, fonts });
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select font" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {FONT_OPTIONS.map((font) => (
                                                    <SelectItem key={font.name} value={font.name}>
                                                        <span style={{ fontFamily: font.name }}>{font.name}</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Brand Voice */}
                            <div className="space-y-4">
                                <Label className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    Brand Voice (for AI)
                                </Label>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm text-muted-foreground">Tone</Label>
                                        <Select
                                            value={editingKit.voice?.tone}
                                            onValueChange={(v) => setEditingKit({
                                                ...editingKit,
                                                voice: {
                                                    tone: v as NonNullable<typeof editingKit.voice>['tone'],
                                                    keywords: editingKit.voice?.keywords || [],
                                                    avoidWords: editingKit.voice?.avoidWords || [],
                                                },
                                            })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TONE_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        <div>
                                                            <p>{option.label}</p>
                                                            <p className="text-xs text-muted-foreground">{option.description}</p>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setShowPreview(true)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Preview
                                </Button>
                                <Button
                                    onClick={() => saveMutation.mutate(editingKit)}
                                    disabled={saveMutation.isPending}
                                >
                                    {saveMutation.isPending ? (
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="mr-2 h-4 w-4" />
                                    )}
                                    Save Brand Kit
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Extract from URL */}
                <TabsContent value="extract" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Globe className="h-5 w-5" />
                                Extract Brand from Website
                            </CardTitle>
                            <CardDescription>
                                Automatically detect colors, fonts, and logos from any website
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="extract-url">Website URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="extract-url"
                                        placeholder="https://example.com"
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={() => {
                                            const input = document.getElementById('extract-url') as HTMLInputElement;
                                            if (input?.value) {
                                                extractMutation.mutate(input.value);
                                            }
                                        }}
                                        disabled={extractMutation.isPending}
                                    >
                                        {extractMutation.isPending ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Sparkles className="mr-2 h-4 w-4" />
                                        )}
                                        Extract
                                    </Button>
                                </div>
                            </div>

                            <div className="rounded-lg border-2 border-dashed p-8 text-center">
                                <Palette className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                                <p className="mt-4 text-sm text-muted-foreground">
                                    Enter a website URL to automatically extract brand colors, fonts, and logos
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Brand Kit Preview</DialogTitle>
                        <DialogDescription>
                            See how your brand will look in presentations
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Preview slide mockup */}
                        <div
                            className="aspect-video rounded-lg p-8"
                            style={{
                                backgroundColor: editingKit.colors?.find(c => c.usage === 'background')?.hex || '#ffffff',
                                color: editingKit.colors?.find(c => c.usage === 'text')?.hex || '#000000',
                            }}
                        >
                            <h1
                                className="text-3xl font-bold"
                                style={{
                                    color: editingKit.colors?.find(c => c.usage === 'primary')?.hex,
                                    fontFamily: editingKit.fonts?.find(f => f.usage === 'heading')?.name,
                                }}
                            >
                                {editingKit.name || 'Your Brand'}
                            </h1>
                            <p
                                className="mt-4 text-lg"
                                style={{
                                    fontFamily: editingKit.fonts?.find(f => f.usage === 'body')?.name,
                                }}
                            >
                                This is how your presentations will look with this brand kit applied.
                            </p>
                            <div className="mt-6 flex gap-2">
                                <div
                                    className="rounded-lg px-4 py-2 text-white"
                                    style={{
                                        backgroundColor: editingKit.colors?.find(c => c.usage === 'primary')?.hex,
                                    }}
                                >
                                    Primary Button
                                </div>
                                <div
                                    className="rounded-lg border px-4 py-2"
                                    style={{
                                        borderColor: editingKit.colors?.find(c => c.usage === 'secondary')?.hex,
                                        color: editingKit.colors?.find(c => c.usage === 'secondary')?.hex,
                                    }}
                                >
                                    Secondary Button
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
