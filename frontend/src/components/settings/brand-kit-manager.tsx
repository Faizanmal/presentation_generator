'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Palette,
  Type,
  Image,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Upload,
  Eye,
  Copy,
  Wand2,
  Loader2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  success: string;
  warning: string;
  error: string;
}

interface Typography {
  headingFont: string;
  bodyFont: string;
  headingSizes: {
    h1: string;
    h2: string;
    h3: string;
    h4: string;
  };
  bodySize: string;
  lineHeight: number;
}

interface BrandKit {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  colors: ColorPalette;
  typography: Typography;
  logos: Array<{
    id: string;
    type: 'primary' | 'secondary' | 'icon' | 'wordmark';
    url: string;
    darkModeUrl?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const fontOptions = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Playfair Display',
  'Merriweather',
  'Source Sans Pro',
  'Raleway',
  'Nunito',
  'Work Sans',
  'Space Grotesk',
  'DM Sans',
  'Outfit',
];

const colorLabels: Record<keyof ColorPalette, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
  background: 'Background',
  surface: 'Surface',
  text: 'Text',
  textSecondary: 'Text Secondary',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

export function BrandKitManager() {
  const queryClient = useQueryClient();
  const [selectedKit, setSelectedKit] = useState<BrandKit | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newKitName, setNewKitName] = useState('');
  const [editingColor, setEditingColor] = useState<keyof ColorPalette | null>(null);

  // Fetch brand kits
  const { data: brandKits, isLoading } = useQuery({
    queryKey: ['brand-kits'],
    queryFn: () => api.get('/themes/brand-kits'),
  });

