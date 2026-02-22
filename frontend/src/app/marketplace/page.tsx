"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Sparkles,
    Search,
    Star,
    Download,
    ChevronLeft,
    Grid3X3,
    List,
    ShoppingCart,
    Loader2,
    Crown,
    TrendingUp,
    Clock,
    Tag,
    Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

interface MarketplaceTemplate {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    price: number;
    rating: number;
    downloads: number;
    category?: string;
    author?: { id: string; name: string };
    previewImages?: string[];
    featured?: boolean;
    tags?: string[];
}

export default function MarketplacePage() {
    const router = useRouter();
    const { isAuthenticated } = useAuthStore();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [sortBy, setSortBy] = useState<"popular" | "newest" | "rating" | "downloads">("popular");
    const [priceFilter, setPriceFilter] = useState<"all" | "free" | "paid">("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [selectedTemplate, setSelectedTemplate] = useState<MarketplaceTemplate | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Fetch categories
    const { data: categories } = useQuery({
        queryKey: ["marketplace-categories"],
        queryFn: () => api.getMarketplaceCategories(),
    });

    // Fetch templates
    const { data: templatesData, isLoading } = useQuery({
        queryKey: ["marketplace-templates", selectedCategory, sortBy, priceFilter, searchQuery],
        queryFn: () =>
            api.listMarketplaceTemplates({
                category: selectedCategory !== "all" ? selectedCategory : undefined,
                sortBy,
                pricing: priceFilter !== "all" ? priceFilter : undefined,
                search: searchQuery || undefined,
                page: 1,
                limit: 24,
            }),
    });

    // Use template mutation
    const useTemplateMutation = useMutation({
        mutationFn: ({ templateId, title }: { templateId: string; title?: string }) =>
            api.useTemplate(templateId, title),
        onSuccess: (project) => {
            toast.success("Template applied! Redirecting to editor...");
            router.push(`/editor/${project.id}`);
        },
        onError: () => {
            toast.error("Failed to use template");
        },
    });

    const templates = useMemo<MarketplaceTemplate[]>(() => templatesData?.data || [], [templatesData?.data]);

    // Featured templates (first 4 with highest downloads)
    const featuredTemplates = useMemo(() => {
        return [...templates]
            .sort((a, b) => b.downloads - a.downloads)
            .slice(0, 4);
    }, [templates]);

    const handleUseTemplate = (template: MarketplaceTemplate) => {
        if (!isAuthenticated) {
            router.push("/login?redirect=/marketplace");
            return;
        }

        if (template.price > 0) {
            // Would need to handle payment flow
            toast.info("Premium template - payment flow would go here");
            return;
        }

        useTemplateMutation.mutate({ templateId: template.id });
    };

    const openPreview = (template: MarketplaceTemplate) => {
        setSelectedTemplate(template);
        setIsPreviewOpen(true);
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="flex items-center gap-2">
                                <Button variant="ghost" size="sm">
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Back
                                </Button>
                            </Link>
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-linear-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                                    <ShoppingCart className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-xl font-bold text-slate-900 dark:text-white">
                                    Template Marketplace
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link href="/marketplace/author">
                                <Button variant="outline" size="sm">
                                    <Crown className="h-4 w-4 mr-2" />
                                    Sell Templates
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Hero Section */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-bold bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-4">
                        Professional Presentation Templates
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                        Browse thousands of professionally designed templates to create stunning presentations in minutes.
                    </p>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col lg:flex-row gap-4 mb-8">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-12 text-lg bg-white dark:bg-slate-900"
                        />
                    </div>

                    <div className="flex gap-3">
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="w-40 h-12">
                                <Tag className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {categories?.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name} ({cat.count})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                            <SelectTrigger className="w-37.5 h-12">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="popular">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4" />
                                        Popular
                                    </div>
                                </SelectItem>
                                <SelectItem value="newest">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Newest
                                    </div>
                                </SelectItem>
                                <SelectItem value="rating">
                                    <div className="flex items-center gap-2">
                                        <Star className="h-4 w-4" />
                                        Top Rated
                                    </div>
                                </SelectItem>
                                <SelectItem value="downloads">
                                    <div className="flex items-center gap-2">
                                        <Download className="h-4 w-4" />
                                        Most Downloaded
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={priceFilter} onValueChange={(v) => setPriceFilter(v as typeof priceFilter)}>
                            <SelectTrigger className="w-30 h-12">
                                <SelectValue placeholder="Price" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Prices</SelectItem>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="paid">Premium</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex border rounded-lg overflow-hidden">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`p-3 transition-colors ${viewMode === "grid"
                                    ? "bg-slate-100 dark:bg-slate-800"
                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    }`}
                            >
                                <Grid3X3 className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-3 transition-colors ${viewMode === "list"
                                    ? "bg-slate-100 dark:bg-slate-800"
                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    }`}
                            >
                                <List className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Featured Templates */}
                {!searchQuery && selectedCategory === "all" && featuredTemplates.length > 0 && (
                    <div className="mb-12">
                        <div className="flex items-center gap-2 mb-6">
                            <Sparkles className="h-5 w-5 text-yellow-500" />
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Featured Templates</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {featuredTemplates.map((template) => (
                                <Card key={template.id} className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-purple-500/30">
                                    <div className="aspect-16/10 bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative overflow-hidden">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            {template.thumbnail ? (
                                                <img src={template.thumbnail} alt={template.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-6xl font-bold text-slate-300 dark:text-slate-600">
                                                    {template.title.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute top-2 right-2">
                                            <Badge className="bg-yellow-500 text-white">
                                                <Star className="h-3 w-3 mr-1 fill-current" />
                                                Featured
                                            </Badge>
                                        </div>
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <Button size="sm" variant="secondary" onClick={() => openPreview(template)}>
                                                Preview
                                            </Button>
                                        </div>
                                    </div>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg line-clamp-1">{template.title}</CardTitle>
                                        <CardDescription className="line-clamp-2">{template.description}</CardDescription>
                                    </CardHeader>
                                    <CardFooter className="pt-2 flex items-center justify-between">
                                        <div className="flex items-center gap-3 text-sm text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                                                {template.rating.toFixed(1)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Download className="h-4 w-4" />
                                                {template.downloads.toLocaleString()}
                                            </span>
                                        </div>
                                        {template.price > 0 ? (
                                            <Badge variant="secondary" className="font-bold">
                                                ${template.price}
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-green-500 text-white">Free</Badge>
                                        )}
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* All Templates */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {searchQuery ? `Results for "${searchQuery}"` : "All Templates"}
                        </h2>
                        <span className="text-slate-500">
                            {templates.length} template{templates.length !== 1 ? "s" : ""} found
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                                <Search className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                                No templates found
                            </h3>
                            <p className="text-slate-500">
                                Try adjusting your search or filters
                            </p>
                        </div>
                    ) : viewMode === "grid" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {templates.map((template) => (
                                <Card key={template.id} className="group overflow-hidden hover:shadow-lg transition-all duration-300">
                                    <div className="aspect-16/10 bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative overflow-hidden">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            {template.thumbnail ? (
                                                <img src={template.thumbnail} alt={template.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-5xl font-bold text-slate-300 dark:text-slate-600">
                                                    {template.title.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                            <Button size="sm" variant="secondary" onClick={() => openPreview(template)}>
                                                Preview
                                            </Button>
                                            <Button size="sm" onClick={() => handleUseTemplate(template)}>
                                                Use
                                            </Button>
                                        </div>
                                    </div>
                                    <CardContent className="pt-4">
                                        <h3 className="font-medium text-slate-900 dark:text-white line-clamp-1 mb-1">
                                            {template.title}
                                        </h3>
                                        <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                                            {template.description}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                                                {template.rating.toFixed(1)}
                                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                                <Download className="h-3 w-3" />
                                                {template.downloads}
                                            </div>
                                            {template.price > 0 ? (
                                                <span className="font-bold text-purple-600">${template.price}</span>
                                            ) : (
                                                <Badge className="bg-green-500/10 text-green-600">Free</Badge>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {templates.map((template) => (
                                <Card key={template.id} className="flex overflow-hidden hover:shadow-lg transition-all">
                                    <div className="w-48 h-32 bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 shrink-0">
                                        {template.thumbnail ? (
                                            <img src={template.thumbnail} alt={template.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-slate-300 dark:text-slate-600">
                                                {template.title.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <CardContent className="flex-1 py-4 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium text-slate-900 dark:text-white mb-1">
                                                {template.title}
                                            </h3>
                                            <p className="text-sm text-slate-500 line-clamp-1 mb-2">
                                                {template.description}
                                            </p>
                                            <div className="flex items-center gap-3 text-sm text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                                                    {template.rating.toFixed(1)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Download className="h-4 w-4" />
                                                    {template.downloads.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {template.price > 0 ? (
                                                <span className="font-bold text-xl text-purple-600">${template.price}</span>
                                            ) : (
                                                <Badge className="bg-green-500 text-white">Free</Badge>
                                            )}
                                            <Button onClick={() => handleUseTemplate(template)}>
                                                Use Template
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Template Preview Dialog */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">{selectedTemplate?.title}</DialogTitle>
                        <DialogDescription>{selectedTemplate?.description}</DialogDescription>
                    </DialogHeader>

                    {selectedTemplate && (
                        <div className="py-4">
                            <div className="aspect-video bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg overflow-hidden mb-6">
                                {selectedTemplate.thumbnail ? (
                                    <img
                                        src={selectedTemplate.thumbnail}
                                        alt={selectedTemplate.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-8xl font-bold text-slate-300 dark:text-slate-600">
                                        {selectedTemplate.title.charAt(0)}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <Star className="h-5 w-5 text-yellow-500 fill-current" />
                                        <span className="font-medium">{selectedTemplate.rating.toFixed(1)}</span>
                                        <span className="text-slate-500">rating</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Download className="h-5 w-5 text-slate-500" />
                                        <span className="font-medium">{selectedTemplate.downloads.toLocaleString()}</span>
                                        <span className="text-slate-500">downloads</span>
                                    </div>
                                </div>
                                <div>
                                    {selectedTemplate.price > 0 ? (
                                        <span className="text-3xl font-bold text-purple-600">${selectedTemplate.price}</span>
                                    ) : (
                                        <Badge className="bg-green-500 text-white text-lg px-3 py-1">Free</Badge>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap mb-6">
                                {selectedTemplate.tags?.map((tag) => (
                                    <Badge key={tag} variant="outline">{tag}</Badge>
                                )) || (
                                        <>
                                            <Badge variant="outline">Professional</Badge>
                                            <Badge variant="outline">Modern</Badge>
                                            <Badge variant="outline">Business</Badge>
                                        </>
                                    )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                            Close
                        </Button>
                        <Button
                            onClick={() => {
                                if (selectedTemplate) { handleUseTemplate(selectedTemplate); }
                                setIsPreviewOpen(false);
                            }}
                            disabled={useTemplateMutation.isPending}
                        >
                            {useTemplateMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Applying...
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4 mr-2" />
                                    Use This Template
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
