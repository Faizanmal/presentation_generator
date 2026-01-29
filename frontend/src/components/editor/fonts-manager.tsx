'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Type,
  Upload,
  Search,
  Star,
  StarOff,
  Trash2,
  Check,
  Plus,
  Globe,
  Download,
  Eye,
  Filter,
  Grid,
  List,
  ArrowUpDown,
} from 'lucide-react';

interface CustomFont {
  id: string;
  name: string;
  family: string;
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
  weights: number[];
  source: 'google' | 'uploaded' | 'system';
  isFavorite: boolean;
  lastUsed?: Date;
  fileUrl?: string;
}

interface GoogleFont {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
  popularity: number;
}

// Popular Google Fonts
const POPULAR_GOOGLE_FONTS: GoogleFont[] = [
  { family: 'Roboto', category: 'sans-serif', variants: ['100', '300', '400', '500', '700', '900'], subsets: ['latin'], popularity: 1 },
  { family: 'Open Sans', category: 'sans-serif', variants: ['300', '400', '500', '600', '700', '800'], subsets: ['latin'], popularity: 2 },
  { family: 'Lato', category: 'sans-serif', variants: ['100', '300', '400', '700', '900'], subsets: ['latin'], popularity: 3 },
  { family: 'Montserrat', category: 'sans-serif', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'], popularity: 4 },
  { family: 'Poppins', category: 'sans-serif', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'], popularity: 5 },
  { family: 'Playfair Display', category: 'serif', variants: ['400', '500', '600', '700', '800', '900'], subsets: ['latin'], popularity: 6 },
  { family: 'Merriweather', category: 'serif', variants: ['300', '400', '700', '900'], subsets: ['latin'], popularity: 7 },
  { family: 'Raleway', category: 'sans-serif', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'], popularity: 8 },
  { family: 'Inter', category: 'sans-serif', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'], popularity: 9 },
  { family: 'Nunito', category: 'sans-serif', variants: ['200', '300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'], popularity: 10 },
  { family: 'Source Sans Pro', category: 'sans-serif', variants: ['200', '300', '400', '600', '700', '900'], subsets: ['latin'], popularity: 11 },
  { family: 'Oswald', category: 'sans-serif', variants: ['200', '300', '400', '500', '600', '700'], subsets: ['latin'], popularity: 12 },
  { family: 'Dancing Script', category: 'handwriting', variants: ['400', '500', '600', '700'], subsets: ['latin'], popularity: 13 },
  { family: 'Pacifico', category: 'handwriting', variants: ['400'], subsets: ['latin'], popularity: 14 },
  { family: 'Bebas Neue', category: 'display', variants: ['400'], subsets: ['latin'], popularity: 15 },
  { family: 'Fira Code', category: 'monospace', variants: ['300', '400', '500', '600', '700'], subsets: ['latin'], popularity: 16 },
  { family: 'JetBrains Mono', category: 'monospace', variants: ['100', '200', '300', '400', '500', '600', '700', '800'], subsets: ['latin'], popularity: 17 },
  { family: 'Crimson Text', category: 'serif', variants: ['400', '600', '700'], subsets: ['latin'], popularity: 18 },
  { family: 'Libre Baskerville', category: 'serif', variants: ['400', '700'], subsets: ['latin'], popularity: 19 },
  { family: 'Abril Fatface', category: 'display', variants: ['400'], subsets: ['latin'], popularity: 20 },
];

// System fonts
const SYSTEM_FONTS: CustomFont[] = [
  { id: 'sys-1', name: 'Arial', family: 'Arial, sans-serif', category: 'sans-serif', weights: [400, 700], source: 'system', isFavorite: false },
  { id: 'sys-2', name: 'Times New Roman', family: "'Times New Roman', serif", category: 'serif', weights: [400, 700], source: 'system', isFavorite: false },
  { id: 'sys-3', name: 'Georgia', family: 'Georgia, serif', category: 'serif', weights: [400, 700], source: 'system', isFavorite: false },
  { id: 'sys-4', name: 'Verdana', family: 'Verdana, sans-serif', category: 'sans-serif', weights: [400, 700], source: 'system', isFavorite: false },
  { id: 'sys-5', name: 'Courier New', family: "'Courier New', monospace", category: 'monospace', weights: [400, 700], source: 'system', isFavorite: false },
];

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'popularity' | 'recent';

interface FontsManagerProps {
  onFontSelect?: (font: CustomFont) => void;
  selectedFontFamily?: string;
}

export function FontsManager({ onFontSelect, selectedFontFamily }: FontsManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('popularity');
  const [installedFonts, setInstalledFonts] = useState<CustomFont[]>([...SYSTEM_FONTS]);
  const [favoriteFonts, setFavoriteFonts] = useState<Set<string>>(new Set());
  const [loadedGoogleFonts, setLoadedGoogleFonts] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewText, setPreviewText] = useState('The quick brown fox jumps over the lazy dog');

  // Load Google Font dynamically
  const loadGoogleFont = useCallback((fontFamily: string) => {
    if (loadedGoogleFonts.has(fontFamily)) return;

    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    setLoadedGoogleFonts((prev) => new Set([...prev, fontFamily]));
  }, [loadedGoogleFonts]);

  // Install Google Font
  const installGoogleFont = useCallback((googleFont: GoogleFont) => {
    loadGoogleFont(googleFont.family);

    const newFont: CustomFont = {
      id: `google-${googleFont.family.toLowerCase().replace(/ /g, '-')}`,
      name: googleFont.family,
      family: `'${googleFont.family}', ${googleFont.category}`,
      category: googleFont.category as CustomFont['category'],
      weights: googleFont.variants.filter((v) => !v.includes('italic')).map((v) => parseInt(v) || 400),
      source: 'google',
      isFavorite: false,
    };

    setInstalledFonts((prev) => {
      if (prev.some((f) => f.id === newFont.id)) return prev;
      return [...prev, newFont];
    });
  }, [loadGoogleFont]);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList) => {
    const validFiles = Array.from(files).filter((file) =>
      ['.ttf', '.otf', '.woff', '.woff2'].some((ext) => file.name.toLowerCase().endsWith(ext))
    );

    for (const file of validFiles) {
      const fontName = file.name.replace(/\.(ttf|otf|woff|woff2)$/i, '');
      const fontUrl = URL.createObjectURL(file);

      // Create @font-face rule
      const fontFace = new FontFace(fontName, `url(${fontUrl})`);
      try {
        await fontFace.load();
        document.fonts.add(fontFace);

        const newFont: CustomFont = {
          id: `uploaded-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: fontName,
          family: `'${fontName}', sans-serif`,
          category: 'sans-serif',
          weights: [400],
          source: 'uploaded',
          isFavorite: false,
          fileUrl: fontUrl,
        };

        setInstalledFonts((prev) => [...prev, newFont]);
      } catch (error) {
        console.error('Failed to load font:', error);
      }
    }
  }, []);

  // Toggle favorite
  const toggleFavorite = useCallback((fontId: string) => {
    setInstalledFonts((prev) =>
      prev.map((font) =>
        font.id === fontId ? { ...font, isFavorite: !font.isFavorite } : font
      )
    );
  }, []);

  // Remove font
  const removeFont = useCallback((fontId: string) => {
    setInstalledFonts((prev) => prev.filter((font) => font.id !== fontId));
  }, []);

  // Select font
  const selectFont = useCallback((font: CustomFont) => {
    // Update last used
    setInstalledFonts((prev) =>
      prev.map((f) => (f.id === font.id ? { ...f, lastUsed: new Date() } : f))
    );

    onFontSelect?.(font);
    setIsOpen(false);
  }, [onFontSelect]);

  // Filter and sort fonts
  const filteredFonts = installedFonts
    .filter((font) => {
      if (searchQuery && !font.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (categoryFilter !== 'all' && font.category !== categoryFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'recent':
          return (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0);
        default:
          return 0;
      }
    });

  const favoriteFontsList = filteredFonts.filter((f) => f.isFavorite);

  // Filter Google fonts
  const filteredGoogleFonts = POPULAR_GOOGLE_FONTS.filter((font) => {
    const isInstalled = installedFonts.some(
      (f) => f.name.toLowerCase() === font.family.toLowerCase()
    );
    if (isInstalled) return false;

    if (searchQuery && !font.family.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (categoryFilter !== 'all' && font.category !== categoryFilter) {
      return false;
    }
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Type className="h-4 w-4" />
          Fonts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Font Manager
          </DialogTitle>
          <DialogDescription>
            Browse, install, and manage fonts for your presentations
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="installed" className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="installed">
                Installed ({installedFonts.length})
              </TabsTrigger>
              <TabsTrigger value="google">Google Fonts</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search fonts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="sans-serif">Sans Serif</SelectItem>
                  <SelectItem value="serif">Serif</SelectItem>
                  <SelectItem value="display">Display</SelectItem>
                  <SelectItem value="handwriting">Handwriting</SelectItem>
                  <SelectItem value="monospace">Monospace</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Preview Text */}
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground">Preview Text</Label>
            <Input
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder="Type to preview..."
              className="mt-1"
            />
          </div>

          <TabsContent value="installed" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-[400px]">
              {/* Favorites */}
              {favoriteFontsList.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    Favorites
                  </h3>
                  <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
                    {favoriteFontsList.map((font) => (
                      <FontCard
                        key={font.id}
                        font={font}
                        previewText={previewText}
                        viewMode={viewMode}
                        isSelected={selectedFontFamily === font.family}
                        onSelect={() => selectFont(font)}
                        onToggleFavorite={() => toggleFavorite(font.id)}
                        onRemove={font.source !== 'system' ? () => removeFont(font.id) : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Fonts */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  All Fonts ({filteredFonts.length})
                </h3>
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
                  {filteredFonts.map((font) => (
                    <FontCard
                      key={font.id}
                      font={font}
                      previewText={previewText}
                      viewMode={viewMode}
                      isSelected={selectedFontFamily === font.family}
                      onSelect={() => selectFont(font)}
                      onToggleFavorite={() => toggleFavorite(font.id)}
                      onRemove={font.source !== 'system' ? () => removeFont(font.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="google" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-[400px]">
              <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
                {filteredGoogleFonts.map((font) => (
                  <GoogleFontCard
                    key={font.family}
                    font={font}
                    previewText={previewText}
                    viewMode={viewMode}
                    onInstall={() => installGoogleFont(font)}
                    onLoadPreview={() => loadGoogleFont(font.family)}
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="upload" className="flex-1 m-0">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Upload Custom Fonts</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop font files here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Supported formats: TTF, OTF, WOFF, WOFF2
              </p>
              <Input
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                multiple
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                className="hidden"
                id="font-upload"
              />
              <Button asChild>
                <label htmlFor="font-upload" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Files
                </label>
              </Button>
            </div>

            {/* Uploaded fonts list */}
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3">Uploaded Fonts</h3>
              {installedFonts.filter((f) => f.source === 'uploaded').length === 0 ? (
                <p className="text-sm text-muted-foreground">No fonts uploaded yet</p>
              ) : (
                <div className="space-y-2">
                  {installedFonts
                    .filter((f) => f.source === 'uploaded')
                    .map((font) => (
                      <div
                        key={font.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div>
                          <p className="font-medium" style={{ fontFamily: font.family }}>
                            {font.name}
                          </p>
                          <p className="text-xs text-muted-foreground">Custom font</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFont(font.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Font Card Component
interface FontCardProps {
  font: CustomFont;
  previewText: string;
  viewMode: ViewMode;
  isSelected: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onRemove?: () => void;
}

function FontCard({
  font,
  previewText,
  viewMode,
  isSelected,
  onSelect,
  onToggleFavorite,
  onRemove,
}: FontCardProps) {
  if (viewMode === 'list') {
    return (
      <div
        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
          isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
        }`}
        onClick={onSelect}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium">{font.name}</p>
            <Badge variant="outline" className="text-xs">
              {font.category}
            </Badge>
            {font.source === 'google' && <Globe className="h-3 w-3 text-muted-foreground" />}
          </div>
          <p
            className="text-lg truncate mt-1"
            style={{ fontFamily: font.family }}
          >
            {previewText}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
          >
            {font.isFavorite ? (
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            ) : (
              <StarOff className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card
      className={`cursor-pointer transition-colors ${
        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-medium text-sm">{font.name}</p>
            <Badge variant="outline" className="text-xs mt-1">
              {font.category}
            </Badge>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
            >
              {font.isFavorite ? (
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              ) : (
                <StarOff className="h-3 w-3 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
        <p
          className="text-xl leading-relaxed line-clamp-2"
          style={{ fontFamily: font.family }}
        >
          {previewText}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          {font.source === 'google' && <Globe className="h-3 w-3" />}
          <span>{font.weights.length} weights</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Google Font Card Component
interface GoogleFontCardProps {
  font: GoogleFont;
  previewText: string;
  viewMode: ViewMode;
  onInstall: () => void;
  onLoadPreview: () => void;
}

function GoogleFontCard({
  font,
  previewText,
  viewMode,
  onInstall,
  onLoadPreview,
}: GoogleFontCardProps) {
  useEffect(() => {
    onLoadPreview();
  }, [onLoadPreview]);

  if (viewMode === 'list') {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium">{font.family}</p>
            <Badge variant="outline" className="text-xs">
              {font.category}
            </Badge>
            <Globe className="h-3 w-3 text-muted-foreground" />
          </div>
          <p
            className="text-lg truncate mt-1"
            style={{ fontFamily: `'${font.family}', ${font.category}` }}
          >
            {previewText}
          </p>
        </div>
        <Button size="sm" onClick={onInstall}>
          <Plus className="h-4 w-4 mr-1" />
          Install
        </Button>
      </div>
    );
  }

  return (
    <Card className="hover:bg-accent/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-medium text-sm">{font.family}</p>
            <Badge variant="outline" className="text-xs mt-1">
              {font.category}
            </Badge>
          </div>
          <Button size="sm" onClick={onInstall}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <p
          className="text-xl leading-relaxed line-clamp-2"
          style={{ fontFamily: `'${font.family}', ${font.category}` }}
        >
          {previewText}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Globe className="h-3 w-3" />
          <span>Google Fonts</span>
          <span>•</span>
          <span>{font.variants.length} variants</span>
        </div>
      </CardContent>
    </Card>
  );
}
