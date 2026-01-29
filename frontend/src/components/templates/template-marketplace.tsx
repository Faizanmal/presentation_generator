'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Star,
  Heart,
  Download,
  Crown,
  Grid3X3,
  List,
  ChevronRight,
  Loader2,
  X,
  Check,
  Briefcase,
  GraduationCap,
  Megaphone,
  Rocket,
  Palette,
  Cpu,
  MinusSquare,
  ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Image from 'next/image';

interface TemplatePreview {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  category: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  stats: {
    uses: number;
    likes: number;
    rating: number;
    reviews: number;
  };
  isPremium: boolean;
  price?: number;
  tags: string[];
  createdAt: string;
}

interface TemplateCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  templateCount: number;
}

const categoryIcons: Record<string, React.ReactNode> = {
  business: <Briefcase className="h-5 w-5" />,
  education: <GraduationCap className="h-5 w-5" />,
  marketing: <Megaphone className="h-5 w-5" />,
  startup: <Rocket className="h-5 w-5" />,
  creative: <Palette className="h-5 w-5" />,
  technology: <Cpu className="h-5 w-5" />,
  minimal: <MinusSquare className="h-5 w-5" />,
  portfolio: <ImageIcon className="h-5 w-5" />,
};

export function TemplateMarketplace() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'rating'>('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePreview | null>(null);
  const [showPremiumOnly, setShowPremiumOnly] = useState(false);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['template-categories'],
    queryFn: () => api.get('/templates/categories'),
  });

  // Fetch templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates', searchQuery, selectedCategory, sortBy, showPremiumOnly],
    queryFn: () =>
      api.get('/templates/search', {
        params: {
          q: searchQuery || undefined,
          category: selectedCategory || undefined,
          sort: sortBy,
          premium: showPremiumOnly ? 'true' : undefined,
        },
      }),
  });

  // Fetch featured templates
  const { data: featuredTemplates } = useQuery({
    queryKey: ['templates-featured'],
    queryFn: () => api.get('/templates/featured'),
  });

  // Use template mutation
  const useMutation_useTemplate = useMutation({
    mutationFn: (templateId: string) => api.post(`/templates/${templateId}/use`),
    onSuccess: (data) => {
      toast.success('Template applied! Opening project...');
      // Navigate to project
      window.location.href = `/editor/${(data as any).projectId}`;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to use template');
    },
  });

  // Like template mutation
  const likeMutation = useMutation({
    mutationFn: (templateId: string) => api.post(`/templates/${templateId}/like`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Categories */}
      <div className="w-64 border-r p-4 hidden lg:block">
        <h3 className="font-semibold mb-4">Categories</h3>
        <div className="space-y-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
              !selectedCategory
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-slate-100'
            )}
          >
            <Grid3X3 className="h-4 w-4" />
            <span>All Templates</span>
          </button>
          {categories?.map((category: TemplateCategory) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.slug)}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                selectedCategory === category.slug
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-slate-100'
              )}
            >
              <div className="flex items-center gap-2">
                {categoryIcons[category.slug]}
                <span>{category.name}</span>
              </div>
              <span className="text-xs opacity-60">{category.templateCount}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center border rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={showPremiumOnly ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowPremiumOnly(!showPremiumOnly)}
            >
              <Crown className="h-3 w-3 mr-1" />
              Premium
            </Button>
            {selectedCategory && (
              <Badge variant="secondary" className="gap-1">
                {selectedCategory}
                <button onClick={() => setSelectedCategory(null)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Featured Section */}
            {!searchQuery && !selectedCategory && featuredTemplates?.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Featured Templates</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featuredTemplates.slice(0, 3).map((template: TemplatePreview) => (
                    <Card
                      key={template.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <div className="aspect-video bg-slate-100 relative">
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                          <ImageIcon className="h-12 w-12" />
                        </div>
                        {template.isPremium && (
                          <Badge className="absolute top-2 right-2 bg-gradient-to-r from-yellow-500 to-amber-500">
                            <Crown className="h-3 w-3 mr-1" />
                            Premium
                          </Badge>
                        )}
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{template.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {template.description}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="pt-0 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            {template.stats.rating}
                          </span>
                          <span>{formatNumber(template.stats.uses)} uses</span>
                        </div>
                        {template.isPremium && template.price && (
                          <span className="font-semibold">${template.price}</span>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* All Templates */}
            <div>
              <h2 className="text-lg font-semibold mb-4">
                {selectedCategory
                  ? `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Templates`
                  : 'All Templates'}
              </h2>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {templatesData?.templates?.map((template: TemplatePreview) => (
                    <Card
                      key={template.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <div className="aspect-video bg-slate-100 relative">
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                        {template.isPremium && (
                          <Badge className="absolute top-2 right-2 bg-gradient-to-r from-yellow-500 to-amber-500">
                            <Crown className="h-3 w-3" />
                          </Badge>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button size="sm" variant="secondary">
                            Preview
                          </Button>
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-medium truncate">{template.title}</h3>
                        <div className="flex items-center justify-between mt-1 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            {template.stats.rating}
                          </span>
                          <span>{formatNumber(template.stats.uses)} uses</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {templatesData?.templates?.map((template: TemplatePreview) => (
                    <Card
                      key={template.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <div className="flex items-center p-4 gap-4">
                        <div className="w-32 aspect-video bg-slate-100 rounded flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="h-6 w-6 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{template.title}</h3>
                            {template.isPremium && (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                                <Crown className="h-3 w-3 mr-1" />
                                Premium
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 truncate">
                            {template.description}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              {template.stats.rating} ({template.stats.reviews})
                            </span>
                            <span>{formatNumber(template.stats.uses)} uses</span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {formatNumber(template.stats.likes)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {templatesData?.templates?.length === 0 && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">No templates found</p>
                  <p className="text-sm text-slate-400">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Template Preview Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedTemplate.title}
                  {selectedTemplate.isPremium && (
                    <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500">
                      <Crown className="h-3 w-3 mr-1" />
                      Premium
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  by {selectedTemplate.author.name}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1">
                <div className="space-y-4">
                  {/* Preview Image */}
                  <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
                    <ImageIcon className="h-16 w-16 text-slate-300" />
                  </div>

                  {/* Description */}
                  <p className="text-slate-600">{selectedTemplate.description}</p>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <strong>{selectedTemplate.stats.rating}</strong>
                      <span className="text-slate-500">
                        ({selectedTemplate.stats.reviews} reviews)
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="h-4 w-4 text-slate-400" />
                      <strong>{formatNumber(selectedTemplate.stats.uses)}</strong>
                      <span className="text-slate-500">uses</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-4 w-4 text-slate-400" />
                      <strong>{formatNumber(selectedTemplate.stats.likes)}</strong>
                      <span className="text-slate-500">likes</span>
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="flex-row gap-2 sm:justify-between border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => likeMutation.mutate(selectedTemplate.id)}
                >
                  <Heart className="h-4 w-4 mr-2" />
                  Like
                </Button>
                <div className="flex gap-2">
                  {selectedTemplate.isPremium && selectedTemplate.price && (
                    <span className="flex items-center text-lg font-bold">
                      ${selectedTemplate.price}
                    </span>
                  )}
                  <Button
                    onClick={() => useMutation_useTemplate.mutate(selectedTemplate.id)}
                    disabled={useMutation_useTemplate.isPending}
                  >
                    {useMutation_useTemplate.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Use Template
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
