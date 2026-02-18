'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    Link,
    Globe,
    FileText,
    Youtube,
    Upload,
    Loader2,
    Check,
    AlertCircle,
    Sparkles,
    Layout,
    Image as ImageIcon,
    RefreshCw,
    ShieldCheck,
} from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { api } from '@/lib/api';

interface ImportedSlide {
    heading: string;
    blocks: Array<{
        type: string;
        content: string;
    }>;
    speakerNotes?: string;
}

interface ImportResult {
    title: string;
    summary: string;
    slides: ImportedSlide[];
    sourceUrl: string;
    extractedImages?: string[];
    metadata?: {
        author?: string;
        publishedDate?: string;
        keywords?: string[];
    };
}

interface URLImporterProps {
    onImport: (result: ImportResult) => void;
    onClose?: () => void;
}

const IMPORT_SOURCES = [
    { id: 'url', label: 'Website URL', icon: Globe, description: 'Import from any webpage' },
    { id: 'youtube', label: 'YouTube', icon: Youtube, description: 'Import from video' },
    { id: 'document', label: 'Document', icon: FileText, description: 'PDF, Word, or text' },
] as const;

const STYLE_OPTIONS = [
    { id: 'detailed', label: 'Detailed', description: 'Comprehensive slides with full explanations' },
    { id: 'summary', label: 'Summary', description: 'Concise overview of key points' },
    { id: 'bullet-points', label: 'Bullet Points', description: 'Quick-scan format with bullets' },
] as const;

const SLIDE_COUNT_OPTIONS = [4, 6, 8, 10, 12, 15];

const ALLOWED_DOMAINS_TIP = "Allowed: wikipedia.org, creativecommons.org, gov/edu sites, unsplash.com";

