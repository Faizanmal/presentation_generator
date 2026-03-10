'use client';

import { useState, useCallback, useRef } from 'react';
import {
    Upload,
    FileText,
    FileSpreadsheet,
    File,
    Loader2,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    X,
    Settings2,
    Wand2,
    Users,
    Presentation,
    Minus,
    BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ========================================
// TYPES
// ========================================

interface IngestionResult {
    success: boolean;
    originalFilename: string;
    mimeType: string;
    extractedTextLength: number;
    chunkCount: number;
    slides: Array<{
        title: string;
        layout: string;
        blocks: Array<{
            blockType: string;
            content: Record<string, unknown>;
            order: number;
        }>;
    }>;
    summary: string;
    suggestedTitle: string;
}

interface DocumentUploadPanelProps {
    onSlidesGenerated?: (result: IngestionResult) => void;
    className?: string;
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

// Supported file types
const SUPPORTED_TYPES = [
    { mime: 'application/pdf', ext: '.pdf', label: 'PDF', icon: FileText },
    {
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ext: '.docx',
        label: 'Word',
        icon: FileSpreadsheet,
    },
    { mime: 'text/plain', ext: '.txt', label: 'Text', icon: File },
    { mime: 'text/markdown', ext: '.md', label: 'Markdown', icon: File },
    { mime: 'text/html', ext: '.html', label: 'HTML', icon: File },
];

const ACCEPT_STRING = SUPPORTED_TYPES.map((t) => t.ext).join(',');

// ========================================
// COMPONENT
// ========================================

export function DocumentUploadPanel({
    onSlidesGenerated,
    className,
}: DocumentUploadPanelProps) {
    const [status, setStatus] = useState<UploadStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [result, setResult] = useState<IngestionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Options
    const [slideCount, setSlideCount] = useState(10);
    const [style, setStyle] = useState<'executive' | 'detailed' | 'visual' | 'minimal'>('executive');
    const [audienceType, setAudienceType] = useState<'executives' | 'technical' | 'sales' | 'general'>('general');
    const [includeDataSlides, setIncludeDataSlides] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            selectFile(file);
        }
    }, []);

    const selectFile = (file: File) => {
        const isSupported = SUPPORTED_TYPES.some(
            (t) => t.mime === file.type || file.name.endsWith(t.ext),
        );

        if (!isSupported) {
            toast.error('Unsupported file type. Please upload a PDF, DOCX, TXT, Markdown, or HTML file.');
            return;
        }

        if (file.size > 25 * 1024 * 1024) {
            toast.error('File too large. Maximum size is 25MB.');
            return;
        }

        setSelectedFile(file);
        setError(null);
        setResult(null);
        setStatus('idle');
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setStatus('uploading');
        setProgress(10);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('slideCount', String(slideCount));
            formData.append('style', style);
            formData.append('audienceType', audienceType);
            formData.append('includeDataSlides', String(includeDataSlides));

            setProgress(30);
            setStatus('processing');

            const response = await api.documentIngestion.upload(formData);

            setProgress(100);
            setStatus('done');
            setResult(response);
            toast.success(
                `Generated ${response.slides.length} slides from "${response.originalFilename}"`,
            );
            onSlidesGenerated?.(response);
        } catch (err: unknown) {
            setStatus('error');
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Failed to process document. Please try again.';
            setError(msg);
            toast.error(msg);
        }
    };

    const resetPanel = () => {
        setSelectedFile(null);
        setResult(null);
        setError(null);
        setStatus('idle');
        setProgress(0);
    };

    const getFileIcon = (file: File) => {
        const type = SUPPORTED_TYPES.find(
            (t) => t.mime === file.type || file.name.endsWith(t.ext),
        );
        return type?.icon || File;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className={cn('flex flex-col gap-4', className)}>
            {/* Drop Zone */}
            {!selectedFile && (
                <div
                    className={cn(
                        'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
                        isDragging
                            ? 'border-primary bg-primary/5 scale-[1.02]'
                            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPT_STRING}
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) selectFile(file);
                        }}
                    />
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-3 rounded-full bg-primary/10">
                            <Upload className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <p className="font-semibold text-sm">
                                Drop your document here or click to browse
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                PDF, DOCX, TXT, Markdown, HTML — up to 25MB
                            </p>
                        </div>
                        <div className="flex gap-2 mt-2">
                            {SUPPORTED_TYPES.map((type) => (
                                <Badge key={type.ext} variant="outline" className="text-xs">
                                    {type.ext}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Selected File */}
            {selectedFile && status !== 'done' && (
                <div className="border rounded-xl p-4 space-y-4">
                    {/* File info */}
                    <div className="flex items-center gap-3">
                        {(() => {
                            const FileIcon = getFileIcon(selectedFile);
                            return (
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <FileIcon className="h-5 w-5 text-primary" />
                                </div>
                            );
                        })()}
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                                {selectedFile.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {formatFileSize(selectedFile.size)}
                            </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetPanel}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Progress */}
                    {(status === 'uploading' || status === 'processing') && (
                        <div className="space-y-2">
                            <Progress value={progress} className="h-2" />
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {status === 'uploading'
                                    ? 'Uploading document...'
                                    : 'AI is analyzing and generating slides...'}
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {status === 'error' && error && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Settings Toggle */}
                    <div className="flex items-center justify-between">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setShowSettings(!showSettings)}
                        >
                            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                            Generation Settings
                        </Button>
                    </div>

                    {/* Settings Panel */}
                    {showSettings && (
                        <div className="space-y-4 p-3 rounded-lg bg-muted/50 border">
                            {/* Slide Count */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Number of Slides</Label>
                                    <span className="text-xs font-medium">{slideCount}</span>
                                </div>
                                <Slider
                                    value={[slideCount]}
                                    onValueChange={([v]) => setSlideCount(v)}
                                    min={3}
                                    max={30}
                                    step={1}
                                    className="w-full"
                                />
                            </div>

                            {/* Style */}
                            <div className="space-y-1">
                                <Label className="text-xs">Presentation Style</Label>
                                <Select value={style} onValueChange={(v) => setStyle(v as typeof style)}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="executive">
                                            <span className="flex items-center gap-1.5">
                                                <Presentation className="h-3 w-3" /> Executive Summary
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="detailed">
                                            <span className="flex items-center gap-1.5">
                                                <FileText className="h-3 w-3" /> Detailed
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="visual">
                                            <span className="flex items-center gap-1.5">
                                                <Sparkles className="h-3 w-3" /> Visual-First
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="minimal">
                                            <span className="flex items-center gap-1.5">
                                                <Minus className="h-3 w-3" /> Minimal
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Audience */}
                            <div className="space-y-1">
                                <Label className="text-xs">Target Audience</Label>
                                <Select
                                    value={audienceType}
                                    onValueChange={(v) => setAudienceType(v as typeof audienceType)}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">
                                            <span className="flex items-center gap-1.5">
                                                <Users className="h-3 w-3" /> General Audience
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="executives">
                                            <span className="flex items-center gap-1.5">
                                                <Presentation className="h-3 w-3" /> Executives / C-Suite
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="technical">
                                            <span className="flex items-center gap-1.5">
                                                <Settings2 className="h-3 w-3" /> Technical
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="sales">
                                            <span className="flex items-center gap-1.5">
                                                <BarChart3 className="h-3 w-3" /> Sales / Investors
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Data Slides */}
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Include Data/Chart Slides</Label>
                                <Switch
                                    checked={includeDataSlides}
                                    onCheckedChange={setIncludeDataSlides}
                                />
                            </div>
                        </div>
                    )}

                    {/* Generate Button */}
                    <Button
                        className="w-full gap-2"
                        size="lg"
                        onClick={handleUpload}
                        disabled={status === 'uploading' || status === 'processing'}
                    >
                        {status === 'uploading' || status === 'processing' ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating slides...
                            </>
                        ) : (
                            <>
                                <Wand2 className="h-4 w-4" />
                                Generate Presentation
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* Success Result */}
            {status === 'done' && result && (
                <div className="border rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium text-sm">Slides Generated!</span>
                    </div>

                    <div className="space-y-2">
                        <p className="font-semibold">{result.suggestedTitle}</p>
                        <p className="text-xs text-muted-foreground">{result.summary}</p>
                    </div>

                    <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{result.slides.length} slides</span>
                        <span>•</span>
                        <span>{result.extractedTextLength.toLocaleString()} chars extracted</span>
                        <span>•</span>
                        <span>{result.chunkCount} sections analyzed</span>
                    </div>

                    {/* Slide preview list */}
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {result.slides.map((slide, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 text-sm"
                            >
                                <span className="text-xs text-muted-foreground font-mono w-5">
                                    {i + 1}
                                </span>
                                <span className="truncate">{slide.title}</span>
                                <Badge variant="outline" className="text-[10px] ml-auto">
                                    {slide.layout}
                                </Badge>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={resetPanel} className="flex-1">
                            Upload Another
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Dialog wrapper for DocumentUploadPanel — can be triggered from a toolbar button
 */
export interface DocumentUploadDialogProps {
    onSlidesGenerated?: (result: IngestionResult) => void;
    /**
     * Optional controlled visibility props. When provided the dialog will
     * behave as a controlled component rather than rendering its own trigger.
     */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function DocumentUploadDialog({
    onSlidesGenerated,
    open,
    onOpenChange,
}: DocumentUploadDialogProps) {
    const isControlled = open !== undefined && onOpenChange !== undefined;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Only render the built‑in trigger when the caller isn't controlling open state */}
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Import Document
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Import Document → AI Slides
                    </DialogTitle>
                    <DialogDescription>
                        Upload a PDF, Word doc, or text file and our AI will automatically
                        structure it into a beautiful presentation.
                    </DialogDescription>
                </DialogHeader>
                <DocumentUploadPanel onSlidesGenerated={onSlidesGenerated} />
            </DialogContent>
        </Dialog>
    );
}
