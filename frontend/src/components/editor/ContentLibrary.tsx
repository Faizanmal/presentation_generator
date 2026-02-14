'use client';

import { useState } from 'react';
import {
    Library,
    Grid3x3,
    LayoutTemplate,
    Search,
    Plus,
    Trash2,
    Star,
} from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ContentLibraryProps {
    onInsertSlide?: (content: Record<string, unknown>) => void;
    onInsertBlock?: (content: Record<string, unknown>) => void;
}

interface LibraryItem {
    id: string;
    name: string;
    description?: string;
    type: 'slide' | 'block';
    content: Record<string, unknown>;
    tags: string[];
    category: string;
    createdAt: string;
}

const CATEGORIES = [
    { value: 'all', label: 'All' },
    { value: 'titles', label: 'Titles' },
    { value: 'content', label: 'Content' },
    { value: 'structure', label: 'Structure' },
    { value: 'data', label: 'Data' },
    { value: 'analysis', label: 'Analysis' },
    { value: 'planning', label: 'Planning' },
    { value: 'closing', label: 'Closing' },
    { value: 'my-library', label: 'My Library' },
];

export function ContentLibrary({
    onInsertSlide,
    onInsertBlock,
}: ContentLibraryProps) {
    const [activeTab, setActiveTab] = useState<'templates' | 'my-library'>(
        'templates',
    );
    const [filterType, setFilterType] = useState<'all' | 'slide' | 'block'>('all');
    const [category, setCategory] = useState('all');
    const [search, setSearch] = useState('');

    // Fetch built-in templates
    const { data: templates } = useQuery({
        queryKey: ['library-templates', filterType],
        queryFn: async () => {
            const response = await api.get('/library/templates', {
                params: { type: filterType === 'all' ? undefined : filterType },
            });
            return (response.data as { templates: LibraryItem[] }).templates;
        },
    });

    // Fetch user's library
    const { data: myLibrary, refetch: refetchLibrary } = useQuery({
        queryKey: ['my-library', filterType, category],
        queryFn: async () => {
            const response = await api.get('/library', {
                params: {
                    type: filterType === 'all' ? undefined : filterType,
                    category: category === 'all' ? undefined : category,
                    search: search || undefined,
                },
            });
            return (response.data as { items: LibraryItem[] }).items;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/library/${id}`);
        },
        onSuccess: () => {
            refetchLibrary();
        },
    });

    const items = activeTab === 'templates' ? templates : myLibrary;

    const filteredItems = items?.filter((item: LibraryItem) => {
        if (category !== 'all' && category !== 'my-library' && item.category !== category) {
            return false;
        }
        if (search && !item.name.toLowerCase().includes(search.toLowerCase())) {
            return false;
        }
        return true;
    });

    const handleInsert = (item: LibraryItem) => {
        if (item.type === 'slide' && onInsertSlide) {
            onInsertSlide(item.content);
        } else if (item.type === 'block' && onInsertBlock) {
            onInsertBlock(item.content);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                    <Library className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-900">Content Library</h3>
                    <p className="text-sm text-slate-600">
                        Reusable slides and blocks
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('templates')}
                    className={`px-4 py-2 font-medium transition-colors ${activeTab === 'templates'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    <LayoutTemplate className="w-4 h-4 inline mr-2" />
                    Templates
                </button>
                <button
                    onClick={() => setActiveTab('my-library')}
                    className={`px-4 py-2 font-medium transition-colors ${activeTab === 'my-library'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    <Star className="w-4 h-4 inline mr-2" />
                    My Library
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as 'all' | 'slide' | 'block')}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                    <option value="all">All Types</option>
                    <option value="slide">Slides</option>
                    <option value="block">Blocks</option>
                </select>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat.value}
                        onClick={() => setCategory(cat.value)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${category === cat.value
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                {filteredItems?.map((item: LibraryItem) => (
                    <div
                        key={item.id}
                        className="group relative border border-slate-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => handleInsert(item)}
                    >
                        {/* Type Badge */}
                        <div
                            className={`absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium ${item.type === 'slide'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-green-100 text-green-700'
                                }`}
                        >
                            {item.type}
                        </div>

                        {/* Preview Icon */}
                        <div className="mb-3">
                            {item.type === 'slide' ? (
                                <div className="w-full h-16 bg-slate-100 rounded flex items-center justify-center">
                                    <Grid3x3 className="w-8 h-8 text-slate-400" />
                                </div>
                            ) : (
                                <div className="w-full h-16 bg-slate-100 rounded flex items-center justify-center">
                                    <LayoutTemplate className="w-8 h-8 text-slate-400" />
                                </div>
                            )}
                        </div>

                        <h4 className="font-medium text-slate-900 text-sm mb-1">
                            {item.name}
                        </h4>
                        {item.description && (
                            <p className="text-xs text-slate-500 line-clamp-2">
                                {item.description}
                            </p>
                        )}

                        {/* Hover Actions */}
                        <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity flex items-center justify-center gap-2">
                            <button className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg flex items-center gap-1">
                                <Plus className="w-4 h-4" />
                                Insert
                            </button>
                            {activeTab === 'my-library' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteMutation.mutate(item.id);
                                    }}
                                    className="p-1.5 bg-red-600 text-white rounded-lg"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Tags */}
                        {item.tags?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {item.tags.slice(0, 3).map((tag) => (
                                    <span
                                        key={tag}
                                        className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-xs rounded"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {filteredItems?.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                    <Library className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No items found</p>
                </div>
            )}
        </div>
    );
}
