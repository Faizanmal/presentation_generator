'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
    ImageIcon, ArrowLeft, Loader2, Search, Wand2, Download,
    CheckCircle2, XCircle, Layers, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useImageAcquisition } from '@/hooks/use-new-features';
import Link from 'next/link';

export default function ImageAcquisitionPage() {
    const searchParams = useSearchParams();
    const projectId = searchParams.get('projectId') || '';
    const { sources, acquire, smartAcquire, bulkAcquire } = useImageAcquisition(projectId);

    const [query, setQuery] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [orientation, setOrientation] = useState<'landscape' | 'portrait' | 'square'>('landscape');
    const [source, setSource] = useState<'unsplash' | 'pexels' | 'pixabay' | 'ai'>('unsplash');
    const [bulkTopic, setBulkTopic] = useState('');
    const [bulkCount, setBulkCount] = useState(5);

    const [results, setResults] = useState<Array<{
        url: string; source: string; width: number; height: number; attribution?: string;
    }>>([]);

    const handleSearch = async () => {
        if (!query.trim()) {
            toast.error('Please enter a search query');
            return;
        }
        try {
            const result = await acquire.mutateAsync({
                source,
                query,
                orientation,
            });
            if (result.image) {
                setResults((prev) => [result.image, ...prev]);
                toast.success(`Image found from ${result.image.source}`);
            }
        } catch {
            toast.error('Failed to acquire image');
        }
    };

    const handleSmartSearch = async () => {
        if (!query.trim()) {
            toast.error('Please enter a query');
            return;
        }
        try {
            const result = await smartAcquire.mutateAsync({
                query,
                orientation,
            });
            if (result.image) {
                setResults((prev) => [result.image, ...prev]);
                toast.success(`Smart acquisition found image from ${result.image.source}`);
            }
        } catch {
            toast.error('Smart acquisition failed');
        }
    };

    const handleBulkAcquire = async () => {
        if (!bulkTopic.trim()) {
            toast.error('Please enter a topic');
            return;
        }
        try {
            const result = await bulkAcquire.mutateAsync({
                topic: bulkTopic,
                count: bulkCount,
            });
            toast.success(`Bulk acquisition queued: ${result.message}`);
        } catch {
            toast.error('Bulk acquisition failed');
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto p-6 space-y-8">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <ImageIcon className="w-8 h-8 text-pink-500" />
                            Image Acquisition
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Find and generate images from stock libraries and AI
                        </p>
                    </div>
                </div>

                {!projectId && (
                    <Card className="border-amber-500/30 bg-amber-500/5">
                        <CardContent className="p-4 flex items-center gap-3 text-sm">
                            <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                            <p>Open this page from a project editor to auto-add images to your slides.</p>
                        </CardContent>
                    </Card>
                )}

                {/* Sources status */}
                <div className="flex flex-wrap gap-2">
                    {sources.data?.sources?.map((s) => (
                        <Badge
                            key={s.id}
                            variant={s.available ? 'default' : 'outline'}
                            className={`text-xs ${s.available ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'opacity-50'}`}
                        >
                            {s.available ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                            {s.name}
                        </Badge>
                    ))}
                </div>

                <Tabs defaultValue="search" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="search">
                            <Search className="w-4 h-4 mr-2" /> Search
                        </TabsTrigger>
                        <TabsTrigger value="smart">
                            <Wand2 className="w-4 h-4 mr-2" /> Smart Acquire
                        </TabsTrigger>
                        <TabsTrigger value="bulk">
                            <Layers className="w-4 h-4 mr-2" /> Bulk Acquire
                        </TabsTrigger>
                    </TabsList>

                    {/* Search tab */}
                    <TabsContent value="search" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Search Stock Libraries</CardTitle>
                                <CardDescription>Search Unsplash, Pexels, Pixabay, or generate with AI</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Source</Label>
                                        <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                                            <SelectTrigger className="mt-1.5">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unsplash">Unsplash</SelectItem>
                                                <SelectItem value="pexels">Pexels</SelectItem>
                                                <SelectItem value="pixabay">Pixabay</SelectItem>
                                                <SelectItem value="ai">AI Generation</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Orientation</Label>
                                        <Select value={orientation} onValueChange={(v) => setOrientation(v as typeof orientation)}>
                                            <SelectTrigger className="mt-1.5">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="landscape">Landscape</SelectItem>
                                                <SelectItem value="portrait">Portrait</SelectItem>
                                                <SelectItem value="square">Square</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder={source === 'ai' ? 'Describe the image you want...' : 'Search for images...'}
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                    <Button onClick={handleSearch} disabled={acquire.isPending}>
                                        {acquire.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Smart Acquire tab */}
                    <TabsContent value="smart" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Smart Acquire</CardTitle>
                                <CardDescription>AI automatically tries multiple sources to find the best match</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Describe what you need..."
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()}
                                    />
                                    <Button onClick={handleSmartSearch} disabled={smartAcquire.isPending}>
                                        {smartAcquire.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Bulk tab */}
                    <TabsContent value="bulk" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Bulk Acquire</CardTitle>
                                <CardDescription>Get multiple images for a topic at once (max 20)</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Topic</Label>
                                        <Input
                                            placeholder="e.g. artificial intelligence"
                                            value={bulkTopic}
                                            onChange={(e) => setBulkTopic(e.target.value)}
                                            className="mt-1.5"
                                        />
                                    </div>
                                    <div>
                                        <Label>Count</Label>
                                        <Select value={String(bulkCount)} onValueChange={(v) => setBulkCount(Number(v))}>
                                            <SelectTrigger className="mt-1.5">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[3, 5, 8, 10, 15, 20].map((n) => (
                                                    <SelectItem key={n} value={String(n)}>{n} images</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Button className="w-full" onClick={handleBulkAcquire} disabled={bulkAcquire.isPending}>
                                    {bulkAcquire.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Layers className="w-4 h-4 mr-2" />}
                                    Queue Bulk Acquisition
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Results gallery */}
                {results.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Acquired Images ({results.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {results.map((img, i) => (
                                    <div key={i} className="rounded-lg overflow-hidden border group relative">
                                        <img
                                            src={img.url}
                                            alt={`Acquired image ${i + 1}`}
                                            className="w-full h-40 object-cover"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Button variant="secondary" size="sm" asChild>
                                                <a href={img.url} target="_blank" rel="noopener noreferrer">
                                                    <Download className="w-3 h-3 mr-1" /> Open
                                                </a>
                                            </Button>
                                        </div>
                                        <div className="p-2 flex items-center justify-between text-xs">
                                            <Badge variant="secondary" className="text-[10px]">{img.source}</Badge>
                                            <span className="text-muted-foreground">{img.width}×{img.height}</span>
                                        </div>
                                        {img.attribution && (
                                            <p className="px-2 pb-2 text-[10px] text-muted-foreground truncate">{img.attribution}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