export function URLImporter({ onImport, onClose }: URLImporterProps) {
    const [activeTab, setActiveTab] = useState<'url' | 'youtube' | 'document'>('url');
    const [url, setUrl] = useState('');
    const [style, setStyle] = useState<'detailed' | 'summary' | 'bullet-points'>('detailed');
    const [slideCount, setSlideCount] = useState(8);
    const [includeImages] = useState(true);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Import mutation
    const importMutation = useMutation({
        mutationFn: async () => {
            setError(null);
            const endpoint = activeTab === 'youtube' ? '/ai/import-youtube' : '/ai/import-url';
            try {
                const response = await api.post(endpoint, {
                    url,
                    targetSlides: slideCount,
                    style,
                    includeImages,
                });
                return response.data as ImportResult;
            } catch (err: any) {
                const msg = err.response?.data?.message || err.message || 'Import failed';
                console.error("Import error:", msg); // Log explicitly
                throw new Error(msg);
            }
        },
        onSuccess: (data) => {
            setImportResult(data);
            setShowPreview(true);
        },
        onError: (err) => {
            setError(err.message);
        }
    });

    const handleImport = () => {
        if (!url.trim()) { return; }
        importMutation.mutate();
    };

    const handleConfirmImport = () => {
        if (importResult) {
            onImport(importResult);
            onClose?.();
        }
    };

    const isValidUrl = (urlString: string) => {
        try {
            new URL(urlString);
            return true;
        } catch {
            return false;
        }
    };

    const isYouTubeUrl = (urlString: string) => {
        return urlString.includes('youtube.com') || urlString.includes('youtu.be');
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                    <Link className="h-6 w-6 text-white" />
                </div>
                <h2 className="mt-4 text-2xl font-bold">Import from URL</h2>
                <p className="mt-1 text-muted-foreground">
                    Transform permissible web content into a presentation
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="grid w-full grid-cols-3">
                    {IMPORT_SOURCES.map((source) => (
                        <TabsTrigger key={source.id} value={source.id} className="gap-2">
                            <source.icon className="h-4 w-4" />
                            {source.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* Website URL Tab */}
                <TabsContent value="url" className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="url-input">Website URL</Label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="url-input"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://wikipedia.org/wiki/..."
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
                            <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5" />
                            <p>{ALLOWED_DOMAINS_TIP}</p>
                        </div>

                        {url && !isValidUrl(url) && (
                            <p className="text-xs text-destructive">Please enter a valid URL</p>
                        )}
                        {url && isYouTubeUrl(url) && (
                            <p className="text-xs text-blue-600">
                                Detected YouTube URL - switch to YouTube tab for better results
                            </p>
                        )}
                    </div>
                </TabsContent>

                {/* YouTube Tab */}
                <TabsContent value="youtube" className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="youtube-input">YouTube Video URL</Label>
                        <div className="relative">
                            <Youtube className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500" />
                            <Input
                                id="youtube-input"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://youtube.com/watch?v=..."
                                className="pl-10"
                            />
                        </div>
                    </div>
                    <Card className="border-dashed">
                        <CardContent className="flex items-center gap-3 p-4">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                            <p className="text-sm text-muted-foreground">
                                YouTube import uses video metadata and AI to generate slides.
                                For best results, choose videos with clear topic structure.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Document Tab */}
                <TabsContent value="document" className="space-y-4">
                    <div className="rounded-lg border-2 border-dashed p-8 text-center">
                        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">
                            Drag and drop a document, or
                        </p>
                        <Button variant="outline" size="sm" className="mt-2">
                            Browse Files
                        </Button>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Supports PDF, DOCX, TXT, MD (Max 10MB)
                        </p>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Error Message */}
            {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            {/* Import Options */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Import Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Slide Count */}
                    <div className="space-y-2">
                        <Label>Number of Slides</Label>
                        <Select
                            value={slideCount.toString()}
                            onValueChange={(v) => setSlideCount(parseInt(v))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SLIDE_COUNT_OPTIONS.map((count) => (
                                    <SelectItem key={count} value={count.toString()}>
                                        {count} slides
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Style */}
                    <div className="space-y-2">
                        <Label>Presentation Style</Label>
                        <RadioGroup
                            value={style}
                            onValueChange={(v) => setStyle(v as typeof style)}
                            className="grid gap-2"
                        >
                            {STYLE_OPTIONS.map((option) => (
                                <Label
                                    key={option.id}
                                    htmlFor={option.id}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                                        style === option.id && 'border-primary bg-primary/5'
                                    )}
                                >
                                    <RadioGroupItem value={option.id} id={option.id} />
                                    <div>
                                        <p className="font-medium">{option.label}</p>
                                        <p className="text-xs text-muted-foreground">{option.description}</p>
                                    </div>
                                </Label>
                            ))}
                        </RadioGroup>
                    </div>

                    <div className="text-xs text-muted-foreground pt-2 border-t">
                        By importing content, you confirm that you have the rights to use the content/media from the source URL.
                    </div>
                </CardContent>
            </Card>

            {/* Action Button */}
            <Button
                onClick={handleImport}
                disabled={!url.trim() || !isValidUrl(url) || importMutation.isPending}
                className="w-full gap-2"
                size="lg"
            >
                {importMutation.isPending ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing...
                    </>
                ) : (
                    <>
                        <Sparkles className="h-4 w-4" />
                        Generate Presentation
                    </>
                )}
            </Button>

            {/* Progress Indicator */}
            {importMutation.isPending && (
                <Card>
                    <CardContent className="p-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>Processing content...</span>
                                <Badge variant="outline">AI Working</Badge>
                            </div>
                            <Progress value={undefined} className="h-2" />
                            <p className="text-xs text-muted-foreground">
                                Fetching content, analyzing structure, generating slides...
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            Import Preview
                        </DialogTitle>
                        <DialogDescription>
                            Review the generated presentation before importing
                        </DialogDescription>
                    </DialogHeader>

                    {importResult && (
                        <div className="space-y-4">
                            {/* Metadata */}
                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold">{importResult.title}</h3>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {importResult.summary}
                                            </p>
                                            {importResult.metadata?.keywords && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {importResult.metadata.keywords.map((kw) => (
                                                        <Badge key={kw} variant="secondary" className="text-xs">
                                                            {kw}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <Badge variant="outline">
                                            {importResult.slides.length} slides
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Slides Preview */}
                            <ScrollArea className="h-[400px]">
                                <div className="grid grid-cols-2 gap-4 p-1">
                                    {importResult.slides.map((slide, index) => (
                                        <Card key={slide.heading} className="overflow-hidden">
                                            <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-4">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Layout className="h-3 w-3" />
                                                    Slide {index + 1}
                                                </div>
                                                <h4 className="mt-2 font-semibold line-clamp-2">
                                                    {slide.heading}
                                                </h4>
                                                <div className="mt-2 space-y-1">
                                                    {slide.blocks.slice(0, 3).map((block, bi) => (
                                                        <p
                                                            // eslint-disable-next-line react/no-array-index-key
                                                            key={`${bi}-${block.type}`}
                                                            className="text-xs text-muted-foreground line-clamp-1"
                                                        >
                                                            • {block.content}
                                                        </p>
                                                    ))}
                                                    {slide.blocks.length > 3 && (
                                                        <p className="text-xs text-muted-foreground">
                                                            +{slide.blocks.length - 3} more blocks
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </ScrollArea>

                            {/* Extracted Images */}
                            {importResult.extractedImages && importResult.extractedImages.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4" />
                                        Extracted Images ({importResult.extractedImages.length})
                                    </Label>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {importResult.extractedImages.slice(0, 6).map((img, i) => (
                                            <img
                                                key={img}
                                                src={img}
                                                alt={`Extracted visual ${i + 1} from source`}
                                                className="h-16 w-24 rounded object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowPreview(false)}>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Regenerate
                                </Button>
                                <Button onClick={handleConfirmImport} className="gap-2">
                                    <Check className="h-4 w-4" />
                                    Import Presentation
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