  // Create brand kit mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => api.post('/themes/brand-kits', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
      setSelectedKit(data as BrandKit | null);
      setIsCreating(false);
      setNewKitName('');
      toast.success('Brand kit created');
    },
  });

  // Update brand kit mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BrandKit> }) =>
      api.patch(`/themes/brand-kits/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
      toast.success('Brand kit updated');
    },
  });

  // Delete brand kit mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/themes/brand-kits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
      setSelectedKit(null);
      toast.success('Brand kit deleted');
    },
  });

  const handleColorChange = (colorKey: keyof ColorPalette, value: string) => {
    if (!selectedKit) return;

    const updatedColors = { ...selectedKit.colors, [colorKey]: value };
    setSelectedKit({ ...selectedKit, colors: updatedColors });
    
    updateMutation.mutate({
      id: selectedKit.id,
      updates: { colors: updatedColors },
    });
  };

  const handleFontChange = (type: 'headingFont' | 'bodyFont', value: string) => {
    if (!selectedKit) return;

    const updatedTypography = { ...selectedKit.typography, [type]: value };
    setSelectedKit({ ...selectedKit, typography: updatedTypography });
    
    updateMutation.mutate({
      id: selectedKit.id,
      updates: { typography: updatedTypography },
    });
  };

  const handleSetDefault = () => {
    if (!selectedKit) return;
    toast.success('Set as default brand kit');
  };

  const handleApplyToProject = () => {
    if (!selectedKit) return;
    toast.success('Brand kit applied to current project');
  };

  // Mock data for initial render
  const mockBrandKits: BrandKit[] = brandKits || [
    {
      id: 'brand-1',
      name: 'Corporate Brand',
      description: 'Official company branding',
      isDefault: true,
      colors: {
        primary: '#2563eb',
        secondary: '#7c3aed',
        accent: '#06b6d4',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#0f172a',
        textSecondary: '#64748b',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      typography: {
        headingFont: 'Inter',
        bodyFont: 'Inter',
        headingSizes: { h1: '48px', h2: '36px', h3: '24px', h4: '18px' },
        bodySize: '16px',
        lineHeight: 1.6,
      },
      logos: [],
      createdAt: '2025-01-01',
      updatedAt: '2025-01-15',
    },
  ];

  return (
    <div className="flex h-full">
      {/* Sidebar - Brand Kit List */}
      <div className="w-64 border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <Palette className="h-5 w-5 text-purple-500" />
            Brand Kits
          </h2>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {mockBrandKits.map((kit) => (
              <button
                key={kit.id}
                onClick={() => setSelectedKit(kit)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                  selectedKit?.id === kit.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-slate-100'
                )}
              >
                <div className="flex -space-x-1">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: kit.colors.primary }}
                  />
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: kit.colors.secondary }}
                  />
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: kit.colors.accent }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{kit.name}</div>
                  {kit.isDefault && (
                    <Badge variant="secondary" className="text-[10px] mt-0.5">
                      Default
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t">
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                New Brand Kit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Brand Kit</DialogTitle>
                <DialogDescription>
                  Start with a new brand kit for your presentations
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="kit-name">Name</Label>
                  <Input
                    id="kit-name"
                    value={newKitName}
                    onChange={(e) => setNewKitName(e.target.value)}
                    placeholder="My Brand Kit"
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate({ name: newKitName })}
                  disabled={!newKitName.trim() || createMutation.isPending}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content - Brand Kit Editor */}
      <div className="flex-1 flex flex-col">
        {selectedKit ? (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{selectedKit.name}</h2>
                <p className="text-sm text-slate-500">
                  {selectedKit.description || 'No description'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSetDefault}>
                  <Check className="h-4 w-4 mr-1" />
                  Set Default
                </Button>
                <Button size="sm" onClick={handleApplyToProject}>
                  <Wand2 className="h-4 w-4 mr-1" />
                  Apply to Project
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                {/* Colors */}
                <section>
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Color Palette
                  </h3>
                  <div className="grid grid-cols-5 gap-4">
                    {(Object.keys(selectedKit.colors) as Array<keyof ColorPalette>).map(
                      (colorKey) => (
                        <div key={colorKey}>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="w-full aspect-square rounded-lg border-2 border-transparent hover:border-slate-300 transition-colors relative group"
                                style={{ backgroundColor: selectedKit.colors[colorKey] }}
                              >
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg">
                                  <Edit className="h-4 w-4 text-white" />
                                </div>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64">
                              <div className="space-y-3">
                                <Label>{colorLabels[colorKey]}</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="color"
                                    value={selectedKit.colors[colorKey]}
                                    onChange={(e) => handleColorChange(colorKey, e.target.value)}
                                    className="w-12 h-10 p-1 cursor-pointer"
                                  />
                                  <Input
                                    value={selectedKit.colors[colorKey]}
                                    onChange={(e) => handleColorChange(colorKey, e.target.value)}
                                    className="font-mono"
                                  />
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <p className="text-xs text-center mt-2 text-slate-600">
                            {colorLabels[colorKey]}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </section>

                <Separator />

                {/* Typography */}
                <section>
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    Typography
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label>Heading Font</Label>
                      <Select
                        value={selectedKit.typography.headingFont}
                        onValueChange={(v) => handleFontChange('headingFont', v)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fontOptions.map((font) => (
                            <SelectItem key={font} value={font}>
                              <span style={{ fontFamily: font }}>{font}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div
                        className="mt-3 p-4 bg-slate-50 rounded-lg"
                        style={{ fontFamily: selectedKit.typography.headingFont }}
                      >
                        <p className="text-2xl font-bold">Heading Preview</p>
                        <p className="text-lg">Subheading Text</p>
                      </div>
                    </div>
                    <div>
                      <Label>Body Font</Label>
                      <Select
                        value={selectedKit.typography.bodyFont}
                        onValueChange={(v) => handleFontChange('bodyFont', v)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fontOptions.map((font) => (
                            <SelectItem key={font} value={font}>
                              <span style={{ fontFamily: font }}>{font}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div
                        className="mt-3 p-4 bg-slate-50 rounded-lg"
                        style={{ fontFamily: selectedKit.typography.bodyFont }}
                      >
                        <p>
                          This is body text that demonstrates how your chosen font
                          will appear in paragraphs and regular content.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Logos */}
                <section>
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Logos
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    {['primary', 'secondary', 'icon', 'wordmark'].map((type) => (
                      <Card key={type} className="relative group">
                        <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px]">
                          <Upload className="h-8 w-8 text-slate-300 mb-2" />
                          <p className="text-sm text-slate-500 capitalize">{type}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Upload
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>

                {/* Preview */}
                <section>
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </h3>
                  <Card>
                    <CardContent className="p-6">
                      <div
                        className="rounded-lg p-8"
                        style={{
                          backgroundColor: selectedKit.colors.background,
                          color: selectedKit.colors.text,
                        }}
                      >
                        <h1
                          className="text-3xl font-bold mb-2"
                          style={{
                            fontFamily: selectedKit.typography.headingFont,
                            color: selectedKit.colors.primary,
                          }}
                        >
                          Presentation Title
                        </h1>
                        <p
                          className="text-lg mb-4"
                          style={{
                            fontFamily: selectedKit.typography.bodyFont,
                            color: selectedKit.colors.textSecondary,
                          }}
                        >
                          Subtitle or description text
                        </p>
                        <p
                          className="mb-4"
                          style={{ fontFamily: selectedKit.typography.bodyFont }}
                        >
                          This is how your body text will appear in presentations.
                          The fonts and colors from your brand kit create a cohesive
                          visual experience.
                        </p>
                        <div className="flex gap-2">
                          <button
                            className="px-4 py-2 rounded-lg text-white"
                            style={{ backgroundColor: selectedKit.colors.primary }}
                          >
                            Primary Button
                          </button>
                          <button
                            className="px-4 py-2 rounded-lg text-white"
                            style={{ backgroundColor: selectedKit.colors.secondary }}
                          >
                            Secondary
                          </button>
                          <button
                            className="px-4 py-2 rounded-lg text-white"
                            style={{ backgroundColor: selectedKit.colors.accent }}
                          >
                            Accent
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <Palette className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-2">Select a Brand Kit</h3>
              <p className="text-slate-500 max-w-md">
                Choose a brand kit from the sidebar or create a new one to define
                your presentation&apos;s visual identity.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
