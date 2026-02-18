'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
    Library, ArrowLeft, Loader2, Search, Trash2, LayoutGrid, List,
    FileText, Blocks, Star, Filter, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useContentLibrary } from '@/hooks/use-new-features';
import Link from 'next/link';

export default function ContentLibraryPage() {
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'slide' | 'block' | undefined>(undefined);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const { items, templates, saveItem, deleteItem } = useContentLibrary({
        type: typeFilter,
        search: search || undefined,
    });

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteItem.mutateAsync(deleteId);
            setDeleteId(null);
            toast.success('Item removed from library');
        } catch {
            toast.error('Failed to delete item');
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
                            <Library className="w-8 h-8 text-indigo-500" />
                            Content Library
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Save, organise, and re-use your favourite slides and blocks
                        </p>
                    </div>
                </div>

                <Tabs defaultValue="saved" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="saved" className="flex items-center gap-2">
                            <Star className="w-4 h-4" /> My Library
                        </TabsTrigger>
                        <TabsTrigger value="templates" className="flex items-center gap-2">
                            <LayoutGrid className="w-4 h-4" /> Built-in Templates
                        </TabsTrigger>
                    </TabsList>

                    {/* Search & filter bar */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search library..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
                            <button
                                onClick={() => setTypeFilter(undefined)}
                                className={`px-3 py-2 text-xs font-medium transition-colors ${!typeFilter ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                            >All</button>
                            <button
                                onClick={() => setTypeFilter('slide')}
                                className={`px-3 py-2 text-xs font-medium transition-colors ${typeFilter === 'slide' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                            >Slides</button>
                            <button
                                onClick={() => setTypeFilter('block')}
                                className={`px-3 py-2 text-xs font-medium transition-colors ${typeFilter === 'block' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                            >Blocks</button>
                        </div>
                    </div>

                    {/* Saved library items */}
                    <TabsContent value="saved">
                        {items.isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                        ) : !items.data?.items?.length ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <Library className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                                    <p className="text-muted-foreground">
                                        {search ? 'No results matching your search.' : 'Your library is empty. Save slides or blocks from the editor to see them here.'}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {items.data.items.map((item) => (
                                    <Card key={item.id} className="group overflow-hidden hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    {item.type === 'slide' ? (
                                                        <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                                                    ) : (
                                                        <Blocks className="w-5 h-5 text-emerald-500 shrink-0" />
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-sm truncate">{item.name}</p>
                                                        <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                                    onClick={() => setDeleteId(item.id)}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                            {item.tags && item.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-3">
                                                    {item.tags.map((tag) => (
                                                        <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                                                    ))}
                                                </div>
                                            )}
                                            {item.category && (
                                                <Badge variant="outline" className="mt-2 text-[10px]">{item.category}</Badge>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Built-in templates */}
                    <TabsContent value="templates">
                        {templates.isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                        ) : !templates.data?.templates?.length ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <LayoutGrid className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                                    <p className="text-muted-foreground">No built-in templates available.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {templates.data.templates.map((tpl) => (
                                    <Card key={tpl.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-2">
                                                {tpl.type === 'slide' ? (
                                                    <FileText className="w-5 h-5 text-blue-500" />
                                                ) : (
                                                    <Blocks className="w-5 h-5 text-emerald-500" />
                                                )}
                                                <div>
                                                    <p className="font-medium text-sm">{tpl.name}</p>
                                                    <p className="text-xs text-muted-foreground capitalize">{tpl.type} template</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                {/* Delete confirmation dialog */}
                <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Remove from library?</DialogTitle>
                            <DialogDescription>
                                This item will be permanently removed from your library.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={deleteItem.isPending}>
                                {deleteItem.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
